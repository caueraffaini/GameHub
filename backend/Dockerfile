# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --workspace=backend
COPY backend/ ./backend/
RUN npm run build -w backend

# Stage 2: Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --only=production --workspace=backend
COPY --from=builder /app/backend/dist ./backend/dist
EXPOSE 3000
CMD ["node", "-r", "./backend/dist/shared/telemetry/otel-bootstrap.js", "backend/dist/main.js"]
