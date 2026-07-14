import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultBranding, defaultSettings, defaultTheme, type AuditLog, type Database, type Tenant, type User } from "./domain";

const dataDirectory = process.env.SUPPORT_AGENT_DATA_DIR ?? path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "support-agent.json");
let queue = Promise.resolve();

function seed(): Database {
  const now = new Date().toISOString();
  const tenantId = "tenant_demo";
  return {
    tenants: [{ id: tenantId, name: "Acme Industrial", slug: "acme", status: "ACTIVE", settings: defaultSettings, branding: defaultBranding, theme: defaultTheme, createdAt: now, updatedAt: now }],
    users: [],
    auditLogs: [],
  };
}

async function load(): Promise<Database> {
  try {
    return JSON.parse(await readFile(databasePath, "utf8")) as Database;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const initial = seed();
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
