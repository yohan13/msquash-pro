FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

ENV PORT=4000
ENV NODE_ENV=production

EXPOSE 4000

CMD ["sh", "docker-entrypoint.sh"]
