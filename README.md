# Gorenje Washing Machine Monitoring

## Quick Start

- **Docker Setup**: See [Code/UI/README.md](Code/UI/README.md) for instructions on setting up the backend and frontend containers.

- **ESP Code**: The ESP32 sensor code in `Code/esp/` uses the PlatformIO extension for easy loading and deployment.

## Release & Deployment

### Creating a Release
To trigger a build and publish new Docker images to GHCR:
1. Create a git tag (e.g., `v1.2.3`).
2. Push the tag: `git push origin v1.2.3`.
The GitHub Actions workflow will automatically build and push `frontend`, `backend`, and `mqtt-worker` images.

### Windows Deployment (Customer Bundle)
The deployment bundle is located in [`deploy/windows/`](deploy/windows/).
See [`deploy/windows/README.txt`](deploy/windows/README.txt) for detailed instructions on installation, updates, and rollback.
