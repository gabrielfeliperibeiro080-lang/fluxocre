FROM node:20-alpine

WORKDIR /app

# Copia package.json e instala dependências
COPY package*.json ./
RUN npm install

# Copia o restante do código
COPY . .

# Compila o TypeScript
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
