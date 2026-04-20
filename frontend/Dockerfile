# Railway — set service Root Directory to `frontend`
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# VITE_API_ORIGIN must be set in Railway Variables for this service (build-time)
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
# Set CRIDORA_API_ORIGIN or API_PUBLIC_URL on Railway (runtime — no rebuild) to your API https URL
ENTRYPOINT ["./docker-entrypoint.sh"]
