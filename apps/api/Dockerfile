# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

# Copy repository files necessary for build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/api ./apps/api
COPY packages ./packages

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @voxflow/api build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --prod --filter @voxflow/api

COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/server.js"]
