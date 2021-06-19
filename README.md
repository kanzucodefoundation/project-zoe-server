# About Project Zoe 

Project Zoe is a church management centered on what's at the heart of all ministry - people. The platform simplifies the process of managing people and their relationships between each other and the church, keeping track of data across the organization and creates a foundation for adding new features that are specific to your church.

# The tech

This repo holds the Project Zoe church relationship management system (RMS) server. 

## Getting started

Clone the repository:
`git clone git@github.com:kanzucode/angie-server.git`

Install the dependencies

`npm install`

**PS:** If you don't have `npm` installed, check out this guide https://www.npmjs.com/get-npm


Set up the environment variables and update them as necessary

```
cp .env.sample .env
```


Install mysql server locally
In case you need run a development instance of mysql server, you can find the instruction here

https://dev.mysql.com/doc/refman/8.0/en/installing.html




Finally, start the party:
`npm start`

Open the api at http://localhost:4002

To start in watch mode
`npm run start:dev`

This repo works with the client at https://github.com/kanzucode/angie-client so be sure to set that up too.


### Installation errors
1. `sh: eslint: command not found`

**Solution:** Run `npm install -g eslint` then `eslint --init`
If that fails, other alternatives here https://github.com/eslint/eslint/issues/10192

## Contributing
Before making any contribution to this codebase, please read through this [contributing guide](contributing.md).


