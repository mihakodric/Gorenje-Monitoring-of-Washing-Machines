# Frontend Docker Setup

This directory contains Docker configuration for the React frontend application.

## 🐳 **Docker Files**

### **Production Setup (Dockerfile)**
- Multi-stage build with Node.js and Nginx
- Optimized for production deployment
- Includes security headers and caching
- API proxy configuration to backend

### **Development Setup (Dockerfile.dev)**
- Single-stage build with hot reloading
- Volume mounting for live code changes
- Faster development iterations

## 🚀 **Usage**

### **Production Build**
```bash
# Build and run with docker-compose
docker-compose up --build

# Frontend will be available at: http://localhost:3000
# API proxy will forward /api/* to backend at port 8000
```

### **Development Build**
```bash
# Use development compose file
docker-compose -f docker-compose.dev.yml up --build

# Frontend dev server at: http://localhost:3000
# Hot reloading enabled with volume mounting
```

### **Manual Docker Commands**
```bash
# Production build
docker build -t gorenje-frontend .
docker run -p 3000:80 gorenje-frontend

# Development build
docker build -f Dockerfile.dev -t gorenje-frontend-dev .
docker run -p 3000:3000 -v $(pwd):/app -v /app/node_modules gorenje-frontend-dev
```

## 📋 **Features**

### **Production Container:**
- ✅ Multi-stage build (smaller final image)
- ✅ Nginx web server with optimized configuration
- ✅ Gzip compression for static assets
- ✅ Security headers (XSS, Content-Type, Frame-Options)
- ✅ SPA routing support (React Router)
- ✅ API proxy to backend container
- ✅ Static asset caching (1 year for images, JS, CSS)
- ✅ Health check endpoint

### **Development Container:**
- ✅ Live code reloading
- ✅ Volume mounting for instant changes
- ✅ Full development dependencies
- ✅ React development server
- ✅ Environment variable support

## 🔧 **Configuration**

### **Environment Variables**
- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:8000)

### **Nginx Configuration**
- Custom nginx.conf with:
  - API proxy to backend container
  - CORS headers
  - Security headers
  - Gzip compression
  - Static asset caching

## 📦 **Build Optimization**

- `.dockerignore` excludes unnecessary files
- Multi-stage build reduces final image size
- npm ci for faster, reliable builds
- Only production dependencies in final image

## 🌐 **Access Points**

- **Frontend**: http://localhost:3000
- **API (proxied)**: http://localhost:3000/api/
- **Direct Backend**: http://localhost:8000 (if needed)

## 🔍 **Troubleshooting**

### **Common Issues:**
1. **CORS errors**: Ensure API proxy is working correctly
2. **Hot reload not working**: Check volume mounting in dev mode
3. **Build fails**: Clear node_modules and rebuild
4. **API calls fail**: Verify backend container is running

### **Logs:**
```bash
# Frontend container logs
docker logs frontend

# All services logs
docker-compose logs -f
```