import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { groqService } from '../python-bridge';

// 🧠 Memória Local: Dicionário para guardar o histórico de cada usuário.
// A chave é o ID numérico do Telegram, e o valor é um array com as conversas.
const userMemory = new Map<number, Array<{ role: string; content: string }>>();

let bot: Telegraf | null = null;

export const startTelegramBot = () => {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) {
    console.log('Telegran token não configurado; pulando inicialização do bot Telegram.');
    return;
  }

  bot = new Telegraf(token);

  bot.use(async (ctx, next) => {
    console.log('📩 Nova atividade detectada no Telegram:', ctx.updateType);
    return next();
  });

  bot.start((ctx) => {
    userMemory.set(ctx.from.id, []);
    ctx.reply('Olá! Eu sou o Bolsinho 💰, seu assistente financeiro. Como posso ajudar com suas finanças hoje?');
  });

  bot.on(message('text'), async (ctx) => {
    const userText = ctx.message.text;
    const userId = ctx.from.id;

    await ctx.sendChatAction('typing');

    const history = userMemory.get(userId) || [];

    try {
      const mensagensParaGroq = [
        { role: 'system', content: 'Você é o Bolsinho, um assistente financeiro irônico, direto e muito inteligente. Responda de forma concisa.' },
        ...history,
        { role: 'user', content: userText },
      ];

      const respostaIA = await groqService.chatCompletion(mensagensParaGroq);

      let textoFinal = 'Erro ao ler formato da IA';

      if (respostaIA.success) {
        if (typeof respostaIA.data === 'string') {
          textoFinal = respostaIA.data;
        } else if (respostaIA.data?.choices?.[0]?.message?.content) {
          textoFinal = respostaIA.data.choices[0].message.content;
        } else {
          textoFinal = JSON.stringify(respostaIA.data);
        }
      } else {
        textoFinal = 'Erro no motor Python: ' + respostaIA.error;
      }

      history.push({ role: 'user', content: userText });
      history.push({ role: 'assistant', content: textoFinal });
      if (history.length > 10) history.splice(0, history.length - 10);
      userMemory.set(userId, history);

      await ctx.reply(textoFinal);
    } catch (error) {
      console.error('🚨 O Erro real foi:', error);
      await ctx.reply('Ops, meus circuitos financeiros falharam. Tente novamente em instantes.');
    }
  });

  bot.catch((err, ctx) => {
    console.error(`🚨 Erro crítico no Telegram ao processar a atualização ${ctx.updateType}:`, err);
  });

  bot.launch();
  console.log('🤖 Bolsinho Telegram Bot conectado e com memória ativa!');

  process.once('SIGINT', () => bot?.stop('SIGINT'));
  process.once('SIGTERM', () => bot?.stop('SIGTERM'));
};

export const stopTelegramBot = () => {
  if (bot) bot.stop();
};