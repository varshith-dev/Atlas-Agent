cat << 'EOF' > ~/atlas/compose.yaml
services:
  frontend:
    build: ./frontend
    container_name: atlas_frontend
    restart: always
    networks:
      - atlas_network

  backend:
    build: ./backend
    container_name: atlas_backend
    restart: always
    environment:
      - POSTGRES_URL=postgresql://atlas:atlas_secret@postgres:5432/atlas
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    networks:
      - atlas_network

  postgres:
    image: pgvector/pgvector:pg16
    container_name: atlas_postgres
    restart: always
    environment:
      - POSTGRES_USER=atlas
      - POSTGRES_PASSWORD=atlas_secret
      - POSTGRES_DB=atlas
    volumes:
      - atlas_pg_data:/var/lib/postgresql/data
    networks:
      - atlas_network

  redis:
    image: redis:7-alpine
    container_name: atlas_redis
    restart: always
    volumes:
      - atlas_redis_data:/data
    networks:
      - atlas_network

  nginx:
    image: nginx:alpine
    container_name: atlas_nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on:
      - frontend
      - backend
    networks:
      - atlas_network

networks:
  atlas_network:
    driver: bridge

volumes:
  atlas_pg_data:
  atlas_redis_data:
EOF

cat << 'EOF' > ~/atlas/nginx/nginx.conf
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;
    sendfile        on;
    keepalive_timeout  65;

    server {
        listen 80;
        server_name atlas.oqens.me;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    server {
        listen 443 ssl;
        server_name atlas.oqens.me;

        ssl_certificate /etc/letsencrypt/live/atlas.oqens.me/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/atlas.oqens.me/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;

        location / {
            proxy_pass http://atlas_frontend:80;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /api/ {
            rewrite ^/api/(.*)$ /$1 break;
            proxy_pass http://atlas_backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF

cat << 'EOF' > ~/atlas/backend/requirements.txt
fastapi[standard]>=0.111.0
uvicorn>=0.30.0
pydantic>=2.7.0
EOF

cat << 'EOF' > ~/atlas/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Atlas Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}
EOF

cd ~/atlas
sudo docker compose build frontend
sudo docker compose up -d