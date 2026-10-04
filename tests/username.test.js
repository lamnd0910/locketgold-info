import assert from "node:assert/strict";
import test from "node:test";
import { parsePastedUsername } from "../src/username.js";

test("pasted Locket profile links resolve to the username", () => {
  for (const value of [
    "https://locket.cam/andong",
    " https://locket.cam/andong \n",
    "https://www.locket.camera/@andong?ref=invite",
    "https://locket.cam/andong/",
    "https://locket.camera/?username=%40andong",
    "@andong",
  ]) {
    assert.equal(parsePastedUsername(value), "andong", value);
  }
});

test("pasted links cannot bypass username or profile validation", () => {
  for (const value of [
    "https://locket.cam.evil.example/andong",
    "https://example.com/andong",
    "https://locket.camera/links/invite-id",
    "https://locket.cam/?username=alice%20bob",
    "https://locket.cam/?username=" + "a".repeat(65),
    "https://locket.cam/%E0%A4%A",
  ]) {
    assert.equal(parsePastedUsername(value), "", value);
  }
});
