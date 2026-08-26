FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY misil-hub ./misil-hub

ENV NODE_ENV=production
ENV MISIL_HUB_HOST=0.0.0.0
ENV MISIL_HUB_PORT=4320
ENV MISIL_HUB_DATA_DIR=/var/lib/misil-hub
EXPOSE 4320

CMD ["node", "misil-hub/server.mjs"]
