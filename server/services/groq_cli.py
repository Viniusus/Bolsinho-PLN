#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CLI wrapper para groq_service"""

import sys
import json
import io

# Configurar encoding UTF-8 para stdout/stderr
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from groq_service import groq_service

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)
    
    try:
        request = json.loads(sys.argv[1])
        method = request.get("method")
        args = request.get("args", [])
        
        if method == "chat_completion":
            messages = args[0] if len(args) > 0 else []
            options = args[1] if len(args) > 1 else {}
            result = groq_service.chat_completion(messages, **options)
            
        elif method == "analyze_image":
            image_url = args[0]
            prompt = args[1]
            result = groq_service.analyze_image(image_url, prompt)
            
        elif method == "extract_financial_data":
            image_url = args[0]
            document_type = args[1] if len(args) > 1 else "recibo"
            result = groq_service.extract_financial_data(image_url, document_type)
            
        elif method == "categorize_transaction":
            description = args[0]
            amount = args[1]
            context = args[2] if len(args) > 2 else None
            result = groq_service.categorize_transaction(description, amount, context)
            
        elif method == "analyze_spending_pattern":
            transactions = args[0]
            budget = args[1] if len(args) > 1 else None
            result = groq_service.analyze_spending_pattern(transactions, budget)
            
        elif method == "financial_assistant":
            user_message = args[0]
            conversation_history = args[1] if len(args) > 1 else None
            result = groq_service.financial_assistant(user_message, conversation_history)
            
        elif method == "financial_assistant_multimodal":
            user_content = args[0]
            conversation_history = args[1] if len(args) > 1 else None
            result = groq_service.financial_assistant_multimodal(user_content, conversation_history)
            
        else:
            result = {"error": f"Unknown method: {method}"}
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
