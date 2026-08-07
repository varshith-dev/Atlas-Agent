mkdir -p ~/atlas/backend/app ~/atlas/nginx ~/atlas/docker

cat << 'EOF' > ~/atlas/.env
POSTGRES_USER=atlas
POSTGRES_PASSWORD=atlas_secret
POSTGRES_DB=atlas
TUNNEL_TOKEN=your_cloudflare_tunnel_token_here
EOF

cat << 'EOF' > ~/atlas/compose.yaml
services:
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
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
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
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
    networks:
      - atlas_network

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: atlas_cloudflared
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
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

        location / {
            proxy_pass http://backend:8000;
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

cat << 'EOF' > ~/atlas/backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

touch ~/atlas/backend/app/__init__.py

cat << 'EOF' > ~/atlas/backend/app/main.py
from fastapi import FastAPI

app = FastAPI(title="Atlas Backend")

@app.get("/health")
def health_check():
    return {"status": "ok"}
EOF

cd ~/atlas
sudo docker compose up -d --build