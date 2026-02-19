output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "vm_public_ip" {
  description = "Public IP address of the VM"
  value       = azurerm_public_ip.main.ip_address
}

output "vm_fqdn" {
  description = "Fully qualified domain name of the VM"
  value       = azurerm_public_ip.main.fqdn
}

output "ssh_connection_string" {
  description = "SSH connection string for the VM"
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.main.ip_address}"
}

output "api_endpoint" {
  description = "API endpoint URL"
  value       = "https://${var.domain_name != "" ? var.domain_name : azurerm_public_ip.main.fqdn}"
}

output "vm_id" {
  description = "ID of the virtual machine"
  value       = azurerm_linux_virtual_machine.main.id
}

output "data_disk_id" {
  description = "ID of the data disk"
  value       = azurerm_managed_disk.data.id
}

output "deployment_instructions" {
  description = "Post-deployment instructions"
  value       = <<-EOT
    
    ========================================
    Deployment Complete!
    ========================================
    
    1. SSH into the VM:
       ssh ${var.admin_username}@${azurerm_public_ip.main.ip_address}
    
    2. Check Docker containers status:
       docker ps
    
    3. View logs:
       docker logs hotel-pms-api
       docker logs hotel-pms-postgres
    
    4. Run database migrations:
       docker exec hotel-pms-api npm run db:migrate
    
    5. (Optional) Seed the database:
       docker exec hotel-pms-api npm run db:seed
    
    6. If using a custom domain, point it (${var.domain_name}) to IP: ${azurerm_public_ip.main.ip_address}
       Otherwise, use the Azure-provided domain: ${azurerm_public_ip.main.fqdn}
    
    7. Wait for Let's Encrypt certificate (check logs):
       sudo journalctl -u certbot-init -f
    
    8. Test your API:
       curl https://${var.domain_name != "" ? var.domain_name : azurerm_public_ip.main.fqdn}/health
    
    ========================================
  EOT
}

