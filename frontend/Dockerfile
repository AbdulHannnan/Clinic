# Clinic frontend (Next.js standalone). Build from the REPO ROOT:
#   docker build -f frontend/Dockerfile -t clinic-frontend .
# NOTE: not build-tested in CI yet — validate with `docker build` before relying on it.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
# Skip postinstall: backend's `prisma generate` needs a schema the frontend image doesn't carry.
RUN npm ci --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:shared && npm run build -w frontend

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Next's standalone bundle; in this workspace layout the server sits under frontend/.
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
EXPOSE 3000
CMD ["node", "frontend/server.js"]
