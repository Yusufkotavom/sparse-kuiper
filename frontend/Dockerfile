# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency manifest
COPY package.json ./

# Install dependencies
RUN npm install

# Copy semua source code frontend
COPY . .

# Build aplikasi Next.js
# Pastikan env variabel seperti NEXT_PUBLIC_API_URL sudah diset jika dibutuhkan saat build
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy file-file yang dibutuhkan dari stage builder
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose port Next.js
EXPOSE 3000

# Jalankan aplikasi produksi
CMD ["npm", "run", "start"]
