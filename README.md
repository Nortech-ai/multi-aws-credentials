## Multi aws credentials

Simple tool to manage multiple aws credentials locally for when aws cli profiles are not enough

## Usage:

```
Usage: multi-aws-credentials [options] [command]

For use cases where aws cli profiles are not sufficient

Options:
  -V, --version             output the version number
  -h, --help                display help for command

Commands:
  add <name> <id> <secret>  Add a profile
  change <name>             Change the current (default) profile
  list                      list profiles
  remove <name>             Remove a profile
  help [command]            display help for command
```

# How it works

It creates a file in ~/.aws/$NAME.creds for each profile
Upon changing to a profile, it replace ~/.aws/credentials with the specific profile file
