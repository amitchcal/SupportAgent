import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultBranding, defaultSettings, defaultTheme, type AuditLog, type Database, type Tenant, type User } from "./domain";
import { mutatePostgresState, postgresConfigured, readPostgresState } from "./database";

const dataDirectory = process.env.SUPPORT_AGENT_DATA_DIR ?? path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "support-agent.json");
let queue = Promise.resolve();

export function seedDatabase(): Database {
  const now = new Date().toISOString();
  const tenantId = "tenant_demo";
  return {
    tenants: [{ id: tenantId, name: "Acme Industrial", slug: "acme", status: "ACTIVE", settings: defaultSettings, branding: defaultBranding, theme: defaultTheme, createdAt: now, updatedAt: now }],
    users: [],
    auditLogs: [], conversations: [], conversationMessages: [], conversationFeedback: [], knowledgeDocuments: [], knowledgeVersions: [], knowledgeGaps: [], rateLimits: [], sopDefinitions: [], sopExecutions: [], ticketingIntegrations: [], tickets: [], ticketSyncLogs: [],
  };
}

async function load(): Promise<Database> {
  if (postgresConfigured()) return readPostgresState(seedDatabase);
  try {
    const database = JSON.parse(await readFile(databasePath, "utf8")) as Database;
    database.conversations ??= []; database.conversationMessages ??= []; database.conversationFeedback ??= []; database.knowledgeDocuments ??= []; database.knowledgeVersions ??= []; database.knowledgeGaps ??= []; database.rateLimits ??= []; database.sopDefinitions ??= []; database.sopExecutions ??= []; database.ticketingIntegrations ??= []; database.tickets ??= []; database.ticketSyncLogs ??= [];
    return database;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const initial = seedDatabase();
    await persist(initial);
    return initial;
  }
}

async function persist(database: Database) {
  await mkdir(dataDirectory, { recursive: true });
  const temporary = `${databasePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(database, null, 2), "utf8");
  await rename(temporary, databasePath);
}

export async function readDatabase() { return load(); }

export function mutateDatabase<T>(mutation: (database: Database) => T | Promise<T>): Promise<T> {
  if (postgresConfigured()) return mutatePostgresState(mutation, seedDatabase);
  const operation = queue.then(async () => {
    const database = await load();
    const result = await mutation(database);
    await persist(database);
    return result;
  });
  queue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function findTenantBySlug(slug: string) {
  return (await load()).tenants.find((tenant) => tenant.slug === slug && tenant.status === "ACTIVE") ?? null;
}

export async function findUserByEmail(email: string) {
  return (await load()).users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(id: string) {
  return (await load()).users.find((user) => user.id === id) ?? null;
}

export async function listTenantUsers(tenantId: string) {
  return (await load()).users.filter((user) => user.tenantId === tenantId).map(withoutPassword);
}

export async function listTenantAuditLogs(tenantId: string) {
  return (await load()).auditLogs.filter((entry) => entry.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTenantConversation(tenantId: string, conversationId: string) {
  return (await load()).conversations.find((item) => item.id === conversationId && item.tenantId === tenantId) ?? null;
}

export async function listTenantKnowledge(tenantId: string) {
  const database = await load();
  return database.knowledgeDocuments.filter((item) => item.tenantId === tenantId).map((document) => ({ document, versions: database.knowledgeVersions.filter((version) => version.tenantId === tenantId && version.documentId === document.id).sort((a, b) => b.version - a.version) }));
}

export async function listTenantSops(tenantId: string) {
  return (await load()).sopDefinitions.filter((item) => item.tenantId === tenantId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTenantTicketing(tenantId: string) {
  const database = await load(); return { integrations: database.ticketingIntegrations.filter((item) => item.tenantId === tenantId), tickets: database.tickets.filter((item) => item.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), syncLogs: database.ticketSyncLogs.filter((item) => item.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

export function withoutPassword(user: User): Omit<User, "passwordHash"> {
  const { passwordHash: _, ...safe } = user;
  void _;
  return safe;
}

export function audit(database: Database, input: Omit<AuditLog, "id" | "createdAt">) {
  database.auditLogs.push({ ...input, id: randomUUID(), createdAt: new Date().toISOString() });
}

export function createTenantRecord(input: Pick<Tenant, "name" | "slug">): Tenant {
  const now = new Date().toISOString();
  return { id: randomUUID(), name: input.name, slug: input.slug, status: "ACTIVE", settings: defaultSettings, branding: { ...defaultBranding, companyDisplayName: input.name }, theme: defaultTheme, createdAt: now, updatedAt: now };
}
