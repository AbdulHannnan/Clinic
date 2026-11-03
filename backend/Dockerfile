# Clinic backend (NestJS + Prisma). Build from the REPO ROOT:
#   docker build -f backend/Dockerfile -t clinic-backend .
# NOTE: not build-tested in CI yet — validate with `docker build` before relying on it.
# openssl + libc6-compat are Prisma's runtime requirements on Alpine.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
# Prisma schema must be present so backend's postinstall `prisma generate` succeeds.
COPY backend/prisma backend/prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:shared && npm run build -w backend

FROM node:22-alpine AS run
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
ENV PORT=4000
# node_modules from build already holds the generated Prisma client.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma ./backend/prisma
EXPOSE 4000
# Apply migrations, then start. One copy per doctor; see docs/deployment.md.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=backend/prisma/schema.prisma && node backend/dist/main.js"]
