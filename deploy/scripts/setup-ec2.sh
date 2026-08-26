#!/bin/bash
set -euo pipefail

# ─── EC2 Instance Initial Setup Script ────────────────────────────────────────
# Run this once on a fresh Ubuntu 22.04+ EC2 instance
# Usage: sudo bash setup-ec2.sh

APP_NAME="taskflow"
DEPLOY_DIR="/opt/$APP_NAME"
DEPLOY_USER="deploy"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TaskFlow EC2 Setup                                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ─── System Updates ───────────────────────────────────────────────────────────
echo "→ Updating system packages..."
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git unzip htop

# ─── Install Docker ───────────────────────────────────────────────────────────
echo "→ Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin

# ─── Create Deploy User ──────────────────────────────────────────────────────
echo "→ Creating deploy user..."
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$DEPLOY_USER"
    usermod -aG docker "$DEPLOY_USER"
fi

# ─── Create Application Directory ────────────────────────────────────────────
echo "→ Setting up application directory..."
mkdir -p "$DEPLOY_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR"

# ─── Install Nginx ────────────────────────────────────────────────────────────
echo "→ Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx

# ─── Firewall Setup ──────────────────────────────────────────────────────────
echo "→ Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# ─── Swap Space (for smaller instances) ──────────────────────────────────────
if [ ! -f /swapfile ]; then
    echo "→ Creating swap space..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ─── System Tuning ───────────────────────────────────────────────────────────
echo "→ Applying system tuning..."
cat >> /etc/sysctl.conf << 'EOF'
# Network tuning
net.core.somaxconn = 65535
net.ipv4.tcp_max_tw_buckets = 1440000
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_window_scaling = 1
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216

# File descriptors
fs.file-max = 2097152
EOF
sysctl -p

# ─── Log Rotation ────────────────────────────────────────────────────────────
cat > /etc/logrotate.d/taskflow << 'EOF'
/opt/taskflow/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    sharedscripts
}
EOF

# ─── Systemd Service ─────────────────────────────────────────────────────────
echo "→ Creating systemd service..."
cat > /etc/systemd/system/taskflow.service << EOF
[Unit]
Description=TaskFlow Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=$DEPLOY_USER
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable taskflow

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Setup Complete!                                            ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                                ║"
echo "║  1. Copy docker-compose.yml to $DEPLOY_DIR                  ║"
echo "║  2. Create .env.production in $DEPLOY_DIR                   ║"
echo "║  3. Copy nginx config to /etc/nginx/sites-available         ║"
echo "║  4. Run: ./deploy.sh production                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
