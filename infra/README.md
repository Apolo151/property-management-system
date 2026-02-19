# Hotel PMS - Azure Terraform Deployment

This Terraform module deploys the Hotel Property Management System (PMS) backend services to Azure using Docker containers on a Linux VM.

## Architecture

The deployment includes:
- **Azure VM** (Standard_B2s) running Ubuntu 22.04 LTS
- **Docker Containers**:
  - Nginx (reverse proxy with SSL/TLS)
  - API service (Node.js/Express)
  - 3 background workers (inbound, outbound, scheduler)
  - PostgreSQL database
  - RabbitMQ message broker
- **Managed Disk** (50GB Premium SSD) for persistent data
- **Public IP** with DNS label
- **Network Security Group** with firewall rules
- **Let's Encrypt** SSL certificate (auto-renewal)

## Prerequisites

1. **Azure CLI** - [Install Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
   ```bash
   az login
   az account set --subscription "YOUR_SUBSCRIPTION_ID"
   ```

2. **Terraform** - [Install Terraform](https://www.terraform.io/downloads) (v1.0+)
   ```bash
   terraform --version
   ```

3. **SSH Key Pair** - Generate if you don't have one:
   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/hotel_pms_azure -C "hotel-pms-vm"
   ```

4. **Domain Name** - You need a domain name pointing to the VM's public IP for SSL

## Quick Start

### 1. Configure Variables

Copy the example variables file and customize it:

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set:
- `ssh_public_key` - Content of your `~/.ssh/hotel_pms_azure.pub`
- `allowed_ssh_ip` - IP address/CIDR for SSH access (use "*" to allow all IPs, or specify "YOUR_IP/32" to restrict)
- `domain_name` - Your domain for the API (e.g., `api.example.com`)
- `letsencrypt_email` - Your email for SSL certificate notifications
- `db_password` - Strong database password
- `jwt_secret` - Random secret (generate with `openssl rand -base64 64`)
- `rabbitmq_password` - Strong RabbitMQ password

**Security Note**: Never commit `terraform.tfvars` to version control!

### 2. Build and Push Docker Image (One-time Setup)

Before deploying, you need to either:

**Option A: Use a Container Registry**

1. Build and push to Azure Container Registry:
   ```bash
   # Create ACR
   az acr create --resource-group hotel-pms-rg --name hotelpmsacr --sku Basic
   
   # Build and push
   cd ../backend
   az acr build --registry hotelpmsacr --image hotel-pms-api:latest .
   ```

2. Update `docker-compose.prod.yml` to use your registry:
   ```yaml
   api:
     image: hotelpmsacr.azurecr.io/hotel-pms-api:latest
   ```

**Option B: Build Locally on VM**

1. Upload backend code to VM after deployment
2. Build images on the VM itself (slower but simpler for testing)

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Plan Deployment

Review what will be created:

```bash
terraform plan
```

### 5. Deploy Infrastructure

```bash
terraform apply
```

Type `yes` when prompted. Deployment takes ~5-10 minutes.

### 6. Configure DNS

After deployment, Terraform will output the public IP:

```bash
terraform output vm_public_ip
```

Point your domain's DNS A record to this IP:
```
api.example.com  A  <VM_PUBLIC_IP>
```

Wait for DNS propagation (check with `dig api.example.com`)

### 7. Verify Deployment

SSH into the VM:
```bash
ssh -i ~/.ssh/hotel_pms_azure azureuser@$(terraform output -raw vm_public_ip)
```

Check service status:
```bash
# Check all containers
docker ps

# Check logs
docker logs hotel-pms-api
docker logs hotel-pms-postgres
docker logs hotel-pms-nginx

# Check SSL certificate status
sudo journalctl -u certbot-init -f
```

### 8. Initialize Database

Run migrations:
```bash
docker exec hotel-pms-api npm run db:migrate
```

Optionally seed the database:
```bash
docker exec hotel-pms-api npm run db:seed
```

### 9. Test API

```bash
# Health check
curl https://api.example.com/health

# Should return: {"status":"ok"}
```

## Post-Deployment Configuration

### Database Backups

Set up automated PostgreSQL backups:

```bash
# Create backup script
cat > /opt/hotel-pms/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/data/backups"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
docker exec hotel-pms-postgres pg_dump -U postgres hotel_pms_prod | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz
# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/hotel-pms/backup-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /opt/hotel-pms/backup-db.sh" | crontab -
```

### Monitoring

View container logs:
```bash
docker logs -f hotel-pms-api
docker logs -f hotel-pms-worker-inbound
docker logs -f hotel-pms-worker-outbound
docker logs -f hotel-pms-worker-scheduler
```

Monitor resource usage:
```bash
docker stats
```

### Updating the Application

1. Build and push new image:
   ```bash
   cd backend
   az acr build --registry hotelpmsacr --image hotel-pms-api:latest .
   ```

2. On the VM, pull and restart:
   ```bash
   docker compose -f /opt/hotel-pms/docker-compose.yml pull
   docker compose -f /opt/hotel-pms/docker-compose.yml up -d
   ```

3. Run migrations if needed:
   ```bash
   docker exec hotel-pms-api npm run db:migrate
   ```

## Terraform Commands

```bash
# Show current state
terraform show

# List all resources
terraform state list

# Get specific output
terraform output vm_public_ip

# Refresh state
terraform refresh

# Destroy everything (WARNING: Deletes all data!)
terraform destroy
```

## Troubleshooting

### Certificate Issues

If SSL certificate fails:

```bash
# Check certbot logs
sudo journalctl -u certbot-init

# Verify DNS resolution
dig +short api.example.com

# Check if ports are open
sudo netstat -tlnp | grep -E ':(80|443)'

# Manually retry certificate
ssh into VM and run:
sudo /opt/hotel-pms/nginx/certbot-init.sh
```

### Container Not Starting

```bash
# Check container status
docker ps -a

# View container logs
docker logs hotel-pms-api

# Check environment variables
docker exec hotel-pms-api env | grep DB_

# Restart specific service
docker restart hotel-pms-api
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker exec hotel-pms-postgres pg_isready -U postgres

# Connect to database
docker exec -it hotel-pms-postgres psql -U postgres -d hotel_pms_prod

# Check connection from API
docker exec hotel-pms-api nc -zv postgres 5432
```

### Worker Issues

```bash
# Check worker logs
docker logs hotel-pms-worker-inbound
docker logs hotel-pms-worker-outbound
docker logs hotel-pms-worker-scheduler

# Restart workers
docker restart hotel-pms-worker-inbound
docker restart hotel-pms-worker-outbound
docker restart hotel-pms-worker-scheduler
```

### RabbitMQ Issues

```bash
# Check RabbitMQ status
docker exec hotel-pms-rabbitmq rabbitmq-diagnostics check_running

# View RabbitMQ logs
docker logs hotel-pms-rabbitmq

# Access management UI (setup port forwarding first)
ssh -L 15672:localhost:15672 azureuser@<VM_IP>
# Then open http://localhost:15672 in browser
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a --volumes

# Check data directory
du -sh /data/*
```

### Performance Issues

```bash
# Check VM resources
htop

# Check Docker resource usage
docker stats

# View system logs
sudo journalctl -xe
```

## Security Best Practices

1. **Rotate Secrets Regularly**
   - Update database passwords
   - Regenerate JWT secrets
   - Rotate API keys

2. **Keep System Updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Monitor Access Logs**
   ```bash
   sudo tail -f /data/nginx/logs/access.log
   sudo tail -f /data/nginx/logs/error.log
   ```

4. **Secure SSH Access**
   - By default, SSH is open to all IPs (use `allowed_ssh_ip = "*"`)
   - For production, restrict to specific IP: `allowed_ssh_ip = "YOUR_IP/32"`
   - Use SSH keys, never passwords
   - Consider using Azure Bastion for production

5. **Backup Data**
   - Regular database backups
   - Snapshot the data disk periodically

## Cost Optimization

Monthly cost breakdown (Italy North):
- Standard_B2s VM: ~$30/month
- 50GB Premium SSD: ~$10/month
- Public IP: ~$3/month
- Network egress: ~$5-20/month

**Total: ~$48-63/month**

To reduce costs:
- Use `Standard_B1s` for dev/testing ($7/month)
- Use Standard HDD instead of Premium SSD
- Stop VM when not in use (data persists)

## Scaling Considerations

For production with higher traffic:

1. **Upgrade VM size**:
   ```hcl
   vm_size = "Standard_D4s_v3"  # 4 vCPUs, 16GB RAM
   ```

2. **Use Azure Database for PostgreSQL**:
   - Managed service with automatic backups
   - Better performance and reliability

3. **Use Azure Service Bus** instead of RabbitMQ:
   - Fully managed message broker
   - Better scalability

4. **Add Azure Load Balancer**:
   - Multiple VM instances
   - High availability

5. **Use Azure Container Instances** or **Azure Kubernetes Service**:
   - Better for microservices
   - Auto-scaling capabilities

## Support

For issues:
1. Check logs: `docker logs <container_name>`
2. Review Terraform state: `terraform show`
3. Verify network connectivity
4. Check Azure portal for resource status

## License

This infrastructure code is part of the Hotel PMS project.

