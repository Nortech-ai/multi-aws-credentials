#!/usr/bin/env ts-node --swc

import { Command } from "commander"
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs"
import { homedir } from "os"
import type { IPackageJson } from "package-json-type"
import { join } from "path"

const program = new Command()

const packageDetails = getCurrentPackageDetails()
program.version(packageDetails.version!).name(packageDetails.name!).description(packageDetails.description!)

const awsPath = join(homedir(), ".aws")
const mainFilePath = join(awsPath, "credentials")

program.command("add")
    .argument("<name>", "Profile name")
    .argument("<id>", "Aws access key id")
    .argument("<secret>", "Aws access key secret")
    .action((name, id, secret) => {
        const filePath = getFilePath(name)
        writeFileSync(filePath, `[default]\naws_access_key_id = ${id}\naws_secret_access_key = ${secret}`)
        console.log(`Profile ${name} added to ${filePath}`)
    })

program.command("change")
    .argument("<name>", "Profile name")
    .action((name) => {
        const filePath = getFilePath(name)
        const contents = readFileSync(filePath, "utf-8")
        writeFileSync(mainFilePath, contents)
        console.log(`Changed active profile in ${mainFilePath} to ${name} in ${filePath}`)
    })
program.command("list").action(() => {
    console.log(readdirSync("${homedir()}/.aws").filter((file) => file.endsWith(".creds")))
})
program.command("remove", "Remove profile").argument("<name>", "Profile name").action((name) => {
    const filePath = getFilePath(name)
    if (existsSync(filePath)) {
        unlinkSync(filePath)
        console.log(`Profile ${name} removed from ${filePath}`)
    }
    else {
        console.log(`Profile ${name} not found in ${filePath}`)
    }
})

program.parse()

function getFilePath(name: string) {
    return join(awsPath, `${name}.creds`)
}

function getCurrentPackageDetails() {
    return JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8")) as IPackageJson
}
