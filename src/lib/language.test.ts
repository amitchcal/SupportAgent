import assert from "node:assert/strict";
import test from "node:test";
import { localizedMessage, technicalTerms, type TranslationAdapter } from "./language";

test("full C4 language set extracts and preserves technical terms",()=>{assert.deepEqual(technicalTerms("Fehler PLC S7-1200, alarm E104 and ISO-13849"),["PLC","S7-1200","E104","ISO-13849"])});
test("original and translated content are stored separately",async()=>{const adapter:TranslationAdapter={async translate(text,_source,_target,terms){return `English: ${text} ${terms.join(" ")}`}};const message=await localizedMessage({id:"m1",tenantId:"t1",conversationId:"c1",role:"USER",content:"Motor X200 Fehler E104",createdAt:new Date(0).toISOString()},"de","en",adapter);assert.equal(message.originalContent,"Motor X200 Fehler E104");assert.match(message.translatedContent??"",/^English:/);assert.deepEqual(message.preservedTerms,["X200","E104"])});
test("translation rejects providers that alter a protected technical identifier",async()=>{const adapter:TranslationAdapter={async translate(){return "translated without identifier"}};await assert.rejects(localizedMessage({id:"m1",tenantId:"t1",conversationId:"c1",role:"USER",content:"PLC E104",createdAt:"now"},"fr","en",adapter),/protected technical term/)});
