# Docker Compose Commands Cheat Sheet

Quick reference for common Docker Compose commands for this project.

## 🚀 Start Services

```bash
# Start only API (use external DB/RabbitMQ)
docker compose up -d api

# Start API + infrastructure (DB + RabbitMQ)
docker compose --profile infra up -d api

# Start everything (API + Workers + Infrastructure)
docker compose --profile infra --profile workers up -d

# Start with specific services
docker compose --profile infra up -d postgres rabbitmq

# Start in foreground (see logs)
docker compose --profile infra up api

# Start specific services
docker compose up -d api worker-inbound

# Build images before starting
docker compose up -d --build

# Force recreate containers
docker compose up -d --force-recreate
```

## 🛑 Stop Services

```bash
# Stop all services (keep volumes/data)
docker compose stop

# Stop specific service
docker compose stop api

# Stop and remove containers (keep volumes/data)
docker compose down

# Stop and remove containers AND volumes (DELETES DATA!)
docker compose --profile infra --profile workers down -v

# Remove all stopped containers
docker compose rm -f
```

## 📊 View Status

```bash
# List all services and status
docker compose ps

# List all services (including stopped)
docker compose ps -a

# Show images used
docker compose images

# Show running processes in containers
docker compose top api

# Show resource usage
docker compose stats
```

## 📖 View Logs

```bash
# Follow all logs
docker compose logs -f

# Follow specific service logs
docker compose logs -f api
docker compose logs -f postgres

# Last N lines (e.g., 100)
docker compose logs --tail=100 api

# Show logs with timestamps
docker compose logs -t api

# From specific time (e.g., last 30 minutes)
docker compose logs --since 30m api

# Save logs to file
docker compose logs api > api.log
```

## 🔨 Build & Rebuild

```bash
# Build all images
docker compose build

# Build specific image
docker compose build api

# Build without cache
docker compose build --no-cache

# Build and push to registry
docker compose build --push

# Build with specific target (for production)
docker compose build --target production
```

## 💻 Execute Commands

```bash
# Run command in container
docker compose exec api npm run lint

# Run command with stdin/stdout
docker compose exec api sh

# Run as specific user
docker compose exec -u root postgres psql

# Run and allocate pseudo-terminal
docker compose exec -it api sh

# Run new container (not exec)
docker compose run --rm api npm run build

# Run database migration
docker compose --profile tools run migrate

# Run database seeds
docker compose --profile tools run seed
```

## 🔍 Inspect Services

```bash
# Show service config
docker compose config

# Show service config for specific service
docker compose config --services

# Validate compose file
docker compose config --quiet

# Show environment variables for service
docker compose exec api env

# Check database connectivity
docker compose exec api ping postgres

# Check RabbitMQ connectivity
docker compose exec api ping rabbitmq
```

## 🔄 Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart api

# Restart with recreate
docker compose down && docker compose up -d

# Graceful restart
docker compose restart -t 30  # 30 second timeout
```

## 🐛 Debugging

```bash
# Interactive shell in container
docker compose exec api sh

# Shell as root
docker compose exec -u root api sh

# Check logs for errors
docker compose logs --tail=50 api | grep -i error

# Show docker-compose internals
docker compose --verbose up api

# Check compose version and info
docker compose version

# Validate all environment variables are set
docker compose config
```

## 📦 Database Commands

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d hotel_pms_dev

# Run SQL query
docker compose exec postgres psql -U postgres -d hotel_pms_dev -c "SELECT * FROM users LIMIT 5;"

# Backup database
docker compose exec postgres pg_dump -U postgres hotel_pms_dev > backup.sql

# Restore database
docker compose exec -T postgres psql -U postgres hotel_pms_dev < backup.sql

# Connect with psql without specifying credentials
docker compose exec postgres psql -U postgres
```

## 🐰 RabbitMQ Commands

