FROM node:18-alpine

# Prisma'nın Alpine üzerinde çalışabilmesi için OpenSSL kütüphanesini, Auto-Code için Git'i yüklüyoruz
RUN apk add --no-cache openssl git

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]