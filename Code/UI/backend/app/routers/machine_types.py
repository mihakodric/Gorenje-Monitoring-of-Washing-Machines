"""
Machine Types API router.

This module handles all machine type-related API endpoints including
CRUD operations for machine types used in the system.
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.models import MachineType, MachineTypeCreate, MachineTypeUpdate
from database import (
    get_all_machine_types,
    get_machine_type_by_id,
    create_machine_type,
    update_machine_type,
    delete_machine_type
)

router = APIRouter()


@router.get("", response_model=List[MachineType])
async def get_machine_types():
    """Get all machine types."""
    return await get_all_machine_types()


@router.get("/{type_id}", response_model=MachineType)
async def get_machine_type(type_id: int):
    """Get a specific machine type by ID."""
    machine_type = await get_machine_type_by_id(type_id)
    if not machine_type:
        raise HTTPException(status_code=404, detail="Machine type not found")
    return machine_type


@router.post("", response_model=dict)
async def create_machine_type_endpoint(machine_type: MachineTypeCreate):
    """Create a new machine type."""
    result = await create_machine_type(machine_type.model_dump())
    if not result:
        raise HTTPException(
            status_code=400,
            detail="Failed to create machine type"
        )
    return {
        "message": "Machine type created successfully",
        "machine_type": result
    }


@router.put("/{type_id}", response_model=dict)
async def update_machine_type_endpoint(type_id: int, machine_type: MachineTypeUpdate):
    """Update an existing machine type."""
    machine_type_dict = {k: v for k, v in machine_type.model_dump().items() if v is not None}
    result = await update_machine_type(type_id, machine_type_dict)
    if not result:
        raise HTTPException(status_code=404, detail="Machine type not found")
    return {
        "message": "Machine type updated successfully",
        "machine_type": result
    }


@router.delete("/{type_id}")
async def delete_machine_type_endpoint(type_id: int):
    """Delete a machine type."""
    success = await delete_machine_type(type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Machine type not found")
    return {"message": "Machine type deleted successfully"}