import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { groqService } from '../python-bridge';
import {
  upsertUser,
  getUserByOpenId,
  getUserChatMessages,
  createChatMessage,
  getUserRagContext,
} from '../db';

// Fallback in-memory history for when the DB is unavailable
const userMemory = new Map<number, Array<{ role: string; content: string }>>();

let bot: Telegraf | null = null;

function telegramOpenId(telegramId: number): string {
  return `telegram_${telegramId}`;
}

function displayName(ctx: { from: { first_name?: string; last_name?: string; id: number } }): string {
  return [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || `Usuário Telegram`;
}

export const startTelegramBot = () => {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) {
    console.log('Telegram token não configurado; pulando inicialização do bot Telegram.');
    return;
  }

  bot = new Telegraf(token);

  bot.use(async (ctx, next) => {
    console.log('📩 Nova atividade detectada no Telegram:', ctx.updateType);
    return next();
  });

  bot.start(async (ctx) => {
    const openId = telegramOpenId(ctx.from.id);
    await upsertUser({ openId, name: displayName(ctx), loginMethod: 'telegram' }).catch(() => {});
    userMemory.set(ctx.from.id, []);
    ctx.reply('Olá! Eu sou o Bolsinho 💰, seu assistente financeiro. Como posso ajudar com suas finanças hoje?');
  });

  bot.on(message('text'), async (ctx) => {
    const userText = ctx.message.text;
    const telegramId = ctx.from.id;
    const openId = telegramOpenId(telegramId);

    await ctx.sendChatAction('typing');

    // Upsert user and resolve DB record
    await upsertUser({ openId, name: displayName(ctx), loginMethod: 'telegram' }).catch(() => {});
    const dbUser = await getUserByOpenId(openId).catch(() => null);
    const userId = dbUser?.id ?? null;

    // Conversation history: DB when available, in-memory fallback
    let history: Array<{ role: string; content: string }> = [];
    if (userId) {
      const dbMessages = await getUserChatMessages(userId, 10).catch(() => []);
      history = [...dbMessages].reverse().map(m => ({ role: m.role, content: m.content }));
    } else {
      history = userMemory.get(telegramId) ?? [];
    }

    // User financial context for RAG
    const ragContext = userId ? await getUserRagContext(userId).catch(() => '') : '';

    // Persist the incoming message
    if (userId) {
      await createChatMessage({ userId, role: 'user', content: userText }).catch(() => {});
    }

    try {
      let textoFinal = '';

      if (userId) {
        // Use function-calling assistant so the AI can read/write DB via tools
        const result = await groqService.financialAssistantWithTools(userText, history, userId, ragContext);
        if (result.success) {
          textoFinal = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
        } else {
          console.warn('financialAssistantWithTools falhou, usando chatCompletion:', result.error);
          textoFinal = await fallbackCompletion(history, ragContext, userText);
        }
      } else {
        textoFinal = await fallbackCompletion(history, ragContext, userText);
        // Update in-memory history
        history.push({ role: 'user', content: userText });
        history.push({ role: 'assistant', content: textoFinal });
        if (history.length > 10) history.splice(0, history.length - 10);
        userMemory.set(telegramId, history);
      }

      // Persist the assistant response
      if (userId && textoFinal) {
        await createChatMessage({ userId, role: 'assistant', content: textoFinal }).catch(() => {});
      }

      await ctx.reply(textoFinal || 'Não consegui processar sua mensagem.');
    } catch (error) {
      console.error('🚨 Erro:', error);
      await ctx.reply('Ops, meus circuitos financeiros falharam. Tente novamente em instantes.');
    }
  });

  bot.catch((err, ctx) => {
    console.error(`🚨 Erro crítico no Telegram ao processar a atualização ${ctx.updateType}:`, err);
  });

  bot.launch();
  console.log('🤖 Bolsinho Telegram Bot conectado!');

  process.once('SIGINT', () => bot?.stop('SIGINT'));
  process.once('SIGTERM', () => bot?.stop('SIGTERM'));
};

async function fallbackCompletion(
  history: Array<{ role: string; content: string }>,
  ragContext: string,
  userText: string,
): Promise<string> {
  const systemContent = ragContext
    ? `Você é o Bolsinho, assistente financeiro. Responda de forma concisa.\n\n${ragContext}`
    : 'Você é o Bolsinho, assistente financeiro. Responda de forma concisa.';

  const msgs = [{ role: 'system', content: systemContent }, ...history, { role: 'user', content: userText }];
  const res = await groqService.chatCompletion(msgs);

  if (res.success) {
    return typeof res.data === 'string'
      ? res.data
      : (res.data?.choices?.[0]?.message?.content ?? JSON.stringify(res.data));
  }
  return 'Erro no motor Python: ' + res.error;
}

export const stopTelegramBot = () => {
  if (bot) bot.stop();
};
