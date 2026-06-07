#!/usr/bin/env python3
"""CLI wrapper para news_service"""

import sys
import json
import os
from news_service import get_news_service

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)
    
    try:
        # Verifica se a API key está configurada
        if not os.getenv("NEWS_API_KEY"):
            error_msg = "NEWS_API_KEY não configurada. Configure a variável de ambiente NEWS_API_KEY no arquivo .env com sua chave da NewsAPI (https://newsapi.org/)"
            print(json.dumps({"error": error_msg}, ensure_ascii=False))
            sys.exit(1)
        
        # Obtém a instância do serviço (cria apenas quando necessário)
        news_service = get_news_service()
        
        request = json.loads(sys.argv[1])
        method = request.get("method")
        args = request.get("args", [])
        
        if method == "get_top_headlines":
            category = args[0] if len(args) > 0 else "business"
            country = args[1] if len(args) > 1 else "br"
            page_size = args[2] if len(args) > 2 else 20
            result = news_service.get_top_headlines(category, country, page_size)
            
        elif method == "search_news":
            query = args[0]
            options = args[1] if len(args) > 1 else {}
            result = news_service.search_news(query, **options)
            
        elif method == "get_investment_news":
            asset_type = args[0] if len(args) > 0 else None
            page_size = args[1] if len(args) > 1 else 20
            result = news_service.get_investment_news(asset_type, page_size)
            
        elif method == "get_sector_news":
            sector = args[0]
            page_size = args[1] if len(args) > 1 else 20
            result = news_service.get_sector_news(sector, page_size)
            
        elif method == "get_market_indicators_news":
            page_size = args[0] if len(args) > 0 else 15
            result = news_service.get_market_indicators_news(page_size)
            
        elif method == "analyze_news_impact":
            news_list = args[0]
            portfolio_sectors = args[1] if len(args) > 1 else None
            result = news_service.analyze_news_impact(news_list, portfolio_sectors)
            
        else:
            result = {"error": f"Unknown method: {method}"}
        
        print(json.dumps(result, ensure_ascii=False))
        
    except ValueError as e:
        # Erro de configuração (API key não configurada)
        error_msg = str(e)
        if "NEWS_API_KEY" in error_msg:
            error_msg += " Configure a variável de ambiente NEWS_API_KEY no arquivo .env com sua chave da NewsAPI (https://newsapi.org/)"
        print(json.dumps({"error": error_msg}, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        # Outros erros (erros da API, etc.)
        import traceback
        error_msg = f"Erro ao buscar notícias: {str(e)}"
        print(json.dumps({"error": error_msg, "details": traceback.format_exc()}, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
