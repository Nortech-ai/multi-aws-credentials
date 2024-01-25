#!/usr/bin/env node

import { execSync } from "child_process";
import { Command } from "commander";
import { assert } from "console";
import * as crypto from "crypto";
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
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
  .argument(
    "[region]",
    "Aws region, optional (will read from stdin if not provided)"
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
      region?: string,
      options: { password: boolean } = { password: false }
    ) => {
      if (!id) {
        id = await askForInput("Aws access key id");
      }
      if (!secret) {
        secret = await askForInput("Aws access key secret");
      }
      if (!region) {
        region = await askForInput("Aws region [Optional]");
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
        secret,
        region
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
      readFileSync(filePath, "utf-8"),
      name
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
  .argument(
    "[region]",
    "Aws region, optional (will read from stdin if not provided)"
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
      region?: string,
      options: { password: boolean } = { password: false }
    ) => {
      if (!id) {
        id = await askForInput("Aws access key id");
      }
      if (!secret) {
        secret = await askForInput("Aws access key secret");
      }
      if (!region) {
        region = await askForInput("Aws region [Optional]");
      }
      const filePath = getFilePath(name);
      const contents = await makeContentsWithOrWithoutPassword(
        options.password,
        id,
        secret,
        region
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
  .option("--json", "Outputs raw json")
  .action(
    async (name: string, options: { json: boolean } = { json: false }) => {
      const env = await getProfileEnv(name);
      if (options.json) {
        console.log(JSON.stringify(env));
      } else {
        Object.entries(env).forEach(([key, value]) => {
          console.log(`export ${key}="${value}"`);
        });
      }
    }
  );

program
  .command("env-run")
  .description(
    "Run a command with configured environment variables. Pass command after -- or through stdin"
  )
  .argument("<name>", "Profile name")
  .argument("[script...]", "Script to run")
  .action(async (name: string, args?: string[]) => {
    const stdinIsTTY = process.stdin.isTTY;
    assert(stdinIsTTY || args, "Must pass script when not using stdin");
    const script =
      (!args || args.length === 0) && stdinIsTTY
        ? readFileSync(0, "utf-8")
        : args!.join(" ");
    const env = await getProfileEnv(name);
    execSync(script, {
      stdio: "inherit",
      env: {
        ...process.env,
        ...env,
      },
    });
  });

program
  .command("encrypt")
  .description("Encrypt a profile with a password")
  .argument("<name>", "Profile name")
  .action(async (name: string) => {
    const filePath = getFilePath(name);
    if (!existsSync(filePath)) {
      console.error(`[ERROR] Profile ${name} not found in ${filePath}`);
      process.exit(1);
    }
    const contents = readFileSync(filePath, "utf-8");
    if (contentIsEncrypted(contents)) {
      console.log(`Profile ${name} already encrypted in ${filePath}`);
      console.log("Reencrypting with new password");
    }
    const config = await returnOrDecryptContents(contents, name);
    const password = await askForInput("Password", true);
    writeFileSync(filePath, encryptContents(password, config));

    console.log(`Profile ${name} encrypted in ${filePath}`);
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

async function getProfileEnv(name: string) {
  if (process.env.ACTIVE_AWS_PROFILE === name) {
    return {
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
      ACTIVE_AWS_PROFILE: process.env.ACTIVE_AWS_PROFILE,
    };
  } else {
    const contents = await getProfileContents(name);
    const env = {
      AWS_ACCESS_KEY_ID: contents.id,
      AWS_SECRET_ACCESS_KEY: contents.secret,
      AWS_DEFAULT_REGION: contents.region,
      ACTIVE_AWS_PROFILE: name,
    };
    return Object.fromEntries(
      Object.entries(env).filter(([, value]) => value !== undefined)
    );
  }
}

async function getProfileContents(name: string) {
  const filePath = getFilePath(name);
  const contents = await returnOrDecryptContents(
    readFileSync(filePath, "utf-8"),
    name
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
  const region = extractRegionFromConfig(contents);
  return { id, secret, region };
}

async function makeContentsWithOrWithoutPassword(
  usePassword: boolean,
  id: string,
  secret: string,
  region?: string
) {
  const password = usePassword
    ? await askForInput("Password", true)
    : undefined;

  const contents = makeProfileContents(id, secret, region);
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

async function returnOrDecryptContents(contents: string, username?: string) {
  const password = contentIsEncrypted(contents)
    ? await askForInput(
        `Password for aws user ${username ? `(${username})` : ""}`,
        true
      )
    : undefined;
  return password ? decryptContents(password, contents) : contents;
}

function contentIsEncrypted(contents: string) {
  return contents.startsWith("ENCRYPTED|");
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

function makeProfileContents(
  id: string,
  secret: string,
  region?: string
): string {
  return `[default]\naws_access_key_id = ${id}\naws_secret_access_key = ${secret}\n${
    region ? `region = ${region}\n` : ""
  }`;
}

function extractRegionFromConfig(config: string) {
  const lines = config.split("\n");
  const regionLine = lines.find((line) => line.startsWith("region"));
  if (regionLine) {
    return regionLine.split("=")[1].trim();
  }
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
