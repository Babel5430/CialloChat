# prompt_info_builder.py
from typing import  List, Set, Union
from abc import ABC, abstractmethod
from langchain.schema import ChatMessage
import numpy as np

class PromptInfoBuilder(ABC):
    """
    负责从记忆系统中查询并构建prompt所需信息的抽象类。
    依赖于抽象的记忆系统查询和嵌入方法。
    """

    @abstractmethod
    def _query_stm(self, query_vector: np.ndarray, **kwargs) -> str:
        """
        抽象方法：查询短期记忆。

        Args:
            query_vector: 查询向量。
            **kwargs: 灵活的参数传递给具体的短期记忆查询实现。

        Returns:
            短期记忆的查询结果字符串。
        """
        pass

    @abstractmethod
    def _query_ltm(self, query_vector: np.ndarray, **kwargs) -> str:
        """
        抽象方法：查询长期记忆。

        Args:
            query_vector: 查询向量。
            **kwargs: 灵活的参数传递给具体的长期记忆查询实现。

        Returns:
            长期记忆的查询结果字符串。
        """
        pass

    @abstractmethod
    def _query_attr(self, query_vector: np.ndarray, attr: str, **kwargs) -> str:
        """
        抽象方法：查询特定属性信息。

        Args:
            query_vector: 查询向量。
            attr: 属性名称。
            **kwargs: 灵活的参数传递给具体的属性查询实现。

        Returns:
            属性信息的查询结果字符串。
        """
        pass

    @abstractmethod
    def _get_embedding(self, text: Union[str, List[str]], **kwargs) -> np.ndarray:
        """
        抽象方法：获取文本的嵌入向量。

        Args:
            text: 输入文本或文本列表。
            **kwargs: 灵活的参数传递给具体的嵌入实现。

        Returns:
            文本的嵌入向量。
        """
        pass

    @abstractmethod
    def _get_context_messages(self, **kwargs) -> List[ChatMessage]:
        """
        抽象方法：获取上下文消息。

        Args:
            **kwargs: 灵活的参数传递给具体的上下文获取实现。

        Returns:
            包含上下文消息的ChatMessage列表。
        """
        pass

    @abstractmethod
    def _query_identification(self, user_input: str, **kwargs) -> Set[str]:
        """
        抽象方法：识别用户输入相关的查询类型。

        Args:
            user_input: 用户输入。
            **kwargs: 灵活的参数传递给具体的查询类型识别实现。

        Returns:
            识别到的查询类型集合。
        """
        pass

    @abstractmethod
    def _build_style_message_content(self, query_vector: np.ndarray, **kwargs) -> str:
        """
        抽象方法：构建说话风格信息的内容。

        Args:
            query_vector: 查询向量。
            **kwargs: 灵活的参数传递给具体的风格信息构建实现。

        Returns:
            说话风格信息字符串。
        """
        pass

    def get_info_messages(self, user_input: str, **kwargs) -> str:
        """
        获取与用户输入相关的记忆和属性信息。

        Args:
            user_input: 用户输入。
            **kwargs: 灵活的参数传递，用于传递给抽象方法。
                      必须包含 'user', 'role', 'mind_flow', 'query_to_attr',
                      'query_embeddings', 'entity_attr', 'desc_embeddings',
                      以及 _get_context_messages 所需参数。

        Returns:
            包含查询结果的格式化字符串。
        """
        user = kwargs.get('user')
        role = kwargs.get('role')
        mind_flow = kwargs.get('mind_flow')
        query_to_attr = kwargs.get('query_to_attr')
        query_embeddings = kwargs.get('query_embeddings')
        entity_attr = kwargs.get('entity_attr')
        desc_embeddings = kwargs.get('desc_embeddings')

        if not all([user, role, mind_flow is not None, query_to_attr, query_embeddings is not None,
                    entity_attr, desc_embeddings is not None]):
             raise ValueError("Missing required parameters in kwargs for get_info_messages")

        embedding = self._get_embedding(user_input, **kwargs)
        embedding_with_role = self._get_embedding(f"{user}说:" + user_input, **kwargs)

        # Identify query types using the abstract method
        query_types = self._query_identification(
            user_input,
            **kwargs
        )

        info_messages = []

        if '短期记忆' in query_types:
            # Need context messages to replicate original logic for STM query input
            context_messages = self._get_context_messages(**kwargs)
            if len(context_messages) > 0 and len(mind_flow) > 0:
                last_ctx_role = context_messages[-1].role if context_messages else role
                tmp = f"{last_ctx_role}想:{list(mind_flow)[-1]}\n{last_ctx_role}说:{context_messages[-1].content if context_messages else ''}\n" + f"{user}说:" + user_input
                tmp_ebd = self._get_embedding(tmp, **kwargs)
            else:
                tmp_ebd = embedding_with_role # Fallback if no context/mind flow
            res = self._query_stm(tmp_ebd, **kwargs)
            if res:
                info_messages.append(res)
            query_types.discard('短期记忆')

        for query_type in query_types:
            if query_type == '长期记忆':
                res = self._query_ltm(embedding_with_role, **kwargs)
                if res:
                    info_messages.append(res)
            elif query_type != '0':
                attr = query_type
                query_result = self._query_attr(embedding, attr, **kwargs)
                if query_result:
                    info_messages.append(query_result)

        return "\n".join(info_messages) if info_messages else "无查询结果"

    def get_style_message_content(self, user_input: str, **kwargs) -> str:
        """
        获取说话风格信息的内容。

        Args:
            user_input: 用户输入。
            **kwargs: 灵活的参数传递，用于传递给抽象方法。
                      必须包含 'answer_schema', 'question_embeddings'.

        Returns:
            说话风格信息字符串。
        """
        answer_schema = kwargs.get('answer_schema')
        question_embeddings = kwargs.get('question_embeddings')

        if not all([answer_schema, question_embeddings is not None]):
             raise ValueError("Missing required parameters in kwargs for get_style_message_content")

        embedding = self._get_embedding(user_input, **kwargs)
        return self._build_style_message_content(embedding, **kwargs)

    # Note: Task and Role Info building is handled in BaseCharacterChatbot using abstract methods,
    # and the concrete implementation will provide the strings. PromptInfoBuilder focuses on
    # dynamic information retrieval (memory, attributes) and style based on input.