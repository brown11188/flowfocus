FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Stub secrets so Next.js static analysis never crashes at build time
ENV NEXTAUTH_SECRET=build_placeholder
ENV AUTH_SECRET=build_placeholder
ENV DATABASE_URL=file:./data/placeholder.db
ENV NEXT_PUBLIC_BASE_PATH=/apps/xklwb3f46m48u5s4h2h5d4pd
RUN mkdir -p public
# Generate Prisma Client (v7: outputs to src/generated/prisma/client) then build
# DB migrations are handled by the dedicated migrate stage / deployment pipeline
RUN npx prisma generate
RUN npm run build

# Dedicated migration stage — used by the deployment pipeline for migrations.
# Reuses compiled native modules from deps + pre-generated Prisma client from
# builder to avoid redundant native recompilation (~2-3 min saving).
FROM node:20-alpine AS migrate
WORKDIR /app
# Copy all node_modules (including native better-sqlite3) from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the generated Prisma client from builder (avoids regenerating)
COPY --from=builder /app/src/generated ./src/generated
# Copy source files needed at migration time
COPY prisma ./prisma
COPY prisma.config.ts .
COPY package.json .
COPY tsconfig.json .
# Migration entrypoint used by deployment pipeline:
#   npm run db:migrate  →  tsx prisma/migrate.ts
#   npm run db:seed     →  tsx prisma/seed.ts

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BASE_PATH=/apps/xklwb3f46m48u5s4h2h5d4pd

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir -p ./public ./.next/static

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder --chown=nextjs:nodejs /app/start.sh ./start.sh
RUN chmod +x ./start.sh

# Create data directory for SQLite.
# nextjs user owns the directory so it can create WAL/SHM sibling files.
# No chmod 777 needed — ownership is sufficient.
RUN mkdir -p /app/db \
    && chown nextjs:nodejs /app/db \
    && chmod 755 /app/db
RUN touch /app/.env.production && chown nextjs:nodejs /app/.env.production && chmod 644 /app/.env.production

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["./start.sh"]
