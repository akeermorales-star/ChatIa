# Opcional: solo si quieres la "Voz del servidor" (espeak-ng). Con el runtime Node normal de Render NO hace falta.
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
CMD ["node", "server.js"]
