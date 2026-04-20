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

EXPOSE 3000
CMD ["sh", "-c", "exec serve -s dist -l ${PORT:-3000}"]
