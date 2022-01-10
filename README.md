# About project Angie

Angie is a church management centered on what's at the heart of all ministry - people. The platform simplifies the process of managing people and their relationships between each other and the church, keeping track of data across the organization and creates a foundation for adding new features that are specific to your church.

# The tech

This repo holds the Angie church relationship management system (RMS) server. 

## Getting started

Clone the repository:
`git clone git@github.com:kanzucode/angie-client.git`

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

This repo works with the server at https://github.com/kanzucode/angie-client so be sure to set that up too.


### Installation errors
1. `sh: eslint: command not found`

**Solution:** Run `npm install -g eslint` then `eslint --init`
If that fails, other alternatives here https://github.com/eslint/eslint/issues/10192

## Commitizen friendly
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)





