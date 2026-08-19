FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY accounts.json ./

EXPOSE 3000

CMD ["npm", "start"]
