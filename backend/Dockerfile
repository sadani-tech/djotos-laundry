FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 4000
# Migrasi → seed (idempotent; layanan/owner yang sudah ada tidak ditimpa) → jalankan API
CMD ["sh", "-c", "npx prisma migrate deploy && SEED_SAMPLE=${SEED_SAMPLE:-false} npx ts-node prisma/seed.ts && node dist/main.js"]
