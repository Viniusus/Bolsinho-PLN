#!/usr/bin/env python3
"""CLI wrapper para ocr_service"""

import sys
import json
from ocr_service import ocr_service

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)
    
    try:
        request = json.loads(sys.argv[1])
        method = request.get("method")
        args = request.get("args", [])
        
        if method == "extract_text":
            image_path = args[0]
            preprocess = args[1] if len(args) > 1 else True
            result = ocr_service.extract_text(image_path, preprocess)
            
        elif method == "extract_boleto_data":
            image_path = args[0]
            result = ocr_service.extract_boleto_data(image_path)
            
        elif method == "extract_receipt_data":
            image_path = args[0]
            result = ocr_service.extract_receipt_data(image_path)
            
        elif method == "extract_invoice_data":
            image_path = args[0]
            result = ocr_service.extract_invoice_data(image_path)
            
        elif method == "extract_text_from_pdf":
            pdf_path = args[0]
            result = ocr_service.extract_text_from_pdf(pdf_path)
            
        else:
            result = {"error": f"Unknown method: {method}"}
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
