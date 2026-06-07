#!/usr/bin/env python3
"""
Serviço de OCR usando Tesseract para extração de texto de documentos financeiros.
Suporta PDFs: extrai texto diretamente de PDFs com texto ou usa OCR em PDFs escaneados.
"""

import os
import re
import tempfile
from typing import Dict, Any, Optional, List
import pytesseract
from PIL import Image
import cv2
import numpy as np

# PDF processing
try:
    from PyPDF2 import PdfReader
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False


class OCRService:
    """Serviço para OCR de documentos financeiros."""
    
    def __init__(self):
        """Inicializa o serviço de OCR."""
        # Configura o caminho do Tesseract no Windows se necessário
        self._configure_tesseract_path()
        
        # Configura idiomas (português e inglês)
        self.languages = "por+eng"
    
    def _configure_tesseract_path(self):
        """Configura o caminho do Tesseract automaticamente no Windows."""
        import platform
        if platform.system() == "Windows":
            # Caminhos comuns do Tesseract no Windows
            possible_paths = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                r"C:\Users\{}\AppData\Local\Programs\Tesseract-OCR\tesseract.exe".format(os.getenv("USERNAME", "")),
            ]
            
            # Verifica se o Tesseract já está no PATH
            try:
                import shutil
                if shutil.which("tesseract"):
                    return  # Já está no PATH
            except:
                pass
            
            # Tenta encontrar o Tesseract nos caminhos comuns
            for tesseract_path in possible_paths:
                if os.path.exists(tesseract_path):
                    pytesseract.pytesseract.tesseract_cmd = tesseract_path
                    print(f"[OCR] Tesseract encontrado em: {tesseract_path}")
                    return
    
    def preprocess_image(self, image_path: str) -> np.ndarray:
        """
        Pré-processa imagem para melhorar OCR.
        
        Args:
            image_path: Caminho da imagem
            
        Returns:
            Imagem processada
        """
        # Lê imagem
        img = cv2.imread(image_path)
        
        # Converte para escala de cinza
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Aplica threshold adaptativo
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Remove ruído
        denoised = cv2.fastNlMeansDenoising(thresh)
        
        return denoised
    
    def extract_text(self, image_path: str, preprocess: bool = True) -> str:
        """
        Extrai texto de uma imagem.
        
        Args:
            image_path: Caminho da imagem
            preprocess: Se deve pré-processar a imagem
            
        Returns:
            Texto extraído
        """
        try:
            if preprocess:
                img = self.preprocess_image(image_path)
            else:
                img = Image.open(image_path)
            
            # Extrai texto
            text = pytesseract.image_to_string(img, lang=self.languages)
            
            return text.strip()
        except Exception as e:
            return f"Erro ao extrair texto: {str(e)}"
    
    def extract_structured_data(self, image_path: str) -> Dict[str, Any]:
        """
        Extrai dados estruturados de uma imagem.
        
        Args:
            image_path: Caminho da imagem
            
        Returns:
            Dicionário com dados extraídos
        """
        try:
            if image_path.startswith("http"):
                # Download da imagem se for URL
                import requests
                from io import BytesIO
                
                response = requests.get(image_path)
                img = Image.open(BytesIO(response.content))
                
                # Salva temporariamente
                temp_path = "/tmp/temp_ocr_image.jpg"
                img.save(temp_path)
                image_path = temp_path
            
            img = self.preprocess_image(image_path)
            
            # Extrai dados com informações de posição
            data = pytesseract.image_to_data(
                img, lang=self.languages, output_type=pytesseract.Output.DICT
            )
            
            return data
        except Exception as e:
            return {"error": str(e)}
    
    def extract_boleto_data(self, image_path: str) -> Dict[str, Any]:
        """
        Extrai dados específicos de um boleto.
        
        Args:
            image_path: Caminho da imagem do boleto
            
        Returns:
            Dados do boleto
        """
        text = self.extract_text(image_path)
        
        result = {
            "linha_digitavel": None,
            "codigo_barras": None,
            "valor": None,
            "vencimento": None,
            "beneficiario": None,
            "raw_text": text
        }
        
        # Padrões regex para extração
        
        # Linha digitável (47 ou 48 dígitos com pontos e espaços)
        linha_pattern = r'\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14}'
        linha_match = re.search(linha_pattern, text.replace('\n', ' '))
        if linha_match:
            result["linha_digitavel"] = linha_match.group(0)
        
        # Valor (R$ seguido de número)
        valor_pattern = r'R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})'
        valor_matches = re.findall(valor_pattern, text)
        if valor_matches:
            # Pega o maior valor encontrado
            valores = [float(v.replace('.', '').replace(',', '.')) for v in valor_matches]
            result["valor"] = max(valores)
        
        # Data de vencimento (DD/MM/YYYY)
        vencimento_pattern = r'(\d{2}/\d{2}/\d{4})'
        vencimento_matches = re.findall(vencimento_pattern, text)
        if vencimento_matches:
            result["vencimento"] = vencimento_matches[0]
        
        return result
    
    def extract_receipt_data(self, image_path: str) -> Dict[str, Any]:
        """
        Extrai dados de um recibo/cupom fiscal.
        
        Args:
            image_path: Caminho da imagem do recibo
            
        Returns:
            Dados do recibo
        """
        text = self.extract_text(image_path)
        
        result = {
            "estabelecimento": None,
            "cnpj": None,
            "data": None,
            "hora": None,
            "valor_total": None,
            "itens": [],
            "raw_text": text
        }
        
        lines = text.split('\n')
        
        # CNPJ
        cnpj_pattern = r'CNPJ[:\s]*(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})'
        cnpj_match = re.search(cnpj_pattern, text, re.IGNORECASE)
        if cnpj_match:
            result["cnpj"] = cnpj_match.group(1)
        
        # Data
        data_pattern = r'(\d{2}/\d{2}/\d{4})'
        data_match = re.search(data_pattern, text)
        if data_match:
            result["data"] = data_match.group(1)
        
        # Hora
        hora_pattern = r'(\d{2}:\d{2}:\d{2})'
        hora_match = re.search(hora_pattern, text)
        if hora_match:
            result["hora"] = hora_match.group(1)
        
        # Valor total
        total_patterns = [
            r'TOTAL[:\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})',
            r'VALOR TOTAL[:\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})',
        ]
        
        for pattern in total_patterns:
            total_match = re.search(pattern, text, re.IGNORECASE)
            if total_match:
                valor_str = total_match.group(1)
                result["valor_total"] = float(valor_str.replace('.', '').replace(',', '.'))
                break
        
        # Tenta extrair itens (padrão: descrição seguida de valor)
        item_pattern = r'(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})'
        for line in lines:
            item_match = re.search(item_pattern, line)
            if item_match:
                descricao = item_match.group(1).strip()
                valor_str = item_match.group(2)
                valor = float(valor_str.replace('.', '').replace(',', '.'))
                
                # Filtra linhas que parecem itens válidos
                if len(descricao) > 3 and valor > 0:
                    result["itens"].append({
                        "descricao": descricao,
                        "valor": valor
                    })
        
        return result
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extrai texto de um PDF.
        Tenta extrair texto diretamente primeiro. Se falhar (PDF escaneado),
        converte para imagem e usa OCR.
        
        Args:
            pdf_path: Caminho do arquivo PDF ou URL
            
        Returns:
            Texto extraído do PDF
        """
        try:
            # Se for URL ou data URL, processa de forma diferente
            if pdf_path.startswith("http") or pdf_path.startswith("data:"):
                from io import BytesIO
                
                if pdf_path.startswith("data:"):
                    # Data URL: data:application/pdf;base64,...
                    import base64
                    header, encoded = pdf_path.split(',', 1)
                    pdf_content = base64.b64decode(encoded)
                    pdf_file = BytesIO(pdf_content)
                else:
                    # URL HTTP
                    import requests
                    response = requests.get(pdf_path)
                    pdf_file = BytesIO(response.content)
            else:
                # Arquivo local
                pdf_file = open(pdf_path, 'rb')
            
            # Tenta extrair texto diretamente do PDF
            pdf_content_for_ocr = None
            temp_pdf_path = None
            pdf_file_closed = False
            
            if PDF_AVAILABLE:
                try:
                    # Reset file pointer if it's a file object
                    if not isinstance(pdf_file, BytesIO):
                        pdf_file.seek(0)
                    
                    reader = PdfReader(pdf_file)
                    text_parts = []
                    
                    for page_num, page in enumerate(reader.pages):
                        try:
                            page_text = page.extract_text()
                            if page_text and page_text.strip():
                                text_parts.append(f"--- Página {page_num + 1} ---\n{page_text}")
                        except Exception as page_error:
                            # Skip pages with errors, continue with others
                            continue
                    
                    # Close file if it was opened from disk
                    if not isinstance(pdf_file, BytesIO) and hasattr(pdf_file, 'close'):
                        pdf_file.close()
                        pdf_file_closed = True
                    
                    if text_parts:
                        return "\n\n".join(text_parts).strip()
                    
                    # Se não extraiu texto, precisa usar OCR - salva conteúdo para OCR
                    if not pdf_file_closed:
                        if isinstance(pdf_file, BytesIO):
                            pdf_content_for_ocr = pdf_file.getvalue()
                        else:
                            try:
                                if not pdf_file_closed:
                                    pdf_file.seek(0)
                                    pdf_content_for_ocr = pdf_file.read()
                            except:
                                pass
                            finally:
                                if hasattr(pdf_file, 'close') and not pdf_file_closed:
                                    pdf_file.close()
                                    pdf_file_closed = True
                except Exception as e:
                    # Se falhar, tenta OCR (PDF escaneado)
                    if not pdf_file_closed:
                        try:
                            if isinstance(pdf_file, BytesIO):
                                pdf_content_for_ocr = pdf_file.getvalue()
                            else:
                                pdf_file.seek(0)
                                pdf_content_for_ocr = pdf_file.read()
                        except:
                            pass
                        finally:
                            if hasattr(pdf_file, 'close') and not pdf_file_closed:
                                try:
                                    pdf_file.close()
                                except:
                                    pass
                                pdf_file_closed = True
            
            # Se não conseguiu extrair texto ou não tem PyPDF2, tenta OCR
            # Mas só se temos conteúdo para processar
            if not pdf_content_for_ocr:
                # Se é um arquivo local, tenta ler diretamente
                if not pdf_path.startswith("http") and not pdf_path.startswith("data:"):
                    try:
                        with open(pdf_path, 'rb') as f:
                            pdf_content_for_ocr = f.read()
                    except:
                        pass
            
            if PDF2IMAGE_AVAILABLE:
                if pdf_content_for_ocr:
                    # Salva PDF temporariamente para conversão
                    temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
                    temp_pdf.write(pdf_content_for_ocr)
                    temp_pdf.close()
                    temp_pdf_path = temp_pdf.name
                elif not pdf_path.startswith("http") and not pdf_path.startswith("data:"):
                    # Se é um arquivo local, usa diretamente
                    temp_pdf_path = pdf_path
                
                if temp_pdf_path:
                    try:
                        images = convert_from_path(temp_pdf_path)
                        text_parts = []
                        
                        for page_num, img in enumerate(images):
                            try:
                                # Salva imagem temporária
                                temp_img = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
                                img.save(temp_img.name, 'PNG')
                                temp_img.close()
                                
                                # Extrai texto usando OCR
                                page_text = self.extract_text(temp_img.name)
                                if page_text and page_text.strip():
                                    text_parts.append(f"--- Página {page_num + 1} ---\n{page_text}")
                                
                                # Remove arquivo temporário
                                try:
                                    os.unlink(temp_img.name)
                                except:
                                    pass
                            except Exception as page_error:
                                # Continue processing other pages
                                continue
                        
                        # Remove PDF temporário apenas se foi criado por nós
                        if temp_pdf_path != pdf_path:
                            try:
                                os.unlink(temp_pdf_path)
                            except:
                                pass
                        
                        if text_parts:
                            return "\n\n".join(text_parts).strip()
                        else:
                            return "Não foi possível extrair texto do PDF usando OCR. O arquivo pode estar vazio, corrompido ou ser uma imagem escaneada de baixa qualidade. Tente usar um PDF com texto selecionável ou uma imagem de melhor qualidade."
                    except Exception as ocr_error:
                        # Cleanup on error
                        if temp_pdf_path != pdf_path:
                            try:
                                os.unlink(temp_pdf_path)
                            except:
                                pass
                        # Check for specific errors
                        error_msg = str(ocr_error)
                        if "poppler" in error_msg.lower() or "is poppler installed" in error_msg.lower():
                            raise Exception("Poppler não está instalado ou não está no PATH. Para Windows, baixe em: https://github.com/oschwartz10612/poppler-windows/releases/ e adicione a pasta 'bin' ao PATH. Para Linux: sudo apt-get install poppler-utils. Para macOS: brew install poppler")
                        else:
                            raise ocr_error
                else:
                    return "Erro: Não foi possível acessar o conteúdo do PDF para processamento OCR."
            elif not PDF_AVAILABLE:
                return "Erro: Bibliotecas de PDF não disponíveis. Instale PyPDF2 e pdf2image com: pip install PyPDF2 pdf2image"
            else:
                return "Não foi possível extrair texto do PDF. O arquivo pode estar vazio ou ser uma imagem escaneada. Tente usar um PDF com texto selecionável."
                
        except Exception as e:
            error_msg = str(e)
            # Check for specific errors and provide helpful messages
            if "poppler" in error_msg.lower() or "is poppler installed" in error_msg.lower():
                return "Erro: Poppler não está instalado ou não está no PATH. Para Windows, baixe em: https://github.com/oschwartz10612/poppler-windows/releases/ e adicione a pasta 'bin' ao PATH do sistema. Para Linux: sudo apt-get install poppler-utils. Para macOS: brew install poppler"
            elif "pypdf2" in error_msg.lower() or "pdf2image" in error_msg.lower():
                return "Erro: Bibliotecas Python não disponíveis. Execute: pip install PyPDF2 pdf2image"
            else:
                # Return a cleaner error message without full traceback for user-facing errors
                return f"Erro ao extrair texto do PDF: {error_msg}"
    
    def extract_invoice_data(self, image_path: str) -> Dict[str, Any]:
        """
        Extrai dados de uma nota fiscal.
        
        Args:
            image_path: Caminho da imagem da nota fiscal
            
        Returns:
            Dados da nota fiscal
        """
        text = self.extract_text(image_path)
        
        result = {
            "numero_nf": None,
            "serie": None,
            "data_emissao": None,
            "cnpj_emitente": None,
            "razao_social": None,
            "valor_total": None,
            "chave_acesso": None,
            "raw_text": text
        }
        
        # Número da NF
        nf_pattern = r'N[FºªÚ°]\s*(\d+)'
        nf_match = re.search(nf_pattern, text, re.IGNORECASE)
        if nf_match:
            result["numero_nf"] = nf_match.group(1)
        
        # Série
        serie_pattern = r'S[EÉ]RIE[:\s]*(\d+)'
        serie_match = re.search(serie_pattern, text, re.IGNORECASE)
        if serie_match:
            result["serie"] = serie_match.group(1)
        
        # Data de emissão
        data_pattern = r'EMISS[ÃA]O[:\s]*(\d{2}/\d{2}/\d{4})'
        data_match = re.search(data_pattern, text, re.IGNORECASE)
        if data_match:
            result["data_emissao"] = data_match.group(1)
        
        # CNPJ
        cnpj_pattern = r'CNPJ[:\s]*(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})'
        cnpj_match = re.search(cnpj_pattern, text, re.IGNORECASE)
        if cnpj_match:
            result["cnpj_emitente"] = cnpj_match.group(1)
        
        # Valor total
        valor_pattern = r'TOTAL[:\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})'
        valor_match = re.search(valor_pattern, text, re.IGNORECASE)
        if valor_match:
            valor_str = valor_match.group(1)
            result["valor_total"] = float(valor_str.replace('.', '').replace(',', '.'))
        
        # Chave de acesso (44 dígitos)
        chave_pattern = r'(\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4})'
        chave_match = re.search(chave_pattern, text)
        if chave_match:
            result["chave_acesso"] = chave_match.group(1).replace(' ', '')
        
        return result


# Instância global do serviço
ocr_service = OCRService()
