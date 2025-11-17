"""
Tests API router.

This module handles all test-related API endpoints including
CRUD operations for tests, test relations, and test lifecycle management.
"""

from typing import List
from fastapi import APIRouter, HTTPException
import logging

from app.models import (
    Test, TestCreate, TestUpdate,
    TestRelation, TestRelationCreate,
)
from database import (
    get_all_tests,
    get_test_by_id,
    create_test,
    update_test_metadata,
    delete_test,
    start_test,
    stop_test,
    get_test_relations,
)
from app.core import test_worker

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=List[Test])
async def get_tests():
    """Get all tests."""
    return await get_all_tests()


@router.get("/{test_id}", response_model=Test)
async def get_test(test_id: int):
    """Get a specific test by ID."""
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


@router.post("", response_model=Test)
async def create_test_endpoint(test: TestCreate):
    """Create a new test."""
    created_test = await create_test(test.model_dump())
    if not created_test:
        raise HTTPException(
            status_code=400,
            detail="Failed to create test - test name might already exist"
        )
    return created_test

@router.put("/{test_id}", response_model=dict)
async def update_test_endpoint(test_id: int, test: TestUpdate):
    """Update an existing test."""
    update_data = test.model_dump()
    
    # Check if test_status is being changed
    if 'test_status' in update_data:
        new_status = update_data['test_status']
        current_test = await get_test_by_id(test_id)
        
        if not current_test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        old_status = current_test.get('test_status')
        
        # Handle status change to 'running'
        if new_status == 'running' and old_status != 'running':
            logger.info(f"Starting test {test_id} and its worker")
            
            # Check if test has sensors
            relations = await get_test_relations(test_id)
            if not relations:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot start test: no sensors connected"
                )
            
            # Start the worker
            worker_started = await test_worker.start_worker_for_test(test_id)
            if not worker_started:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to start data collection worker"
                )
            
            logger.info(f"✅ Worker started for test {test_id}")
        
        # Handle status change from 'running' to something else (stopping)
        elif old_status == 'running' and new_status != 'running':
            logger.info(f"Stopping test {test_id} and its worker")
            
            # Stop the worker
            await test_worker.stop_worker_for_test(test_id)
            logger.info(f"✅ Worker stopped for test {test_id}")
    
    success = await update_test_metadata(test_id, update_data)
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return {"message": "Test updated successfully"}

@router.delete("/{test_id}", response_model=dict)
async def delete_test_endpoint(test_id: int):
    """Delete a test and all its related data."""
    success = await delete_test(test_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test and related data deleted successfully"}

@router.post("/{test_id}/start", response_model=dict)
async def start_test_endpoint(test_id: int):
    """Start a test, only if it has at least one sensor and machine connected."""
    relations = await get_test_relations(test_id)
    if not relations:
        raise HTTPException(
            status_code=400,
            detail="Cannot start test: no sensors or machines connected"
        )
    
    success = await start_test(test_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to start test: already running or completed"
        )
    
    return {"message": "Test started successfully"}


@router.post("/{test_id}/stop", response_model=dict)
async def stop_test_endpoint(test_id: int):
    """Stop a running test."""
    success = await stop_test(test_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test not found or not running")
    return {"message": "Test stopped successfully"}


@router.get("/{test_id}/worker-status", response_model=dict)
async def get_test_worker_status(test_id: int):
    """Get the status of the data collection worker for a test."""
    status = await test_worker.get_worker_status(test_id)
    
    if status is None:
        return {
            "test_id": test_id,
            "worker_active": False,
            "message": "No worker running for this test"
        }
    
    return {
        "worker_active": True,
        **status
    }


@router.get("/workers/active", response_model=dict)
async def get_active_workers():
    """Get list of all active test workers."""
    active_test_ids = await test_worker.get_active_workers()
    
    return {
        "active_workers_count": len(active_test_ids),
        "test_ids": active_test_ids
    }