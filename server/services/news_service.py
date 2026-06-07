#!/usr/bin/env python3
"""
Serviço de notícias financeiras usando NewsAPI.
"""

import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from newsapi import NewsApiClient


class NewsService:
    """Serviço para busca de notícias financeiras."""
    
    def __init__(self):
        """Inicializa o cliente NewsAPI."""
        api_key = os.getenv("NEWS_API_KEY")
        if not api_key:
            raise ValueError(
                "NEWS_API_KEY não configurada. "
                "Configure a variável de ambiente NEWS_API_KEY no arquivo .env. "
                "Obtenha sua chave em: https://newsapi.org/register"
            )
        
        try:
            self.client = NewsApiClient(api_key=api_key)
        except Exception as e:
            raise ValueError(f"Erro ao inicializar NewsAPI: {str(e)}")
        
        # Fontes brasileiras de notícias financeiras
        self.brazilian_sources = [
            "infomoney",
            "valor-economico", 
            "exame"
        ]
    
    def _check_api_status(self):
        """Verifica o status da API e retorna informações úteis."""
        try:
            # Testa com uma busca simples
            test_response = self.client.get_everything(
                q="economia",
                language="pt",
                page_size=1,
                sort_by="publishedAt"
            )
            return {
                "status": test_response.get("status"),
                "total_results": test_response.get("totalResults", 0),
                "working": test_response.get("status") == "ok"
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "working": False
            }
    
    def get_top_headlines(
        self,
        category: str = "business",
        country: str = "br",
        page_size: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Busca principais manchetes financeiras.
        
        Args:
            category: Categoria de notícias
            country: Código do país (br para Brasil)
            page_size: Número de resultados
            
        Returns:
            Lista de notícias
        """
        try:
            response = self.client.get_top_headlines(
                category=category,
                country=country,
                page_size=page_size
            )
            
            # Verifica o status da resposta
            status = response.get("status")
            if status == "error":
                error_code = response.get("code")
                error_message = response.get("message", "Erro desconhecido")
                return [{"error": f"Erro da API: {error_message}", "code": error_code}]
            
            articles = response.get("articles", [])
            if not articles:
                # Se não houver notícias no top_headlines, tenta usar search_news como fallback
                # Isso é útil porque a NewsAPI gratuita tem limitações no endpoint top_headlines
                try:
                    fallback_query = "financeiro OR economia OR mercado" if category == "business" else category
                    fallback_result = self.search_news(fallback_query, language="pt", page_size=page_size)
                    if fallback_result and len(fallback_result) > 0 and "error" not in fallback_result[0]:
                        return fallback_result
                except:
                    pass
                
                # Se o fallback também falhou, retorna erro
                total_results = response.get("totalResults", 0)
                if total_results == 0:
                    return [{"error": f"Nenhuma notícia encontrada para {category} no país {country}. Tente usar search_news com uma busca específica.", "status": status}]
                else:
                    return [{"error": "Nenhuma notícia retornada pela API", "status": status, "totalResults": total_results}]
            
            return self._format_articles(articles)
        except Exception as e:
            error_msg = str(e)
            # Verifica se é um erro de API (rate limit, invalid key, etc.)
            if "401" in error_msg or "Unauthorized" in error_msg:
                return [{"error": "API Key inválida. Verifique se a NEWS_API_KEY está correta no arquivo .env"}]
            elif "429" in error_msg or "rate limit" in error_msg.lower():
                return [{"error": "Limite de requisições excedido. Aguarde um momento antes de tentar novamente."}]
            elif "400" in error_msg:
                return [{"error": f"Erro na requisição: {error_msg}"}]
            else:
                return [{"error": f"Erro ao buscar notícias: {error_msg}"}]
    
    def search_news(
        self,
        query: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        language: str = "pt",
        sort_by: str = "relevancy",
        page_size: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Busca notícias por palavra-chave.
        
        Args:
            query: Termo de busca
            from_date: Data inicial
            to_date: Data final
            language: Idioma das notícias
            sort_by: Ordenação (relevancy, popularity, publishedAt)
            page_size: Número de resultados
            
        Returns:
            Lista de notícias
        """
        try:
            # Define período padrão (últimos 30 dias para mais resultados)
            if not from_date:
                from_date = datetime.now() - timedelta(days=30)
            if not to_date:
                to_date = datetime.now()
            
            # Limita o período máximo para evitar erros da API
            max_days = 30
            days_diff = (to_date - from_date).days
            if days_diff > max_days:
                from_date = to_date - timedelta(days=max_days)
            
            response = self.client.get_everything(
                q=query,
                from_param=from_date.strftime("%Y-%m-%d"),
                to=to_date.strftime("%Y-%m-%d"),
                language=language,
                sort_by=sort_by,
                page_size=min(page_size, 100)  # Limite máximo da API
            )
            
            # Verifica o status da resposta
            status = response.get("status")
            if status == "error":
                error_code = response.get("code")
                error_message = response.get("message", "Erro desconhecido")
                return [{"error": f"Erro da API: {error_message}", "code": error_code}]
            
            articles = response.get("articles", [])
            total_results = response.get("totalResults", 0)
            
            if not articles:
                if total_results == 0:
                    return [{"error": f"Nenhuma notícia encontrada para a busca: {query}", "status": status}]
                else:
                    return [{"error": "Nenhuma notícia retornada pela API", "status": status, "totalResults": total_results}]
            
            return self._format_articles(articles)
        except Exception as e:
            error_msg = str(e)
            # Verifica se é um erro de API (rate limit, invalid key, etc.)
            if "401" in error_msg or "Unauthorized" in error_msg:
                return [{"error": "API Key inválida. Verifique se a NEWS_API_KEY está correta no arquivo .env"}]
            elif "429" in error_msg or "rate limit" in error_msg.lower():
                return [{"error": "Limite de requisições excedido. Aguarde um momento antes de tentar novamente."}]
            elif "400" in error_msg:
                return [{"error": f"Erro na requisição: {error_msg}"}]
            else:
                return [{"error": f"Erro ao buscar notícias: {error_msg}"}]
    
    def get_investment_news(
        self,
        asset_type: Optional[str] = None,
        page_size: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Busca notícias sobre investimentos.
        
        Args:
            asset_type: Tipo de ativo (acoes, fundos, cripto, renda_fixa)
            page_size: Número de resultados
            
        Returns:
            Lista de notícias
        """
        queries = {
            "acoes": "ações OR bolsa OR B3 OR Ibovespa",
            "fundos": "fundos de investimento OR fundos imobiliários OR FII",
            "cripto": "criptomoedas OR bitcoin OR ethereum OR crypto",
            "renda_fixa": "renda fixa OR tesouro direto OR CDB OR LCI",
            None: "investimentos OR mercado financeiro OR economia"
        }
        
        query = queries.get(asset_type, queries[None])
        return self.search_news(query, page_size=page_size)
    
    def get_sector_news(
        self,
        sector: str,
        page_size: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Busca notícias por setor econômico.
        
        Args:
            sector: Setor (tecnologia, energia, saude, financeiro, etc.)
            page_size: Número de resultados
            
        Returns:
            Lista de notícias
        """
        sector_queries = {
            "tecnologia": "tecnologia OR tech OR startups OR inovação",
            "energia": "energia OR petróleo OR Petrobras OR energia renovável",
            "saude": "saúde OR farmacêutica OR hospitais",
            "financeiro": "bancos OR fintech OR sistema financeiro",
            "varejo": "varejo OR e-commerce OR consumo",
            "agronegocio": "agronegócio OR agricultura OR commodities",
            "construcao": "construção civil OR imóveis OR incorporadoras"
        }
        
        query = sector_queries.get(sector.lower(), sector)
        return self.search_news(query, page_size=page_size)
    
    def get_market_indicators_news(self, page_size: int = 15) -> List[Dict[str, Any]]:
        """
        Busca notícias sobre indicadores de mercado.
        
        Args:
            page_size: Número de resultados
            
        Returns:
            Lista de notícias
        """
        query = "Ibovespa OR dólar OR SELIC OR inflação OR IPCA OR PIB"
        return self.search_news(query, page_size=page_size)
    
    def analyze_news_impact(
        self,
        news_list: List[Dict[str, Any]],
        portfolio_sectors: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Analisa o impacto potencial de notícias no portfólio.
        
        Args:
            news_list: Lista de notícias
            portfolio_sectors: Setores do portfólio do usuário
            
        Returns:
            Análise de impacto
        """
        if not portfolio_sectors:
            portfolio_sectors = []
        
        # Análise básica de sentimento por palavras-chave
        positive_keywords = [
            "crescimento", "lucro", "alta", "valorização", "expansão",
            "otimista", "positivo", "recuperação", "ganho"
        ]
        
        negative_keywords = [
            "queda", "prejuízo", "crise", "recessão", "baixa",
            "pessimista", "negativo", "perda", "declínio"
        ]
        
        analysis = {
            "total_news": len(news_list),
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
            "relevant_to_portfolio": [],
            "sentiment_score": 0.0
        }
        
        for news in news_list:
            title = news.get("title", "").lower()
            description = news.get("description", "").lower()
            content = f"{title} {description}"
            
            # Análise de sentimento simples
            positive_score = sum(1 for kw in positive_keywords if kw in content)
            negative_score = sum(1 for kw in negative_keywords if kw in content)
            
            if positive_score > negative_score:
                analysis["positive_count"] += 1
                sentiment = "positivo"
            elif negative_score > positive_score:
                analysis["negative_count"] += 1
                sentiment = "negativo"
            else:
                analysis["neutral_count"] += 1
                sentiment = "neutro"
            
            # Verifica relevância para o portfólio
            for sector in portfolio_sectors:
                if sector.lower() in content:
                    analysis["relevant_to_portfolio"].append({
                        "title": news.get("title"),
                        "sector": sector,
                        "sentiment": sentiment,
                        "url": news.get("url")
                    })
        
        # Calcula score geral de sentimento (-1 a 1)
        total = analysis["total_news"]
        if total > 0:
            analysis["sentiment_score"] = (
                (analysis["positive_count"] - analysis["negative_count"]) / total
            )
        
        return analysis
    
    def _format_articles(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Formata artigos para um formato consistente.
        
        Args:
            articles: Lista de artigos da API
            
        Returns:
            Lista de artigos formatados
        """
        formatted = []
        
        for article in articles:
            formatted.append({
                "title": article.get("title"),
                "description": article.get("description"),
                "url": article.get("url"),
                "source": article.get("source", {}).get("name"),
                "published_at": article.get("publishedAt"),
                "image_url": article.get("urlToImage"),
                "content": article.get("content")
            })
        
        return formatted


# Instância global do serviço (inicializada apenas quando necessário)
news_service = None

def get_news_service():
    """Obtém ou cria a instância do serviço de notícias."""
    global news_service
    if news_service is None:
        news_service = NewsService()
    return news_service
