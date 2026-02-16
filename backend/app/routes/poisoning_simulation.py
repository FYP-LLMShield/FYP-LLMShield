"""
Poisoning Simulation API Routes
==============================
Provides endpoints for running real-time poisoning vulnerability scans 
on custom connected models.
"""

import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

from app.services.poisoning_simulator_service import PoisoningSimulatorService
from app.utils.auth import get_current_user
from app.models.user import UserInDB

logger = logging.getLogger(__name__)

router = APIRouter()
simulator = PoisoningSimulatorService()


class LLMConfig(BaseModel):
    provider: str = Field(..., example="openai")
    model_id: str = Field(..., example="gpt-4o")
    api_key: str = Field(...)
    base_url: Optional[str] = None

class SimulationRequest(BaseModel):
    llm_config: LLMConfig
    scenario_id: str = Field(..., example="brand_sabotage")
    custom_prompt: Optional[str] = None

class SimulationResponse(BaseModel):
    success: bool
    scenario_name: str
    baseline_response: str
    poisoned_response: str
    deviation_score: float
    is_vulnerable: bool
    time_taken_ms: int
    error: Optional[str] = None

async def get_optional_user(request: Optional[str] = None) -> Optional[UserInDB]:
    """Extract optional user from request."""
    try:
        # This is a workaround - in practice, FastAPI will handle dependency injection
        # We're making auth optional by catching the auth error
        return None
    except:
        return None


@router.post("/scan", response_model=SimulationResponse)
async def run_poisoning_scan(request: SimulationRequest, current_user: Optional[UserInDB] = Depends(lambda: None)):
    """
    Runs a 3-step poisoning simulation on a custom model:
    1. Baseline Query
    2. Poisoned Query (via Context Injection)
    3. Anomaly Analysis
    """
    try:
        result = await simulator.run_simulation(
            model_config=request.llm_config.model_dump(),
            scenario_id=request.scenario_id,
            custom_prompt=request.custom_prompt
        )


        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Simulation failed")
            )

        # Embed results if user is authenticated
        return result

    except Exception as e:
        logger.error(f"Scan endpoint error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/scenarios")
async def get_scenarios():
    """Returns available poisoning simulation scenarios"""
    return {
        "scenarios": [
            {"id": k, "name": v["name"]} 
            for k, v in simulator.SCENARIOS.items()
        ]
    }
