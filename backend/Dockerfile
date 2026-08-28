FROM node:22-alpine

WORKDIR /app

# O build context do Railway é a raiz do repo,
# então precisamos referenciar a pasta backend/ explicitamente
COPY backend/package*.json ./
RUN npm install

COPY backend/ .

# Corrige permissões dos binários (necessário ao copiar do Windows)
RUN chmod +x node_modules/.bin/*

# Compila o TypeScript
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
