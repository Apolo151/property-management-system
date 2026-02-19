# Deployment Checklist

Use this checklist to ensure a smooth deployment of the Hotel PMS to Azure.

## Pre-Deployment

- [ ] Azure CLI installed and logged in (`az login`)
- [ ] Terraform installed (v1.0+)
- [ ] SSH key pair generated
- [ ] Domain name registered and ready to configure DNS
- [ ] Email address for Let's Encrypt notifications

## Configuration

- [ ] Copy `terraform.tfvars.example` to `terraform.tfvars`
- [ ] Set `ssh_public_key` with your public key content
- [ ] Set `allowed_ssh_ip` (use "*" for all IPs, or "YOUR_IP/32" to restrict)
- [ ] Set `domain_name` with your API domain
- [ ] Set `letsencrypt_email` with your email
- [ ] Generate and set `db_password` (strong, random)
- [ ] Generate and set `jwt_secret` (use `openssl rand -base64 64`)
- [ ] Generate and set `rabbitmq_password` (strong, random)
- [ ] (Optional) Set QloApps credentials if using
- [ ] (Optional) Set Beds24 credentials if using
- [ ] Review and adjust VM size and disk size if needed

## Terraform Deployment

- [ ] Run `terraform init` to initialize
- [ ] Run `terraform validate` to check configuration
- [ ] Run `terraform plan` to preview changes
- [ ] Review the plan output carefully
- [ ] Run `terraform apply` to deploy
- [ ] Save the outputs (IP address, FQDN, etc.)

## DNS Configuration

- [ ] Point domain A record to VM public IP
- [ ] Wait for DNS propagation (check with `dig`)
- [ ] Verify DNS resolves correctly

## Post-Deployment

- [ ] SSH into VM: `ssh -i ~/.ssh/your_key azureuser@<VM_IP>`
- [ ] Verify all containers are running: `docker ps`
- [ ] Check API logs: `docker logs hotel-pms-api`
- [ ] Check Postgres logs: `docker logs hotel-pms-postgres`
- [ ] Check nginx logs: `docker logs hotel-pms-nginx`
- [ ] Monitor SSL certificate setup: `sudo journalctl -u certbot-init -f`
- [ ] Wait for SSL certificate to be issued (may take 2-5 minutes)

## Database Setup

- [ ] Run migrations: `docker exec hotel-pms-api npm run db:migrate`
- [ ] Verify migrations succeeded
- [ ] (Optional) Seed database: `docker exec hotel-pms-api npm run db:seed`

## Testing

- [ ] Test health endpoint: `curl https://your-domain.com/health`
- [ ] Test API authentication endpoints
- [ ] Verify workers are processing messages
- [ ] Check RabbitMQ is accessible
- [ ] Test a complete workflow (create booking, etc.)

## Security

- [ ] Verify SSH access is configured correctly (check NSG rules)
- [ ] Ensure HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] Verify SSL certificate is valid
- [ ] Review environment variables are not exposed
- [ ] Confirm database passwords are strong

## Monitoring Setup

- [ ] Set up database backup cron job
- [ ] Configure log rotation
- [ ] Set up monitoring alerts (optional)
- [ ] Document access procedures for team

## Documentation

- [ ] Update team documentation with:
  - VM IP address and FQDN
  - SSH key location
  - How to access logs
  - Deployment procedures
  - Rollback procedures
  - Emergency contacts

## Final Verification

- [ ] API is accessible via HTTPS
- [ ] SSL certificate is valid and auto-renewing
- [ ] Database is persistent (survives container restart)
- [ ] All workers are running
- [ ] Logs are being generated
- [ ] Backups are configured

## Notes

- Keep `terraform.tfvars` secure and never commit to git
- Save Terraform state file securely
- Document any custom configurations
- Set calendar reminder for SSL certificate monitoring (though it auto-renews)

## Troubleshooting Quick Links

If issues arise, refer to:
- [README.md](./README.md) - Full documentation
- [Terraform outputs](run `terraform output`)
- Azure Portal - Resource group overview
- VM logs: `sudo journalctl -xe`
- Container logs: `docker logs <container-name>`

## Rollback Procedure

If deployment fails:
1. Review error messages from Terraform
2. Fix configuration issues in terraform.tfvars
3. Re-run `terraform apply`
4. If catastrophic, run `terraform destroy` and start over
5. Ensure DNS is reverted if necessary

## Support

For issues:
- Check README.md troubleshooting section
- Review Azure portal for resource status
- Check container logs
- Verify network connectivity
- Review Terraform state

