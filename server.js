import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
const port = 3000;
const db = new pg.Client({
    connectionString:
        "postgres://default:Ef7gRnhwbD9B@ep-bold-limit-a48ldweb.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require",
});
db.connect();

import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let usuario;
let wrongPass = false;
let wrongUser = false;
let userExists = false;
let postAtual = false;
let pastaatual = "Todos";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cors());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

app.get("/", async (req, res) => {
    if (usuario) {
        res.redirect("/logado");
    } else {
        res.render("homepage.ejs");
    }
});
app.get("/register", (req, res) => {
    wrongPass = false;
    wrongUser = false;
    userExists = false;
    res.render("register.ejs", { userExists: userExists });
});

app.get("/login", (req, res) => {
    userExists = false;
    wrongPass = false;
    wrongUser = false;
    console.log("Usuário atual no GET: ", usuario);
    if (usuario) {
        res.redirect("/logado");
    }
    res.render("login.ejs", { wrongPass: wrongPass, wrongUser: wrongUser });
});

app.post("/login", async (req, res) => {
    console.log("Usuário atual: ", usuario);

    if (usuario) {
        console.log(usuario);
        res.redirect("/logado");
    } else {
        const result = await db.query(
            "SELECT * FROM journalfsuser WHERE usuario = $1",
            [req.body.usuario.trim()]
        );
        const data = result.rows[0];

        if (data) {
            if (data.senha === req.body.senha) {
                usuario = data;
                res.redirect("/logado");
            } else {
                console.log("senha incorreta");
                wrongPass = true;
                wrongUser = false;
                res.render("login.ejs", {
                    wrongPass: wrongPass,
                    wrongUser: wrongUser,
                });
            }
        } else {
            console.log("usuário inválido");
            wrongPass = false;
            wrongUser = true;
            res.render("login.ejs", {
                wrongUser: wrongUser,
                wrongPass: wrongPass,
            });
        }
    }
});

app.post("/register", async (req, res) => {
    const usuarioReq = req.body.usuario.trim();
    //const senha = req.body.senha.trim()

    const result = await db.query(
        "SELECT usuario FROM journalfsuser WHERE usuario = $1",
        [usuarioReq]
    );
    const data = result.rows[0];

    if (!data) {
        db.query(
            "INSERT INTO journalfsuser (usuario, senha, nome) VALUES ($1, $2, $3)",
            [usuarioReq, req.body.senha, req.body.nome]
        );
        const result = await db.query(
            "SELECT * FROM journalfsuser WHERE usuario = $1",
            [usuarioReq]
        );
        const data = result.rows[0];
        usuario = data;
        res.redirect("/login");
    } else {
        userExists = true;
        res.render("register.ejs", { userExists: userExists });
    }
});

app.get("/logado", async (req, res) => {
    if (usuario) {
        userExists = false;
        wrongPass = false;
        wrongUser = false;
        console.log(usuario);
        const result = await db.query(
            "SELECT * FROM journalfs WHERE user_id = $1 ORDER BY datapost DESC, id DESC",
            [usuario.id]
        );
        const data = result.rows;

        const result1 = await db.query(
            "SELECT * FROM journalpastasfs WHERE user_id = $1",
            [usuario.id]
        );
        const data1 = result1.rows;

        console.log(data);

        const datas = data.map((el) => el.datapost);
        const datasArr = [];

        datas.forEach((data) => {
            let dataF = data.toLocaleDateString("pt-br", {
                year: "2-digit",
                month: "2-digit",
                day: "2-digit",
            });

            datasArr.push(dataF);
        });

        console.log(datasArr);

        res.render("home.ejs", {
            data: data,
            data1: data1,
            datasArr: datasArr,
            usuario: usuario,
        });
    } else {
        res.redirect("/login");
    }
});

app.get("/my-account", async (req, res) => {
    const result = await db.query(
        "SELECT titulo FROM journalfs WHERE user_id = $1",
        [usuario.id]
    );
    const data = result.rows.map((el) => el.titulo).length;

    const result1 = await db.query(
        "SELECT nomepasta FROM journalpastasfs WHERE user_id = $1",
        [usuario.id]
    );
    const data1 = result1.rows.map((el) => el.nomepasta).length;

    const fName = usuario.nome.split(" ")[0];
    const nome = fName[0].toUpperCase() + fName.slice(1);

    res.render("myaccount.ejs", {
        pastas: data1,
        posts: data,
        usuario: usuario,
        nome: nome,
    });
});

