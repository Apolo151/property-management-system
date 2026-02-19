# Quick Start Guide

Get your Hotel PMS deployed to Azure in under 15 minutes!

## Prerequisites

```bash
# Check Azure CLI
az --version

# Check Terraform
terraform --version

# Generate SSH key if needed
ssh-keygen -t rsa -b 4096 -f ~/.ssh/hotel_pms_azure
```

## 5-Step Deployment

### Step 1: Configure Variables (2 minutes)

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` - minimum required:
```hcl
ssh_public_key = "ssh-rsa AAAAB3Nza... (paste your public key)"
allowed_ssh_ip = "*"  # Use "*" to allow all IPs, or "YOUR_IP/32" to restrict
domain_name = "api.example.com"
letsencrypt_email = "you@example.com"
db_password = "strong_password_here"
jwt_secret = "long_random_secret"  # Generate with: openssl rand -base64 64
rabbitmq_password = "strong_password_here"
```

### Step 2: Deploy Infrastructure (5 minutes)

```bash
terraform init
terraform apply -auto-approve
```

Save the output IP address!

### Step 3: Configure DNS (1 minute)

Point your domain to the VM IP:
```
api.example.com  A  <VM_PUBLIC_IP>
```

### Step 4: Wait for SSL (3 minutes)

SSH into VM and monitor:
```bash
ssh -i ~/.ssh/hotel_pms_azure azureuser@<VM_IP>
sudo journalctl -u certbot-init -f
```

Wait for "Certificate obtained successfully!" message.

### Step 5: Initialize Database (2 minutes)

```bash
docker exec hotel-pms-api npm run db:migrate
docker exec hotel-pms-api npm run db:seed  # Optional
```

## Verify Deployment

```bash
# Test API
curl https://api.example.com/health

# Should return: {"status":"ok"}
```

## What's Running?

```bash
docker ps
```

You should see 7 containers:
- `hotel-pms-nginx` - Reverse proxy with SSL
- `hotel-pms-api` - Main API service
- `hotel-pms-worker-inbound` - Inbound sync worker
- `hotel-pms-worker-outbound` - Outbound sync worker
- `hotel-pms-worker-scheduler` - Sync scheduler
- `hotel-pms-postgres` - PostgreSQL database
- `hotel-pms-rabbitmq` - RabbitMQ message broker

## Common Commands

```bash
# View logs
docker logs -f hotel-pms-api

# Restart a service
docker restart hotel-pms-api

# Check all services
docker ps

# SSH into VM
ssh -i ~/.ssh/hotel_pms_azure azureuser@<VM_IP>

# Destroy everything
terraform destroy
```

## Troubleshooting

### DNS not resolving?
```bash
dig +short api.example.com
# Should return your VM IP
```

### SSL certificate failed?
```bash
# Check if DNS is correct first!
# Then retry:
sudo /opt/hotel-pms/nginx/certbot-init.sh
```

### Containers not running?
```bash
docker logs hotel-pms-api
# Check for errors in output
```

### API not responding?
```bash
# Check if API container is healthy
docker ps
# Look for "healthy" status

# Check logs
docker logs hotel-pms-api
```

## Next Steps

1. Create your first admin user
2. Configure hotel settings
3. Set up integrations (QloApps/Beds24)
4. Test booking workflow
5. Set up automated backups

For detailed documentation, see [README.md](./README.md)

## Cost

~$48-63/month for Standard_B2s VM with 50GB storage

## Need Help?

Refer to the comprehensive [README.md](./README.md) for:
- Detailed troubleshooting
- Security best practices
- Monitoring setup
- Database backups
- Scaling considerations

