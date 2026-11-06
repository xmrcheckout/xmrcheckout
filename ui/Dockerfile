FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS production-deps
RUN npm prune --omit=dev

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DONATIONS_ENABLED=false
ARG NEXT_PUBLIC_DONATIONS_ENABLED=false
ARG NEXT_PUBLIC_SITE_URL=http://localhost
# The deployed commit, shown in the footer; empty unless the build sets SOURCE_COMMIT.
ARG NEXT_PUBLIC_SOURCE_COMMIT=
ENV NEXT_TELEMETRY_DISABLED=1
ENV DONATIONS_ENABLED=$DONATIONS_ENABLED
ENV NEXT_PUBLIC_DONATIONS_ENABLED=$NEXT_PUBLIC_DONATIONS_ENABLED
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SOURCE_COMMIT=$NEXT_PUBLIC_SOURCE_COMMIT
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=production-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
# next start reads runtime settings such as poweredByHeader from this file.
COPY --chown=node:node --from=builder /app/next.config.mjs ./
EXPOSE 3000
USER node
CMD ["npm", "start"]
