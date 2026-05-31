from fastmcp import FastMCP

# Cria a instância do servidor MCP
mcp = FastMCP("Bolsinho_Tools")

@mcp.tool
def somar_gastos(gastos: list[float]) -> float:
    """Soma uma lista de valores de gastos e retorna o total exato."""
    return sum(gastos)

@mcp.tool
def obter_gasto_por_categoria(categoria: str) -> str:
    """Obtém o total gasto pelo usuário em uma categoria específica neste mês."""
    # No futuro, aqui você faria a busca real no MySQL!
    # Por enquanto, criamos um banco de dados simulado em memória:
    banco_simulado = {
        "alimentacao": 450.50,
        "transporte": 150.00,
        "lazer": 320.00,
        "educacao": 1200.00
    }
    
    categoria_formatada = categoria.lower()
    if categoria_formatada in banco_simulado:
        return f"O gasto na categoria '{categoria_formatada}' foi de R$ {banco_simulado[categoria_formatada]:.2f}."
    
    return f"Nenhum gasto registrado na categoria '{categoria}'."

@mcp.tool
def adicionar_gasto(descricao: str, valor: float, categoria: str) -> str:
    """Registra uma nova despesa no banco de dados do usuário."""
    # Lógica futura de INSERT no banco
    return f"Sucesso! O gasto '{descricao}' no valor de R$ {valor:.2f} foi adicionado à categoria '{categoria}'."

if __name__ == "__main__":
    # Inicia o servidor MCP localmente para testes
    print("Servidor de Ferramentas MCP do Bolsinho rodando...")
    mcp.run()