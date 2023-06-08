## Multi aws credentials

Simple tool to manage multiple aws credentials locally for when aws cli profiles are not enough.

Supports password encryption, and receiving values from stdin to prevent shell history leakage.

As a preferred mode of operation, it loads your credentials into your shell env instead, meaning there are no unencrypted credential files on disk.

## Installation

- npm: npm install -g @nortech/multi-aws-credentials
- yarn: yarn global add @nortech/multi-aws-credentials

## Usage:

```
Usage: multi-aws-credentials [options] [command]

For use cases where aws cli profiles are not sufficient

Options:
  -V, --version                                   output the version number
  -h, --help                                      display help for command

Commands:
  add [options] <name> [id] [secret] [region]     Add a profile
  change <name>                                   Change the current (default) profile
  list                                            list profiles
  rename <current-name> <new-name>                Rename a profile
  upsert [options] <name> [id] [secret] [region]  Add a profile if it doesn't exist, otherwise replace it
  env <name>                                      Outputs a profile as shell compatible variable exports, for use with eval
  env-run <name> [script...]                      Run a command with configured environment variables. Pass command after -- or through stdin
  encrypt <name>                                  Encrypt a profile with a password
  remove <name>                                   Remove a profile
  help [command]                                  display help for command
```

## How it works

It creates a file in ~/.aws/$NAME.creds for each profile
Upon changing to a profile, it replaces ~/.aws/credentials with the specific profile file.
As a preferrable mode of operation, you should instead load the credentials into your current shell with the `env` command like `eval $(multi-aws-credentials env my-profile)`

## Why not cli profiles?

1. It makes the commands more verbose.
2. It makes scripts less reusable (every command needs to include an environment profile).
3. More prone to mistakes, if you forget to specify a profile somewhere in your script you might break something in the wrong aws environment.
4. Doesn't play well with non-cli tools. When using automated tools (such as terraform in nortech's case), they should not have to manage aws profiles.
