"""
API routes for test segments.
"""

from fastapi import APIRouter, HTTPException
from typing import List
from app.models.test_segments import TestSegment, TestSegmentCreate, TestSegmentUpdate
from database import test_segments as segments_db

router = APIRouter()


@router.post("", response_model=TestSegment)
async def create_segment(segment: TestSegmentCreate):
    """Create a new test segment."""
    try:
        result = await segments_db.create_segment(
            segment.test_id,
            segment.segment_name,
            segment.start_time,
            segment.end_time
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test/{test_id}", response_model=List[TestSegment])
async def get_segments_by_test(test_id: int):
    """Get all segments for a specific test."""
    try:
        segments = await segments_db.get_segments_by_test_id(test_id)
        return segments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{segment_id}", response_model=TestSegment)
async def get_segment(segment_id: int):
    """Get a specific segment by ID."""
    try:
        segment = await segments_db.get_segment_by_id(segment_id)
        if not segment:
            raise HTTPException(status_code=404, detail="Segment not found")
        return segment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{segment_id}", response_model=TestSegment)
async def update_segment(segment_id: int, segment: TestSegmentUpdate):
    """Update a test segment."""
    try:
        result = await segments_db.update_segment(
            segment_id,
            segment.segment_name,
            segment.start_time,
            segment.end_time
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{segment_id}")
async def delete_segment(segment_id: int):
    """Delete a test segment."""
    try:
        success = await segments_db.delete_segment(segment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Segment not found")
        return {"message": "Segment deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
