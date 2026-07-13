FROM node:18-alpine

# Prisma'nın Alpine üzerinde çalışabilmesi için OpenSSL kütüphanesini yüklüyoruz
RUN apk add --no-cache openssl

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]