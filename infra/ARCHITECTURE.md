# Hotel PMS Azure Infrastructure Architecture

## Overview

This document describes the Azure infrastructure architecture for the Hotel Property Management System (PMS) backend deployment.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Internet                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS (443) / HTTP (80)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Azure Network Security Group                   │
│  Rules: Allow 443, 80 (Internet), 22 (All IPs by default)     │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Azure Public IP (Static)                    │
│                    DNS: hotel-pms-prod.region                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Azure Network Interface                       │
│                  VNet: 10.0.0.0/16                              │
│                  Subnet: 10.0.1.0/24                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              Azure Linux VM (Ubuntu 22.04 LTS)                   │
│                    Standard_B2s (2 vCPU, 4GB RAM)               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Docker Containers                          │   │
│  │                                                          │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │  Nginx (Reverse Proxy + SSL Termination)        │  │   │
│  │  │  - Let's Encrypt SSL certificates               │  │   │
│  │  │  - HTTP → HTTPS redirect                        │  │   │
│  │  │  - Rate limiting                                 │  │   │
│  │  └──────────────────┬──────────────────────────────┘  │   │
│  │                     │ :3000                            │   │
│  │  ┌──────────────────▼──────────────────────────────┐  │   │
│  │  │  API Service (Node.js/Express)                  │  │   │
│  │  │  - REST API endpoints                           │  │   │
│  │  │  - JWT authentication                           │  │   │
│  │  │  - Business logic                               │  │   │
│  │  └──────────────────┬──────────────────────────────┘  │   │
│  │                     │                                  │   │
│  │       ┌─────────────┼─────────────┬──────────────┐   │   │
│  │       │             │             │              │   │   │
│  │  ┌────▼───┐   ┌────▼───┐   ┌────▼───┐   ┌─────▼──┐ │   │
│  │  │Worker  │   │Worker  │   │Worker  │   │RabbitMQ│ │   │
│  │  │Inbound │   │Outbound│   │Schedul.│   │        │ │   │
│  │  └────┬───┘   └────┬───┘   └────┬───┘   └────┬───┘ │   │
│  │       │            │            │            │      │   │
│  │       └────────────┴────────────┴────────────┘      │   │
│  │                     │                                │   │
│  │  ┌──────────────────▼──────────────────────────────┐│   │
│  │  │  PostgreSQL Database                            ││   │
│  │  │  - Hotel data, bookings, guests, etc.          ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  OS Disk (30GB Premium SSD)                                 │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│        Azure Managed Disk (50GB Premium SSD)                  │
│        Mounted at: /data                                      │
│        - /data/postgres (PostgreSQL data)                     │
│        - /data/rabbitmq (RabbitMQ data)                       │
│        - /data/letsencrypt (SSL certificates)                 │
└───────────────────────────────────────────────────────────────┘
```

## Components

### 1. Network Layer

**Virtual Network (VNet)**
- Address space: `10.0.0.0/16`
- Subnet: `10.0.1.0/24`
- Provides isolated network for VM

**Network Security Group (NSG)**
- Inbound Rules:
  - Port 443 (HTTPS): Allow from Internet
  - Port 80 (HTTP): Allow from Internet (for Let's Encrypt and redirect)
  - Port 22 (SSH): Allow from all IPs by default (configurable via `allowed_ssh_ip` variable)
  - Default: Deny all other inbound traffic
- Outbound Rules: Allow all (default)

**Public IP**
- Static allocation
- Standard SKU
- DNS label: `{project}-{environment}.{region}.cloudapp.azure.com`

### 2. Compute Layer

**Virtual Machine**
- OS: Ubuntu 22.04 LTS
- Size: Standard_B2s (2 vCPU, 4GB RAM)
- Authentication: SSH key only (no password)
- Initialization: Cloud-init script

**OS Disk**
- Size: 30GB
- Type: Premium SSD (P10)
- Purpose: Operating system and Docker images

**Data Disk**
- Size: 50GB (configurable)
- Type: Premium SSD (P10)
- Mount point: `/data`
- Purpose: Persistent application data
- Contents:
  - PostgreSQL database files
  - RabbitMQ data
  - SSL certificates
  - Application logs

### 3. Application Layer (Docker Containers)

**Nginx Container**
- Image: `nginx:alpine`
- Purpose: Reverse proxy and SSL termination
- Ports: 80, 443
- Features:
  - Let's Encrypt SSL certificates
  - HTTP to HTTPS redirect
  - Rate limiting (10 req/s per IP)
  - Security headers
  - Gzip compression

**API Container**
- Build: Multi-stage Dockerfile (Node.js 22)
- Purpose: Main REST API service
- Port: 3000 (internal)
- Features:
  - Express.js framework
  - JWT authentication
  - Business logic for hotel operations
  - Health check endpoint

**Worker Containers (3 instances)**
1. **Inbound Worker**: Processes incoming sync events from external systems
2. **Outbound Worker**: Pushes updates to external systems
3. **Scheduler Worker**: Periodic sync jobs

**PostgreSQL Container**
- Image: `postgres:16-alpine`
- Port: 5432 (internal only)
- Data: Persisted to `/data/postgres`
- Features:
  - Health checks
  - Automatic restart
  - Connection pooling

**RabbitMQ Container**
- Image: `rabbitmq:3-management-alpine`
- Port: 5672 (internal only)
- Management UI: 15672 (not exposed externally)
- Data: Persisted to `/data/rabbitmq`
- Purpose: Message queue for async processing

### 4. Storage Layer

**Managed Disk**
- Attached as LUN 0
- Formatted with ext4 filesystem
- Auto-mounted via `/etc/fstab`
- Survives VM restarts and container recreation

**Directory Structure**
```
/data/
├── postgres/           # PostgreSQL data directory
├── rabbitmq/          # RabbitMQ data directory
├── letsencrypt/       # SSL certificates
│   ├── etc/          # Certificate files
│   ├── lib/          # Certbot working directory
│   └── www/          # ACME challenge files
├── nginx/
│   └── logs/         # Nginx access and error logs
└── backups/          # Database backups (optional)
```

## Data Flow

### 1. HTTPS Request Flow
```
Internet → NSG (443) → Public IP → NIC → VM → Nginx (443) 
→ SSL Termination → Nginx (proxy) → API Container (3000) 
→ Business Logic → PostgreSQL/RabbitMQ → Response
```

### 2. Worker Processing Flow
```
API → RabbitMQ (publish message) → Worker (consume) 
→ Process → External API / Database → Result
```

### 3. SSL Certificate Flow
```
Let's Encrypt → HTTP Challenge (80) → Nginx → Certbot 
→ Certificate Issued → Stored in /data/letsencrypt 
→ Nginx Reload → HTTPS Enabled
```

## Security Architecture

### Network Security
- NSG restricts inbound traffic to necessary ports only
- SSH access open to all IPs by default (can be restricted via `allowed_ssh_ip` variable)
- All application traffic encrypted with TLS 1.2/1.3
- Internal container communication on isolated Docker network

### Application Security
- JWT-based authentication
- Password hashing with bcrypt
- Sensitive data encrypted at rest (optional encryption key)
- Non-root user in containers
- Environment variables for secrets (not in code)

### Data Security
- Database passwords are strong and unique
- Secrets stored in Terraform variables (sensitive)
- SSL certificates auto-renewed
- Data persisted on encrypted Azure managed disk

## High Availability Considerations

### Current Architecture
- Single VM deployment
- Suitable for: Development, staging, small production
- RTO (Recovery Time Objective): ~15 minutes
- RPO (Recovery Point Objective): Last backup

### Scaling Options

**Vertical Scaling** (Increase VM size)
```hcl
vm_size = "Standard_D4s_v3"  # 4 vCPU, 16GB RAM
```

**Horizontal Scaling** (Multiple VMs)
- Add Azure Load Balancer
- Deploy multiple VM instances
- Shared PostgreSQL (Azure Database for PostgreSQL)
- Shared RabbitMQ (Azure Service Bus)

**Managed Services Migration**
- Azure Database for PostgreSQL (Flexible Server)
- Azure Service Bus (instead of RabbitMQ)
- Azure Container Instances or AKS
- Azure Application Gateway (WAF)

## Monitoring and Observability

### Built-in Monitoring
- Docker container health checks
- Nginx access and error logs
- Application logs (stdout/stderr)
- PostgreSQL logs

### Recommended Additions
- Azure Monitor for VM metrics
- Log Analytics workspace
- Application Insights for API
- Azure Alerts for critical events

## Backup Strategy

### Database Backups
- Automated daily backups via cron
- Stored on data disk: `/data/backups`
- Retention: 7 days (configurable)
- Manual backup: `docker exec hotel-pms-postgres pg_dump`

### Disk Snapshots
- Azure managed disk snapshots
- Can be automated via Azure Backup
- Point-in-time recovery capability

### Disaster Recovery
1. Terraform state backed up
2. Regular disk snapshots
3. Database dumps stored off-VM
4. Infrastructure as Code allows quick rebuild

## Cost Optimization

### Current Configuration (~$48-63/month)
- VM: Standard_B2s (~$30/month)
- Managed Disk: 50GB Premium SSD (~$10/month)
- Public IP: Static (~$3/month)
- Network egress: Variable (~$5-20/month)

### Cost Reduction Options
1. Use Standard HDD instead of Premium SSD (-$5/month)
2. Use smaller VM for dev/test: Standard_B1s (-$23/month)
3. Stop VM when not in use (dev/test only)
4. Use Azure Reserved Instances for production (-30% VM cost)

### Cost Increase for Production
1. Larger VM: Standard_D4s_v3 (+$90/month)
2. Larger disk: 250GB (+$30/month)
3. Azure Database for PostgreSQL (+$50-200/month)
4. Load Balancer (+$20/month)
5. Azure Monitor/Log Analytics (+$10-50/month)

## Deployment Process

1. **Terraform Init**: Download providers
2. **Terraform Plan**: Preview infrastructure changes
3. **Terraform Apply**: Create Azure resources
4. **Cloud-init**: VM first-boot configuration
   - Install Docker
   - Format and mount data disk
   - Create directory structure
   - Deploy docker-compose configuration
   - Start all services
5. **SSL Setup**: Let's Encrypt certificate acquisition
6. **Database Init**: Run migrations and seeds

## Maintenance

### Regular Tasks
- Monitor disk space: `df -h`
- Review logs: `docker logs <container>`
- Check SSL expiry: Auto-renewed, but verify
- Update Docker images: `docker compose pull && docker compose up -d`
- System updates: `apt update && apt upgrade`

### Emergency Procedures
- Restart all services: `systemctl restart hotel-pms`
- Restart single container: `docker restart hotel-pms-api`
- Restore from backup: See README.md
- Scale up VM: Update `vm_size` in terraform.tfvars and apply

## Future Enhancements

1. **Multi-region deployment** for global availability
2. **CDN integration** for static assets
3. **Redis caching** for improved performance
4. **Elasticsearch** for log aggregation
5. **Prometheus + Grafana** for metrics
6. **Azure Key Vault** for secrets management
7. **Azure DevOps** or GitHub Actions for CI/CD
8. **Blue-green deployment** for zero-downtime updates

## References

- [Azure VM Sizes](https://docs.microsoft.com/en-us/azure/virtual-machines/sizes)
- [Azure Managed Disks](https://docs.microsoft.com/en-us/azure/virtual-machines/managed-disks-overview)
- [Docker Compose](https://docs.docker.com/compose/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx Documentation](https://nginx.org/en/docs/)

