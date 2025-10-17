"""
Test Relations API router.

This module handles all test-related API endpoints including
CRUD operations for test relations
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.models import (
    TestRelation, TestRelationCreate
)
from database import (

    get_test_relations,
    add_test_relation,
    delete_all_test_relations_for_single_test,
    delete_test_relation_for_single_relation_id,
    update_test_relation,
    update_test_machine
)

router = APIRouter()


@router.get("/{test_id}", response_model=List[TestRelation])
async def get_test_relations_endpoint(test_id: int):
    """Get all test relations."""
    return await get_test_relations(test_id)

@router.post("", response_model=TestRelationCreate)
async def add_test_relation_endpoint(test_relation: TestRelationCreate):
    """Add a new test relation."""
    # Check if sensor and machine are available

    created_relation = await add_test_relation(
        test_relation.test_id, test_relation.model_dump()
    )
    if not created_relation:
        raise HTTPException(
            status_code=400,
            detail="Failed to create test relation."
        )
    return created_relation

@router.post("/multiple-test-relations", response_model=List[TestRelationCreate])
async def add_multiple_test_relations_endpoint(test_relations: List[TestRelationCreate]):
    """Add multiple test relations."""
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


@router.delete("/{test_relation_id}", response_model=dict)
async def delete_single_test_relation_endpoint(test_relation_id: int):
    """Delete a test relation."""
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

