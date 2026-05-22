# Use a lightweight Node.js environment
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the backend source code
COPY . .

# Expose the port the API runs on
EXPOSE 5001

# Command to start the server
CMD ["node", "server.js"]