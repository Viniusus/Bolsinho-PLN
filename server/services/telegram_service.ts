import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { groqService } from '../python-bridge';

// 🧠 Memória Local: Dicionário para guardar o histórico de cada usuário.
// A chave é o ID numérico do Telegram, e o valor é um array com as conversas.
const userMemory = new Map<number, Array<{role: string, content: string}>>();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN as string);

bot.use(async (ctx, next) => {
  console.log('📩 Nova atividade detectada no Telegram:', ctx.updateType);
  return next(); // Continua para o restante do código
});

bot.start((ctx) => {
  // Limpa a memória quando o usuário envia /start para reiniciar a conversa
  userMemory.set(ctx.from.id, []);
  ctx.reply('Olá! Eu sou o Bolsinho 💰, seu assistente financeiro. Como posso ajudar com suas finanças hoje?');
});

bot.on(message('text'), async (ctx) => {
  const userText = ctx.message.text;
  const userId = ctx.from.id;

  await ctx.sendChatAction('typing');

  // Recupera o histórico do usuário (se for a primeira mensagem, cria um array vazio)
  const history = userMemory.get(userId) || [];

  try {
    // 1. Injetamos um "System Prompt" no início do histórico para dar a personalidade ao bot
    const mensagensParaGroq = [
      { role: 'system', content: 'Você é o Bolsinho, um assistente financeiro irônico, direto e muito inteligente. Responda de forma concisa.' },
      ...history, // Coloca todo o histórico de conversas que salvamos na memória
      { role: 'user', content: userText } // Adiciona a mensagem atual
    ];

    // 2. Usamos o chatCompletion direto, contornando a necessidade de banco de dados
    const respostaIA = await groqService.chatCompletion(mensagensParaGroq);
    
    // 3. Extraindo apenas o texto limpo da resposta
    let textoFinal = "Erro ao ler formato da IA";
    
    if (respostaIA.success) {
        // Se a resposta direta for a string formatada
        if (typeof respostaIA.data === 'string') {
            textoFinal = respostaIA.data;
        } 
        // Se o Python retornar o objeto bruto da API da Groq
        else if (respostaIA.data?.choices?.[0]?.message?.content) {
            textoFinal = respostaIA.data.choices[0].message.content;
        } 
        // Fallback de segurança
        else {
            textoFinal = JSON.stringify(respostaIA.data); 
        }
    } else {
        // Se a chamada falhar no lado do Python
        textoFinal = "Erro no motor Python: " + respostaIA.error;
    }

    // 4. Salva no histórico
    history.push({ role: 'user', content: userText });
    history.push({ role: 'assistant', content: textoFinal });

    if (history.length > 10) history.splice(0, history.length - 10);
    userMemory.set(userId, history);

    // 5. Envia para o Telegram
    await ctx.reply(textoFinal);
    
  } catch (error) {
    console.error('🚨 O Erro real foi:', error);
    await ctx.reply('Ops, meus circuitos financeiros falharam. Tente novamente em instantes.');
  }
});

export const startTelegramBot = () => {
  bot.launch();
  console.log('🤖 Bolsinho Telegram Bot conectado e com memória ativa!');
  
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};
// Detector global de erros do bot
bot.catch((err, ctx) => {
  console.error(`🚨 Erro crítico no Telegram ao processar a atualização ${ctx.updateType}:`, err);
});