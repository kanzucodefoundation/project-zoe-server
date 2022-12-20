# About Project Zoe

Project Zoe is a church management centered on what's at the heart of all ministry - people. The platform simplifies the process of managing people and their relationships between each other and the church, keeping track of data across the organization and creates a foundation for adding new features that are specific to your church.

# The Tech

This repo holds the Project Zoe church relationship management system (RMS) server. 

## Project Setup / Installation 🚀

1. Clone the repository:

    > `git clone https://github.com/kanzucodefoundation/project-zoe-server.git`

2. Checkout to the Develop branch

    > `git checkout develop`

3. Temporarily change `binaryTargets = ["debian-openssl-1.1.x"]` to `binaryTargets = ["native"]` in `prisma/schema.prisma`

4. Install dependencies with npm version 6.14.5:

    > `npx npm@6.14.5 install`

5. Create a `.env` file based on the `.env.sample`.

    Set these environment variables in the `env` file as follows 

    > `APP_ENVIRONMENT=local` - If you are running the app locally.

    > `DB_USERNAME=<your-local-postgres-db-username>`

    > `DB_PASSWORD=<your-local-postgres-db-password>`

    > `DB_DATABASE=projectzoe-db`

6. Go ahead and manually create an new postgreSQL database called: `projectzoe-db`

7. Finally, spin up the project with:

    > `npm run start:dev`

8. Revert the changes in `prisma/schema.prisma`. Change `binaryTargets = ["native"]` to `binaryTargets = ["debian-openssl-1.1.x"]`

**Please Note:** 
- If you don't have `node.js` installed, check out this guide https://nodejs.org/en/
- This repo works with the client at https://github.com/kanzucodefoundation/project-zoe-client so be sure to set that up too.


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







