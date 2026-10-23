# Etapa 1: Compilación (Builder Stage)
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Comprúebalo y genera los estáticos minificados
RUN npm run build

# Etapa 2: Servidor Ultraligero de Producción (Server Stage)
FROM nginx:alpine

# Limpia cualquier archivo demo de Nginx
RUN rm -rf /usr/share/nginx/html/*

# Arrastra exclusivamente la magia generada en la primera fase y desecha el Node de 1 Gigabyte
COPY --from=builder /app/dist/csm-pacientes/browser /usr/share/nginx/html

# Inyectamos SPA Fallback directamente (Evita error 404 de Nginx cuando entras a la ruta /mis-citas manualmente)
RUN printf 'server { \n\
    listen 80; \n\
    server_name localhost; \n\
    location / { \n\
        root /usr/share/nginx/html; \n\
        index index.html index.htm; \n\
        try_files $uri $uri/ /index.html; \n\
    } \n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
