FROM node:22-alpine

WORKDIR /app

# --- NEW: Install native compilers directly into the backend! ---
RUN apk add --no-cache python3 g++ gcc make
# ----------------------------------------------------------------

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5002

CMD ["npm", "start"]