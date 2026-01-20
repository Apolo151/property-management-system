# Quick Start Guide - Docker

Get the Hotel Management System running with Docker in 5 minutes!

## Prerequisites

- Docker and Docker Compose installed
- Git (to clone the project)
- 2GB+ free disk space

## Quick Start - 5 Minutes

### 1. Setup Environment (30 seconds)

```bash
# Navigate to backend directory
cd backend

# Copy environment configuration
cp .env.docker .env
```

### 2. Start Everything (2-3 minutes)

```bash
# Start API + Workers + Database + RabbitMQ
docker compose --profile infra --profile workers up -d
```

**What happens:**
- Downloads and starts PostgreSQL
- Downloads and starts RabbitMQ
- Builds and starts the API server
- Starts 3 worker processes
- Database is initialized

### 3. Verify It's Running (1-2 minutes)

```bash
# Check services status
docker compose ps

# View logs
docker compose logs -f api
```

**Expected output:**
```
CONTAINER ID   STATUS      PORTS
...
hotel-api      Up          0.0.0.0:3000->3000/tcp
```

### 4. Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| API | http://localhost:3000 | N/A |
| RabbitMQ | http://localhost:15672 | guest / guest |
| PostgreSQL | localhost:5432 | postgres / postgres |

## Common Scenarios

### Scenario 1: API Only (Using External Database)

If you already have PostgreSQL and RabbitMQ running externally:

```bash
# Update .env with your external service addresses
# Then start only the API
docker compose up -d api
```

### Scenario 2: API + Database (No Workers)

```bash
docker compose --profile infra up -d api postgres
```

### Scenario 3: Just Workers (API Running Elsewhere)

```bash
docker compose --profile infra --profile workers up -d worker-inbound worker-outbound worker-scheduler postgres rabbitmq
```

### Scenario 4: Full Stack with Database Setup

```bash
# Start infrastructure
docker compose --profile infra up -d

# Wait for services
sleep 10

# Run migrations
docker compose --profile tools run migrate

# Run seeds (optional)
docker compose --profile tools run seed

# Start workers
docker compose --profile workers up -d
```

## Useful Commands

### View Logs

```bash
# Follow all logs
docker compose logs -f

# Follow specific service
docker compose logs -f api

# Last 50 lines
docker compose logs --tail=50 api
```

### Stop Services

```bash
# Stop without removing
docker compose stop

# Stop and remove containers (data persists)
docker compose down

# Stop and remove everything (WARNING: deletes data!)
docker compose down -v
```

### Rebuild

```bash
# Rebuild all images
docker compose build

# Rebuild specific service
docker compose build api

# Rebuild and restart
docker compose up -d --build
```

### Access Containers

```bash
# Shell into API container
docker compose exec api sh

# Run command in container
docker compose exec api npm run lint

# Connect to database
docker compose exec postgres psql -U postgres -d hotel_pms_dev
```

### Health Checks

```bash
# Check service status
docker compose ps

# View specific service logs
docker compose logs postgres

# Manual API health check
curl http://localhost:3000/api/health
```

## Troubleshooting

### Services not starting?

```bash
# Check detailed logs
docker compose logs --tail=100 api

# Restart services
docker compose restart

# Full cleanup and restart
docker compose down -v
docker compose --profile infra --profile workers up -d
```

### Port already in use?

```bash
# Find what's using port 3000
lsof -i :3000

# Or just use a different port
PORT=3001 docker compose up -d api
```

### Database connection issues?

```bash
# Test database connection
docker compose exec postgres psql -U postgres -c "SELECT 1"

# Check database logs
docker compose logs postgres
```

### Workers not connecting?

```bash
# Check RabbitMQ status
docker compose exec rabbitmq rabbitmq-diagnostics check_running

# View RabbitMQ logs
docker compose logs rabbitmq

# Check worker logs
docker compose logs worker-inbound
```

## Next Steps

- Read [DOCKER.md](./DOCKER.md) for comprehensive documentation
- Check [README.md](./README.md) for project overview
- See [DATABASE.md](./DATABASE.md) for database management

## Production Deployment

For production deployment:

1. Build production image:
   ```bash
   docker build -f Dockerfile -t hotel-pms:latest .
   ```

2. Push to registry:
   ```bash
   docker tag hotel-pms:latest your-registry/hotel-pms:latest
   docker push your-registry/hotel-pms:latest
   ```

3. Use in production orchestration (Kubernetes, Swarm, etc.)

## Support

For issues or questions, refer to:
- [DOCKER.md](./DOCKER.md) - Full Docker documentation
- [README.md](./README.md) - Project setup
- Docker Compose docs: https://docs.docker.com/compose/
