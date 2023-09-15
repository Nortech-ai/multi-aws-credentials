const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const {
  add,
  change,
  rename,
  upsert,
  env,
  envRun,
  encrypt,
  remove,
} = require("../index.ts");

describe("Main flow", () => {
  const awsFolderPath = path.join(__dirname, ".aws");

  beforeEach(() => {
    if (fs.existsSync(awsFolderPath)) {
      fs.rmdirSync(awsFolderPath, { recursive: true });
    }
  });

  test("add command creates .aws folder if it does not exist", () => {
    add("test", "id", "secret", "region");
    expect(fs.existsSync(awsFolderPath)).toBe(true);
  });

  // Add similar tests for the other commands
});
