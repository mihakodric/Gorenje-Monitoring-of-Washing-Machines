"""
Machines API router.

This module handles all machine-related API endpoints including
CRUD operations for washing machines and their management.
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.models import Machine, MachineCreate, MachineUpdate
from database import (
    get_all_machines,
    get_machine_by_id, 
    create_machine,
    update_machine,
    delete_machine,

    get_tests_for_machine_id
)

router = APIRouter()


@router.get("", response_model=List[Machine])
async def get_machines():
    """Get all washing machines."""
    return await get_all_machines()


@router.get("/{machine_id}", response_model=Machine)
async def get_machine(machine_id: int):
    """Get a specific washing machine by ID."""
    machine = await get_machine_by_id(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return machine


@router.post("", response_model=dict)
async def create_machine_endpoint(machine: MachineCreate):
    """Create a new washing machine."""
    success = await create_machine(machine.model_dump())
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to create machine - machine might already exist"
        )
    return {"message": "Washing Machine created successfully"}


@router.put("/{machine_id}", response_model=dict)
async def update_machine_endpoint(machine_id: int, machine: MachineUpdate):
    """Update an existing washing machine."""
    update_data = machine.model_dump(exclude_unset=True)
    result = await update_machine(machine_id, update_data)
    if not result:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return result


@router.delete("/{machine_id}", response_model=dict)
async def delete_machine_endpoint(machine_id: int):
    """Delete a washing machine if it has no active test relations."""
    relations = await get_tests_for_machine_id(machine_id)
    success = await delete_machine(machine_id)
    if not success:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return {"message": "Washing Machine deleted successfully"}