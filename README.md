# About Project Zoe

Project Zoe is a church management centered on what's at the heart of all ministry - people. The platform simplifies the process of managing people and their relationships between each other and the church, keeping track of data across the organization and creates a foundation for adding new features that are specific to your church.

# The tech

This repo holds the Project Zoe church relationship management system (RMS) server. 

## Getting started

Clone the repository:
`git clone git@github.com:kanzucodefoundation/project-zoe-server.git`

Install the dependencies:
`npm install`

**PS:** If you don't have `npm` installed, check out this guide https://www.npmjs.com/get-npm

For your development environment, add some "dummy" (seed) data:

```
cd src/data
node seed.ts
```

Finally, start the party:
`npm start`

This repo works with the client at https://github.com/kanzucodefoundation/project-zoe-client.git so be sure to set that up too.


### Installation errors
1. `sh: eslint: command not found`

**Solution:** Run `npm install -g eslint` then `eslint --init`
If that fails, other alternatives here https://github.com/eslint/eslint/issues/10192

## Commitizen friendly
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)


## Github Action
This repo is automatically deployed to the prod server using github actions. We create an `.env` file during the deployment process. Rather than add each environment variable to the file one by one, we copied a complete `.env` file and encrypted it using base64. We use the command:

```
openssl base64 -A -in .env -out .env.prod.encrypted
```

We then get the contents of `.env.prod.encrypted` and add them as a Github Action variable called `PROD_ENV_FILE`




