import assert from "node:assert/strict";import test from "node:test";import { validateThemeColors } from "./theme";
test("theme saving rejects invalid colors",()=>{assert.throws(()=>validateThemeColors(["red","#123456"]),/hexadecimal/);assert.equal(validateThemeColors(["#123456","#ABCDEF"]),true);});
