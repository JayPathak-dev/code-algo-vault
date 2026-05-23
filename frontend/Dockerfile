# Stage 1: Build the React application
FROM node:22-alpine as builder
WORKDIR /app

# INJECT THE CLERK API KEY HERE
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Install dependencies and build
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:alpine

# Copy your custom Nginx configuration routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled React app from Stage 1 into Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]