#!/usr/bin/env node

import { Command } from "commander";
import * as crypto from "crypto";
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

const read = require("read") as (opts: {
  prompt: string;
  silent?: boolean;
  replace?: string;
  output?: NodeJS.WritableStream;
}) => Promise<string>;
const program = new Command();

const packageDetails = getCurrentPackageDetails();
program
  .version(packageDetails.version!)
  .name(packageDetails.name!.replace("@nortech/", ""))
  .description(packageDetails.description!);

const awsPath = join(homedir(), ".aws");
const mainFilePath = join(awsPath, "credentials");

program
  .command("add")
  .description("Add a profile")
  .argument("<name>", "Profile name")
  .argument(
    "[id]",
    "Aws access key id, optional (will read from stdin if not provided)"
  )
  .argument(
    "[secret]",
    "Aws access key secret, optional (will read from stdin if not provided)"
  )
  .option(
    "--password",
    "Reads a password from stdin to encrypt the credentials, will be requested when using the profile"
  )
  .action(
    async (
      name: string,
      id?: string,
      secret?: string,
      options: { password: boolean } = { password: false }
    ) => {
      if (!id) {
        id = await askForInput("Aws access key id");
      }
      if (!secret) {
        secret = await askForInput("Aws access key secret");
      }
      const filePath = getFilePath(name);
      if (existsSync(filePath)) {
        console.error(
          `[ERROR] Profile ${name} already exists. If you want to replace it, explicitly use the replace command
  multi-aws-credentials replace <name> <id> <secret>`
        );
        process.exit(1);
      }

      const contents = await makeContentsWithOrWithoutPassword(
        options.password,
        id,
        secret
      );

      writeFileSync(filePath, contents);
      console.log(`Profile ${name} added to ${filePath}`);
    }
  );

program
  .command("change")
  .description("Change the current (default) profile")
  .argument("<name>", "Profile name")
  .action(async (name: string) => {
    const filePath = getFilePath(name);
    const contents = await returnOrDecryptContents(
      readFileSync(filePath, "utf-8")
    );
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
  .argument(
    "[id]",
    "Aws access key id, optional (will read from stdin if not provided)"
  )
  .argument(
    "[secret]",
    "Aws access key secret, optional (will read from stdin if not provided)"
  )
  .option(
    "--password",
    "Reads a password from stdin to encrypt the credentials, will be requested when using the profile"
  )
  .action(
    async (
      name: string,
      id?: string,
      secret?: string,
      options: { password: boolean } = { password: false }
    ) => {
      if (!id) {
        id = await askForInput("Aws access key id");
      }
      if (!secret) {
        secret = await askForInput("Aws access key secret");
      }
      const filePath = getFilePath(name);
      const contents = await makeContentsWithOrWithoutPassword(
        options.password,
        id,
        secret
      );
      if (existsSync(filePath)) {
        console.log(`Profile ${name} replaced in ${filePath}`);
      } else {
        console.log(`Profile ${name} added to ${filePath}`);
      }
      writeFileSync(filePath, contents);
    }
  );

program
  .command("env")
  .description(
    "Outputs a profile as shell compatible variable exports, for use with eval"
  )
  .argument("<name>", "Profile name")
  .action(async (name: string) => {
    const filePath = getFilePath(name);
    const contents = await returnOrDecryptContents(
      readFileSync(filePath, "utf-8")
    );
    const lines = contents.split("\n");
    const id = lines
      .find((line) => line.startsWith("aws_access_key_id"))!
      .split("=")[1]
      .trim();
    const secret = lines
      .find((line) => line.startsWith("aws_secret_access_key"))!
      .split("=")[1]
      .trim();
    console.log(`export AWS_ACCESS_KEY_ID="${id}"`);
    console.log(`export AWS_SECRET_ACCESS_KEY="${secret}"`);
    console.log(`export ACTIVE_AWS_PROFILE="${name}"`);
  });

program
  .command("replace")
  .description("Replace a profile")
  .argument("<current-name>", "Current profile name")
  .argument("<new-id>", "New access key id")
  .argument("<new-secret>", "New access key secret")
  .option(
    "--password",
    "Reads a password from stdin to encrypt the credentials"
  )
  .action(
    async (
      currentName: string,
      newId: string,
      newSecret: string,
      options: { password: boolean }
    ) => {
      const currentFilePath = getFilePath(currentName);
      if (existsSync(currentFilePath)) {
        writeFileSync(
          currentFilePath,
          await makeContentsWithOrWithoutPassword(
            options.password,
            newId,
            newSecret
          )
        );
        console.log(`Profile ${currentName} replaced in ${currentFilePath}`);
      } else {
        console.error(
          `[ERROR] Profile ${currentName} not found in ${currentFilePath}`
        );
        process.exit(1);
      }
    }
  );

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

async function makeContentsWithOrWithoutPassword(
  usePassword: boolean,
  id: string,
  secret: string
) {
  const password = usePassword
    ? await askForInput("Password", true)
    : undefined;

  const contents = makeProfileContents(id, secret);
  let finalContents = password ? encryptContents(password, contents) : contents;
  return finalContents;
}

function encryptContents(password: string, contents: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    hashPassword(password),
    iv
  );
  const finalContents = Buffer.concat([
    cipher.update(contents),
    cipher.final(),
  ]);
  const c = {
    iv: iv.toString("base64"),
    contents: finalContents.toString("base64"),
  };
  return "ENCRYPTED|" + JSON.stringify(c);
}

async function returnOrDecryptContents(contents: string) {
  const password = contents.startsWith("ENCRYPTED|")
    ? await askForInput("Password", true)
    : undefined;
  return password ? decryptContents(password, contents) : contents;
}

async function decryptContents(password: string, rawContents: string) {
  const c = JSON.parse(rawContents.split("|")[1]);
  const contents = Buffer.from(c.contents, "base64");
  const iv = Buffer.from(c.iv, "base64");
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    hashPassword(password),
    iv
  );
  const decrypted = Buffer.concat([
    decipher.update(contents),
    decipher.final(),
  ]).toString("utf-8");
  return decrypted;
}

function makeProfileContents(id: string, secret: string): string {
  return `[default]\naws_access_key_id = ${id}\naws_secret_access_key = ${secret}`;
}

function getFilePath(name: string) {
  return join(awsPath, `${name}.creds`);
}

function getCurrentPackageDetails() {
  return JSON.parse(
    readFileSync(join(__dirname, "package.json"), "utf-8")
  ) as IPackageJson;
}
function askForInput(thing: string, silent = false): Promise<string> {
  return read({
    prompt: `${thing}: `,
    silent,
    replace: silent ? "*" : undefined,
    output: process.stderr,
  });
}

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest();
}
