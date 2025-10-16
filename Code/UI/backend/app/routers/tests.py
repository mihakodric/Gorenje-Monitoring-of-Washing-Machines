"""
Tests API router.

This module handles all test-related API endpoints including
CRUD operations for tests, test relations, and test lifecycle management.
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.models import (
    Test, TestCreate, TestUpdate, TestCreateWithRelations,
    TestRelation, TestRelationCreate, 
    MachineUpdateForTest, UpdateRelationsRequest
)
from database import (
    get_all_tests,
    get_test_by_id,
    create_test,
    update_test,
    delete_test,
    start_test,
    stop_test,
    get_test_relations,
    add_test_relation,
    delete_test_relation,
    update_test_relation,
    is_sensor_or_machine_available,
    update_test_machine
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


@router.post("/create-with-relations", response_model=dict)
async def create_test_with_relations(test_data: TestCreateWithRelations):
    """Create a new test with machine and sensor relations in one operation."""
    # First create the test
    success = await create_test(test_data.test.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Test with this name already exists")
    
    # Get the created test to find its ID
    created_test = None
    tests = await get_all_tests()
    for test in tests:
        if test['test_name'] == test_data.test.test_name:
            created_test = test
            break
    
    if not created_test:
        raise HTTPException(status_code=500, detail="Failed to retrieve created test")
    
    test_id = created_test['id']
    
    try:
        # Create relations for each sensor
        for sensor_info in test_data.sensors:
            # Check if sensor or machine is available
            if not await is_sensor_or_machine_available(sensor_info.sensor_id, test_data.machine_id):
                # Clean up: delete the test we just created
                await delete_test(test_id)
                raise HTTPException(
                    status_code=400,
                    detail="Sensor or Machine is currently used by another running test"
                )
            
            # Create the relation
            relation_data = {
                'sensor_id': sensor_info.sensor_id,
                'machine_id': test_data.machine_id,
                'sensor_location': sensor_info.sensor_location
            }
            relation_success = await add_test_relation(test_id, relation_data)
            if not relation_success:
                # Clean up: delete the test we just created
                await delete_test(test_id)
                raise HTTPException(status_code=400, detail="Failed to create sensor relation")
    
    except Exception as e:
        # Clean up: delete the test we just created
        await delete_test(test_id)
        raise e
    
    return {"message": "Test created with relations successfully", "test_id": test_id}


@router.put("/{test_id}", response_model=dict)
async def update_test_endpoint(test_id: int, test: TestUpdate):
    """Update an existing test."""
    success = await update_test(test_id, test.model_dump())
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test updated successfully"}


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


@router.delete("/{test_id}", response_model=dict)
async def delete_test_endpoint(test_id: int):
    """Delete a test and all its related data."""
    success = await delete_test(test_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test and related data deleted successfully"}


# Test Relations endpoints
@router.get("/{test_id}/relations", response_model=List[TestRelation])
async def get_test_relations_endpoint(test_id: int):
    """Get all relations for a test."""
    return await get_test_relations(test_id)


@router.get("/{test_id}/with-relations", response_model=dict)
async def get_test_with_relations(test_id: int):
    """Get test details with machine and sensor relations."""
    # Get test details
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Get relations
    relations = await get_test_relations(test_id)
    
    # Extract machine_id and sensors from relations
    machine_id = None
    sensors = []
    
    for relation in relations:
        if relation['machine_id'] and not machine_id:
            machine_id = relation['machine_id']
        
        sensors.append({
            'sensor_id': relation['sensor_id'],
            'sensor_location': relation.get('sensor_location') or ''
        })
    
    # Create response with flattened structure for frontend compatibility
    response_data = {
        **test,  # Spread all test fields at the top level
        'machine_id': machine_id,
        'sensors': sensors
    }
    
    return response_data


@router.post("/{test_id}/relations", response_model=dict)
async def create_test_relation(test_id: int, relation: TestRelationCreate):
    """Create a new test relation only if the test is idle and sensor/machine are available."""
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if test['status'] != 'idle':
        raise HTTPException(
            status_code=400,
            detail="Can only add relations to idle tests"
        )
    
    if not await is_sensor_or_machine_available(relation.sensor_id, relation.machine_id):
        raise HTTPException(
            status_code=400,
            detail="Sensor or Machine is currently used by another running test"
        )
    
    success = await add_test_relation(test_id, relation.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Failed to create relation")
    
    return {"message": "Relation created successfully"}


@router.delete("/{test_id}/relations/{relation_id}", response_model=dict)
async def delete_test_relation_endpoint(test_id: int, relation_id: int):
    """Delete a test relation."""
    success = await delete_test_relation(relation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Relation not found")
    return {"message": "Relation deleted successfully"}


@router.put("/{test_id}/relations", response_model=dict)
async def update_test_relations_endpoint(test_id: int, relations_update: UpdateRelationsRequest):
    """Update all relations for a test - replaces existing relations with new ones."""
    # Check if test exists and is idle
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if test['status'] != 'idle':
        raise HTTPException(
            status_code=400,
            detail="Can only update relations for idle tests"
        )
    
    # Get current relations to delete them first
    current_relations = await get_test_relations(test_id)
    
    # Delete all current relations first to free up resources
    for relation in current_relations:
        await delete_test_relation(relation['id'])
    
    # Now check if sensor or machine is available
    for sensor_info in relations_update.sensors:
        if not await is_sensor_or_machine_available(sensor_info.sensor_id, relations_update.machine_id):
            raise HTTPException(
                status_code=400,
                detail=f"Sensor {sensor_info.sensor_id} or Machine {relations_update.machine_id} is currently used by another running test"
            )
    
    # Create new relations
    for sensor_info in relations_update.sensors:
        relation_data = {
            'sensor_id': sensor_info.sensor_id,
            'machine_id': relations_update.machine_id,
            'sensor_location': sensor_info.sensor_location
        }
        success = await add_test_relation(test_id, relation_data)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to create new relations")
    
    return {"message": "Relations updated successfully"}


@router.put("/{test_id}/relations/machine", response_model=dict)
async def update_test_machine_endpoint(test_id: int, update: MachineUpdateForTest):
    """Update machine for all relations in a test."""
    success = await update_test_machine(test_id, update.machine_id)
    if not success:
        raise HTTPException(status_code=404, detail="No relations found for this test")
    return {"message": "Machine updated successfully"}


# Data endpoints
@router.get("/{test_id}/data")
async def get_test_data(
    test_id: int,
    sensor_id: int = None,
    start_time: str = None,
    end_time: str = None,
):
    """Get sensor data for a test."""
    # TODO: Implement get_sensor_data function in measurements module
    return {
        "test_id": test_id,
        "sensor_id": sensor_id,
        "start_time": start_time,
        "end_time": end_time,
        "data": [],
        "message": "Data retrieval not yet implemented"
    }