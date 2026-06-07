import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  InsertUserProfile, userProfiles,
  InsertUserMemory, userMemories,
  InsertUserPreference, userPreferences,
  categories, InsertCategory,
  transactions, InsertTransaction,
  budgets, InsertBudget,
  goals, InsertGoal,
  chatMessages, InsertChatMessage,
  alerts, InsertAlert,
  documents, InsertDocument
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// User profile / memory / preferences
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserProfile(profile: InsertUserProfile) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user profile: database not available");
    return;
  }

  if (!profile.userId) {
    throw new Error("userId is required to upsert a user profile");
  }

  const values = {
    userId: profile.userId,
  } as InsertUserProfile & Record<string, unknown>;
  const updateSet: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  const optionalFields = [
    "monthlyIncome",
    "monthlyExpenseLimit",
    "riskProfile",
    "financialMoment",
    "preferredCurrency",
    "preferredLanguage",
    "notes",
  ] as const;

  optionalFields.forEach((field) => {
    const value = profile[field];
    if (value !== undefined) {
      values[field] = value as unknown;
      updateSet[field] = value;
    }
  });

  await db.insert(userProfiles).values(values).onDuplicateKeyUpdate({
    set: updateSet,
  });
}

export async function getUserMemories(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;

  return db.select().from(userMemories)
    .where(and(eq(userMemories.userId, userId), eq(userMemories.isActive, 1)))
    .orderBy(desc(userMemories.importance), desc(userMemories.updatedAt))
    .limit(safeLimit);
}

export async function saveUserMemory(memory: InsertUserMemory) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save user memory: database not available");
    return;
  }

  if (!memory.userId || !memory.memoryType || !memory.content || !memory.content.trim()) {
    console.warn("[Database] Ignoring empty or incomplete memory payload");
    return;
  }

  const values = {
    userId: memory.userId,
    memoryType: memory.memoryType,
    content: memory.content.trim(),
  } as InsertUserMemory & Record<string, unknown>;

  const optionalFields = ["importance", "confidence", "source", "isActive"] as const;
  optionalFields.forEach((field) => {
    const value = memory[field];
    if (value !== undefined) {
      values[field] = value as unknown;
    }
  });

  await db.insert(userMemories).values(values);
}

export async function disableUserMemory(userId: number, memoryId: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(userMemories)
    .set({ isActive: 0, updatedAt: new Date() })
    .where(and(eq(userMemories.id, memoryId), eq(userMemories.userId, userId)));
}

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .orderBy(userPreferences.preferenceKey);
}

export async function upsertUserPreference(userId: number, key: string, value: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user preference: database not available");
    return;
  }

  if (!key.trim() || !value.trim()) {
    throw new Error("preference key and value are required");
  }

  await db.insert(userPreferences).values({
    userId,
    preferenceKey: key.trim(),
    preferenceValue: value.trim(),
  }).onDuplicateKeyUpdate({
    set: {
      preferenceValue: value.trim(),
      updatedAt: new Date(),
    },
  });
}

// Categories
export async function getUserCategories(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(categories.name);
}

export async function createCategory(category: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(categories).values(category);
}

// Transactions
export async function getUserTransactions(userId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  if (startDate && endDate) {
    return db.select().from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .orderBy(desc(transactions.date));
  }
  
  return db.select().from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date))
    .limit(100);
}

export async function createTransaction(transaction: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(transactions).values(transaction);
  return result;
}

export async function updateTransaction(id: number, userId: number, data: Partial<InsertTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(transactions)
    .set(data)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteTransaction(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

// Budgets
export async function getUserBudgets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(budgets)
    .where(eq(budgets.userId, userId))
    .orderBy(budgets.createdAt);
}

export async function createBudget(budget: InsertBudget) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(budgets).values(budget);
}

// Goals
export async function getUserGoals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(goals.createdAt);
}

export async function createGoal(goal: InsertGoal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(goals).values(goal);
}

// Chat Messages
export async function getUserChatMessages(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

export async function createChatMessage(message: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(chatMessages).values(message);
}

// Alerts
export async function getUserAlerts(userId: number, onlyUnread: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  if (onlyUnread) {
    return db.select().from(alerts)
      .where(and(eq(alerts.userId, userId), eq(alerts.isRead, 0)))
      .orderBy(desc(alerts.createdAt));
  }
  
  return db.select().from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.createdAt))
    .limit(50);
}

export async function createAlert(alert: InsertAlert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(alerts).values(alert);
}

// Documents
export async function getUserDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt));
}

export async function createDocument(document: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(documents).values(document);
  return result;
}

