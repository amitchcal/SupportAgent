import assert from "node:assert/strict";
import test from "node:test";
import type { Database, SopDefinition } from "./domain";
import { advanceSopExecution, currentSopStep, findActiveSop, startSopExecution, validateSopSteps } from "./sop";

const steps = validateSopSteps([
  { id: "safe", type: "safety_warning", content: "Lock out electrical power.", responseFormat: "boolean" },
  { id: "branch", type: "branch", content: "Is the indicator green?", responseFormat: "choice", branches: [{ equals: "no", nextStepId: "escalate" }, { equals: "yes", nextStepId: "resolve" }] },
  { id: "escalate", type: "escalate", content: "Contact an engineer.", responseFormat: "boolean" },
  { id: "resolve", type: "resolve", content: "Confirm normal operation.", responseFormat: "boolean" },
]);
const sop: SopDefinition = { id: "sop-a", tenantId: "tenant-a", title: "Electrical reset", category: "Electrical", product: "", language: "en", status: "ACTIVE", version: 1, steps, createdBy: "u1", approvedBy: "u2", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), approvedAt: new Date(0).toISOString() };

test("SOP validation orders steps and forces safety warnings to mandatory", () => {
  assert.deepEqual(steps.map((step) => step.order), [1, 2, 3, 4]);
  assert.equal(steps[0].mandatory, true);
  assert.throws(() => validateSopSteps([{ type: "instruction", content: "Do something" }]), /resolve or escalate/);
});

test("only active SOPs from the same tenant can be selected or executed", () => {
  const database = { tenants: [], users: [], auditLogs: [], conversations: [], conversationMessages: [], knowledgeDocuments: [], knowledgeVersions: [], sopDefinitions: [sop, { ...sop, id: "draft", status: "DRAFT" as const }], sopExecutions: [], ticketingIntegrations: [], tickets: [], ticketSyncLogs: [] } satisfies Database;
  assert.equal(findActiveSop(database, "tenant-a", "Electrical", "en")?.id, "sop-a");
  assert.equal(findActiveSop(database, "tenant-b", "Electrical", "en"), null);
  assert.throws(() => startSopExecution(sop, "tenant-b", "c1"), /active tenant SOP/);
});

test("mandatory safety steps cannot be skipped and every step is logged", () => {
  const execution = startSopExecution(sop, "tenant-a", "c1", [], "2026-01-01T00:00:00.000Z");
  assert.equal(currentSopStep(execution, sop)?.id, "safe");
  assert.throws(() => advanceSopExecution(execution, sop, "skip", false), /cannot be skipped/);
  assert.equal(execution.logs.some((log) => log.event === "SAFETY_BLOCKED"), true);
  advanceSopExecution(execution, sop, "power isolated", true);
  assert.equal(currentSopStep(execution, sop)?.id, "branch");
  advanceSopExecution(execution, sop, "no", true);
  assert.equal(currentSopStep(execution, sop)?.id, "escalate");
  advanceSopExecution(execution, sop, "confirmed", true);
  assert.equal(execution.status, "ESCALATED");
});

test("emergency detection overrides an SOP immediately", () => {
  const execution = startSopExecution(sop, "tenant-a", "c1");
  advanceSopExecution(execution, sop, "There is smoke now", true, ["smoke"]);
  assert.equal(execution.status, "ESCALATED");
  assert.match(execution.logs.at(-1)?.response ?? "", /Emergency override/);
});
