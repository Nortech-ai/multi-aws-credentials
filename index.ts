import { Command } from "commander";
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import type { IPackageJson } from "package-json-type";
import { join } from "path";

const program = new Command();

const packageDetails = getCurrentPackageDetails();
program
  .version(packageDetails.version!)
  .name(packageDetails.name!)
  .description(packageDetails.description!);

const awsPath = join(homedir(), ".aws");
const mainFilePath = join(awsPath, "credentials");

program
  .command("add")
  .description("Add a profile")
  .argument("<name>", "Profile name")
  .argument("<id>", "Aws access key id")
  .argument("<secret>", "Aws access key secret")
  .action((name: string, id: string, secret: string) => {
    const filePath = getFilePath(name);
    if (existsSync(filePath)) {
      console.error(
        `[ERROR] Profile ${name} already exists. If you want to replace it, explicitly use the replace command 
        multi-aws-credentials replace <name> <id> <secret>`
      );
      process.exit(1);
    }
    writeProfileFile(filePath, id, secret);
    console.log(`Profile ${name} added to ${filePath}`);
  });

program
  .command("change")
  .description("Change the current (default) profile")
  .argument("<name>", "Profile name")
  .action((name: string) => {
    const filePath = getFilePath(name);
    const contents = readFileSync(filePath, "utf-8");
    writeFileSync(mainFilePath, contents);
    console.log(
      `Changed active profile in ${mainFilePath} to ${name} in ${filePath}`
    );
  });
program
  .command("list")
  .description("list profiles")
  .action(() => {
    console.log(
      readdirSync(awsPath)
        .filter((file) => file.endsWith(".creds"))
        .map((file) => file.replace(".creds", ""))
        .join("\n")
    );
  });

program
  .command("rename")
  .description("Rename a profile")
  .argument("<current-name>", "Current profile name")
  .argument("<new-name>", "New Profile name")
  .action((currentName: string, newName: string) => {
    const currentFilePath = getFilePath(currentName);
    if (existsSync(currentFilePath)) {
      const newFilePath = getFilePath(newName);
      cpSync(currentFilePath, newFilePath);
      unlinkSync(currentFilePath);
      console.log(
        `Profile ${currentName} moved to ${newName} as ${newFilePath}`
      );
    } else {
      console.log(`Profile ${currentName} not found in ${currentFilePath}`);
    }
  });

program
  .command("upsert")
  .description("Add a profile if it doesn't exist, otherwise replace it")
  .argument("<name>", "Profile name")
  .argument("<id>", "Aws access key id")
  .argument("<secret>", "Aws access key secret")
  .action((name: string, id: string, secret: string) => {
    const filePath = getFilePath(name);
    if (existsSync(filePath)) {
      writeProfileFile(filePath, id, secret);
      console.log(`Profile ${name} replaced in ${filePath}`);
    } else {
      writeProfileFile(filePath, id, secret);
      console.log(`Profile ${name} added to ${filePath}`);
    }
  });

program
  .command("replace")
  .description("Replace a profile")
  .argument("<current-name>", "Current profile name")
  .argument("<new-id>", "New access key id")
  .argument("<new-secret>", "New access key secret")
  .action((currentName: string, newId: string, newSecret: string) => {
    const currentFilePath = getFilePath(currentName);
    if (existsSync(currentFilePath)) {
      writeProfileFile(currentFilePath, newId, newSecret);
      console.log(`Profile ${currentName} replaced in ${currentFilePath}`);
    } else {
      console.error(
        `[ERROR] Profile ${currentName} not found in ${currentFilePath}`
      );
      process.exit(1);
    }
  });

program
  .command("remove")
  .description("Remove a profile")
  .argument("<name>", "Profile name")
  .action((name: string) => {
    const filePath = getFilePath(name);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      console.log(`Profile ${name} removed from ${filePath}`);
    } else {
      console.log(`Profile ${name} not found in ${filePath}`);
    }
  });

program.parse();

function writeProfileFile(filePath: string, id: string, secret: string) {
  writeFileSync(
    filePath,
    `[default]\naws_access_key_id = ${id}\naws_secret_access_key = ${secret}`
  );
}

function getFilePath(name: string) {
  return join(awsPath, `${name}.creds`);
}

function getCurrentPackageDetails() {
  return JSON.parse(
    readFileSync(join(__dirname, "package.json"), "utf-8")
  ) as IPackageJson;
}
