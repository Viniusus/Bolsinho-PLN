@echo off
echo ============================================
echo Setup do Banco de Dados FinBot
echo ============================================
echo.
echo Este script vai criar o banco de dados 'finbot' e o usuario 'finbot'
echo Voce precisara da senha do usuario ROOT do MySQL
echo.
pause

echo Executando script SQL...
mysql -u root -p < setup-database.sql

if %ERRORLEVEL% == 0 (
    echo.
    echo ============================================
    echo Banco de dados criado com sucesso!
    echo ============================================
    echo.
    echo Agora execute: pnpm db:push
) else (
    echo.
    echo ============================================
    echo Erro ao criar o banco de dados
    echo ============================================
    echo.
    echo Possiveis causas:
    echo - MySQL nao esta rodando
    echo - Senha do root incorreta
    echo - Usuario nao tem permissoes
    echo.
    echo Tente executar manualmente:
    echo mysql -u root -p
    echo Depois cole o conteudo de setup-database.sql
)

pause

