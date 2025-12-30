#!/bin/bash
# Initial Server Setup Script
# Run as ROOT user on fresh Linode server
# Usage: bash 01-initial-server-setup.sh

set -e  # Exit on error

echo "=== Initial Server Setup ==="
echo ""
echo "This script will:"
echo "  - Update system packages"
echo "  - Configure SSH security"
echo "  - Create deploy user with sudo access"
echo "  - Install all required dependencies"
echo "  - Setup firewall basics"
echo ""
read -p "Press Enter to continue..."

# Update system
echo ""
echo "[1/9] Updating system packages..."
apt update && apt upgrade -y

# Configure SSH for security
echo "[2/9] Configuring SSH security..."
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Disable root login (will do this AFTER setting up deploy user)
# Disable password authentication (will do this AFTER confirming SSH key works)
sed -i 's/#PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config

# Set up fail2ban for SSH protection
echo "[3/9] Installing fail2ban for SSH protection..."
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Create deploy user
echo "[4/9] Creating deploy user..."
if id "deploy" &>/dev/null; then
    echo "User 'deploy' already exists, skipping..."
else
    adduser --gecos "" --disabled-password deploy
    echo "deploy:$(openssl rand -base64 32)" | chpasswd  # Random password (won't be used)
    usermod -aG sudo deploy
    
    # Allow deploy user to use sudo without password
    echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
    chmod 440 /etc/sudoers.d/deploy
fi

# Setup SSH for deploy user
echo "[5/9] Setting up SSH for deploy user..."
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh

# Copy root's authorized_keys to deploy user
if [ -f /root/.ssh/authorized_keys ]; then
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
    chmod 600 /home/deploy/.ssh/authorized_keys
    chown -R deploy:deploy /home/deploy/.ssh
    echo "✓ SSH keys copied from root to deploy user"
else
    echo "⚠ WARNING: No SSH keys found in /root/.ssh/authorized_keys"
    echo ""
    echo "Please add your SSH public key now:"
    echo "From your LOCAL machine, run:"
    echo "  ssh-copy-id deploy@$(curl -s ifconfig.me)"
    echo ""
    read -p "Press Enter after adding your SSH key..."
fi

# Install basic dependencies
echo "[6/9] Installing Python, PostgreSQL, Nginx, Git..."
apt install -y \
    python3 \
    python3-venv \
    python3-pip \
    postgresql \
    postgresql-contrib \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    curl \
    wget \
    ufw \
    htop \
    vim \
    unzip

# Install Node.js 18
echo "[7/9] Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Basic firewall setup (will be completed in script 06)
echo "[8/9] Setting up basic firewall rules..."
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
# Don't enable yet - will do in script 06

# Set timezone (optional but recommended)
echo "[9/9] Setting timezone to UTC..."
timedatectl set-timezone UTC

# Create deployment config directory
mkdir -p /home/deploy/deployment-config
chown -R deploy:deploy /home/deploy/deployment-config
chmod 700 /home/deploy/deployment-config

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "✓ System updated"
echo "✓ SSH security configured"
echo "✓ fail2ban installed"
echo "✓ Deploy user created with sudo access"
echo "✓ SSH keys configured"
echo "✓ All dependencies installed"
echo "✓ Basic firewall rules configured"
echo ""
echo "IMPORTANT: Test SSH access before closing this session!"
echo ""
echo "In a NEW terminal window, test:"
echo "  ssh deploy@$(curl -s ifconfig.me)"
echo ""
echo "If that works, you can proceed with:"
echo "  1. Exit this root session"
echo "  2. SSH in as deploy user"
echo "  3. Run: bash 02-configure-database.sh"
echo ""
read -p "Press Enter to finish..."