// Analytics
export async function getSpendingByCategory(userId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    categoryId: transactions.categoryId,
    total: sql<number>`SUM(${transactions.amount})`,
    count: sql<number>`COUNT(*)`,
  })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(transactions.categoryId);
}

function formatMoney(value: number | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined) {
    return "não informado";
  }

  const code = currency && currency.trim() ? currency.trim().toUpperCase() : "BRL";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: code,
    }).format(value / 100);
  } catch {
    return `${code} ${(value / 100).toFixed(2)}`;
  }
}

function normalizeContextValue(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return "não informado";
  }

  return value.trim();
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "não informado";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "não informado";
  }

  return date.toLocaleDateString("pt-BR");
}

export async function getUserRagContext(userId?: number | null) {
  if (!userId) {
    return "";
  }

  try {
    const [profileResult, memoriesResult, preferencesResult, goalsResult, transactionsResult] = await Promise.allSettled([
      getUserProfile(userId),
      getUserMemories(userId, 20),
      getUserPreferences(userId),
      getUserGoals(userId),
      getUserTransactions(userId, undefined, undefined),
    ]);

    const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
    const memories = (memoriesResult.status === "fulfilled" ? memoriesResult.value : []) as Array<{ memoryType: string; content: string }>;
    const preferences = (preferencesResult.status === "fulfilled" ? preferencesResult.value : []) as Array<{ preferenceKey: string; preferenceValue: string }>;
    const goalsList = (goalsResult.status === "fulfilled" ? goalsResult.value : []) as Array<{ targetAmount: number; currentAmount: number; name: string; status: string; deadline: Date | string | null | undefined }>;
    const recentTransactions = (transactionsResult.status === "fulfilled" ? transactionsResult.value.slice(0, 5) : []) as Array<{ amount: number; type: string; date: Date | string | null | undefined; description: string }>;

    const profileLines = [
      `- Perfil de risco: ${profile ? profile.riskProfile : "não informado"}`,
      `- Momento financeiro: ${profile ? profile.financialMoment : "não informado"}`,
      `- Moeda preferida: ${normalizeContextValue(profile?.preferredCurrency)}`,
      `- Idioma preferido: ${normalizeContextValue(profile?.preferredLanguage)}`,
      `- Renda mensal: ${profile ? formatMoney(profile.monthlyIncome, profile.preferredCurrency) : "não informado"}`,
      `- Limite mensal de gastos: ${profile ? formatMoney(profile.monthlyExpenseLimit, profile.preferredCurrency) : "não informado"}`,
      `- Observações: ${normalizeContextValue(profile?.notes)}`,
    ].join("\n");

    const memoryLineItems: string[] = [];
    for (const memory of memories) {
      memoryLineItems.push(`- [${memory.memoryType}] ${memory.content}`);
    }

    const preferenceLineItems: string[] = [];
    for (const preference of preferences) {
      preferenceLineItems.push(`- ${preference.preferenceKey}: ${preference.preferenceValue}`);
    }

    const goalLineItems: string[] = [];
    for (const goal of goalsList) {
      const target = formatMoney(goal.targetAmount, profile?.preferredCurrency);
      const current = formatMoney(goal.currentAmount, profile?.preferredCurrency);
      goalLineItems.push(`- ${goal.name} | meta ${target} | atual ${current} | status ${goal.status}${goal.deadline ? ` | prazo ${formatDate(goal.deadline)}` : ""}`);
    }

    const transactionLineItems: string[] = [];
    for (const transaction of recentTransactions) {
      const amount = formatMoney(transaction.amount, profile?.preferredCurrency);
      transactionLineItems.push(`- ${formatDate(transaction.date)} | ${transaction.type} | ${amount} | ${transaction.description}`);
    }

    const memoryLines = memoryLineItems.length > 0 ? memoryLineItems.join("\n") : "- nenhum dado cadastrado";
    const preferenceLines = preferenceLineItems.length > 0 ? preferenceLineItems.join("\n") : "- nenhum dado cadastrado";
    const goalLines = goalLineItems.length > 0 ? goalLineItems.join("\n") : "- nenhum dado cadastrado";
    const transactionLines = transactionLineItems.length > 0 ? transactionLineItems.join("\n") : "- nenhum dado cadastrado";

    return [
      "CONTEXTO PERSISTENTE DO USUÁRIO",
      "",
      "Perfil financeiro:",
      profileLines,
      "",
      "Memórias úteis:",
      memoryLines,
      "",
      "Preferências:",
      preferenceLines,
      "",
      "Metas financeiras:",
      goalLines,
      "",
      "Transações recentes:",
      transactionLines,
    ].join("\n");
  } catch (error) {
    console.warn("[Database] Failed to build user RAG context:", error);
    return "";
  }
}
