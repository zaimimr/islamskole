import assert from "node:assert/strict";
import test from "node:test";
import { describeParentChange } from "../src/lib/parent-change-summary.ts";
import { isValidPhone } from "../src/lib/portal/family-types.ts";

test("describeParentChange lists the changed fields in Norwegian", () => {
  assert.equal(
    describeParentChange("portal.child.update", {
      changes: { child_first_name: { from: "A", to: "B" }, child_email: { from: null, to: "x@y.no" } },
    }),
    "barnets opplysninger: fornavn, e-post",
  );
  assert.equal(
    describeParentChange("portal.child.health", { changes: { allergies: { from: null, to: "Nøtter" } } }),
    "helse og samtykke: allergier",
  );
});

test("describeParentChange falls back to the action label", () => {
  assert.equal(describeParentChange("portal.guardian.remove", { removed: { first_name: "A" } }), "fjernet foresatt");
  assert.equal(describeParentChange("portal.ukjent", null), "opplysninger");
});

test("isValidPhone accepts Norwegian and international numbers", () => {
  for (const value of ["91234567", "912 34 567", "+47 912 34 567", "+4791234567", "0047-912-34-567"]) {
    assert.equal(isValidPhone(value), true, value);
  }
  for (const value of ["", "123", "abc12345", "+47 912 34 567 890 123"]) {
    assert.equal(isValidPhone(value), false, value);
  }
});
