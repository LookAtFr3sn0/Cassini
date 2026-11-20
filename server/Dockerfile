FROM node:26-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build

FROM node:26-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ .
COPY --from=web /web/dist ./public
EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]