```bash
# Check RabbitMQ status
docker compose exec rabbitmq rabbitmq-diagnostics check_running

# List queues
docker compose exec rabbitmq rabbitmqctl list_queues

# List bindings
docker compose exec rabbitmq rabbitmqctl list_bindings

# Check connection
docker compose exec rabbitmq rabbitmq-diagnostics -q ping

# View RabbitMQ management UI
# Open: http://localhost:15672
# Default credentials: guest / guest
```

## 🌐 Network Commands

```bash
# List networks
docker network ls

# Inspect hotel network
docker network inspect backend_hotel-network

# Connect container to network
docker network connect backend_hotel-network <container_name>

# Test connectivity between services
docker compose exec api ping postgres
docker compose exec api ping rabbitmq
```

## 🧹 Clean Up

```bash
# Remove stopped containers
docker compose rm -f

# Remove volumes
docker compose down -v

# Remove images
docker compose down --rmi all

# Clean up everything (images, containers, volumes, networks)
docker compose --profile infra --profile workers down -v --rmi all

# System-wide cleanup
docker system prune -a

# Remove specific volume
docker volume rm backend_postgres_data
```

## 🔐 Production Operations

```bash
# Build production image
docker build -f Dockerfile -t hotel-pms:latest .

# Tag for registry
docker tag hotel-pms:latest myregistry/hotel-pms:1.0.0

# Push to registry
docker push myregistry/hotel-pms:1.0.0

# Pull from registry
docker pull myregistry/hotel-pms:1.0.0

# Run production image
docker run -d -p 3000:3000 hotel-pms:latest
```

## 📋 Common Workflows

### Full Setup from Scratch
```bash
# 1. Start infrastructure
docker compose --profile infra up -d postgres rabbitmq

# 2. Wait for services
sleep 10

# 3. Run migrations
docker compose --profile tools run migrate

# 4. Run seeds (optional)
docker compose --profile tools run seed

# 5. Start API and workers
docker compose --profile infra --profile workers up -d

# 6. Verify
docker compose ps
curl http://localhost:3000/api/health
```

### Development Workflow
```bash
# 1. Start infrastructure and API
docker compose --profile infra up -d postgres rabbitmq
docker compose up -d api

# 2. Watch logs while developing
docker compose logs -f api

# 3. Run tests
docker compose exec api npm test

# 4. Run linter
docker compose exec api npm run lint

# 5. Changes auto-reload via nodemon
```

### Production Deployment
```bash
# 1. Build production image
docker build -f Dockerfile -t myapp:latest .

# 2. Tag and push
docker tag myapp:latest registry/myapp:1.0.0
docker push registry/myapp:1.0.0

# 3. Deploy (using orchestration platform like k8s)
kubectl set image deployment/pms pms=registry/myapp:1.0.0
```

### Troubleshooting
```bash
# 1. Check status
docker compose ps

# 2. View logs
docker compose logs -f --tail=50 service-name

# 3. Shell into container
docker compose exec service-name sh

# 4. Check connectivity
docker compose exec api ping postgres

# 5. Full reset
docker compose down -v
docker compose --profile infra up -d
```

## 🎯 Profile Quick Reference

```bash
# No profile: default services (API only)
docker compose up -d

# infra profile: Infrastructure services (DB + RabbitMQ)
docker compose --profile infra up -d

# workers profile: Worker services
docker compose --profile workers up -d

# tools profile: Utility services (migrate, seed)
docker compose --profile tools run migrate

# Multiple profiles
docker compose --profile infra --profile workers up -d

# All profiles
docker compose --profile infra --profile workers --profile tools up -d
```

## 📌 Environment Variables

Set variables in `.env` or command line:

```bash
# Via .env file
PORT=3000
NODE_ENV=development

# Via command line
docker compose -e PORT=3001 up -d

# Via environment
export PORT=3001
docker compose up -d
```

## 🔗 Useful Links

- Docker Compose Docs: https://docs.docker.com/compose/
- Docker Reference: https://docs.docker.com/reference/
- PostgreSQL Docs: https://www.postgresql.org/docs/
- RabbitMQ Docs: https://www.rabbitmq.com/documentation.html

---

**Tip:** Save this file and refer to it when working with Docker Compose.
