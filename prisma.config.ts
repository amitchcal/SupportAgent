import dotenv from "dotenv";
import { defineConfig } from "prisma/config";
dotenv.config({ path: ".env.local" });
const baseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const migrationUrl = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}sslmode=require` : "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: migrationUrl },
});
