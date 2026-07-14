import { randomUUID } from "node:crypto";
import { sopStepTypes, type Database, type SopDefinition, type SopExecution, type SopStep } from "./domain";

export function validateSopSteps(input: unknown): SopStep[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error("An SOP requires at least one step.");
  const steps = input.map((raw, index) => { const item = raw as Partial<SopStep>; if (!item || typeof item.content !== "string" || !item.content.trim()) throw new Error(`Step ${index + 1} requires content.`); if (!sopStepTypes.includes(item.type as SopStep["type"])) throw new Error(`Step ${index + 1} has an unsupported type.`); const responseFormat = item.responseFormat ?? "boolean"; if (!["text", "boolean", "number", "file", "choice"].includes(responseFormat)) throw new Error(`Step ${index + 1} has an unsupported response format.`); return { id: typeof item.id === "string" && item.id ? item.id : randomUUID(), order: index + 1, type: item.type as SopStep["type"], content: item.content.trim(), responseFormat, mandatory: item.type === "safety_warning" ? true : Boolean(item.mandatory), branches: item.type === "branch" && Array.isArray(item.branches) ? item.branches : undefined } satisfies SopStep; });
  const ids = new Set(steps.map((step) => step.id));
  for (const step of steps) for (const branch of step.branches ?? []) if (!ids.has(branch.nextStepId)) throw new Error(`Branch from ${step.id} points to an unknown step.`);
  if (!steps.some((step) => step.type === "resolve" || step.type === "escalate")) throw new Error("An SOP must end through a resolve or escalate step.");
  return steps;
}

export function findActiveSop(database: Database, tenantId: string, category: string, language: string, product = "") {
  return database.sopDefinitions.filter((sop) => sop.tenantId === tenantId && sop.status === "ACTIVE" && sop.category === category && sop.language === language && (!sop.product || !product || sop.product.toLowerCase() === product.toLowerCase())).sort((a, b) => b.version - a.version)[0] ?? null;
}

export function startSopExecution(sop: SopDefinition, tenantId: string, conversationId: string, emergencyReasons: string[] = [], now = new Date().toISOString()): SopExecution {
  if (sop.tenantId !== tenantId || sop.status !== "ACTIVE") throw new Error("Only an active tenant SOP can be executed.");
  if (emergencyReasons.length) return { id: randomUUID(), tenantId, conversationId, sopId: sop.id, currentStepId: null, status: "ESCALATED", completedStepIds: [], logs: [{ stepId: null, event: "ESCALATED", response: `Emergency override: ${emergencyReasons.join(", ")}`, createdAt: now }], createdAt: now, updatedAt: now };
  return { id: randomUUID(), tenantId, conversationId, sopId: sop.id, currentStepId: sop.steps[0]?.id ?? null, status: "IN_PROGRESS", completedStepIds: [], logs: [{ stepId: null, event: "STARTED", response: "", createdAt: now }], createdAt: now, updatedAt: now };
}

export function advanceSopExecution(execution: SopExecution, sop: SopDefinition, response: string, confirmed: boolean, emergencyReasons: string[] = [], now = new Date().toISOString()) {
  if (execution.tenantId !== sop.tenantId || execution.sopId !== sop.id || execution.status !== "IN_PROGRESS") throw new Error("SOP execution is not active.");
  if (emergencyReasons.length) { execution.status = "ESCALATED"; execution.currentStepId = null; execution.logs.push({ stepId: null, event: "ESCALATED", response: `Emergency override: ${emergencyReasons.join(", ")}`, createdAt: now }); execution.updatedAt = now; return execution; }
  const step = sop.steps.find((item) => item.id === execution.currentStepId); if (!step) throw new Error("Current SOP step is invalid.");
  if (!confirmed) { if (step.type === "safety_warning" || step.mandatory) execution.logs.push({ stepId: step.id, event: "SAFETY_BLOCKED", response, createdAt: now }); throw new Error(step.type === "safety_warning" || step.mandatory ? "Mandatory safety step cannot be skipped." : "Each SOP step must be confirmed."); }
  execution.completedStepIds.push(step.id); execution.logs.push({ stepId: step.id, event: "STEP_CONFIRMED", response, createdAt: now });
  if (step.type === "escalate") { execution.status = "ESCALATED"; execution.currentStepId = null; execution.logs.push({ stepId: step.id, event: "ESCALATED", response, createdAt: now }); }
  else if (step.type === "resolve") { execution.status = "RESOLVED"; execution.currentStepId = null; execution.logs.push({ stepId: step.id, event: "RESOLVED", response, createdAt: now }); }
  else { const branchTarget = step.type === "branch" ? step.branches?.find((branch) => branch.equals.toLowerCase() === response.trim().toLowerCase())?.nextStepId : undefined; execution.currentStepId = branchTarget ?? sop.steps.find((item) => item.order === step.order + 1)?.id ?? null; if (!execution.currentStepId) throw new Error("SOP ended without resolve or escalation."); }
  execution.updatedAt = now; return execution;
}

export function currentSopStep(execution: SopExecution, sop: SopDefinition) { return sop.steps.find((step) => step.id === execution.currentStepId) ?? null; }
