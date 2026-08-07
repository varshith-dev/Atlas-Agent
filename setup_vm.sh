#!/bin/bash
set -e

echo "=== Starting Server Setup ==="

# 1. Update apt package index
sudo apt-get update

# 2. Install curl, git, build-essential
sudo apt-get install -y curl git build-essential ca-certificates gnupg lsb-release

# 3. Setup Docker keyring
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg

# 4. Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. Install Docker & Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 6. Configure non-sudo docker access for azureuser
sudo usermod -aG docker azureuser

# 7. Install Go 1.23 using snap
sudo snap install go --classic

# 8. Install Node.js LTS v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== Server Setup Completed Successfully ==="
