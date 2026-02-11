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
    get_machine_by_id,
    get_templates_by_machine_type,
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
    """
    Delete a test and all its related data.
    Test must be in 'idle' status to be deleted.
    Deletes: test_relations, test_runs, and all measurements.
    """
    try:
        success = await delete_test(test_id)
        if not success:
            raise HTTPException(status_code=404, detail="Test not found")
        return {"message": "Test and all related data deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{test_id}/start", response_model=dict)
async def start_test_endpoint(test_id: int):
    """
    Start a test and notify all sensors.
    Validates that all required sensors from the machine type template are present and online.
    """
    # Get test details
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(404, "Test not found")
    
    # Get test relations (sensors connected to this test)
    relations = await get_test_relations(test_id)
    if not relations:
        raise HTTPException(400, "No sensors connected")

    # Validate all sensors are online
    offline_sensors = []
    for rel in relations:
        if not rel.get("sensor_is_online", False):
            offline_sensors.append(rel.get('sensor_name'))
    
    if offline_sensors:
        raise HTTPException(
            400, 
            f"Cannot start test: The following sensors are offline: {', '.join(offline_sensors)}"
        )
    
    # Check machine type template requirements
    machine_id = test.get('machine_id')
    if machine_id:
        machine = await get_machine_by_id(machine_id)
        if machine and machine.get('machine_type_id'):
            # Get templates for this machine type
            templates = await get_templates_by_machine_type(machine['machine_type_id'])
            
            if templates:
                # Check if all required sensors are present
                required_templates = [t for t in templates if t.get('is_required', False)]
                
                if required_templates:
                    # Get set of connected sensor types (location doesn't matter)
                    connected_sensor_types = set(rel.get('sensor_type_id') for rel in relations)
                    
                    # DEBUG: Print what we have
                    print(f"DEBUG: Connected sensor types: {connected_sensor_types}")
                    print(f"DEBUG: Required templates: {[(t.get('sensor_type_id'), t.get('sensor_type_name')) for t in required_templates]}")
                    print(f"DEBUG: Relations data: {[(rel.get('sensor_type_id'), rel.get('sensor_name')) for rel in relations]}")
                    
                    # Find missing required sensors
                    missing_required = []
                    for template in required_templates:
                        template_sensor_type_id = template.get('sensor_type_id')
                        
                        # Only check if sensor type exists, ignore location
                        if template_sensor_type_id not in connected_sensor_types:
                            sensor_type_name = template.get('sensor_type_name', 'Unknown')
                            missing_required.append(sensor_type_name)
                    
                    if missing_required:
                        raise HTTPException(
                            400,
                            f"Cannot start test: Missing required sensors: {', '.join(missing_required)}"
                        )
        
    # All validations passed, start the test
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

    # Allow stopping test even if some sensors are offline
    # Offline sensors simply won't receive the stop command

    # ✅ Atomically stop test + close run
    closed_run_id = await stop_test(test_id)
    if not closed_run_id:
        raise HTTPException(
            status_code=400,
            detail="Test not running or already completed"
        )
    
    print(f"Test {test_id} stopped in DB, notifying sensors...")

    # ✅ Notify devices only AFTER DB is consistent
    # Only send stop commands to online sensors
    online_sensors = [rel for rel in relations if rel.get("sensor_is_online", False)]
    offline_sensors = [rel for rel in relations if not rel.get("sensor_is_online", False)]
    
    for rel in online_sensors:
        sensor_topic = rel["sensor_mqtt_topic"]
        cmd_topic = f"sensors/{sensor_topic}/cmd"

        payload = {
            "cmd": "stop",
            "test_id": test_id,
            "run_id": closed_run_id
        }

        publish_cmd(topic=cmd_topic, payload=payload)
        print(f"Sent stop command to sensor topic: {cmd_topic} with payload: {payload}")    
    
    if offline_sensors:
        print(f"Skipped sending stop command to {len(offline_sensors)} offline sensor(s): {[s['sensor_name'] for s in offline_sensors]}")

    print(f"Test {test_id} stop notifications sent to {len(online_sensors)} online sensor(s).")

    return {
        "message": f"Test {test_id} stopped",
        "run_id": closed_run_id
    }


