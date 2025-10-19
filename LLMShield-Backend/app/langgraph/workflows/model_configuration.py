from langgraph.graph import StateGraph, END
from langgraph.checkpoint.mongodb import MongoDBSaver
from app.langgraph.state import ModelConfigState
from app.langgraph.nodes.validation_nodes import (
    validate_model_type_node,
    validate_parameters_node,
    test_connection_node,
    test_basic_capability_node,
    save_configuration_node,
    handle_error_node,
    should_retry
)
from app.core.database import get_database
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ModelConfigurationWorkflow:
    """LangGraph workflow for model configuration"""
    
    def __init__(self):
        self.workflow = self._build_workflow()
    
    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph workflow"""
        
        # Create the state graph
        workflow = StateGraph(ModelConfigState)
        
        # Add nodes
        workflow.add_node("validate_model_type", validate_model_type_node)
        workflow.add_node("validate_parameters", validate_parameters_node)
        workflow.add_node("test_connection", test_connection_node)
        workflow.add_node("test_capability", test_basic_capability_node)
        workflow.add_node("save_configuration", save_configuration_node)
        workflow.add_node("handle_error", handle_error_node)
        
        # Set entry point
        workflow.set_entry_point("validate_model_type")
        
        # Add edges for the happy path
        workflow.add_edge("validate_model_type", "validate_parameters")
        workflow.add_edge("validate_parameters", "test_connection")
        workflow.add_edge("test_connection", "test_capability")
        workflow.add_edge("test_capability", "save_configuration")
        workflow.add_edge("save_configuration", END)
        
        # Add conditional edges for error handling
        workflow.add_conditional_edges(
            "validate_model_type",
            self._route_from_validation,
            {
                "validate_parameters": "validate_parameters",
                "error": "handle_error"
            }
        )
        
        workflow.add_conditional_edges(
            "validate_parameters",
            self._route_from_validation,
            {
                "test_connection": "test_connection",
                "parameter_input": END,  # Return to user for parameter correction
                "error": "handle_error"
            }
        )
        
        workflow.add_conditional_edges(
            "test_connection",
            self._route_from_connection,
            {
                "test_capability": "test_capability",
                "parameter_input": END,  # Return to user for credential correction
                "error": "handle_error"
            }
        )
        
        workflow.add_conditional_edges(
            "test_capability",
            self._route_from_capability,
            {
                "save_configuration": "save_configuration",
                "test_connection": "test_connection",  # Retry connection
                "error": "handle_error"
            }
        )
        
        workflow.add_conditional_edges(
            "save_configuration",
            self._route_from_save,
            {
                "completed": END,
                "error": "handle_error"
            }
        )
        
        workflow.add_conditional_edges(
            "handle_error",
            self._route_from_error,
            {
                "validate_parameters": "validate_parameters",
                "test_connection": "test_connection",
                "end": END
            }
        )
        
        return workflow
    
    def _route_from_validation(self, state: ModelConfigState) -> str:
        """Route from validation nodes"""
        if state.get("error_message"):
            return "error"
        elif not state.get("is_valid"):
            return "parameter_input"
        else:
            return "test_connection"
    
    def _route_from_connection(self, state: ModelConfigState) -> str:
        """Route from connection test"""
        if state.get("error_message") and not state.get("is_connected"):
            return "parameter_input"
        elif state.get("is_connected"):
            return "test_capability"
        else:
            return "error"
    
    def _route_from_capability(self, state: ModelConfigState) -> str:
        """Route from capability test"""
        if state.get("capability_test_results", {}).get("basic_generation"):
            return "save_configuration"
        elif should_retry(state):
            return "test_connection"
        else:
            return "error"
    
    def _route_from_save(self, state: ModelConfigState) -> str:
        """Route from save configuration"""
        if state.get("error_message"):
            return "error"
        else:
            return "completed"
    
    def _route_from_error(self, state: ModelConfigState) -> str:
        """Route from error handler"""
        if should_retry(state):
            return "validate_parameters"
        else:
            return "end"
    
    def compile(self):
        """Compile the workflow"""
        return self.workflow.compile()

class ModelConfigWorkflowManager:
    """Manager for model configuration workflows"""
    
    def __init__(self, checkpointer):
        self.checkpointer = checkpointer
        self.workflow = None
    
    async def initialize(self):
        """Initialize the workflow manager"""
        try:
            # Create and compile workflow
            workflow_builder = ModelConfigurationWorkflow()
            self.workflow = workflow_builder.workflow.compile(
                checkpointer=self.checkpointer,
                interrupt_before=["validate_parameters", "test_connection"]
            )
            logger.info("Model configuration workflow initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize workflow: {e}")
            raise
    
    async def start_configuration(
        self,
        user_id: str,
        session_id: str,
        initial_data: dict
    ) -> ModelConfigState:
        """Start a new configuration workflow"""
        
        if not self.workflow:
            await self.initialize()
        
        # Create initial state
        initial_state = ModelConfigState(
            user_id=user_id,
            session_id=session_id,
            model_type=initial_data.get("model_type", ""),
            model_name=initial_data.get("model_name", ""),
            parameters=initial_data.get("parameters", {}),
            credentials=initial_data.get("credentials", {}),
            endpoint_config=initial_data.get("endpoint_config", {}),
            profile_name=initial_data.get("profile_name", ""),
            save_as_profile=initial_data.get("save_as_profile", False),
            current_step="start",
            steps_completed=[],
            is_valid=False,
            validation_results={},
            is_connected=False,
            connection_test_results={},
            capability_test_results={},
            error_message=None,
            retry_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Start workflow
        config = {"configurable": {"thread_id": session_id}}
        result = await self.workflow.ainvoke(initial_state, config)
        
        return result
    
    async def continue_configuration(
        self,
        session_id: str,
        updated_data: dict
    ) -> ModelConfigState:
        """Continue an existing configuration workflow"""
        
        if not self.workflow:
            await self.initialize()
        
        config = {"configurable": {"thread_id": session_id}}
        
        # Get current state
        current_state = await self.workflow.aget_state(config)
        if not current_state:
            raise ValueError(f"No workflow found for session {session_id}")
        
        # Update state with new data
        updated_state = current_state.values.copy()
        for key, value in updated_data.items():
            if key in updated_state:
                updated_state[key] = value
        updated_state["updated_at"] = datetime.utcnow()
        
        # Continue workflow
        result = await self.workflow.ainvoke(updated_state, config)
        
        return result
    
    async def get_workflow_state(self, session_id: str) -> ModelConfigState:
        """Get the current state of a workflow"""
        
        if not self.workflow:
            await self.initialize()
        
        config = {"configurable": {"thread_id": session_id}}
        state = await self.workflow.aget_state(config)
        
        if state:
            return state.values
        return None
    
    async def get_workflow_history(self, session_id: str) -> list:
        """Get the history of a workflow"""
        
        if not self.workflow:
            await self.initialize()
        
        config = {"configurable": {"thread_id": session_id}}
        
        try:
            history = []
            async for state in self.workflow.aget_state_history(config):
                history.append({
                    "step": state.values.get("current_step"),
                    "timestamp": state.values.get("updated_at"),
                    "data": {
                        "is_valid": state.values.get("is_valid"),
                        "is_connected": state.values.get("is_connected"),
                        "error_message": state.values.get("error_message")
                    }
                })
            return history
        except Exception as e:
            logger.error(f"Failed to get workflow history: {e}")
            return []
    
    async def cancel_workflow(self, session_id: str) -> bool:
        """Cancel an active workflow"""
        
        try:
            # In a real implementation, you would mark the workflow as cancelled
            # For now, we'll just return True
            logger.info(f"Workflow {session_id} cancelled")
            return True
        except Exception as e:
            logger.error(f"Failed to cancel workflow {session_id}: {e}")
            return False

# Global workflow manager instance
workflow_manager = None

async def get_workflow_manager():
    """Get or create the workflow manager"""
    global workflow_manager
    
    if workflow_manager is None:
        # Create MongoDB checkpointer
        db = await get_database()
        checkpointer = MongoDBSaver(
            db=db,
            collection_name="workflow_checkpoints"
        )
        
        workflow_manager = ModelConfigWorkflowManager(checkpointer)
        await workflow_manager.initialize()
    
    return workflow_manager