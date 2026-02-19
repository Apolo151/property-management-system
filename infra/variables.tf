variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "project_name" {
  description = "Name of the project, used for resource naming"
  type        = string
  default     = "hotel-pms"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "Italy North"
}

variable "vm_size" {
  description = "Size of the Azure VM"
  type        = string
  default     = "Standard_B2s"
}

variable "admin_username" {
  description = "Admin username for the VM"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key" {
  description = "SSH public key for VM access"
  type        = string
  sensitive   = true
}

variable "allowed_ssh_ip" {
  description = "IP address/CIDR allowed to SSH into the VM (use '*' or '0.0.0.0/0' to allow all IPs)"
  type        = string
  default     = "*"
}

variable "domain_name" {
  description = "Optional custom domain name for SSL certificate (e.g., api.example.com). If empty, the module will use the Azure Public IP FQDN (*.cloudapp.azure.com)."
  type        = string
  default     = ""
}

variable "letsencrypt_email" {
  description = "Email address for Let's Encrypt certificate notifications"
  type        = string
}

variable "data_disk_size_gb" {
  description = "Size of the data disk for persistent storage (GB)"
  type        = number
  default     = 50
}

# Application Configuration
variable "node_env" {
  description = "Node environment (development, production)"
  type        = string
  default     = "production"
}

variable "api_port" {
  description = "Port for the API service"
  type        = number
  default     = 3000
}

# Database Configuration
variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "hotel_pms_prod"
}

variable "db_user" {
  description = "PostgreSQL database user"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

# JWT Configuration
variable "jwt_secret" {
  description = "JWT secret key for authentication"
  type        = string
  sensitive   = true
}

variable "jwt_expires_in" {
  description = "JWT token expiration time"
  type        = string
  default     = "7d"
}

# RabbitMQ Configuration
variable "rabbitmq_user" {
  description = "RabbitMQ user"
  type        = string
  default     = "admin"
}

variable "rabbitmq_password" {
  description = "RabbitMQ password"
  type        = string
  sensitive   = true
}

# QloApps Integration (Optional)
variable "qloapps_api_url" {
  description = "QloApps API URL (optional)"
  type        = string
  default     = ""
}

variable "qloapps_api_key" {
  description = "QloApps API key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "qloapps_default_currency" {
  description = "QloApps default currency"
  type        = string
  default     = "USD"
}

# Beds24 Integration (Optional)
variable "beds24_api_key" {
  description = "Beds24 API key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "beds24_prop_key" {
  description = "Beds24 property key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "beds24_api_url" {
  description = "Beds24 API URL"
  type        = string
  default     = "https://api.beds24.com/v2"
}

variable "beds24_webhook_secret" {
  description = "Beds24 webhook secret (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

# Sync Configuration
variable "sync_enabled" {
  description = "Enable sync workers"
  type        = bool
  default     = true
}

variable "sync_interval_ms" {
  description = "Sync interval in milliseconds"
  type        = number
  default     = 60000
}

variable "encryption_key" {
  description = "Encryption key for sensitive data"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    ManagedBy = "Terraform"
    Project   = "HotelPMS"
  }
}

