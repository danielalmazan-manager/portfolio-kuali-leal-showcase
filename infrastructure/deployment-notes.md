# Production Deployment Strategy

## Infrastructure Overview

Kuali Leal is currently deployed on a **self-hosted dedicated Linux server** with the following stack:

### Server Specifications
- **OS**: Debian-based Linux (Ubuntu 22.04 LTS)
- **CPU**: Multi-core processor (4+ cores recommended)
- **RAM**: 8GB+ (4GB app, 2GB MySQL, 2GB system)
- **Storage**: SSD with 100GB+ (databases, logs, uploads)
- **Network**: Static IP with reverse DNS configured

---

## Technology Stack (Production)

### Web Server: NGINX
**Role**: Reverse proxy, SSL termination, static asset serving

**Configuration Highlights**:
```nginx
# /etc/nginx/sites-available/kualileal

# Customer Portal (Next.js Static + Dynamic)
server {
    listen 443 ssl http2;
    server_name kualileal.com www.kualileal.com;

    ssl_certificate /etc/letsencrypt/live/kualileal.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kualileal.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets cache
    location /_next/static {
        proxy_pass http://localhost:3001;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}

# Business Dashboard (Subdomain)
server {
    listen 443 ssl http2;
    server_name app.kualileal.com;

    ssl_certificate /etc/letsencrypt/live/app.kualileal.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.kualileal.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        # ... (same proxy config as above)
    }
}

# HTTP -> HTTPS Redirect
server {
    listen 80;
    server_name kualileal.com www.kualileal.com app.kualileal.com;
    return 301 https://$host$request_uri;
}
```

### Process Manager: PM2
**Role**: Node.js process management, auto-restart, clustering

**Configuration**: `ecosystem.config.js`
```javascript
module.exports = {
  apps: [
    {
      name: 'kuali-customer-portal',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: '/var/www/kualileal.com',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/pm2/kuali-customer-error.log',
      out_file: '/var/log/pm2/kuali-customer-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_memory_restart: '1G',
      watch: false
    },
    {
      name: 'kuali-business-dashboard',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/var/www/app.kualileal.com',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/kuali-business-error.log',
      out_file: '/var/log/pm2/kuali-business-out.log',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G'
    }
  ]
};
```

**Common PM2 Commands**:
```bash
# Start applications
pm2 start ecosystem.config.js

# View status
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs kuali-customer-portal --lines 100

# Restart app
pm2 restart kuali-business-dashboard

# Zero-downtime reload
pm2 reload all

# Enable startup script
pm2 startup
pm2 save
```

---

## Database: MySQL 8.0

### Configuration
**File**: `/etc/mysql/mysql.conf.d/mysqld.cnf`

```ini
[mysqld]
# Basic Settings
user = mysql
pid-file = /var/run/mysqld/mysqld.pid
socket = /var/run/mysqld/mysqld.sock
port = 3306
datadir = /var/lib/mysql

# Character Set
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Performance Tuning
max_connections = 200
innodb_buffer_pool_size = 2G  # 50-70% of dedicated RAM
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 1  # ACID compliance
innodb_flush_method = O_DIRECT

# Query Cache (disabled in MySQL 8.0, use Redis instead)
# query_cache_type = 0

# Slow Query Log (for optimization)
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-query.log
long_query_time = 2

# Binary Logging (for backups & replication)
log_bin = /var/log/mysql/mysql-bin.log
expire_logs_days = 7
max_binlog_size = 100M
```

### Backup Strategy

**Automated Daily Backups**:
```bash
#!/bin/bash
# /usr/local/bin/mysql-backup.sh

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/mysql"
RETENTION_DAYS=30

# Backup Database 01 (Identity)
mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --databases bdKualiLealApp01 \
  | gzip > "$BACKUP_DIR/db01_$DATE.sql.gz"

# Backup Database 02 (Business)
mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --databases bdKualiLealApp02 \
  | gzip > "$BACKUP_DIR/db02_$DATE.sql.gz"

# Delete backups older than retention period
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Upload to cloud storage (optional)
# aws s3 cp "$BACKUP_DIR/db01_$DATE.sql.gz" s3://kuali-backups/
```

