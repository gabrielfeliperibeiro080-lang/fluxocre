FROM node:20-alpine

WORKDIR /app

# O build context do Railway é a raiz do repo,
# então precisamos referenciar a pasta backend/ explicitamente
COPY backend/package*.json ./
RUN npm install

COPY backend/ .

# Compila o TypeScript
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