app.post("/deletar-conta", (req, res) => {
    const userId = req.body.userId;
    db.query("DELETE FROM journalfs WHERE user_id = $1", [userId]);
    db.query("DELETE FROM journalpastasfs WHERE user_id = $1", [userId]);
    db.query("DELETE FROM journalfsuser WHERE id = $1", [userId]);

    usuario = null;

    res.redirect("/");
});

app.post("/deletar-pasta", (req, res) => {
    db.query(
        "DELETE FROM journalpastasfs WHERE nomepasta = $1 AND user_id = $2",
        [req.body.pastaDeletada, usuario.id]
    );
    db.query("DELETE FROM journalfs WHERE pasta = $1 AND user_id = $2", [
        req.body.pastaDeletada,
        usuario.id,
    ]);
    res.redirect("/logado");
});

app.post("/add-pasta", (req, res) => {
    db.query(
        "INSERT INTO journalpastasfs (nomepasta, user_id) VALUES ($1, $2)",
        [req.body.novapasta.toLowerCase().trim(), usuario.id]
    );
    res.redirect("/logado");
});

app.get("/pasta", (req, res) => {
    pastaatual = req.query.pastaatual;
    console.log(pastaatual);
});

app.post("/add", (req, res) => {
    const pastaAtual = req.body.pastaAtual;
    db.query(
        "INSERT INTO journalfs (titulo, autor, datapost, user_id, pasta) VALUES($1,$2,$3,$4, $5)",
        ["Sem título", "Desconhecido", new Date(), usuario.id, pastaAtual]
    );

    res.redirect("/login");
});

app.post("/delete", (req, res) => {
    db.query("DELETE FROM journalfs WHERE id = $1", [req.body.idAtual]);
    res.redirect("/login");
});

app.post("/edit", async (req, res) => {
    const result = await db.query("SELECT * FROM journalfs WHERE id = $1", [
        req.body.idAtual,
    ]);
    const data = result.rows[0];

    const titulo = req.body.tituloEd || data.titulo;
    const texto = req.body.textoEd || data.texto;
    const autor = req.body.autorEd || data.autor;
    const datapost = req.body.datapostEd || data.datapost;

    db.query(
        "UPDATE journalfs SET titulo = $1, texto = $2, autor = $3, datapost = $4 WHERE id = $5",
        [titulo, texto, autor, datapost, req.body.idAtual]
    );

    res.redirect("/login");
});

app.get("/deslogar", (req, res) => {
    usuario = null;
    res.redirect("/");
});

app.get("/view", async (req, res) => {
    if (usuario && postAtual) {
        const result = await db.query("SELECT * FROM journalfs WHERE id = $1", [
            postAtual,
        ]);
        const data = result.rows[0];

        res.render("verpost.ejs", { data: data });
    }
});

app.post("/view", async (req, res) => {
    if (usuario) {
        postAtual = req.body.idAtual;
        const result = await db.query("SELECT * FROM journalfs WHERE id = $1", [
            req.body.idAtual,
        ]);
        const data = result.rows[0];

        res.render("verpost.ejs", { data: data });
    }
});

app.get("/salvar", async (req, res) => {
    const id = req.query.id;
    console.log(id, !!id);
    console.log(req.query.texto);

    const result = await db.query("SELECT * FROM journalfs WHERE id = $1", [
        id,
    ]);
    const data = result.rows[0];

    const titulo = req.query.titulo || data.titulo;
    const texto = req.query.texto || data.texto;
    const autor = req.query.autor || data.autor;

    db.query(
        "UPDATE journalfs SET titulo = $1, texto = $2, autor = $3 WHERE id = $4",
        [titulo, texto, autor, id]
    );

    res.json("Alterado");
});

app.get("/deletar", (req, res) => {
    const selecionados = req.query.selecionados
        .split(",")
        .map((el) => Number(el));
    console.log(selecionados);

    selecionados.forEach((el) => {
        db.query("DELETE FROM journalfs WHERE id = $1", [el]);
    });
});

app.get("/mover", (req, res) => {
    const selecionados = req.query.selecionados
        .split(",")
        .map((el) => Number(el));
    console.log(selecionados);

    selecionados.forEach((el) => {
        db.query("UPDATE journalfs SET pasta = $1 WHERE id = $2", [
            req.query.pasta,
            el,
        ]);
    });

    res.redirect("/logado");
});

app.listen(port, () => {
    console.log(`Server on port ${port}`);
});