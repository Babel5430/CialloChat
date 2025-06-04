from abc import ABC, abstractmethod
from typing import Dict, List, Any

class BaseChatbot(ABC):
    """
    基础抽象类BaseChatbot，定义chatbot的基本结构和抽象方法。
    """

    @abstractmethod
    def _get_system_messages(self, **kwargs) -> List[Dict[str, Any]]:
        """
        抽象方法：构建系统信息。

        Args:
            **kwargs: 灵活的参数传递。

        Returns:
            包含系统消息的字典列表。
        """
        pass

    @abstractmethod
    def _get_context(self, **kwargs) -> List[Dict[str, Any]]:
        """
        抽象方法：获取上下文信息。

        Args:
            **kwargs: 灵活的参数传递。

        Returns:
            包含上下文信息的字典列表。
        """
        pass

    @abstractmethod
    def _build_prompts(self, user_input: str, **kwargs) -> List[Dict[str, Any]]:
        """
        抽象方法：构建完整的prompts。

        Args:
            user_input: 用户输入。
            **kwargs: 灵活的参数传递。

        Returns:
            包含完整prompts的字典列表。
        """
        pass

    @abstractmethod
    def chat(self, user_input: str, **kwargs) -> Dict[str, Any]:
        """
        抽象方法：调用模型进行对话。

        Args:
            user_input: 用户输入。
            **kwargs: 灵活的参数传递。

        Returns:
            包含"role"和"content"两个key的字典对象。
        """
        pass


class BaseCharacterChatbot(BaseChatbot, ABC):
    """
    基础抽象类BaseCharacterChatbot，继承BaseChatbot，用于角色扮演chatbot。
    """

    def __init__(self, user: str, role: str, **kwargs):
        """
        初始化BaseCharacterChatbot。

        Args:
            user: 用户名称。
            role: 角色名称。
            **kwargs: 灵活的参数传递，用于传递其他初始化参数。
        """
        self.user = user
        self.role = role
        super().__init__(**kwargs)

    @abstractmethod
    def _build_task(self, **kwargs) -> str:
        """
        抽象方法：构建任务描述。

        Args:
            **kwargs: 灵活的参数传递。

        Returns:
            任务描述字符串。
        """
        pass

    @abstractmethod
    def _build_role_info(self, **kwargs) -> str:
        """
        抽象方法：构建角色信息。

        Args:
            **kwargs: 灵活的参数传递。

        Returns:
            角色信息字符串。
        """
        pass

    @abstractmethod
    def _build_style(self, **kwargs) -> str:
        """
        抽象方法：构建说话风格描述。

        Args:
            **kwargs: 灵活的参数传递。

        Returns:
            说话风格描述字符串。
        """
        pass

    def _get_system_messages(self, **kwargs) -> List[Dict[str, Any]]:
        """
        实现BaseChatbot的抽象方法：构建系统信息，结合任务、角色和风格信息。

        Args:
            **kwargs: 灵活的参数传递。

        Returns:
            包含系统消息的字典列表。
        """
        task = self._build_task(**kwargs)
        role_info = self._build_role_info(**kwargs)
        style = self._build_style(**kwargs)

        system_messages = []
        if task:
            system_messages.append({"role": "system", "content": "任务描述:\n" + task})
        if role_info:
            system_messages.append({"role": "system", "content": "角色信息\n" + role_info})
        if style:
            system_messages.append({"role": "system", "content": "说话风格\n" + style})

        return system_messages
