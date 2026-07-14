import assert from "node:assert/strict";
import test from "node:test";
import { extractDocumentText } from "./knowledge";
import { anonymizedRateLimitKey, applyRateLimit } from "./rate-limit";
import { isPrivateNetworkAddress, validateOutboundEndpoint } from "./ticketing";
import type { RateLimitEntry } from "./domain";

test("rate limiting blocks excess requests and resets after its window", () => {
  const key = anonymizedRateLimitKey("login", "127.0.0.1:admin@example.com");
  assert.equal(key.includes("admin@example.com"), false);
  let entries: RateLimitEntry[] = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const applied = applyRateLimit(entries, key, 2, 60, new Date(0));
    entries = applied.entries;
    assert.equal(applied.result.allowed, attempt <= 2);
  }
  const reset = applyRateLimit(entries, key, 2, 60, new Date(61_000));
  assert.equal(reset.result.allowed, true);
});

test("outbound ticketing rejects local and private destinations", () => {
  assert.equal(isPrivateNetworkAddress("10.1.2.3"), true);
  assert.equal(isPrivateNetworkAddress("192.168.1.2"), true);
  assert.equal(isPrivateNetworkAddress("8.8.8.8"), false);
  assert.throws(() => validateOutboundEndpoint("http://tickets.example/hook"), /HTTPS/);
  assert.throws(() => validateOutboundEndpoint("https://127.0.0.1/hook"), /private/);
  assert.throws(() => validateOutboundEndpoint("https://service.internal/hook"), /private/);
  assert.equal(validateOutboundEndpoint("https://tickets.example/hook").hostname, "tickets.example");
});

test("plain-text knowledge extraction is chunk-ready", async () => {
  assert.equal(await extractDocumentText("txt", Buffer.from("Hydraulic pressure reset")), "Hydraulic pressure reset");
});