**Cron Job**: `/etc/cron.d/mysql-backup`
```
0 2 * * * root /usr/local/bin/mysql-backup.sh >> /var/log/mysql-backup.log 2>&1
```

---

## SSL/TLS Certificates

### Let's Encrypt (Certbot)

**Installation**:
```bash
sudo apt install certbot python3-certbot-nginx
```

**Certificate Issuance**:
```bash
# Customer portal
sudo certbot --nginx -d kualileal.com -d www.kualileal.com

# Business dashboard
sudo certbot --nginx -d app.kualileal.com
```

**Auto-renewal**: Certbot installs a cron job automatically
```bash
# Test renewal
sudo certbot renew --dry-run

# Manual renewal (if needed)
sudo certbot renew
sudo systemctl reload nginx
```

---

## Deployment Workflow

### Git-Based Deployment

**Repository Structure**:
```
/var/www/
├── kualileal.com/          (Customer portal - main site)
│   └── .git/
├── app.kualileal.com/      (Business dashboard - subdomain)
│   └── .git/
```

**Deployment Script**: `/usr/local/bin/deploy-kuali.sh`
```bash
#!/bin/bash
set -e

APP_DIR="/var/www/app.kualileal.com"
SITE_DIR="/var/www/kualileal.com"

echo "🚀 Deploying Kuali Leal..."

# Function to deploy an app
deploy_app() {
  local DIR=$1
  local APP_NAME=$2

  echo "📦 Deploying $APP_NAME..."
  cd "$DIR"

  # Stash any local changes
  git stash

  # Pull latest changes
  git pull origin main

  # Install dependencies
  npm ci --production=false

  # Run Prisma migrations
  if [ -d "prisma" ]; then
    npx prisma generate
    npx prisma migrate deploy
  fi

  # Build Next.js
  npm run build

  echo "✅ $APP_NAME built successfully"
}

# Deploy both apps
deploy_app "$SITE_DIR" "Customer Portal"
deploy_app "$APP_DIR" "Business Dashboard"

# Restart PM2 processes (zero-downtime)
echo "🔄 Reloading PM2 processes..."
pm2 reload all

echo "✅ Deployment complete!"
echo "📊 Status:"
pm2 status
```

**Usage**:
```bash
# SSH into server
ssh user@your-server-ip

# Run deployment
sudo /usr/local/bin/deploy-kuali.sh
```

---

## Monitoring & Logging

### Application Logs

**PM2 Logs**:
```bash
# Real-time logs
pm2 logs

# Specific app
pm2 logs kuali-business-dashboard

# Last 200 lines
pm2 logs --lines 200

# Clear logs
pm2 flush
```

**NGINX Logs**:
```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log

# Analyze with goaccess (optional)
goaccess /var/log/nginx/access.log -o report.html --log-format=COMBINED
```

**MySQL Logs**:
```bash
# Error log
tail -f /var/log/mysql/error.log

# Slow query log
tail -f /var/log/mysql/slow-query.log
```

### System Monitoring

**Resource Usage**:
```bash
# CPU & Memory
htop

# Disk usage
df -h
du -sh /var/www/*

# MySQL process
mysqladmin -u root -p status
mysqladmin -u root -p extended-status

# PM2 resource monitoring
pm2 monit
```

---

## Environment Variables Management

**Security Best Practice**: Never commit `.env` files to Git

**Production `.env` Location**:
```
/var/www/app.kualileal.com/.env
/var/www/kualileal.com/.env
```

**Permissions**:
```bash
chmod 600 /var/www/app.kualileal.com/.env
chown www-data:www-data /var/www/app.kualileal.com/.env
```

