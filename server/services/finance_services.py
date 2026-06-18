import os
import re
from datetime import datetime

# Contexto do usuário atual — definido antes de cada chamada de ferramenta
_current_user_id: int | None = None


def set_user_context(user_id: int) -> None:
    """Define o usuário cujas ferramentas devem operar."""
    global _current_user_id
    _current_user_id = user_id


def _parse_database_url(url: str) -> dict:
    match = re.match(
        r'mysql(?:\+pymysql)?://([^:]*):([^@]*)@([^:/]+):?(\d+)?/([^?]+)',
        url,
    )
    if not match:
        raise RuntimeError("Formato de DATABASE_URL inválido")
    user, password, host, port, database = match.groups()
    return {
        'host': host,
        'user': user,
        'password': password,
        'database': database.split('?')[0],
        'port': int(port) if port else 3306,
    }


def _get_connection():
    import pymysql
    import pymysql.cursors
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL não configurada")
    params = _parse_database_url(url)
    return pymysql.connect(
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        **params,
    )


def _get_or_create_category(conn, user_id: int, categoria: str) -> int | None:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id FROM categories
               WHERE (userId = %s OR isDefault = 1) AND LOWER(name) = LOWER(%s)
               ORDER BY userId DESC LIMIT 1""",
            (user_id, categoria),
        )
        row = cur.fetchone()
        if row:
            return row['id']
        cur.execute(
            "INSERT INTO categories (name, type, userId, isDefault, createdAt) VALUES (%s, 'expense', %s, 0, NOW())",
            (categoria, user_id),
        )
        conn.commit()
        return cur.lastrowid


# ---------------------------------------------------------------------------
# Ferramentas expostas ao modelo via function calling
# ---------------------------------------------------------------------------

def adicionar_gasto(descricao: str, valor: float, categoria: str) -> str:
    """Registra uma nova despesa no banco de dados do usuário."""
    if _current_user_id is None:
        return "Erro: usuário não identificado. Não foi possível salvar o gasto."
    try:
        conn = _get_connection()
        try:
            category_id = _get_or_create_category(conn, _current_user_id, categoria)
            amount_cents = int(round(valor * 100))
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO transactions
                       (userId, categoryId, amount, description, type, date, createdAt, updatedAt)
                       VALUES (%s, %s, %s, %s, 'expense', NOW(), NOW(), NOW())""",
                    (_current_user_id, category_id, amount_cents, descricao),
                )
                conn.commit()
        finally:
            conn.close()
        return f"✅ Gasto registrado: '{descricao}' de R$ {valor:.2f} na categoria '{categoria}'."
    except Exception as e:
        return f"Erro ao registrar gasto: {e}"


def obter_gasto_por_categoria(categoria: str) -> str:
    """Obtém o total gasto em uma categoria específica no mês atual."""
    if _current_user_id is None:
        return "Erro: usuário não identificado."
    try:
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT SUM(t.amount) AS total, COUNT(*) AS cnt
                       FROM transactions t
                       LEFT JOIN categories c ON t.categoryId = c.id
                       WHERE t.userId = %s
                         AND t.type = 'expense'
                         AND MONTH(t.date) = MONTH(NOW())
                         AND YEAR(t.date)  = YEAR(NOW())
                         AND LOWER(c.name) = LOWER(%s)""",
                    (_current_user_id, categoria),
                )
                row = cur.fetchone()
        finally:
            conn.close()
        if row and row['total']:
            return f"Você gastou R$ {row['total']/100:.2f} em '{categoria}' este mês ({row['cnt']} transação(ões))."
        return f"Nenhum gasto registrado em '{categoria}' este mês."
    except Exception as e:
        return f"Erro ao consultar gastos: {e}"


def somar_gastos(gastos: list) -> float:
    """Soma uma lista de valores de gastos e retorna o total exato."""
    return sum(gastos)


def listar_gastos(limite: int = 10) -> str:
    """Lista as transações mais recentes do usuário."""
    if _current_user_id is None:
        return "Erro: usuário não identificado."
    try:
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT t.description, t.amount, t.type, t.date,
                              COALESCE(c.name, 'sem categoria') AS categoria
                       FROM transactions t
                       LEFT JOIN categories c ON t.categoryId = c.id
                       WHERE t.userId = %s
                       ORDER BY t.date DESC LIMIT %s""",
                    (_current_user_id, limite),
                )
                rows = cur.fetchall()
        finally:
            conn.close()
        if not rows:
            return "Nenhuma transação encontrada."
        lines = [f"Últimas {len(rows)} transações:"]
        for r in rows:
            sinal = "+" if r['type'] == 'income' else "-"
            data = r['date'].strftime('%d/%m') if r['date'] else '?'
            lines.append(f"  {data} | {sinal}R$ {r['amount']/100:.2f} | {r['description']} ({r['categoria']})")
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao listar gastos: {e}"


def obter_resumo_financeiro() -> str:
    """Retorna o total de gastos do mês atual agrupados por categoria."""
    if _current_user_id is None:
        return "Erro: usuário não identificado."
    try:
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT COALESCE(c.name, 'sem categoria') AS categoria,
                              SUM(t.amount) AS total, COUNT(*) AS cnt
                       FROM transactions t
                       LEFT JOIN categories c ON t.categoryId = c.id
                       WHERE t.userId = %s
                         AND t.type = 'expense'
                         AND MONTH(t.date) = MONTH(NOW())
                         AND YEAR(t.date)  = YEAR(NOW())
                       GROUP BY c.id, c.name
                       ORDER BY total DESC""",
                    (_current_user_id,),
                )
                rows = cur.fetchall()
        finally:
            conn.close()
        if not rows:
            return "Nenhum gasto registrado este mês."
        total_geral = sum(r['total'] for r in rows)
        mes = datetime.now().strftime('%B/%Y')
        lines = [f"Resumo de {mes} — Total: R$ {total_geral/100:.2f}"]
        for r in rows:
            pct = (r['total'] / total_geral) * 100
            lines.append(f"  {r['categoria']}: R$ {r['total']/100:.2f} ({pct:.1f}%)")
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao gerar resumo: {e}"
