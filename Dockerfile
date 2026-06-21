# Multi-stage build for backend api
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm ci

# Copy source files
COPY backend/ ./backend/

# Build packages
RUN npm run build --w @portfolio-os/api

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install production dependencies
RUN npm ci --only=production

COPY --from=builder /usr/src/app/backend/dist ./backend/dist

EXPOSE 5000

ENV NODE_ENV=production

CMD ["npm", "run", "start", "--w", "@portfolio-os/api"]
