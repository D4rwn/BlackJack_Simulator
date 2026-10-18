# Stage 1: Base dependencies
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Development server (Vite HMR)
FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 3: Automated verification (TypeScript + Vitest)
FROM base AS test
COPY . .
CMD ["sh", "-c", "npm run typecheck && npm test"]

# Stage 4: Production build
FROM base AS build
COPY . .
RUN npm run build

# Stage 5: Production Nginx server
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

