import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Database } from "../src/lib/domain";
import { mutatePostgresState } from "../src/lib/database";

async function main() {
dotenv.config({ path: ".env.local" });
const sourcePath = path.join(process.cwd(), "data", "support-agent.json");
const source = JSON.parse(await readFile(sourcePath, "utf8")) as Database;
await mutatePostgresState((database) => { Object.assign(database, source); }, () => source);
process.stdout.write(`Migrated ${source.tenants.length} tenant(s), ${source.users.length} user(s), and ${source.conversations.length} conversation(s) to PostgreSQL.\n`);
}
main().catch((error)=>{ console.error(error instanceof Error ? error.message : "Data migration failed."); process.exitCode=1; });
