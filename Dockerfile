FROM node:18-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# 1. Instala dependências (incluindo o Prisma CLI e Client)
COPY package*.json ./
RUN npm install

# 2. Copia todo o código fonte (incluindo a pasta prisma/schema.prisma)
COPY . .

# 3. (NOVO) Gera o Prisma Client com base no schema copiado acima
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "start"]