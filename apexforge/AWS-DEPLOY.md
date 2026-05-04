# ApexForge — AWS Linux Server Deployment Guide

## Prerequisites
- AWS account with EC2 access
- SSH key pair (.pem file)
- ApexForge project folder (apexforge/)

---

## STEP 1 — Launch an EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance
2. Choose: **Ubuntu Server 22.04 LTS** (Free tier eligible)
3. Instance type: **t2.micro** (free tier) or **t3.small** for better performance
4. Key pair: Create or select an existing .pem key
5. Security Group — open these ports:
   - SSH: port **22** (Your IP only, for security)
   - HTTP: port **80** (Anywhere: 0.0.0.0/0)
   - HTTPS: port **443** (Anywhere: 0.0.0.0/0)
6. Storage: 8GB gp3 (default is fine)
7. Click **Launch Instance**

---

## STEP 2 — Connect to Your Server

```bash
# Replace with your .pem path and EC2 public IP
chmod 400 ~/your-key.pem
ssh -i ~/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## STEP 3 — Install Nginx on the Server

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install nginx
sudo apt install nginx -y

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify it's running — you should see "active (running)"
sudo systemctl status nginx
```

Visit `http://YOUR_EC2_PUBLIC_IP` in a browser — you should see the default Nginx page.

---

## STEP 4 — Upload ApexForge Files

### Option A: Upload via SCP (from your local machine)

```bash
# On your LOCAL machine — run this command
# Upload the entire apexforge folder to the server
scp -i ~/your-key.pem -r ./apexforge ubuntu@YOUR_EC2_PUBLIC_IP:/home/ubuntu/

# SSH back into server
ssh -i ~/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### Option B: Upload via GitHub (recommended for updates)

```bash
# On the server:
sudo apt install git -y

# Clone your repo (if you have it on GitHub)
git clone https://github.com/yourusername/apexforge.git /home/ubuntu/apexforge
```

### Option C: Use WinSCP or FileZilla (GUI tools)
- Host: YOUR_EC2_PUBLIC_IP, Port: 22
- Auth: your .pem key file

---

## STEP 5 — Deploy Files to Web Root

```bash
# On the SERVER:

# Create the web directory
sudo mkdir -p /var/www/apexforge

# Copy all files from upload location
sudo cp -r /home/ubuntu/apexforge/* /var/www/apexforge/

# Set proper ownership
sudo chown -R www-data:www-data /var/www/apexforge

# Set proper permissions
sudo chmod -R 755 /var/www/apexforge
```

---

## STEP 6 — Configure Nginx for ApexForge

```bash
# Create nginx config for ApexForge
sudo nano /etc/nginx/sites-available/apexforge
```

Paste this content (replace YOUR_EC2_PUBLIC_IP with your IP or domain):

```nginx
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;  # or your domain name

    root /var/www/apexforge;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_types text/css application/javascript image/svg+xml text/html;
    gzip_comp_level 6;

    location ~* \.(css|js|svg|ico|png|jpg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store";
    }

    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    location ~ /\. { deny all; }
}
```

Save and exit (Ctrl+X, Y, Enter)

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/apexforge /etc/nginx/sites-enabled/

# Remove default site (optional but clean)
sudo rm /etc/nginx/sites-enabled/default

# Test the nginx config
sudo nginx -t

# If "test is successful", reload nginx
sudo systemctl reload nginx
```

---

## STEP 7 — Test Your Site

Open in browser: `http://YOUR_EC2_PUBLIC_IP`

You should see the ApexForge homepage with the animated particle canvas!

---

## STEP 8 — (Optional) Add a Domain Name + HTTPS

### Point your domain to EC2:
1. Go to your domain registrar (GoDaddy / Namecheap / Route 53)
2. Add an **A record**: `@` → YOUR_EC2_PUBLIC_IP
3. Add an **A record**: `www` → YOUR_EC2_PUBLIC_IP

### Install SSL with Certbot (free HTTPS):
```bash
sudo apt install certbot python3-certbot-nginx -y

# Replace with your actual domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts — Certbot will auto-configure HTTPS
# Test renewal
sudo certbot renew --dry-run
```

---

## STEP 9 — (Optional) Elastic IP

By default, EC2 public IPs change on reboot. To get a permanent IP:

1. AWS Console → EC2 → Elastic IPs → Allocate Elastic IP
2. Associate it with your instance

---

## STEP 10 — Updating the Site

When you make changes to your local files:

```bash
# Option A: Re-upload via SCP
scp -i ~/your-key.pem -r ./apexforge/* ubuntu@YOUR_EC2_PUBLIC_IP:/var/www/apexforge/

# Option B: If using Git on server
cd /var/www/apexforge
sudo git pull origin main
sudo chown -R www-data:www-data /var/www/apexforge

# Reload nginx (not always necessary for static files, but good practice)
sudo systemctl reload nginx
```

---

## Quick Reference

| Task | Command |
|------|---------|
| SSH into server | `ssh -i key.pem ubuntu@IP` |
| Nginx status | `sudo systemctl status nginx` |
| Reload nginx | `sudo systemctl reload nginx` |
| View error logs | `sudo tail -f /var/log/nginx/error.log` |
| View access logs | `sudo tail -f /var/log/nginx/access.log` |
| Deploy files | `sudo cp -r /home/ubuntu/apexforge/* /var/www/apexforge/` |

---

## Cost Estimate (AWS Free Tier)

| Resource | Cost |
|---------|------|
| EC2 t2.micro | Free (750 hrs/mo for 12 months) |
| EBS 8GB storage | Free (30GB/mo for 12 months) |
| Elastic IP (in use) | Free |
| Data transfer (first 100GB) | Free |

**After free tier: ~$8-15/month** for a t2.micro in most regions.

---

## Troubleshooting

**Site shows 403 Forbidden:**
```bash
sudo chown -R www-data:www-data /var/www/apexforge
sudo chmod -R 755 /var/www/apexforge
```

**Site shows 502 Bad Gateway:**
```bash
sudo nginx -t  # check config syntax
sudo systemctl restart nginx
```

**CSS/JS not loading (404):**
- Verify the `assets/` folder exists: `ls /var/www/apexforge/assets/`
- Check nginx root path is correct: `/var/www/apexforge`

**Fonts not loading:**
- The site uses Google Fonts (Orbitron, Rajdhani) loaded via CDN
- Ensure your server has outbound internet access (EC2 does by default)
