const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./db');
const path = require('path');

const app = express();

// Configurações
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'segredo_saep_senai',
    resave: false,
    saveUninitialized: true
}));

// Middleware de Autenticação
function verificarAuth(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.redirect('/');
    }
}

// --- ROTA: LOGIN ---
app.get('/', (req, res) => {
    res.render('login', { erro: null });
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    const sql = 'SELECT * FROM usuarios WHERE email = ? AND senha = ?';
    db.query(sql, [email, senha], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.session.usuario = results[0];
            res.redirect('/index');
        } else {
            res.render('login', { erro: 'Usuário ou senha incorretos!' });
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- ROTA: PRINCIPAL ---
app.get('/index', verificarAuth, (req, res) => {
    res.render('index', { usuario: req.session.usuario });
});

// --- ROTA: CADASTRO ---
app.get('/cadastro', verificarAuth, (req, res) => {
    const termo = req.query.busca || '';
    let sql = 'SELECT * FROM produtos';
    if (termo) {
        sql += ` WHERE nome LIKE '%${termo}%' OR marca LIKE '%${termo}%'`;
    }
    db.query(sql, (err, produtos) => {
        if (err) throw err;
        res.render('cadastro', { produtos: produtos, termo: termo });
    });
});

app.post('/cadastro/adicionar', verificarAuth, (req, res) => {
    const { nome, marca, descricao, estoque_minimo } = req.body;
    if (!nome || !marca || !estoque_minimo) {
        return res.send('<script>alert("Preencha os campos obrigatórios!"); window.history.back();</script>');
    }
    const sql = 'INSERT INTO produtos (nome, marca, descricao, quantidade, estoque_minimo) VALUES (?, ?, ?, 0, ?)';
    db.query(sql, [nome, marca, descricao, estoque_minimo], (err) => {
        if (err) throw err;
        res.redirect('/cadastro');
    });
});

app.get('/cadastro/deletar/:id', verificarAuth, (req, res) => {
    const sql = 'DELETE FROM produtos WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/cadastro');
    });
});

// --- ROTA: TELA DE EDIÇÃO DE PRODUTO ---
app.get('/cadastro/editar/:id', verificarAuth, (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM produtos WHERE id = ?';
    
    db.query(sql, [id], (err, results) => {
        if (err) throw err;
        
        if (results.length > 0) {
            // Envia os dados do produto encontrado para a tela de edição
            res.render('editar', { produto: results[0] });
        } else {
            res.redirect('/cadastro');
        }
    });
});

// --- ROTA: PROCESSAR A EDIÇÃO NO BANCO DE DADOS ---
app.post('/cadastro/editar/:id', verificarAuth, (req, res) => {
    const id = req.params.id;
    const { nome, marca, estoque_minimo, descricao } = req.body;
    
    // Comando UPDATE para o MySQL
    const sql = 'UPDATE produtos SET nome = ?, marca = ?, estoque_minimo = ?, descricao = ? WHERE id = ?';
    
    db.query(sql, [nome, marca, estoque_minimo, descricao, id], (err) => {
        if (err) throw err;
        res.redirect('/cadastro'); // Volta para a lista atualizada
    });
});

// --- ROTA: ESTOQUE (COM ALERTA INTELIGENTE E HISTÓRICO) ---
app.get('/estoque', verificarAuth, (req, res) => {
    // 1. Busca Produtos em Ordem Alfabética
    const sqlProdutos = 'SELECT * FROM produtos ORDER BY nome ASC';
    
    db.query(sqlProdutos, (err, produtos) => {
        if (err) throw err;

        // 2. Busca Histórico (JOIN para pegar nome do produto e do usuário)
        const sqlHist = `
            SELECT m.*, p.nome AS nome_produto, u.nome AS nome_usuario 
            FROM movimentacoes m
            JOIN produtos p ON m.produto_id = p.id
            JOIN usuarios u ON m.usuario_id = u.id
            ORDER BY m.data_movimentacao DESC
        `;

        db.query(sqlHist, (err, historico) => {
            if (err) throw err;

            // --- LÓGICA DO ALERTA ---
            // Verifica na lista geral quem está abaixo do mínimo (garantindo que são números)
            const produtosCriticos = produtos.filter(p => parseInt(p.quantidade) < parseInt(p.estoque_minimo));
            
            let mensagemFinal = null;
            let msgUrl = req.query.alerta; // Mensagem que veio do redirecionamento após movimentação

            // Se existem produtos críticos na lista geral
            if (produtosCriticos.length > 0) {
                const nomes = produtosCriticos.map(p => p.nome).join(', ');
                
                if (msgUrl) {
                    // Combina o aviso da movimentação recente com a lista geral
                    mensagemFinal = `${msgUrl} <br><strong>⚠ OUTROS ITENS CRÍTICOS:</strong> Verifique também: ${nomes}`;
                } else {
                    // Se não houve movimentação agora, mostra apenas o aviso geral
                    mensagemFinal = `ATENÇÃO GERAL: Existem itens abaixo do estoque mínimo: <strong>${nomes}</strong>`;
                }
            } else if (msgUrl) {
                mensagemFinal = msgUrl;
            }

            // Renderiza a tela enviando Produtos, Alerta e Histórico
            res.render('estoque', { 
                produtos: produtos, 
                historico: historico, 
                alerta: mensagemFinal 
            });
        });
    });
});

app.post('/estoque/movimentar', verificarAuth, (req, res) => {
    const { produto_id, tipo, quantidade, data_movimentacao } = req.body;
    const qtd = parseInt(quantidade);
    const usuario_id = req.session.usuario.id;

    if (qtd <= 0) return res.send('<script>alert("Quantidade inválida"); window.history.back();</script>');

    db.query('SELECT * FROM produtos WHERE id = ?', [produto_id], (err, results) => {
        if (err) throw err;
        
        // 🌟 NOVA PROTEÇÃO AQUI: Verifica se o produto existe
        if (results.length === 0 || !results[0]) {
             return res.send('<script>alert("Erro: Produto não encontrado!"); window.history.back();</script>');
        }

        const produto = results[0];
        let novaQtd = produto.quantidade;

        if (tipo === 'entrada') {
            novaQtd += qtd;
        } else {
            if (produto.quantidade < qtd) return res.send('<script>alert("Estoque insuficiente!"); window.history.back();</script>');
            novaQtd -= qtd;
        }

        db.query('UPDATE produtos SET quantidade = ? WHERE id = ?', [novaQtd, produto_id], (err) => {
            if (err) throw err;

            // Insere no histórico usando a coluna 'tipo' (conforme seu banco)
            const sqlMov = 'INSERT INTO movimentacoes (produto_id, usuario_id, tipo, quantidade, data_movimentacao) VALUES (?, ?, ?, ?, ?)';

            db.query(sqlMov, [produto_id, usuario_id, tipo, qtd, data_movimentacao], (err) => {
                if (err) throw err;
                
                let msgAlerta = '';
                // Se foi SAÍDA e ficou ABAIXO do mínimo, gera o alerta específico
                if (tipo === 'saida' && novaQtd < produto.estoque_minimo) {
                    msgAlerta = `ATENÇÃO: O produto ${produto.nome} atingiu o nível crítico! (Atual: ${novaQtd})`;
                    res.redirect('/estoque?alerta=' + encodeURIComponent(msgAlerta));
                } else {
                    res.redirect('/estoque');
                }
            });
        });
    });
});

app.listen(3033, () => {
    console.log('Sistema rodando completo em http://localhost:3033');
});