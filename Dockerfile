# Multi-stage build for backend api
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

# Install all dependencies (development + production) for build step
RUN npm ci

# Copy tsconfig and source files
COPY tsconfig.json ./
COPY src/ ./src/

# Build typescript code
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built code from builder
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 5000

ENV NODE_ENV=production

CMD ["npm", "run", "start"]

