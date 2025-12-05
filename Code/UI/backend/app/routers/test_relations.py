"""
Test Relations API router.

This module handles all test-related API endpoints including
CRUD operations for test relations
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.models import (
    TestRelation, TestRelationCreate, TestRelationAllDetails
)
from database import (
    get_test_relations,
    add_test_relation,
    delete_all_test_relations_for_single_test,
    delete_test_relation_for_single_relation_id,
    update_test_relation,
    check_test_relation_has_measurements,
    delete_test_relation_with_measurements
)

router = APIRouter()


@router.get("/{test_id}", response_model=List[TestRelationAllDetails])
async def get_test_relations_endpoint(test_id: int):
    """Get all test relations."""
    return await get_test_relations(test_id)

@router.post("", response_model=List[TestRelationCreate])
async def add_multiple_test_relations_endpoint(test_relations: List[TestRelationCreate]):
    """Add single or multiple test relations."""
    created_relations = []
    for test_relation in test_relations:
        created_relation = await add_test_relation(
            test_relation.test_id, test_relation.model_dump()
        )
        if not created_relation:
            raise HTTPException(
                status_code=400,
                detail="Failed to create one of the test relations."
            )
        created_relations.append(created_relation)
    return created_relations

@router.get("/{test_relation_id}/check-measurements", response_model=dict)
async def check_test_relation_measurements_endpoint(test_relation_id: int):
    """Check if a test relation has any measurements."""
    result = await check_test_relation_has_measurements(test_relation_id)
    return result

@router.delete("/{test_relation_id}", response_model=dict)
async def delete_single_test_relation_endpoint(test_relation_id: int, force: bool = False):
    """
    Delete a test relation.
    If force=True, also deletes all measurements for this relation.
    """
    if force:
        # Delete with measurements
        success = await delete_test_relation_with_measurements(test_relation_id)
        if not success:
            raise HTTPException(status_code=404, detail="Test relation not found")
        return {"message": "Test relation and all measurements deleted successfully"}
    else:
        # Check if it has measurements first
        check = await check_test_relation_has_measurements(test_relation_id)
        if check["has_measurements"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Test relation has {check['measurement_count']} measurements. Use force=true to delete with measurements."
            )
        
        success = await delete_test_relation_for_single_relation_id(test_relation_id)
        if not success:
            raise HTTPException(status_code=404, detail="Test relation not found")
        return {"message": "Test relation deleted successfully"}

@router.delete("/test/{test_id}", response_model=dict)
async def delete_all_test_relations_for_test_endpoint(test_id: int):
    """Delete all test relations for a test."""
    success = await delete_all_test_relations_for_single_test(test_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test relations not found for the given test ID")
    return {"message": "Test relations deleted successfully"}

@router.put("/{test_relation_id}", response_model=dict)
async def update_test_relation_endpoint(test_relation_id: int, relation_data: dict):
    """Update a test relation (e.g., sensor_location)."""
    updated = await update_test_relation(test_relation_id, relation_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Test relation not found")
    return {"message": "Test relation updated successfully", "relation": updated}

