# Hotel Management System (PMS) Backend

A comprehensive Property Management System (PMS) designed to streamline hotel operations, enhance guest experiences, and optimize resource management.

## Tech Stack

- **Node.js** v18+ (Node 22+ recommended)
- **TypeScript** - Type-safe development
- **Express.js** - Web framework
- **Knex.js** - SQL query builder
- **PostgreSQL** - Primary database

## Getting Started

### Prerequisites

- Node.js v18 or higher (Node 22+ recommended)
- PostgreSQL 14+ installed and running
- npm or yarn package manager

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Update the database credentials and other configurations
   ```bash
   cp .env.example .env
   ```

3. **Create PostgreSQL databases:**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres

   # Create development database
   CREATE DATABASE hotel_pms_dev;

   # Create test database  
   CREATE DATABASE hotel_pms_test;

   # Exit psql
   \q
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Seed the database (optional):**
   ```bash
   npm run db:seed
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

7. **Access the API at** `http://localhost:3000`

## Running the full system with Docker

Compose files live at the **repository root**: `docker-compose.yml`, `docker-compose.dev.yml` (bind mounts / Vite), and `docker-compose.prod.yml` (production-like merge). After `cp .env.example .env`, `COMPOSE_FILE` selects base+dev by default. Run all `docker compose` commands from the repo root, not from `backend/`.

### 1. Prerequisites

- Docker and Docker Compose v2
- Ports (adjust via `.env` at repo root): `3000` (API), `HOST_DB_PORT`→`5432` (Postgres on host), `5173` (Vite), `5672` / `15672` (RabbitMQ), and if using optional QloApps: `8080` (or `QLOAPPS_PORT`), `3306`, `2222`

### 2. Environment

```bash
# From repository root
cp .env.example .env
# Edit .env — set JWT_SECRET, HOST_DB_PORT if 5432 is taken, etc.
```

Backend-specific samples remain in `backend/.env.docker` for reference; Compose reads variables from the **root** `.env` when present.

### 3. Start default stack (API + frontend + Postgres + RabbitMQ)

```bash
docker compose up -d
docker compose ps
```

### 4. Migrations and seeds

```bash
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm seed
```

### 5. Workers and optional QloApps

```bash
docker compose --profile workers up -d
docker compose --profile infra up -d   # optional qloapps service
```

Logs:

```bash
docker compose logs -f api
docker compose logs -f worker-inbound
```

### 5.1 Production-like merge (Caddy)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Set `PUBLIC_APP_DOMAIN`, `CADDY_EMAIL`, and `VITE_PROD_API_URL` (see root `.env.example`). Caddy publishes HTTP/HTTPS and proxies `/api*` to the API and `/` to the SPA. VM deployment uses Caddy as well — see `infra/docker/docker-compose.prod.yml` and `infra/docker/caddy/Caddyfile`.

### 6. Run QloApps PMS via official Docker image

To start a standalone QloApps PMS instance (used by this backend as an external channel/PMS), use the official Docker image from Webkul [`webkul/qloapps_docker`](https://hub.docker.com/r/webkul/qloapps_docker):

1. **Pull the image**:

   ```bash
   docker pull webkul/qloapps_docker:latest
   ```

2. **Run the container** (adjust passwords and DB name):

   ```bash
   docker run -tid \
     -p 80:80 \
     -p 3306:3306 \
     -p 2222:22 \
     --name qloapps \
     -e USER_PASSWORD=qloappsuserpassword \
     -e MYSQL_ROOT_PASSWORD=myrootpassword \
     -e MYSQL_DATABASE=qlo170 \
     webkul/qloapps_docker:latest
   ```

   - Port `80` → QloApps web UI
   - Port `3306` → MySQL in the QloApps container
   - Port `2222` → SSH access to the container

   For more details and version‑specific notes, see the Docker Hub docs: [`webkul/qloapps_docker`](https://hub.docker.com/r/webkul/qloapps_docker).

3. **Complete QloApps installation** in the browser:

   - Open `http://localhost/` (or your server IP) and follow the QloApps installer.
   - For v1.7.0, when asked for the MySQL host, use `127.0.0.1` (per the Docker Hub instructions).
   - After installation, remove the `/install` directory inside the container:

     ```bash
     docker exec -i qloapps rm -rf /home/qloapps/www/QloApps/install
     ```

4. **Configure QloApps integration in this PMS**:

   - Create a QloApps WebService API key inside QloApps.
   - Use the admin UI / API endpoints to configure QloApps connection settings (base URL, API key, QloApps hotel ID).
   - **Note**: QloApps base URL and API key are stored in the `qloapps_config` database table (configured via the frontend Settings page), not in environment variables. The API and workers read these settings from the database at runtime.

### 7. Frontend (PMS UI)

By default the **frontend** service runs in Compose (Vite on port `5173`). Override `VITE_API_URL` in root `.env` if the browser cannot reach the API at `http://localhost:3000/api`.

To run Vite on the host instead:

```bash
cd frontend && npm install && npm run dev
```

## Host PostgreSQL (no Docker DB)

To create dev databases on a local Postgres installation:

```bash
./scripts/setup-local-postgres.sh
```

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

### Database Management
- `npm run db:migrate` - Run all pending migrations
- `npm run db:migrate:make <name>` - Create a new migration
- `npm run db:migrate:rollback` - Rollback last migration
- `npm run db:migrate:status` - Check migration status
- `npm run db:seed` - Run database seeds
- `npm run db:seed:make <name>` - Create a new seed file

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

## Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   └── database.ts      # Database connection
│   ├── database/
│   │   ├── migrations/      # Database migrations
│   │   └── seeds/           # Database seed files
│   ├── services/            # Business logic
│   ├── routes/              # API routes
│   ├── middleware/          # Express middleware
│   ├── app.ts              # Express app setup
│   └── server.ts           # Server entry point
├── knexfile.ts             # Knex configuration
├── tsconfig.json           # TypeScript configuration
├── package.json
└── .env                    # Environment variables
```

## Database

This project uses PostgreSQL with Knex.js for query building and migrations.

See [DATABASE.md](./DATABASE.md) for detailed database setup and management instructions.

## Environment Variables

Required environment variables (see `.env.example`):

```env
# Server
NODE_ENV=development
PORT=3000

# Multi-property API (non-production only): allow missing X-Hotel-Id to fall back to the
# migrated default hotel UUID. Production must omit this or leave unset so clients must send X-Hotel-Id.
# ALLOW_DEFAULT_HOTEL=true

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_pms_dev
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# Beds24 Integration
BEDS24_API_KEY=your_api_key
BEDS24_PROP_KEY=your_property_key
```

## License

This project is for demonstration purposes.