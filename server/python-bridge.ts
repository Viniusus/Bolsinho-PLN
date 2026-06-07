/**
 * Bridge para executar serviços Python a partir do Node.js
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Obter __dirname em ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PythonServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Executa um script Python e retorna o resultado
 */
export async function executePythonService(
  serviceName: string,
  method: string,
  args: any[] = []
): Promise<PythonServiceResponse> {
  return new Promise((resolve) => {
    // Usa o CLI wrapper para executar o serviço
    // O nome do arquivo CLI é diferente do nome do serviço
    const cliMap: Record<string, string> = {
      'groq': 'groq_cli',
      'groq_service': 'groq_cli',
      'ocr': 'ocr_cli',
      'ocr_service': 'ocr_cli',
      'news': 'news_cli',
      'news_service': 'news_cli',
    };
    const cliName = cliMap[serviceName] || `${serviceName}_cli`;
    const scriptPath = path.join(__dirname, 'services', `${cliName}.py`);
    
    // Prepara argumentos como JSON no formato esperado pelo CLI
    const request = JSON.stringify({ method, args });
    
    // Try to use venv Python first, then fallback to system Python
    const venvPythonPath = path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe'); // Windows
    const venvPythonPathUnix = path.join(__dirname, '..', 'venv', 'bin', 'python3'); // Unix/Mac
    const venvPython = process.platform === 'win32' ? venvPythonPath : venvPythonPathUnix;
    
    // Check if venv exists synchronously, otherwise use system Python
    let pythonCmd: string;
    try {
      fs.accessSync(venvPython, fs.constants.F_OK);
      pythonCmd = venvPython;
    } catch {
      // Venv doesn't exist, use system Python
      pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    }
    
    const pythonProcess = spawn(pythonCmd, [scriptPath, request], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    
    let stdout = '';
    let stderr = '';
    
    // Configurar encoding UTF-8 explicitamente
    if (pythonProcess.stdout) {
      pythonProcess.stdout.setEncoding('utf8');
    }
    if (pythonProcess.stderr) {
      pythonProcess.stderr.setEncoding('utf8');
    }
    
    pythonProcess.stdout?.on('data', (data: Buffer | string) => {
      stdout += typeof data === 'string' ? data : data.toString('utf8');
    });
    
    pythonProcess.stderr?.on('data', (data: Buffer | string) => {
      stderr += typeof data === 'string' ? data : data.toString('utf8');
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: stderr || `Process exited with code ${code}`
        });
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve({
          success: true,
          data: result
        });
      } catch (e) {
        resolve({
          success: false,
          error: `Failed to parse Python output: ${stdout}`
        });
      }
    });
  });
}

/**
 * Serviço Groq
 */
export const groqService = {
  async chatCompletion(messages: any[], options: any = {}) {
    return executePythonService('groq_service', 'chat_completion', [messages, options]);
  },
  
  async analyzeImage(imageUrl: string, prompt: string) {
    return executePythonService('groq_service', 'analyze_image', [imageUrl, prompt]);
  },
  
  async extractFinancialData(imageUrl: string, documentType: string) {
    return executePythonService('groq_service', 'extract_financial_data', [imageUrl, documentType]);
  },
  
  async categorizeTransaction(description: string, amount: number, context?: string) {
    return executePythonService('groq_service', 'categorize_transaction', [description, amount, context]);
  },
  
  async analyzeSpendingPattern(transactions: any[], budget?: any) {
    return executePythonService('groq_service', 'analyze_spending_pattern', [transactions, budget]);
  },
  
  async financialAssistant(userMessage: string, conversationHistory?: any[]) {
    const result = await executePythonService('groq', 'financial_assistant', [userMessage, conversationHistory]);
    if (!result.success) {
      throw new Error(result.error || 'Erro ao executar o Bolsinho');
    }
    // O resultado pode ser uma string ou objeto, retorna como está
    return typeof result.data === 'string' ? result.data : result.data;
  },
  
  async financialAssistantMultimodal(userContent: any, conversationHistory?: any[]) {
    const result = await executePythonService('groq', 'financial_assistant_multimodal', [userContent, conversationHistory]);
    if (!result.success) {
      throw new Error(result.error || 'Erro ao executar o Bolsinho (multimodal)');
    }
    return typeof result.data === 'string' ? result.data : result.data;
  }
};

/**
 * Serviço OCR
 */
export const ocrService = {
  async extractText(imagePath: string, preprocess: boolean = true) {
    return executePythonService('ocr_service', 'extract_text', [imagePath, preprocess]);
  },
  
  async extractBoletoData(imagePath: string) {
    return executePythonService('ocr_service', 'extract_boleto_data', [imagePath]);
  },
  
  async extractReceiptData(imagePath: string) {
    return executePythonService('ocr_service', 'extract_receipt_data', [imagePath]);
  },
  
  async extractInvoiceData(imagePath: string) {
    return executePythonService('ocr_service', 'extract_invoice_data', [imagePath]);
  },
  
  async extractTextFromPdf(pdfPath: string) {
    return executePythonService('ocr_service', 'extract_text_from_pdf', [pdfPath]);
  }
};

/**
 * Serviço de Notícias
 */
export const newsService = {
  async getTopHeadlines(category: string = 'business', country: string = 'br', pageSize: number = 20) {
    return executePythonService('news_service', 'get_top_headlines', [category, country, pageSize]);
  },
  
  async searchNews(query: string, options: any = {}) {
    return executePythonService('news_service', 'search_news', [query, options]);
  },
  
  async getInvestmentNews(assetType?: string, pageSize: number = 20) {
    return executePythonService('news_service', 'get_investment_news', [assetType, pageSize]);
  },
  
  async getSectorNews(sector: string, pageSize: number = 20) {
    return executePythonService('news_service', 'get_sector_news', [sector, pageSize]);
  },
  
  async getMarketIndicatorsNews(pageSize: number = 15) {
    return executePythonService('news_service', 'get_market_indicators_news', [pageSize]);
  },
  
  async analyzeNewsImpact(newsList: any[], portfolioSectors?: string[]) {
    return executePythonService('news_service', 'analyze_news_impact', [newsList, portfolioSectors]);
  }
};
