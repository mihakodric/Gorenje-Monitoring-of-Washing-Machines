# Docker Setup Guide

## 📁 File Structure

```
frontend/
├── Dockerfile           # Development (hot reload enabled)
├── Dockerfile.dev       # Development (alternative)
└── Dockerfile.prod      # Production (optimized build with nginx)
```

## 🔧 Development Mode (Hot Reload)

**Use this for active development - changes reflect instantly without rebuilding!**

### Start Development Environment:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Features:
✅ **Hot Module Replacement** - Changes appear instantly in browser  
✅ **No Rebuild Required** - Edit files and see updates immediately  
✅ **Fast Refresh** - React components update without page reload  
✅ **Full Dev Tools** - All devDependencies available  

### Access:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Database: localhost:5432
- MQTT: localhost:1883

### How to Make Changes:
1. Edit files in `./frontend/src/`
2. Save the file
3. Browser automatically refreshes with changes
4. **No need to restart containers!**

### Logs:
```bash
docker-compose -f docker-compose.dev.yml logs -f frontend
```

### Stop Development:
```bash
docker-compose -f docker-compose.dev.yml down
```

---

## 🚀 Production Mode (Optimized)

**Use this for deployment - optimized build with nginx**

### Start Production Environment:
```bash
docker-compose up -d
```

### Features:
✅ **Optimized Build** - Minified and bundled for performance  
✅ **Nginx Server** - Fast static file serving  
✅ **Production Ready** - Security and performance optimized  
✅ **Small Image Size** - Multi-stage build reduces size  

### Access:
- Frontend: http://localhost:3000 (served on port 80 internally)
- Backend: http://localhost:8000

### Rebuild After Changes:
```bash
docker-compose up -d --build frontend
```

### Stop Production:
```bash
docker-compose down
```

---

## 🔄 Quick Reference

| Task | Development | Production |
|------|-------------|------------|
| **Start** | `docker-compose -f docker-compose.dev.yml up -d` | `docker-compose up -d` |
| **Make Changes** | Just save files - auto updates | Rebuild required |
| **Rebuild** | Not needed | `docker-compose up -d --build` |
| **Stop** | `docker-compose -f docker-compose.dev.yml down` | `docker-compose down` |
| **Logs** | `docker-compose -f docker-compose.dev.yml logs -f` | `docker-compose logs -f` |

---

## 💡 Tips

### Development:
- Keep `docker-compose.dev.yml` running while coding
- Changes to CSS, JS, JSX reflect instantly
- If changes don't appear, check browser console for errors
- If hot reload stops working, restart: `docker-compose -f docker-compose.dev.yml restart frontend`

### Production:
- Always test production build before deployment
- Production uses nginx for better performance
- Smaller image size than development
- No source code in production image

---

## 🐛 Troubleshooting

### Changes not reflecting in development?
```bash
# Restart frontend container
docker-compose -f docker-compose.dev.yml restart frontend

# Or rebuild if needed
docker-compose -f docker-compose.dev.yml up -d --build frontend
```

### Port already in use?
```bash
# Stop all containers
docker-compose -f docker-compose.dev.yml down
docker-compose down

# Check what's using the port
netstat -ano | findstr :3000
```

### Clear everything and start fresh?
```bash
# Stop and remove all containers
docker-compose -f docker-compose.dev.yml down -v
docker-compose down -v

# Remove images
docker rmi ui-frontend ui-backend

# Rebuild from scratch
docker-compose -f docker-compose.dev.yml up -d --build
```
