import assert from "node:assert/strict";import test from "node:test";import { retryState } from "./ticketing";
test("ticket retry moves repeated failures to dead letter",()=>{assert.equal(retryState(2),"CREATION_FAILED");assert.equal(retryState(3),"DEAD_LETTER");});
