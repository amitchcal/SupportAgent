import dotenv from "dotenv";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

async function main() {
dotenv.config({ path: ".env.local" });
if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is not configured.");
const client = new pg.Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" ("id" VARCHAR(36) PRIMARY KEY, "checksum" VARCHAR(64) NOT NULL, "finished_at" TIMESTAMPTZ, "migration_name" VARCHAR(255) NOT NULL, "logs" TEXT, "rolled_back_at" TIMESTAMPTZ, "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
  const root = path.join(process.cwd(), "prisma", "migrations");
  const migrations = (await readdir(root, { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name).sort();
  for (const name of migrations) {
    const sql = await readFile(path.join(root, name, "migration.sql"), "utf8"); const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query<{ checksum: string }>(`SELECT "checksum" FROM "_prisma_migrations" WHERE "migration_name"=$1 AND "rolled_back_at" IS NULL`, [name]);
    if (existing.rows[0]) { if (existing.rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${name}`); continue; }
    await client.query("BEGIN");
    try { await client.query(sql); await client.query(`INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","applied_steps_count") VALUES ($1,$2,now(),$3,1)`, [randomUUID(), checksum, name]); await client.query("COMMIT"); process.stdout.write(`Applied ${name}\n`); }
    catch (error) { await client.query("ROLLBACK"); throw error; }
  }
} finally { await client.end(); }
}
main().catch((error)=>{ console.error(error instanceof Error ? error.message : "Migration failed."); process.exitCode=1; });
