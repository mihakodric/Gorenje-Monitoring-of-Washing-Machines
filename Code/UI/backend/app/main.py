"""
FastAPI Application Entry Point

This is the main entry point for the Gorenje Washing Machine Monitoring API.
It sets up the FastAPI application with all routers and middleware.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.lifespan import lifespan
from app.routers import (
    sensors,
    sensor_types,
    machines, 
    machine_types,
    machine_type_sensor_templates,
    tests,
    test_relations,
    test_segments,
    measurements,
    mqtt,
    system
)


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    
    app = FastAPI(
        title="Gorenje Washing Machine Monitoring API",
        description="API for monitoring and managing washing machine sensors and tests",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://frontend:3000",
            "http://frontend-dev:3000",
            "*"  # Allow all origins for development
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["*"]
    )

    # Include routers
    app.include_router(
        sensors.router,
        prefix="/api/sensors",
        tags=["Sensors"]
    )

    app.include_router(
        sensor_types.router,
        prefix="/api/sensor-types",
        tags=["Sensor Types"]
    )
    
    app.include_router(
        machines.router,
        prefix="/api/machines",
        tags=["Machines"]
    )

    app.include_router(
        machine_types.router,
        prefix="/api/machine-types",
        tags=["Machine Types"]
    )
    
    app.include_router(
        machine_type_sensor_templates.router,
        prefix="/api/machine-types",
        tags=["Machine Type Sensor Templates"]
    )
    
    app.include_router(
        tests.router,
        prefix="/api/tests",
        tags=["Tests"]
    )
    app.include_router(
        test_relations.router,
        prefix="/api/test-relations",
        tags=["Test Relations"]
    )
    
    app.include_router(
        test_segments.router,
        prefix="/api/test-segments",
        tags=["Test Segments"]
    )
    
    app.include_router(
        measurements.router,
        prefix="/api/measurements",
        tags=["Measurements"]
    )
    
    app.include_router(
        mqtt.router,
        prefix="/api/mqtt",
        tags=["MQTT"]
    )
    
    app.include_router(
        system.router,
        prefix="/api",
        tags=["System"]
    )

    @app.get("/", tags=["Root"])
    async def root():
        """Root endpoint."""
        return {
            "message": "Gorenje Washing Machine Monitoring API",
            "version": "2.0.0",
            "docs": "/docs"
        }

    @app.get("/api/cors-test", tags=["System"])
    async def cors_test():
        """Simple CORS test endpoint."""
        return {"message": "CORS is working!", "timestamp": "2025-10-20T12:00:00Z"}

    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0", 
        port=8000,
        reload=True,
        log_level="info"
    )