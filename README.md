## Multi aws credentials

Simple tool to manage multiple aws credentials locally for when aws cli profiles are not enough

## Installation

- npm: npm install -g @nortech/multi-aws-credentials
- yarn: yarn global add @nortech/multi-aws-credentials

## Usage:

```
Usage: @nortech/multi-aws-credentials [options] [command]

For use cases where aws cli profiles are not sufficient

Options:
  -V, --version                                 output the version number
  -h, --help                                    display help for command

Commands:
  add <name> <id> <secret>                      Add a profile
  change <name>                                 Change the current (default) profile
  list                                          list profiles
  rename <current-name> <new-name>              Rename a profile
  upsert <name> <id> <secret>                   Add a profile if it doesn't exist, otherwise replace it
  env <name>                                    Outputs a profile as shell compatible variable exports, for use with eval
  replace <current-name> <new-id> <new-secret>  Replace a profile
  remove <name>                                 Remove a profile
  help [command]                                display help for command
```

## How it works

It creates a file in ~/.aws/$NAME.creds for each profile
Upon changing to a profile, it replace ~/.aws/credentials with the specific profile file

## Why not cli profiles?

1. It makes the commands more verbose.
2. It makes scripts less reusable (every command needs to include an environment profile).
3. More prone to mistakes, if you forget to specify a profile somewhere in your script you might break something in the wrong aws environment.
4. Doesn't play well with non-cli tools. When using automated tools (such as terraform in nortech's case), they should not have to manage aws profiles.
