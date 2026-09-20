FROM node:20-alpine

WORKDIR /app/frontend

COPY package.json package-lock.json* ./
RUN npm install

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
