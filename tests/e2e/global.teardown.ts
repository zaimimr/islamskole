import { test as teardown } from "playwright/test";
import { cleanupTestData, restoreActiveYear } from "./fixtures";

teardown("restore active school year and remove test data", async () => {
  await restoreActiveYear();
  cleanupTestData();
});
