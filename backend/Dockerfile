FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Beim Build wird keine Datenbank gebraucht; Seiten werden zur Laufzeit gerendert.
RUN PAYLOAD_SECRET=build-only DATABASE_URI=file:/tmp/build.db npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=Europe/Berlin \
    DATABASE_URI=file:/data/db/reparierbar.db BILDER_DIR=/data/bilder
RUN apk add --no-cache tzdata \
 && mkdir -p /data/db /data/bilder && chown -R node:node /data
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
VOLUME /data
# Erst Migrationen, dann die App (Jobs laufen per autoRun im selben Prozess)
CMD ["sh", "-c", "npx payload migrate && npm start"]
