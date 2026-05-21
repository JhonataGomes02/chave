CREATE DATABASE banco_saep_db;
USE banco_saep_db;

-- Tabela de Usuários
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL
);

-- Tabela de Produtos
CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    marca VARCHAR(50),
    descricao TEXT, 
    quantidade INT NOT NULL DEFAULT 0,
    estoque_minimo INT NOT NULL DEFAULT 5
);

-- Tabela de Movimentações (Histórico)
CREATE TABLE movimentacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tipo ENUM('entrada', 'saida') NOT NULL,
    quantidade INT NOT NULL,
    data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Usuários
INSERT INTO usuarios (nome, email, senha) VALUES 
('Administrador', 'admin@senai.br', '123456'),
('Almoxarife 01', 'user1@senai.br', 'senha123'),
('Almoxarife 02', 'user2@senai.br', 'senha456');

-- Produtos (Baseado nos exemplos do Anexo I: Martelo, Chave de Fenda, Furadeira) 
INSERT INTO produtos (nome, marca, descricao, quantidade, estoque_minimo) VALUES 
('Martelo de Unha 16 oz', 'MASTER', 'Perfil Reto com Cabo Tubular', 20, 5),
('Chave de Fenda Cruzada', 'Tramontina', 'Ponta imantada, cabo isolado', 15, 8),
('Furadeira de Impacto', 'Bosch', 'Tensão 220V, Mandril 1/2', 4, 3);

-- Movimentações
INSERT INTO movimentacoes (produto_id, usuario_id, tipo, quantidade, data_movimentacao) VALUES 
(1, 1, 'entrada', 20, NOW()),
(2, 1, 'entrada', 15, NOW()),
(3, 2, 'entrada', 4, NOW());

select * from movimentacoes;

select * from produtos;