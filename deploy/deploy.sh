#!/bin/bash

# Deployment script for whynotusethis.website
# Run this script on your VPS as root

set -e

echo "🚀 Deploying whynotusethis.website..."

# Variables
SITE_DIR="/var/www/whynotusethis.website"
BACKEND_DIR="$SITE_DIR/backend"
SERVICE_NAME="whynotusethis-backend"

# Create directories
echo "📁 Creating directories..."
mkdir -p $SITE_DIR
mkdir -p $BACKEND_DIR

# Copy files (assumes files are already uploaded to SITE_DIR)
# If using git, uncomment:
# cd $SITE_DIR && git pull origin main

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install backend dependencies
echo "📦 Installing dependencies..."
cd $BACKEND_DIR
npm install --production

# Setup systemd service
echo "⚙️ Setting up systemd service..."
cp $SITE_DIR/deploy/whynotusethis-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl restart $SERVICE_NAME

# Update nginx config
echo "🔧 Configuring nginx..."
cp $SITE_DIR/deploy/nginx.conf /etc/nginx/sites-available/whynotusethis.website
ln -sf /etc/nginx/sites-available/whynotusethis.website /etc/nginx/sites-enabled/

# Test and reload nginx
nginx -t && systemctl reload nginx

# Check service status
echo "✅ Checking service status..."
systemctl status $SERVICE_NAME --no-pager

echo ""
echo "🎉 Deployment complete!"
echo "📍 Website: http://whynotusethis.website"
echo "📍 Backend: http://localhost:3001"
echo ""
echo "Useful commands:"
echo "  - View logs: journalctl -u $SERVICE_NAME -f"
echo "  - Restart backend: systemctl restart $SERVICE_NAME"
echo "  - Test nginx: nginx -t"
