FROM node:22-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install all deps (build tooling lives in devDependencies).
RUN npm ci && npm cache clean --force

COPY . .

# Generate the Prisma client and build the app.
RUN npx prisma generate && npm run build

# docker-start runs: prisma migrate deploy (idempotent) then react-router-serve.
CMD ["npm", "run", "docker-start"]
