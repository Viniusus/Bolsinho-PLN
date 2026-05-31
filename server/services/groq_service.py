#!/usr/bin/env python3
"""
Serviço de integração com Groq API para processamento multimodal.
Suporta análise de texto, imagens e documentos financeiros.
"""

import os
import base64
from typing import List, Dict, Any, Optional
from groq import Groq
from finance_services import somar_gastos, obter_gasto_por_categoria, adicionar_gasto

class GroqService:
    """Serviço para interação com Groq API."""
    
    def __init__(self):
        """Inicializa o cliente Groq com a chave de API."""
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY não configurada")
        
        self.client = Groq(api_key=api_key)
        self.default_model = "llama-3.2-90b-vision-preview"  # Modelo multimodal
        self.text_model = "llama-3.3-70b-versatile"  # Modelo apenas texto
    
    def encode_image(self, image_path: str) -> str:
        """Codifica imagem em base64 para envio à API."""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048
    ) -> str:
        """
        Realiza chat completion com Groq.
        
        Args:
            messages: Lista de mensagens no formato OpenAI
            model: Modelo a ser usado (padrão: llama-3.3-70b-versatile)
            temperature: Temperatura para geração (0-2)
            max_tokens: Número máximo de tokens na resposta
            
        Returns:
            Resposta do modelo
        """
        if model is None:
            model = self.text_model
        
        response = self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return response.choices[0].message.content
    
    def analyze_image(
        self,
        image_url: str,
        prompt: str,
        temperature: float = 0.5
    ) -> str:
        """
        Analisa uma imagem usando visão computacional.
        
        Args:
            image_url: URL da imagem a ser analisada
            prompt: Prompt descrevendo o que analisar
            temperature: Temperatura para geração
            
        Returns:
            Análise da imagem
        """
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url
                        }
                    }
                ]
            }
        ]
        
        response = self.client.chat.completions.create(
            model=self.default_model,
            messages=messages,
            temperature=temperature,
            max_tokens=2048
        )
        
        return response.choices[0].message.content
    
    def extract_financial_data(self, image_url: str, document_type: str = "recibo") -> Dict[str, Any]:
        """
        Extrai dados financeiros de documentos (recibos, notas fiscais, extratos).
        
        Args:
            image_url: URL da imagem do documento
            document_type: Tipo de documento (recibo, nota_fiscal, extrato, boleto)
            
        Returns:
            Dicionário com dados extraídos
        """
        prompts = {
            "recibo": """Analise este recibo e extraia as seguintes informações em formato JSON:
            - valor_total: valor total da compra
            - data: data da transação
            - estabelecimento: nome do estabelecimento
            - categoria_sugerida: categoria de gasto sugerida (alimentação, transporte, saúde, etc.)
            - itens: lista de itens comprados (se visível)
            Retorne apenas o JSON, sem texto adicional.""",
            
            "nota_fiscal": """Analise esta nota fiscal e extraia as seguintes informações em formato JSON:
            - valor_total: valor total
            - data_emissao: data de emissão
            - cnpj: CNPJ do emissor
            - razao_social: razão social do emissor
            - itens: lista de produtos/serviços
            - impostos: valores de impostos
            Retorne apenas o JSON, sem texto adicional.""",
            
            "extrato": """Analise este extrato bancário e extraia as seguintes informações em formato JSON:
            - periodo: período do extrato
            - saldo_inicial: saldo inicial
            - saldo_final: saldo final
            - transacoes: lista de transações com data, descrição e valor
            Retorne apenas o JSON, sem texto adicional.""",
            
            "boleto": """Analise este boleto e extraia as seguintes informações em formato JSON:
            - valor: valor do boleto
            - vencimento: data de vencimento
            - beneficiario: nome do beneficiário
            - codigo_barras: código de barras (se visível)
            - linha_digitavel: linha digitável (se visível)
            Retorne apenas o JSON, sem texto adicional."""
        }
        
        prompt = prompts.get(document_type, prompts["recibo"])
        result = self.analyze_image(image_url, prompt, temperature=0.3)
        
        # Tenta parsear o JSON da resposta
        import json
        try:
            # Remove markdown code blocks se presentes
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()
            
            return json.loads(result)
        except json.JSONDecodeError:
            return {"raw_response": result, "error": "Falha ao parsear JSON"}
    
    def categorize_transaction(
        self,
        description: str,
        amount: float,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Categoriza uma transação financeira automaticamente.
        
        Args:
            description: Descrição da transação
            amount: Valor da transação
            context: Contexto adicional (opcional)
            
        Returns:
            Categoria e confiança da classificação
        """
        prompt = f"""Categorize a seguinte transação financeira:

Descrição: {description}
Valor: R$ {amount:.2f}
{f'Contexto: {context}' if context else ''}

Categorias disponíveis:
- alimentacao (restaurantes, supermercados, delivery)
- transporte (combustível, uber, transporte público)
- moradia (aluguel, condomínio, contas)
- saude (farmácia, consultas, plano de saúde)
- educacao (cursos, livros, mensalidade)
- lazer (cinema, streaming, viagens)
- vestuario (roupas, calçados)
- tecnologia (eletrônicos, software)
- investimentos (aplicações, ações)
- outros

Retorne um JSON com:
- categoria: a categoria escolhida
- confianca: nível de confiança (0-1)
- subcategoria: subcategoria específica (opcional)
- sugestao_orcamento: sugestão se deve ser incluído no orçamento mensal

Retorne apenas o JSON, sem texto adicional."""

        response = self.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        
        import json
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                response = response.split("```")[1].split("```")[0].strip()
            
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                "categoria": "outros",
                "confianca": 0.5,
                "raw_response": response
            }
    
    def analyze_spending_pattern(
        self,
        transactions: List[Dict[str, Any]],
        budget: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Analisa padrões de gastos e fornece insights.
        
        Args:
            transactions: Lista de transações
            budget: Orçamento definido por categoria (opcional)
            
        Returns:
            Análise e recomendações
        """
        import json
        
        transactions_summary = json.dumps(transactions, ensure_ascii=False, indent=2)
        budget_info = json.dumps(budget, ensure_ascii=False, indent=2) if budget else "Não definido"
        
        prompt = f"""Analise os seguintes gastos e forneça insights:

Transações:
{transactions_summary}

Orçamento definido:
{budget_info}

Forneça uma análise em JSON com:
- total_gasto: total gasto no período
- categoria_maior_gasto: categoria com maior gasto
- alertas: lista de alertas sobre gastos excessivos
- recomendacoes: recomendações para economizar
- tendencias: tendências observadas nos gastos
- projecao_mensal: projeção de gastos para o mês (se aplicável)

Retorne apenas o JSON, sem texto adicional."""

        response = self.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=3000
        )
        
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                response = response.split("```")[1].split("```")[0].strip()
            
            return json.loads(response)
        except json.JSONDecodeError:
            return {"raw_response": response, "error": "Falha ao parsear análise"}
    
    def financial_assistant(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Assistente financeiro conversacional (Bolsinho).
        
        Args:
            user_message: Mensagem do usuário
            conversation_history: Histórico da conversa
            
        Returns:
            Resposta do assistente
        """
        system_prompt = """Você é o Bolsinho, assistente financeiro pessoal e especialista em investimentos e finanças. Você é especializado em:
- Educação financeira
- Planejamento de orçamento
- Análise de gastos
- Investimentos e mercado financeiro
- Economia e redução de custos

Seja sempre prestativo, claro e forneça conselhos práticos.
Use linguagem acessível e exemplos quando apropriado.
Quando falar sobre investimentos, sempre mencione os riscos envolvidos.

Lembre-se: Você é o Bolsinho, um especialista confiável em investimentos e finanças pessoais."""

        messages = [{"role": "system", "content": system_prompt}]
        
        if conversation_history:
            messages.extend(conversation_history)
        
        messages.append({"role": "user", "content": user_message})
        
        return self.chat_completion(messages, temperature=0.7, max_tokens=2048)
    
    def financial_assistant_multimodal(
        self,
        user_content: Any,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Assistente financeiro conversacional (Bolsinho) com suporte multimodal (texto, imagens, áudio).
        
        Args:
            user_content: Conteúdo do usuário (string, dict ou array de content parts)
            conversation_history: Histórico da conversa (pode conter conteúdo multimodal)
            
        Returns:
            Resposta do assistente
        """
        system_prompt = """Você é o Bolsinho, assistente financeiro pessoal e especialista em investimentos e finanças. Você é especializado em:
- Educação financeira
- Planejamento de orçamento
- Análise de gastos
- Investimentos e mercado financeiro
- Economia e redução de custos
- Notícias financeiras atuais e análises de mercado

Seja sempre prestativo, claro e forneça conselhos práticos.
Use linguagem acessível e exemplos quando apropriado.
Quando falar sobre investimentos, sempre mencione os riscos envolvidos.

Você pode analisar imagens de recibos, notas fiscais, extratos bancários e outros documentos financeiros.
Se receber áudio, transcreva e responda ao conteúdo.

IMPORTANTE: Se o usuário perguntar sobre notícias financeiras, você receberá notícias atualizadas no contexto da mensagem. 
Use essas notícias para fornecer respostas precisas e atualizadas. Cite as fontes quando apropriado e forneça análise relevante sobre o impacto das notícias.

Lembre-se: Você é o Bolsinho, um especialista confiável em investimentos e finanças pessoais."""

        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history if provided
        if conversation_history:
            messages.extend(conversation_history)
        
        # Add current user message
        messages.append({"role": "user", "content": user_content})
        
        # Use vision model if content contains images, otherwise use text model
        has_images = False
        if isinstance(user_content, list):
            has_images = any(
                isinstance(part, dict) and part.get("type") == "image_url"
                for part in user_content
            )
        elif isinstance(user_content, dict):
            has_images = user_content.get("type") == "image_url"
        
        model = self.default_model if has_images else self.text_model
        max_tokens = 4096 if has_images else 2048
        
        return self.chat_completion(messages, model=model, temperature=0.7, max_tokens=max_tokens)
    
    def get_financial_tools(self) -> List[Dict[str, Any]]:
        """Define os esquemas das ferramentas (Function Calling) para o modelo."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "somar_gastos",
                    "description": "Soma uma lista de valores de gastos e retorna o total exato.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "gastos": {
                                "type": "array",
                                "items": {"type": "number"},
                                "description": "Lista de valores numéricos representando os gastos"
                            }
                        },
                        "required": ["gastos"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "obter_gasto_por_categoria",
                    "description": "Obtém o total gasto pelo usuário em uma categoria específica neste mês.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "categoria": {
                                "type": "string",
                                "description": "A categoria do gasto (ex: alimentacao, transporte, lazer, educacao)"
                            }
                        },
                        "required": ["categoria"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "adicionar_gasto",
                    "description": "Registra uma nova despesa no banco de dados do usuário.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "descricao": {
                                "type": "string",
                                "description": "Descrição curta do que foi gasto"
                            },
                            "valor": {
                                "type": "number",
                                "description": "O valor gasto"
                            },
                            "categoria": {
                                "type": "string",
                                "description": "A categoria do gasto (ex: alimentacao, transporte)"
                            }
                        },
                        "required": ["descricao", "valor", "categoria"]
                    }
                }
            }
        ]

    def financial_assistant_with_tools(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Assistente financeiro conversacional (Bolsinho) integrado com ferramentas locais.
        """
        system_prompt = """Você é o Bolsinho, assistente financeiro pessoal. Você tem acesso a ferramentas 
        para consultar e adicionar gastos no banco de dados do usuário. Sempre que o usuário 
        perguntar sobre seus gastos ou quiser registrar uma nova despesa, use as ferramentas fornecidas."""

        messages = [{"role": "system", "content": system_prompt}]
        
        if conversation_history:
            messages.extend(conversation_history)
        
        messages.append({"role": "user", "content": user_message})
        
        tools = self.get_financial_tools()

        # 1. Primeira chamada para o modelo (com as ferramentas disponíveis)
        response = self.client.chat.completions.create(
            model=self.text_model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3 # Temperatura menor ajuda o modelo a ser mais preciso ao preencher parâmetros
        )
        
        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls

        # 2. Verifica se o modelo decidiu chamar alguma ferramenta
        if tool_calls:
            # Anexamos a resposta do modelo (que contém o pedido de chamada da função) ao histórico
            messages.append(response_message)
            
            # Mapeamento das strings de nome para as funções Python reais
            available_functions = {
                "somar_gastos": somar_gastos,
                "obter_gasto_por_categoria": obter_gasto_por_categoria,
                "adicionar_gasto": adicionar_gasto
            }

            # 3. Executamos as funções solicitadas
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_to_call = available_functions[function_name]
                function_args = json.loads(tool_call.function.arguments)
                
                try:
                    # Executa a função do finance_services.py
                    function_response = function_to_call(**function_args)
                except Exception as e:
                    function_response = f"Erro ao executar a ferramenta: {str(e)}"

                # Anexa o resultado da função ao histórico (role: "tool")
                messages.append(
                    {
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": str(function_response),
                    }
                )

            # 4. Segunda chamada: O modelo lê os resultados das ferramentas e gera a resposta final em texto
            second_response = self.client.chat.completions.create(
                model=self.text_model,
                messages=messages,
                temperature=0.7
            )
            return second_response.choices[0].message.content
            
        # Se não houver tool calls, retorna a resposta direta
        if response_message.content:
             return response_message.content
        return "Desculpe, não consegui processar sua solicitação."


# Instância global do serviço
groq_service = GroqService()
