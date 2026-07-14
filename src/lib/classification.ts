import type { Classification, IssueCategory, IssueDetails, SupportedLanguage } from "./domain";

const safetySignals = ["fire", "smoke", "burning smell", "gas leak", "chemical leak", "electric shock", "injury", "explosion", "emergency stop failure", "high pressure leak", "severe vibration"];
const categorySignals: Array<[IssueCategory, string[]]> = [
  ["Electrical", ["voltage", "current", "breaker", "motor", "power", "electrical", "electric"]],
  ["PLC/Automation", ["plc", "automation", "hmi", "ladder", "controller", "sensor input"]],
  ["Hydraulic", ["hydraulic", "oil pressure", "cylinder", "hydraulic leak"]],
  ["Pneumatic", ["pneumatic", "air pressure", "compressor", "air leak"]],
  ["Instrumentation", ["instrument", "transmitter", "sensor", "reading", "signal"]],
  ["Mechanical", ["bearing", "gear", "shaft", "noise", "vibration", "jam", "mechanical"]],
  ["Calibration", ["calibration", "calibrate", "accuracy", "deviation"]],
  ["Installation", ["install", "commission", "wiring diagram", "setup"]],
  ["Warranty", ["warranty", "guarantee", "claim"]],
  ["Spare Parts", ["spare", "part number", "replacement part"]],
  ["Documentation", ["manual", "document", "drawing", "datasheet"]],
  ["Preventive Maintenance", ["maintenance", "service interval", "lubrication", "inspection"]],
];

export function detectSafetyRisk(input: string) {
  const normalized = input.toLowerCase();
  return safetySignals.filter((signal) => normalized.includes(signal));
}

export function classifyIssue(input: string): Classification {
  const normalized = input.toLowerCase(); const safety = detectSafetyRisk(input);
  if (safety.length) return { category: "Safety", severity: "critical", urgency: "immediate", confidence: 0.99 };
  const matched = categorySignals.map(([category, signals]) => ({ category, hits: signals.filter((signal) => normalized.includes(signal)).length })).sort((a, b) => b.hits - a.hits)[0];
  const critical = /stopped production|total shutdown|cannot stop|danger/.test(normalized);
  const high = critical || /not working|failed|failure|down|alarm|error/.test(normalized);
  return { category: matched?.hits ? matched.category : "Other", severity: critical ? "high" : high ? "medium" : "low", urgency: critical ? "urgent" : high ? "soon" : "routine", confidence: matched?.hits ? Math.min(0.96, 0.68 + matched.hits * 0.12) : 0.35 };
}

export function extractIssueDetails(input: string, contact: Record<string, string>): IssueDetails {
  const code = input.match(/(?:error|code|alarm)\s*[:#-]?\s*([a-z]{0,3}[- ]?\d{2,6})/i)?.[1] ?? "";
  const serial = input.match(/(?:serial|s\/n)\s*[:#-]?\s*([a-z0-9-]{4,})/i)?.[1] ?? "";
  const model = input.match(/model\s*[:#-]?\s*([a-z0-9-]{2,})/i)?.[1] ?? "";
  const site = contact.site ?? ""; const asset = contact.equipmentId ?? contact.asset ?? "";
  const missingQuestions = [...(!asset ? ["equipmentId"] : []), ...(!model ? ["model"] : []), ...(!serial ? ["serialNumber"] : []), ...(!site ? ["site"] : [])];
  const severityClues = ["stopped production", "shutdown", "injury", "leak", "smoke", "fire"].filter((clue) => input.toLowerCase().includes(clue));
  return { summary: input.trim().replace(/\s+/g, " ").slice(0, 280), asset, model, serialNumber: serial, errorCode: code, site, severityClues, missingQuestions };
}

const copy = {
  en: { safety: (reason: string) => `I detected a possible safety risk (${reason}). Do not continue troubleshooting. Move to a safe location, follow your site's emergency procedure, and contact emergency or on-call support now. This session has been escalated.`, clarify: "I don't have enough confidence to guide you safely yet. Please add the equipment type, model, error code, and what changed immediately before the issue.", escalate: "I still cannot identify a safe, reliable troubleshooting path. I have escalated this session for human review.", confirm: (summary: string) => `I understood the issue as: “${summary}” Please confirm this summary before troubleshooting begins.` },
  hi: { safety: (reason: string) => `संभावित सुरक्षा जोखिम मिला है (${reason})। समस्या निवारण जारी न रखें। सुरक्षित स्थान पर जाएँ, साइट की आपातकालीन प्रक्रिया अपनाएँ और तुरंत आपातकालीन या ऑन-कॉल सहायता से संपर्क करें। यह सत्र एस्केलेट कर दिया गया है।`, clarify: "सुरक्षित मार्गदर्शन देने के लिए पर्याप्त जानकारी नहीं है। कृपया उपकरण का प्रकार, मॉडल, त्रुटि कोड और समस्या से ठीक पहले क्या बदला था, बताएं।", escalate: "मैं अभी भी सुरक्षित और विश्वसनीय समाधान पहचान नहीं पाया। यह सत्र मानव सहायता के लिए एस्केलेट कर दिया गया है।", confirm: (summary: string) => `मैंने समस्या इस प्रकार समझी: “${summary}” कृपया समस्या निवारण शुरू होने से पहले इसकी पुष्टि करें।` },
  hinglish: { safety: (reason: string) => `Possible safety risk mila hai (${reason}). Troubleshooting continue mat karein. Safe location par jaayein, site emergency procedure follow karein aur emergency ya on-call support ko abhi contact karein. Session escalate kar diya gaya hai.`, clarify: "Safe guidance ke liye abhi enough information nahi hai. Equipment type, model, error code aur issue se just pehle kya change hua tha, please batayein.", escalate: "Safe aur reliable troubleshooting path identify nahi ho paaya. Session human review ke liye escalate kar diya gaya hai.", confirm: (summary: string) => `Maine issue aise samjha: “${summary}” Troubleshooting se pehle please confirm karein.` },
};

export function responseFor(language: SupportedLanguage, input: { safetyReasons: string[]; confidence: number; threshold: number; clarificationCount: number; summary: string }) {
  const languageCopy = language in copy ? copy[language as keyof typeof copy] : copy.en;
  if (input.safetyReasons.length) return { content: languageCopy.safety(input.safetyReasons.join(", ")), status: "ESCALATED" as const, lowConfidenceReason: null };
  if (input.confidence < input.threshold) return input.clarificationCount > 0 ? { content: languageCopy.escalate, status: "ESCALATED" as const, lowConfidenceReason: `Classification confidence ${input.confidence.toFixed(2)} remained below tenant threshold ${input.threshold.toFixed(2)}.` } : { content: languageCopy.clarify, status: "AWAITING_CLARIFICATION" as const, lowConfidenceReason: `Classification confidence ${input.confidence.toFixed(2)} is below tenant threshold ${input.threshold.toFixed(2)}.` };
  return { content: languageCopy.confirm(input.summary), status: "AWAITING_CONFIRMATION" as const, lowConfidenceReason: null };
}
