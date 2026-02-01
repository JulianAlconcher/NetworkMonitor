#!/bin/bash

# NetworkMonitor - Server Setup Script
# This script automates the installation of Node.js, Git, and Project Dependencies

echo "🚀 Starting NetworkMonitor Server Setup..."

# 1. Update System
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (LTS)
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js is already installed."
fi

# 3. Install Git
if ! command -v git &> /dev/null; then
    echo "🟢 Installing Git..."
    sudo apt install -y git
fi

# 4. Install PM2 (Process Manager)
if ! command -v pm2 &> /dev/null; then
    echo "🟢 Installing PM2..."
    sudo npm install -g pm2
fi

# 5. Install Dependencies
echo "📦 Installing project dependencies..."
npm install

# 6. PM2 Configuration
echo "⚙️ Configuring PM2 to start on boot..."
pm2 start server/monitor.js --name "network-monitor"
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME

echo "✅ Setup Complete!"
echo "--------------------------------------------------"
echo "Your server is now running in the background."
echo "Use 'pm2 logs network-monitor' to see real-time logs."
echo "Use 'pm2 status' to check health."
echo "--------------------------------------------------"
