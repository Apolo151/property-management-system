# Infrastructure Documentation Index

Welcome to the Hotel PMS Azure Infrastructure documentation. This directory contains all the Terraform code and documentation needed to deploy the backend services to Azure.

## 📚 Documentation

### Getting Started
1. **[QUICK_START.md](./QUICK_START.md)** - 15-minute deployment guide
   - Fastest way to get up and running
   - Step-by-step instructions
   - Common commands reference

2. **[README.md](./README.md)** - Comprehensive deployment guide
   - Detailed prerequisites
   - Full deployment process
   - Troubleshooting guide
   - Maintenance procedures
   - Security best practices

3. **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Pre-flight checklist
   - Ensure nothing is missed
   - Step-by-step verification
   - Post-deployment tasks

### Technical Documentation
4. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Infrastructure architecture
   - Component overview
   - Network topology
   - Data flow diagrams
   - Security architecture
   - Scaling considerations

## 🗂️ File Structure

```
infra/
├── Documentation
│   ├── INDEX.md                    # This file
│   ├── QUICK_START.md             # Fast deployment guide
│   ├── README.md                  # Comprehensive guide
│   ├── DEPLOYMENT_CHECKLIST.md    # Deployment checklist
│   └── ARCHITECTURE.md            # Architecture details
│
├── Terraform Configuration
│   ├── providers.tf               # Azure provider setup
│   ├── variables.tf               # Input variables
│   ├── outputs.tf                 # Output values
│   ├── main.tf                    # Resource group & disk
│   ├── network.tf                 # VNet, NSG, Public IP
│   ├── vm.tf                      # Virtual machine
│   └── terraform.tfvars.example   # Example variables
│
├── Deployment Scripts
│   └── scripts/
│       └── cloud-init.yaml        # VM initialization
│
├── Docker Configuration
│   └── docker/
│       └── docker-compose.prod.yml # Production compose
│
└── Nginx Configuration
    └── nginx/
        ├── nginx.conf             # Nginx config
        └── certbot-init.sh        # SSL setup script
```

## 🚀 Quick Navigation

### I want to...

**Deploy for the first time**
→ Start with [QUICK_START.md](./QUICK_START.md)

**Understand the architecture**
→ Read [ARCHITECTURE.md](./ARCHITECTURE.md)

**Troubleshoot an issue**
→ Check [README.md](./README.md#troubleshooting)

**Verify my deployment**
→ Use [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

**Customize the configuration**
→ Edit `terraform.tfvars` (see [variables.tf](./variables.tf) for options)

**Scale the infrastructure**
→ See [ARCHITECTURE.md](./ARCHITECTURE.md#scaling-options)

**Set up backups**
→ See [README.md](./README.md#post-deployment-configuration)

**Update the application**
→ See [README.md](./README.md#updating-the-application)

## 🔧 Key Files

### Configuration Files

**terraform.tfvars** (create from example)
- Your deployment configuration
- Contains secrets (never commit!)
- Required before deployment

**docker-compose.prod.yml**
- Defines all containers
- Service dependencies
- Volume mounts
- Environment variables

**nginx.conf**
- Reverse proxy configuration
- SSL settings
- Security headers
- Rate limiting

**cloud-init.yaml**
- VM first-boot setup
- Docker installation
- Service initialization

## 📋 Prerequisites Checklist

Before you start, ensure you have:

- [ ] Azure CLI installed and logged in
- [ ] Terraform installed (v1.0+)
- [ ] SSH key pair generated
- [ ] Domain name ready
- [ ] Email for Let's Encrypt

## 🎯 Deployment Overview

```
1. Configure terraform.tfvars
   ↓
2. terraform init
   ↓
3. terraform plan (review)
   ↓
4. terraform apply
   ↓
5. Configure DNS
   ↓
6. Wait for SSL certificate
   ↓
7. Run database migrations
   ↓
8. Test API endpoint
   ↓
9. ✅ Deployment complete!
```

## 🏗️ What Gets Deployed

- **1 Virtual Machine** (Ubuntu 22.04 LTS)
- **7 Docker Containers**:
  - Nginx (reverse proxy + SSL)
  - API service
  - 3 background workers
  - PostgreSQL database
  - RabbitMQ message broker
- **1 Managed Disk** (50GB for persistent data)
- **1 Public IP** (static)
- **1 Virtual Network** with security rules

## 💰 Cost Estimate

**Development/Small Production**
- VM: Standard_B2s (~$30/month)
- Disk: 50GB Premium SSD (~$10/month)
- Public IP (~$3/month)
- **Total: ~$48-63/month**

See [ARCHITECTURE.md](./ARCHITECTURE.md#cost-optimization) for optimization options.

## 🔒 Security Features

- ✅ SSL/TLS encryption (Let's Encrypt)
- ✅ Firewall rules (NSG)
- ✅ SSH key authentication only
- ✅ Rate limiting
- ✅ Security headers
- ✅ Isolated Docker network
- ✅ Non-root containers
- ✅ Encrypted secrets

## 📊 Monitoring

Built-in monitoring includes:
- Docker health checks
- Nginx access/error logs
- Application logs
- PostgreSQL logs

See [README.md](./README.md#post-deployment-configuration) for advanced monitoring setup.

## 🆘 Getting Help

1. **Check documentation**: Most issues are covered in README.md
2. **Review logs**: `docker logs <container-name>`
3. **Verify configuration**: `terraform show`
4. **Check Azure portal**: Resource group overview
5. **SSH into VM**: Inspect directly

## 🔄 Common Operations

```bash
# View all resources
terraform state list

# Get VM IP
terraform output vm_public_ip

# SSH into VM
ssh -i ~/.ssh/your_key azureuser@<VM_IP>

# Check containers
docker ps

# View logs
docker logs -f hotel-pms-api

# Restart service
docker restart hotel-pms-api

# Update application
docker compose pull && docker compose up -d

# Run migrations
docker exec hotel-pms-api npm run db:migrate

# Destroy infrastructure
terraform destroy
```

## 📝 Important Notes

1. **Never commit `terraform.tfvars`** - Contains secrets
2. **Keep Terraform state secure** - Required for updates
3. **Backup regularly** - Database and disk snapshots
4. **Monitor SSL expiry** - Auto-renews, but verify
5. **Update regularly** - System and Docker images

## 🎓 Learning Resources

- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Azure Virtual Machines](https://docs.microsoft.com/en-us/azure/virtual-machines/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)

## 🚦 Status Indicators

After deployment, verify:

✅ All containers running: `docker ps`
✅ API responding: `curl https://your-domain.com/health`
✅ SSL valid: Check browser (no warnings)
✅ Database accessible: `docker exec hotel-pms-postgres pg_isready`
✅ Workers processing: Check logs

## 📞 Support

For infrastructure issues:
1. Review troubleshooting section in README.md
2. Check Azure portal for resource status
3. Verify network connectivity
4. Review Terraform state and logs

---

**Ready to deploy?** Start with [QUICK_START.md](./QUICK_START.md) →

