"""
Tests API router.

This module handles all test-related API endpoints including
CRUD operations for tests, test relations, and test lifecycle management.
"""

from typing import List
from fastapi import APIRouter, HTTPException

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


@router.post("", response_model=dict)
async def create_test_endpoint(test: TestCreate):
    """Create a new test."""
    success = await create_test(test.model_dump())
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to create test - test name might already exist"
        )
    return {"message": "Test created successfully"}

@router.put("/{test_id}", response_model=dict)
async def update_test_endpoint(test_id: int, test: TestUpdate):
    """Update an existing test."""
    success = await update_test_metadata(test_id, test.model_dump())
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