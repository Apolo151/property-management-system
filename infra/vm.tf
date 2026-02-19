# Linux Virtual Machine
resource "azurerm_linux_virtual_machine" "main" {
  name                  = "${var.project_name}-${var.environment}-vm"
  location              = azurerm_resource_group.main.location
  resource_group_name   = azurerm_resource_group.main.name
  network_interface_ids = [azurerm_network_interface.main.id]
  size                  = var.vm_size
  tags                  = var.tags

  # Use Ubuntu 22.04 LTS
  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  # OS Disk Configuration
  os_disk {
    name                 = "${var.project_name}-${var.environment}-os-disk"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = 30
  }

  # Admin User Configuration
  admin_username                  = var.admin_username
  disable_password_authentication = true

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.ssh_public_key
  }

  # Cloud-init configuration
  custom_data = base64encode(templatefile("${path.module}/scripts/cloud-init.yaml", {
    admin_username     = var.admin_username
    node_env           = var.node_env
    api_port           = var.api_port
    db_host            = "postgres"
    db_port            = 5432
    db_name            = var.db_name
    db_user            = var.db_user
    db_password        = var.db_password
    jwt_secret         = var.jwt_secret
    jwt_expires_in     = var.jwt_expires_in
    rabbitmq_url       = "amqp://${var.rabbitmq_user}:${var.rabbitmq_password}@rabbitmq:5672"
    rabbitmq_user      = var.rabbitmq_user
    rabbitmq_password  = var.rabbitmq_password
    sync_enabled       = var.sync_enabled
    sync_interval_ms   = var.sync_interval_ms
    qloapps_api_url    = var.qloapps_api_url
    qloapps_api_key    = var.qloapps_api_key
    qloapps_currency   = var.qloapps_default_currency
    beds24_api_key     = var.beds24_api_key
    beds24_prop_key    = var.beds24_prop_key
    beds24_api_url     = var.beds24_api_url
    beds24_webhook_sec = var.beds24_webhook_secret
    encryption_key     = var.encryption_key
    domain_name        = var.domain_name != "" ? var.domain_name : azurerm_public_ip.main.fqdn
    letsencrypt_email  = var.letsencrypt_email
    docker_compose_b64 = base64encode(file("${path.module}/docker/docker-compose.prod.yml"))
    nginx_conf_b64     = base64encode(file("${path.module}/nginx/nginx.conf"))
    certbot_script_b64 = base64encode(file("${path.module}/nginx/certbot-init.sh"))
  }))

  # Ensure VM is recreated if cloud-init changes
  lifecycle {
    ignore_changes = [
      custom_data
    ]
  }
}

