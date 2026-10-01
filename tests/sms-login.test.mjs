import assert from "node:assert/strict";
import test from "node:test";
import {
  formatNorwegianMobile,
  generateLoginCode,
  hashLoginCode,
  isLoginCode,
  normalizeNorwegianMobile,
} from "../src/lib/sms-login-core.ts";

test("normalizeNorwegianMobile accepts common Norwegian formats", () => {
  for (const value of [
    "91234567",
    "912 34 567",
    "+4791234567",
    "+47 912 34 567",
    "004791234567",
    "0047 912 34 567",
    "4791234567",
    "(+47) 912-34-567",
    "912.34.567",
  ]) {
    assert.equal(normalizeNorwegianMobile(value), "+4791234567", value);
  }
  assert.equal(normalizeNorwegianMobile("41 23 45 67"), "+4741234567");
});

test("normalizeNorwegianMobile rejects anything that is not a Norwegian mobile", () => {
  for (const value of [
    null,
    undefined,
    "",
    "1234567",
    "912345678",
    "67123456",
    "+46701234567",
    "+47 6712 3456",
    "abc91234567",
    "91234567x",
  ]) {
    assert.equal(normalizeNorwegianMobile(value), null, String(value));
  }
});

test("generateLoginCode returns six digits", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateLoginCode();
    assert.match(code, /^\d{6}$/);
    assert.ok(isLoginCode(code));
  }
});

test("isLoginCode only accepts exactly six digits", () => {
  assert.ok(isLoginCode("000123"));
  for (const value of ["", "12345", "1234567", "12 345", "abcdef", "12345a"]) {
    assert.equal(isLoginCode(value), false, value);
  }
});

test("hashLoginCode is stable, peppered and bound to the phone", () => {
  const hash = hashLoginCode("+4791234567", "123456", "pepper");
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, hashLoginCode("+4791234567", "123456", "pepper"));
  assert.notEqual(hash, hashLoginCode("+4791234567", "123457", "pepper"));
  assert.notEqual(hash, hashLoginCode("+4791234568", "123456", "pepper"));
  assert.notEqual(hash, hashLoginCode("+4791234567", "123456", "other"));
  assert.ok(!hash.includes("123456"));
});

test("formatNorwegianMobile groups a normalized number for display", () => {
  assert.equal(formatNorwegianMobile("+4791234567"), "+47 912 34 567");
  assert.equal(formatNorwegianMobile("12345"), "12345");
});
