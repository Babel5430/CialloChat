def init_chatbot(**kwargs):
    """Placeholder: Must be implemented by the user."""
    raise NotImplementedError("Please implement 'init_chatbot' in backend/chatbot_override.py")

def get_role_desc(round: int, user_input: str, **kwargs) -> str:
    """Placeholder: Must be implemented by the user."""
    raise NotImplementedError("Please implement 'get_role_desc' in backend/chatbot_override.py")

def get_image_file_path(response: dict) -> list[str]:
    """Placeholder: Must be implemented by the user."""
    raise NotImplementedError("Please implement 'get_image_file_path' in backend/chatbot_override.py")