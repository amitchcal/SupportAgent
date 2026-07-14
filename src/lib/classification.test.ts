import assert from "node:assert/strict";
import test from "node:test";
import { classifyIssue, detectSafetyRisk, extractIssueDetails, responseFor } from "./classification";

test("safety signals override normal engineering classification", () => {
  const input = "Hydraulic pump has a high pressure leak and there is smoke";
  assert.deepEqual(detectSafetyRisk(input), ["smoke", "high pressure leak"]);
  assert.deepEqual(classifyIssue(input), { category: "Safety", severity: "critical", urgency: "immediate", confidence: 0.99 });
  const response = responseFor("en", { safetyReasons: detectSafetyRisk(input), confidence: 0.99, threshold: 0.72, clarificationCount: 0, summary: input });
  assert.equal(response.status, "ESCALATED");
  assert.match(response.content, /Do not continue troubleshooting/);
});

test("engineering categories and severity clues are captured", () => {
  const classification = classifyIssue("PLC HMI shows alarm E-204 and production is down");
  assert.equal(classification.category, "PLC/Automation");
  assert.equal(classification.severity, "medium");
  const details = extractIssueDetails("Model AX-20 shows error E-204 after production shutdown", { equipmentId: "LINE-4", site: "Pune" });
  assert.equal(details.model, "AX-20");
  assert.equal(details.errorCode, "E-204");
  assert.equal(details.asset, "LINE-4");
  assert.ok(details.severityClues.includes("shutdown"));
});

test("low confidence asks once, then escalates instead of guessing", () => {
  const first = responseFor("hinglish", { safetyReasons: [], confidence: 0.35, threshold: 0.72, clarificationCount: 0, summary: "It is strange" });
  assert.equal(first.status, "AWAITING_CLARIFICATION");
  assert.match(first.lowConfidenceReason ?? "", /below tenant threshold/);
  const second = responseFor("hinglish", { safetyReasons: [], confidence: 0.35, threshold: 0.72, clarificationCount: 1, summary: "Still strange" });
  assert.equal(second.status, "ESCALATED");
});

test("selected language controls assistant response", () => {
  const hindi = responseFor("hi", { safetyReasons: [], confidence: 0.9, threshold: 0.72, clarificationCount: 0, summary: "मोटर बंद है" });
  assert.equal(hindi.status, "AWAITING_CONFIRMATION");
  assert.match(hindi.content, /कृपया/);
});
