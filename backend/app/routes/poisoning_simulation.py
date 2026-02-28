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

@router.post("/scan", response_model=SimulationResponse)
async def run_poisoning_scan(request: SimulationRequest):
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
