# Frontend (Angular) — dev-server container for the demo.
FROM node:20-bookworm

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 4200

# Serve on all interfaces and proxy /api to the backend container (works for
# both local Docker and Codespaces forwarded ports).
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--port", "4200", "--proxy-config", "proxy.conf.json"]
