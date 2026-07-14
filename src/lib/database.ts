import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Database } from "./domain";

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
function client() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  globalDatabase.prisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  return globalDatabase.prisma;
}

export function postgresConfigured() { return Boolean(process.env.DATABASE_URL?.startsWith("postgres")); }
const json = (database: Database) => JSON.parse(JSON.stringify(database)) as Prisma.InputJsonValue;
function normalize(database: Database): Database { database.tenants??=[]; database.users??=[]; database.auditLogs??=[]; database.conversations??=[]; database.conversationMessages??=[]; database.conversationFeedback??=[]; database.knowledgeDocuments??=[]; database.knowledgeVersions??=[]; database.knowledgeGaps??=[]; database.sopDefinitions??=[]; database.sopExecutions??=[]; database.ticketingIntegrations??=[]; database.tickets??=[]; database.ticketSyncLogs??=[]; return database; }

export async function readPostgresState(seed: () => Database): Promise<Database> {
  const record = await client().supportState.upsert({ where: { id: "primary" }, update: {}, create: { id: "primary", data: json(seed()) } });
  return normalize(record.data as unknown as Database);
}

export async function mutatePostgresState<T>(mutation: (database: Database) => T | Promise<T>, seed: () => Database): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client().$transaction(async (transaction) => {
        const record = await transaction.supportState.upsert({ where: { id: "primary" }, update: {}, create: { id: "primary", data: json(seed()) } });
        const database = normalize(record.data as unknown as Database);
        const result = await mutation(database);
        const updated = await transaction.supportState.updateMany({ where: { id: "primary", revision: record.revision }, data: { data: json(database), revision: { increment: 1 } } });
        if (updated.count !== 1) throw new Error("Concurrent database update detected.");
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  throw new Error("Database update failed.");
}
