import { expect, test } from "playwright/test";
import { decideFamilyMatch } from "../src/lib/families/matching";
import { familyDisplayName } from "../src/lib/families/naming";

test("keeps explicit family names after whitespace normalization", () => {
  expect(
    familyDisplayName({
      familyId: "10000000-0000-0000-0000-000000000000",
      displayName: "  Familien   Noor  ",
      guardians: [{ lastName: "Ahmed" }],
      students: [],
    }),
  ).toBe("Familien Noor");
});

test("builds a stable guardian-based family name", () => {
  const family = {
    familyId: "10000000-0000-0000-0000-000000000000",
    displayName: null,
    guardians: [
      { lastName: "Åsen" },
      { lastName: "hansen" },
      { lastName: "Hansen" },
    ],
    students: [{ lastName: "Noor" }],
  };

  expect(familyDisplayName(family)).toBe("Familien Hansen / Åsen");
  expect(
    familyDisplayName({ ...family, guardians: [...family.guardians].reverse() }),
  ).toBe("Familien Hansen / Åsen");
});

test("falls back to a stable identifier when surnames are unavailable", () => {
  expect(
    familyDisplayName({
      familyId: "a1b2c3d4-0000-0000-0000-000000000000",
      displayName: null,
      guardians: [{ lastName: " " }],
      students: [],
    }),
  ).toBe("Familie A1B2C3D4");
});

test("reuses a family only when a shared payment is durable evidence", () => {
  expect(
    decideFamilyMatch(
      {
        paymentId: "payment-1",
        guardianEmails: ["new@example.no"],
        guardianPhones: [],
      },
      [
        {
          familyId: "family-1",
          paymentIds: ["payment-1"],
          guardianEmails: [],
          guardianPhones: [],
        },
      ],
    ),
  ).toEqual({ kind: "reuse", familyId: "family-1" });
});

test("does not merge applications from contact details alone", () => {
  expect(
    decideFamilyMatch(
      {
        paymentId: null,
        guardianEmails: [" Family@Example.no "],
        guardianPhones: ["+47 900 00 000"],
      },
      [
        {
          familyId: "family-1",
          paymentIds: [],
          guardianEmails: ["family@example.no"],
          guardianPhones: ["+4790000000"],
        },
      ],
    ),
  ).toEqual({
    kind: "create_with_review",
    category: "possible_duplicate_family",
    candidateFamilyIds: ["family-1"],
  });
});

test("routes conflicting shared-payment links to review", () => {
  expect(
    decideFamilyMatch(
      { paymentId: "payment-1", guardianEmails: [], guardianPhones: [] },
      [
        {
          familyId: "family-2",
          paymentIds: ["payment-1"],
          guardianEmails: [],
          guardianPhones: [],
        },
        {
          familyId: "family-1",
          paymentIds: ["payment-1"],
          guardianEmails: [],
          guardianPhones: [],
        },
      ],
    ),
  ).toEqual({
    kind: "review",
    category: "shared_payment_family_conflict",
    candidateFamilyIds: ["family-1", "family-2"],
  });
});
