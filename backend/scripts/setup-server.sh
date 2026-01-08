#!/bin/bash
# ============================================
# MCWEB FAST - Setup del Servidor Hetzner
# ============================================
# Ejecutar como root en un VPS Ubuntu 22.04+

set -e

echo "🚀 Iniciando setup de MCWEB Fast..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Variables
DOMAIN="mcweb.fast"  # Cambiar por tu dominio
APP_DIR="/var/www/mcweb-fast"
SITES_DIR="/var/www/sites"

# ============================================
# 1. ACTUALIZAR SISTEMA
# ============================================
echo -e "${YELLOW}📦 Actualizando sistema...${NC}"
apt update && apt upgrade -y

# ============================================
# 2. INSTALAR DEPENDENCIAS
# ============================================
echo -e "${YELLOW}📦 Instalando dependencias...${NC}"

# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Nginx
apt install -y nginx

# SQLite
apt install -y sqlite3

# Herramientas útiles
apt install -y git curl wget htop vnstat ufw

# PM2 (gestor de procesos Node)
npm install -g pm2

echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# ============================================
# 3. CONFIGURAR FIREWALL
# ============================================
echo -e "${YELLOW}🔒 Configurando firewall...${NC}"

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

echo -e "${GREEN}✅ Firewall configurado${NC}"

# ============================================
# 4. CREAR DIRECTORIOS
# ============================================
echo -e "${YELLOW}📁 Creando directorios...${NC}"

mkdir -p $APP_DIR
mkdir -p $SITES_DIR
mkdir -p /var/log/mcweb-fast

chown -R www-data:www-data $SITES_DIR
chmod -R 755 $SITES_DIR

echo -e "${GREEN}✅ Directorios creados${NC}"

# ============================================
# 5. CONFIGURAR NGINX
# ============================================
echo -e "${YELLOW}🌐 Configurando Nginx...${NC}"

# Nginx principal para el panel
cat > /etc/nginx/sites-available/mcweb-panel << 'EOF'
# Panel de administración MCWEB Fast
server {
    listen 80;
    server_name mcweb.fast www.mcweb.fast;

    # Redirección a HTTPS (descomentar cuando tengas SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Archivos estáticos del frontend
    location /assets/ {
        alias /var/www/mcweb-fast/frontend/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Límite de tamaño de subida
    client_max_body_size 10M;
}
EOF

# Nginx template para sitios de clientes
cat > /etc/nginx/sites-available/site-template << 'EOF'
# Template para sitios de clientes
# Copiar y modificar para cada dominio
server {
    listen 80;
    server_name DOMINIO www.DOMINIO;

    root /var/www/sites/IDENTIFICADOR/public;
    index index.html;

    # Solo permitir IPs de Cloudflare
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    real_ip_header CF-Connecting-IP;

    # Compresión
    gzip on;
    gzip_types text/css application/javascript image/svg+xml;

    # Cache headers para estáticos
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Uploads
    location /uploads/ {
        alias /var/www/sites/IDENTIFICADOR/uploads/;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# Activar configuración del panel
ln -sf /etc/nginx/sites-available/mcweb-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar y recargar Nginx
nginx -t && systemctl reload nginx

echo -e "${GREEN}✅ Nginx configurado${NC}"

# ============================================
# 6. CONFIGURAR MONITOREO
# ============================================
echo -e "${YELLOW}📊 Configurando monitoreo...${NC}"

# Cron para monitoreo de bandwidth
cat > /etc/cron.hourly/mcweb-monitor << 'EOF'
#!/bin/bash
USED_GB=$(vnstat --json | jq -r '.interfaces[0].traffic.month[0].tx // 0' 2>/dev/null)
if [ -z "$USED_GB" ]; then
    USED_GB=0
fi
USED_GB_REAL=$(echo "scale=2; $USED_GB / 1073741824" | bc)
echo "$(date): Bandwidth usado: ${USED_GB_REAL} GB" >> /var/log/mcweb-fast/bandwidth.log

# Alerta si supera 18TB (90% de 20TB)
LIMIT=19327352832000  # 18TB en bytes
if [ "$USED_GB" -gt "$LIMIT" ]; then
    echo "⚠️ ALERTA: Bandwidth cercano al límite!" >> /var/log/mcweb-fast/alerts.log
fi
EOF
chmod +x /etc/cron.hourly/mcweb-monitor

echo -e "${GREEN}✅ Monitoreo configurado${NC}"

# ============================================
# 7. CONFIGURAR LOGROTATE
# ============================================
cat > /etc/logrotate.d/mcweb-fast << 'EOF'
/var/log/mcweb-fast/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
EOF

# ============================================
# INSTRUCCIONES FINALES
# ============================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Setup completado!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "📋 Siguientes pasos:"
echo ""
echo "1. Clona el repositorio en $APP_DIR:"
echo "   git clone [tu-repo] $APP_DIR"
echo ""
echo "2. Instala dependencias:"
echo "   cd $APP_DIR && npm install"
echo "   cd frontend && npm install && npm run build"
echo ""
echo "3. Configura las variables de entorno:"
echo "   cp .env.example .env"
echo "   nano .env  # Editar con tus tokens"
echo ""
echo "4. Inicializa la base de datos:"
echo "   npm run init-db"
echo ""
echo "5. Inicia la aplicación con PM2:"
echo "   pm2 start backend/server.js --name mcweb-fast"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
echo "6. Configura SSL con Cloudflare o Let's Encrypt"
echo ""
echo "7. Configura tu dominio en Cloudflare apuntando a la IP del servidor"
echo ""
echo -e "${YELLOW}IP del servidor: $(curl -s ifconfig.me)${NC}"
echo ""
