FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY .npmrc ./
RUN npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXTAUTH_SECRET=build_placeholder
ENV AUTH_SECRET=build_placeholder
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NEXT_PUBLIC_BASE_PATH=/apps/xklwb3f46m48u5s4h2h5d4pd
RUN mkdir -p public
RUN npm run build

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
COPY --from=builder --chown=nextjs:nodejs /app/start.sh ./start.sh
RUN chmod +x ./start.sh
RUN touch /app/.env.production \
 && chown nextjs:nodejs /app/.env.production \
 && chmod 644 /app/.env.production

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["./start.sh"]
