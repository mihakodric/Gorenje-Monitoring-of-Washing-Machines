"""
Tests API router.

This module handles all test-related API endpoints including
CRUD operations for tests, test relations, and test lifecycle management.
"""
from uuid import uuid4
import json
from typing import List
from fastapi import APIRouter, HTTPException
import logging

from app.models import (
    Test, TestCreate, TestUpdate,
    TestRelation, TestRelationCreate,
)
from database import (
    db_pool,
    get_all_tests,
    get_test_by_id,
    create_test,
    update_test_metadata,
    delete_test,
    start_test,
    stop_test,
    get_test_relations,
)

from app.mqtt_client import publish_cmd

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

    relations = await get_test_relations(test_id)
    if not relations:
        raise HTTPException(400, "No sensors connected")

    for rel in relations:
        if not rel.get("sensor_is_online", False):
            raise HTTPException(400, f"Sensor '{rel.get('sensor_name')}' is offline")
        
    run_id = await start_test(test_id)
    if not run_id:
        raise HTTPException(
            status_code=400,
            detail="Test already running or completed"
        )

    # ✅ Safe to notify devices ONLY after DB is consistent
    for rel in relations:
        sensor_topic = rel["sensor_mqtt_topic"]
        cmd_topic = f"sensors/{sensor_topic}/cmd"

        payload = {
            "cmd": "start",
            "run_id": run_id,
            "test_id": test_id,
        }

        publish_cmd(topic=cmd_topic, payload=payload)

    return {
        "message": f"Test {test_id} started",
        "run_id": run_id
    }


@router.post("/{test_id}/stop", response_model=dict)
async def stop_test_endpoint(test_id: int):

    relations = await get_test_relations(test_id)
    if not relations:
        raise HTTPException(
            status_code=400,
            detail="Cannot stop test: no sensors connected"
        )

    for rel in relations:
        if not rel.get("sensor_is_online", False):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot stop test: sensor '{rel.get('sensor_name')}' is offline"
            )

    # ✅ Atomically stop test + close run
    closed_run_id = await stop_test(test_id)
    if not closed_run_id:
        raise HTTPException(
            status_code=400,
            detail="Test not running or already completed"
        )
    
    print(f"Test {test_id} stopped in DB, notifying sensors...")

    # ✅ Notify devices only AFTER DB is consistent
    for rel in relations:
        sensor_topic = rel["sensor_mqtt_topic"]
        cmd_topic = f"sensors/{sensor_topic}/cmd"

        payload = {
            "cmd": "stop",
            "test_id": test_id,
            "run_id": closed_run_id
        }

        publish_cmd(topic=cmd_topic, payload=payload)
        print(f"Sent stop command to sensor topic: {cmd_topic} with payload: {payload}")    

    print(f"Test {test_id} stop notifications sent to sensors.")

    return {
        "message": f"Test {test_id} stopped",
        "run_id": closed_run_id
    }


