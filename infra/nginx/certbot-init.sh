#!/bin/bash
set -e

# Load environment variables
if [ -f /opt/hotel-pms/.env ]; then
    source /opt/hotel-pms/.env
fi

DOMAIN="${DOMAIN_NAME}"
EMAIL="${LETSENCRYPT_EMAIL}"
CERT_PATH="/data/letsencrypt/etc/live/${DOMAIN}"

echo "==================================="
echo "Let's Encrypt Certificate Setup"
echo "==================================="
echo "Domain: ${DOMAIN}"
echo "Email: ${EMAIL}"
echo ""

# Check if certificate already exists
if [ -d "${CERT_PATH}" ] && [ -f "${CERT_PATH}/fullchain.pem" ]; then
    echo "✓ Certificate already exists at ${CERT_PATH}"
    echo "✓ Skipping certificate generation"
    exit 0
fi

echo "→ Installing certbot..."
apt-get update -qq
apt-get install -y certbot python3-certbot-nginx > /dev/null 2>&1

echo "→ Stopping nginx container temporarily..."
docker stop hotel-pms-nginx || true

echo "→ Requesting certificate from Let's Encrypt..."
certbot certonly \
    --standalone \
    --preferred-challenges http \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --domain "${DOMAIN}" \
    --config-dir /data/letsencrypt/etc \
    --work-dir /data/letsencrypt/lib \
    --logs-dir /var/log/letsencrypt \
    --non-interactive

if [ $? -eq 0 ]; then
    echo "✓ Certificate obtained successfully!"
    
    # Update nginx configuration with actual domain
    sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /opt/hotel-pms/nginx/nginx.conf
    
    echo "→ Starting nginx container..."
    docker start hotel-pms-nginx
    
    echo "→ Setting up automatic renewal..."
    # Create renewal cron job
    cat > /etc/cron.d/certbot-renew << EOF
# Renew certificates twice daily
0 0,12 * * * root certbot renew --config-dir /data/letsencrypt/etc --work-dir /data/letsencrypt/lib --logs-dir /var/log/letsencrypt --quiet --deploy-hook "docker restart hotel-pms-nginx"
EOF
    
    chmod 0644 /etc/cron.d/certbot-renew
    
    echo "✓ SSL certificate setup complete!"
    echo ""
    echo "Certificate details:"
    echo "  - Certificate: ${CERT_PATH}/fullchain.pem"
    echo "  - Private Key: ${CERT_PATH}/privkey.pem"
    echo "  - Expiry: $(date -d "+90 days" +%Y-%m-%d)"
    echo "  - Auto-renewal: Enabled (runs twice daily)"
    echo ""
    echo "==================================="
else
    echo "✗ Failed to obtain certificate"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Verify DNS is pointing to this server: $(curl -s ifconfig.me)"
    echo "2. Ensure ports 80 and 443 are open in firewall"
    echo "3. Check if domain resolves: dig ${DOMAIN}"
    echo "4. Try again after DNS propagation (may take up to 48 hours)"
    echo ""
    echo "==================================="
    
    # Start nginx anyway for HTTP access
    docker start hotel-pms-nginx || true
    exit 1
fi

