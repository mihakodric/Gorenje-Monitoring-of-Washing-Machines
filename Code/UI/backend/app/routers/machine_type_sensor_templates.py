"""
Machine Type Sensor Templates API router.

This module handles all sensor template-related API endpoints for machine types.
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.models import (
    MachineTypeSensorTemplate,
    MachineTypeSensorTemplateCreate,
    MachineTypeSensorTemplateUpdate,
    MachineTypeSensorTemplateWithDetails
)
from database import (
    get_templates_by_machine_type,
    get_template_by_id,
    create_template,
    update_template,
    delete_template,
    bulk_update_template_orders,
)

router = APIRouter()


@router.get("/{machine_type_id}/templates", response_model=List[MachineTypeSensorTemplateWithDetails])
async def get_machine_type_templates(machine_type_id: int):
    """Get all sensor templates for a specific machine type."""
    return await get_templates_by_machine_type(machine_type_id)


@router.post("/{machine_type_id}/templates", response_model=dict)
async def create_machine_type_template(machine_type_id: int, template: MachineTypeSensorTemplateCreate):
    """Create a new sensor template for a machine type."""
    # Ensure machine_type_id matches the route parameter
    template_data = template.model_dump()
    template_data['machine_type_id'] = machine_type_id
    
    result = await create_template(template_data)
    if not result:
        raise HTTPException(
            status_code=400,
            detail="Failed to create sensor template. Check if the combination of sensor type and location already exists."
        )
    return {
        "message": "Sensor template created successfully",
        "template": result
    }


@router.put("/templates/{template_id}", response_model=dict)
async def update_machine_type_template(template_id: int, template: MachineTypeSensorTemplateUpdate):
    """Update an existing sensor template."""
    update_data = template.model_dump(exclude_unset=True)
    result = await update_template(template_id, update_data)
    if not result:
        raise HTTPException(status_code=404, detail="Sensor template not found")
    return {
        "message": "Sensor template updated successfully",
        "template": result
    }


@router.delete("/templates/{template_id}")
async def delete_machine_type_template(template_id: int):
    """Delete a sensor template."""
    success = await delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor template not found")
    return {"message": "Sensor template deleted successfully"}


@router.post("/{machine_type_id}/templates/reorder")
async def reorder_templates(machine_type_id: int, order_updates: List[dict]):
    """
    Bulk update the display order of templates.
    Expects a list of objects with 'id' and 'display_order' fields.
    """
    try:
        await bulk_update_template_orders(order_updates)
        return {"message": "Template order updated successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to update template order: {str(e)}"
        )