**Template**:
```bash
# Database Connections
DATABASE_URL_01="mysql://username:password@localhost:3306/bdKualiLealApp01"
DATABASE_URL_02="mysql://username:password@localhost:3306/bdKualiLealApp02"

# Authentication
JWT_SECRET="your-production-secret-min-32-chars"

# Stripe (LIVE keys)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."

# Application
NODE_ENV="production"
NEXT_TELEMETRY_DISABLED=1
```

---

## Security Hardening

### Firewall (UFW)
```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct MySQL access from outside
sudo ufw deny 3306/tcp

# Check status
sudo ufw status
```

### Fail2Ban (Brute-force Protection)
```bash
# Install
sudo apt install fail2ban

# Configure
sudo nano /etc/fail2ban/jail.local
```

```ini
[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true

[sshd]
enabled = true
maxretry = 3
bantime = 3600
```

```bash
# Start service
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check banned IPs
sudo fail2ban-client status sshd
```

### MySQL Security
```bash
# Run security script
sudo mysql_secure_installation

# Disable remote root login
mysql -u root -p
mysql> DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
mysql> FLUSH PRIVILEGES;
```

---

## Performance Optimization

### Next.js Build Optimization

**next.config.ts**:
```typescript
const config = {
  // Production optimizations
  output: 'standalone', // Reduces Docker image size
  compress: true,       // Gzip compression

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Remove console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};
```

### Database Optimization

**Prisma Connection Pooling**:
```typescript
// lib/prisma.ts
const prismaApp01 = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_01,
    },
  },
  // Connection pool settings
  pool: {
    max: 20,
    min: 5,
    idle: 10000,
  },
});
```

**Indexes** (see `database-erd.md` for full list):
```sql
-- Critical for appointment queries
CREATE INDEX idx_appointments_datetime ON TableAppointments(startTimeDate, idBusiness);

-- Critical for user lookups
CREATE INDEX idx_users_email ON users(emailUser);
```

---

## Disaster Recovery

### Backup Restoration

**Restore Database 01**:
```bash
gunzip < /var/backups/mysql/db01_20260320_020000.sql.gz | \
  mysql -u root -p bdKualiLealApp01
```

**Restore Database 02**:
```bash
gunzip < /var/backups/mysql/db02_20260320_020000.sql.gz | \
  mysql -u root -p bdKualiLealApp02
```

### Application Rollback
```bash
cd /var/www/app.kualileal.com
git log --oneline  # Find previous commit
git reset --hard <commit-hash>
npm ci
npm run build
pm2 reload all
```

---

## Future Infrastructure Improvements

### Short-term (3-6 months)
- [ ] **Redis Integration**: Session storage for horizontal scaling
- [ ] **CDN**: Cloudflare for static asset caching
- [ ] **Monitoring**: Uptime monitoring (UptimeRobot, Pingdom)
- [ ] **Error Tracking**: Sentry for production error alerts

### Medium-term (6-12 months)
- [ ] **Docker Migration**: Containerized deployment for consistency
- [ ] **CI/CD Pipeline**: GitHub Actions for automated testing & deployment
- [ ] **Read Replicas**: MySQL read replicas for analytics queries
- [ ] **Load Balancer**: NGINX load balancer for multi-instance scaling

### Long-term (12+ months)
- [ ] **Cloud Migration**: AWS/GCP for auto-scaling
- [ ] **Microservices**: Extract payment service for independent scaling
- [ ] **Kubernetes**: Container orchestration for complex deployments
- [ ] **Multi-region**: Global CDN + database replication

---

## Contact for Deployment Details

For deeper technical discussions about the production infrastructure, including:
- Specific server configurations
- Security audit results
- Performance benchmarks
- Scaling strategies

**Please schedule a technical interview where I can provide a live walkthrough.**

---

*Last Updated: March 2026*
