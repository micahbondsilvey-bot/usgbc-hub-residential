# Backend (NestJS) — dev-mode container for the demo.
FROM node:20-bookworm

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json ./
RUN npm install

# Copy the source (node_modules excluded via .dockerignore).
COPY . .

EXPOSE 3000

# start:dev compiles with the Nest CLI and watches for changes.
CMD ["npm", "run", "start:dev"]
