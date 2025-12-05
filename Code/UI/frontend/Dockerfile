# Development Dockerfile for React frontend with hot reload
# For production build, use Dockerfile.prod instead
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for development)
RUN npm install

# Copy source code
COPY . .

# Expose port 3000 for development server
EXPOSE 3000

# Set environment variables for hot reload
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
ENV WDS_SOCKET_PORT=0
ENV REACT_APP_API_URL=http://localhost:8000

# Start development server with hot reload
CMD ["npm", "start"]