# Project Zoe Contributing Guide
# Table of Contents
1. [Git Workflow](#git-workflow)


# Git Workflow

The workflow will be as follows:

- Clone or fork the official repository to create a personal version of it on your local machine.

- Branch off develop to create your development branch

- Push your personal changes to this branch

- Create a Pull Request against `develop` branch.

- We will review and give feedback

# Branches
We will be using master and develop branches to manage and store our product release history. Master will be used to store the official release history, while develop will be used an integration branch for all features.

- Master
- Develop
# Branch Naming
Branches created should be named using the following format:

``` {story type}/{story summary} ```

` story type ` - Indicates the context of the branch and should be one of:

- feature
- bug
- chore

` story summary ` - Short 2-3 words summary about what the branch contains

## Example

``` feature/login```

