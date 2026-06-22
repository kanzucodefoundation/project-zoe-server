# Project Zoe — Server

Project Zoe is a church relationship management system (RMS) centred on people. The platform simplifies managing people and their relationships within a church, tracking data across the organisation, and provides a foundation for church-specific features.

This repo holds the NestJS API server.

## Tech stack

- **Runtime:** Node.js 18, TypeScript
- **Framework:** NestJS
- **Database:** PostgreSQL with TypeORM (row-level multi-tenancy)
- **Auth:** JWT

## Getting started

### Prerequisites

- Node.js 18+ — [nodejs.org](https://nodejs.org/en/)
- PostgreSQL running locally

### Setup

1. Clone the repository and check out `develop`:

   ```bash
   git clone https://github.com/kanzucodefoundation/project-zoe-server.git
   cd project-zoe-server
   git checkout develop
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file from the sample and fill in your local database credentials:

   ```bash
   cp .env.sample .env
   ```

   Key variables to set:

   | Variable | Description |
   |----------|-------------|
   | `DB_USERNAME` | Your local Postgres username |
   | `DB_PASSWORD` | Your local Postgres password |
   | `DB_DATABASE` | Database name (default: `projectzoe-db`) |
   | `APP_ENVIRONMENT` | Set to `local` for local development |

4. Create the local database:

   ```bash
   createdb projectzoe-db
   ```

5. Start the development server:

   ```bash
   npm run start:dev
   ```

   The server runs on `http://localhost:4002` by default.

6. Seed a demo tenant:

   ```bash
   npm run command create-tenant demo
   ```

   Default login credentials are in `src/seed/data/users.ts`.

7. Load comprehensive demo data (contacts, groups, reports):

   ```bash
   npm run seed:comprehensive
   ```

   This gives you a realistic dataset to work with locally. You can reset it at any time with `npm run seed:reset`.

> **Note:** This server is designed to work alongside the client at https://github.com/kanzucodefoundation/project-zoe-client.

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start with hot-reload |
| `npm run start:prod` | Run compiled output |
| `npm run build` | Compile TypeScript |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Lint the codebase |
| `npm run format` | Format with Prettier |

## Deployment

| Branch | Environment |
|--------|-------------|
| `master` | Production — auto-deploys on push |
| `develop` | Staging — auto-deploys on push |

The CI pipeline creates the `.env` from a base64-encoded GitHub secret. To encode a local `.env` for CI use:

```bash
openssl base64 -A -in .env -out .env.encrypted
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Commitizen friendly

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
![Build & Deploy workflow](https://github.com/kanzucodefoundation/project-zoe-server/actions/workflows/main.yml/badge.svg)
