-- Script para criar o banco de dados e usuário do FinBot
-- Execute este script como usuário root do MySQL:
-- mysql -u root -p < setup-database.sql
-- Ou conecte ao MySQL e cole o conteúdo abaixo

-- Criar o banco de dados
CREATE DATABASE IF NOT EXISTS finbot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar o usuário (se não existir)
CREATE USER IF NOT EXISTS 'finbot'@'localhost' IDENTIFIED BY 'finbot_password';

-- Dar todas as permissões ao usuário no banco de dados
GRANT ALL PRIVILEGES ON finbot.* TO 'finbot'@'localhost';

-- Aplicar as mudanças
FLUSH PRIVILEGES;

-- Mostrar confirmação
SELECT 'Banco de dados finbot criado com sucesso!' AS Status;
SELECT User, Host FROM mysql.user WHERE User = 'finbot';

