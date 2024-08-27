import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import cors from "cors";
import session from "express-session";

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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cors());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

app.use(
    session({
        secret: "joaoBispoSouza", // Troque por uma chave secreta forte
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }, // Para produção, mude para true se estiver usando HTTPS
    })
);

app.get("/", async (req, res) => {
    if (req.session.usuario) {
        res.redirect("/logado");
    } else {
        return res.render("homepage.ejs");
    }
});
app.get("/register", (req, res) => {
    req.session.usuario = null;
    req.session.wrongPass = false;
    req.session.wrongUser = false;
    req.session.userExists = false;
    return res.render("register.ejs", { userExists: req.session.userExists });
});

app.get("/login", (req, res) => {
    req.session.wrongPass = false;
    req.session.wrongUser = false;
    req.session.userExists = false;
    console.log("Usuário atual no GET: ", req.session.usuario);
    if (req.session.usuario) {
        return res.redirect("/logado");
    }
    return res.render("login.ejs", {
        wrongPass: req.session.wrongPass,
        wrongUser: req.session.wrongUser,
    });
});

app.post("/login", async (req, res) => {
    console.log("Usuário atual: ", req.session.usuario);

    if (req.session.usuario) {
        console.log(req.session.usuario);
        return res.redirect("/logado");
    } else {
        const result = await db.query(
            "SELECT * FROM journalfsuser WHERE usuario = $1",
            [req.body.usuario.trim()]
        );
        const data = result.rows[0];

        if (data) {
            if (data.senha === req.body.senha) {
                req.session.usuario = data;
                return res.redirect("/logado");
            } else {
                console.log("senha incorreta");
                req.session.wrongPass = true;
                req.session.wrongUser = false;
                return res.render("login.ejs", {
                    wrongPass: req.session.wrongPass,
                    wrongUser: req.session.wrongUser,
                });
            }
        } else {
            console.log("usuário inválido");
            req.session.wrongPass = false;
            req.session.wrongUser = true;
            return res.render("login.ejs", {
                wrongUser: req.session.wrongUser,
                wrongPass: req.session.wrongPass,
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
        req.session.usuario = data;
        return res.redirect("/login");
    } else {
        userExists = true;
        return res.render("register.ejs", {
            userExists: req.session.userExists,
        });
    }
});

app.get("/logado", async (req, res) => {
    if (req.session.usuario) {
        req.session.userExists = false;
        req.session.wrongPass = false;
        req.session.wrongUser = false;
        console.log(req.session.usuario);
        const result = await db.query(
            "SELECT * FROM journalfs WHERE user_id = $1 ORDER BY datapost DESC, id DESC",
            [req.session.usuario.id]
        );
        const data = result.rows;

        const result1 = await db.query(
            "SELECT * FROM journalpastasfs WHERE user_id = $1",
            [req.session.usuario.id]
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

        return res.render("home.ejs", {
            data: data,
            data1: data1,
            datasArr: datasArr,
            usuario: req.session.usuario,
        });
    } else {
        return res.redirect("/login");
    }
});

app.get("/my-account", async (req, res) => {
    if (req.session.usuario) {
        const result = await db.query(
            "SELECT titulo FROM journalfs WHERE user_id = $1",
            [req.session.usuario.id]
        );
        const data = result.rows.map((el) => el.titulo).length;

        const result1 = await db.query(
            "SELECT nomepasta FROM journalpastasfs WHERE user_id = $1",
            [req.session.usuario.id]
        );
        const data1 = result1.rows.map((el) => el.nomepasta).length;

        const fName = req.session.usuario.nome.split(" ")[0];
        const nome = fName[0].toUpperCase() + fName.slice(1);

        return res.render("myaccount.ejs", {
            pastas: data1,
            posts: data,
            usuario: req.session.usuario,
            nome: nome,
        });
    } else {
        return res.redirect("/");
    }
});

app.post("/deletar-conta", (req, res) => {
    const userId = req.body.userId;
    db.query("DELETE FROM journalfs WHERE user_id = $1", [userId]);
    db.query("DELETE FROM journalpastasfs WHERE user_id = $1", [userId]);
    db.query("DELETE FROM journalfsuser WHERE id = $1", [userId]);

    req.session.destroy((err) => {
        if (err) {
            return res.redirect("/logado");
        }
        res.clearCookie("connect.sid");
        res.redirect("/");
    });

    return res.redirect("/");
});

app.post("/deletar-pasta", (req, res) => {
    db.query(
        "DELETE FROM journalpastasfs WHERE nomepasta = $1 AND user_id = $2",
        [req.body.pastaDeletada, req.session.usuario.id]
    );
    db.query("DELETE FROM journalfs WHERE pasta = $1 AND user_id = $2", [
        req.body.pastaDeletada,
        req.session.usuario.id,
    ]);
    return res.redirect("/logado");
});

app.post("/add-pasta", (req, res) => {
    db.query(
        "INSERT INTO journalpastasfs (nomepasta, user_id) VALUES ($1, $2)",
        [
            req.body.novapasta.toLowerCase().trim() || "Todos",
            req.session.usuario.id,
        ]
    );
    return res.redirect("/logado");
});

app.post("/add", (req, res) => {
    const pastaAtual = req.body.pastaAtual;
    db.query(
        "INSERT INTO journalfs (titulo, autor, datapost, user_id, pasta) VALUES($1,$2,$3,$4, $5)",
        [
            "Sem título",
            "Desconhecido",
            new Date(),
            req.session.usuario.id,
            pastaAtual,
        ]
    );

    return res.redirect("/login");
});

app.post("/delete", (req, res) => {
    db.query("DELETE FROM journalfs WHERE id = $1", [req.body.idAtual]);
    return res.redirect("/login");
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

    return res.redirect("/login");
});

app.get("/deslogar", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect("/logado");
        }
        res.clearCookie("connect.sid");
        return res.redirect("/");
    });
});

app.get("/view", async (req, res) => {
    if (req.session.usuario && req.session.postAtual) {
        const result = await db.query("SELECT * FROM journalfs WHERE id = $1", [
            req.session.postAtual,
        ]);
        const data = result.rows[0];

        return res.render("verpost.ejs", { data: data });
    }
});

app.post("/view", async (req, res) => {
    if (req.session.usuario) {
        req.session.postAtual = req.body.idAtual;
        const result = await db.query("SELECT * FROM journalfs WHERE id = $1", [
            req.body.idAtual,
        ]);
        const data = result.rows[0];

        return res.render("verpost.ejs", { data: data });
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

    return res.redirect("/logado");
});

app.listen(port, () => {
    console.log(`Server on port ${port}`);
});
