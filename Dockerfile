FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Beim Build wird keine Datenbank gebraucht; die Seiten werden zur Laufzeit gerendert.
RUN PAYLOAD_SECRET=build-only DATABASE_URI=postgres://build:build@localhost:5432/build npm run build
RUN npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=Europe/Berlin
RUN apk add --no-cache tzdata wget && mkdir -p /data/bilder && chown node:node /data/bilder
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
# Erst Migrationen, dann die App (Jobs laufen per autoRun im selben Prozess)
CMD ["sh", "-c", "npx payload migrate && npm start"]
