FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero (mejor cache de capas)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente
COPY src/ ./src/

EXPOSE 3155

ENV PORT=3155

CMD ["node", "src/app.js"]
