from typing import Any, Dict, List, Optional
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.callbacks import CallbackManagerForLLMRun
from openai import OpenAI
import os
import httpx

class ChatDS(BaseChatModel):
    """
    A custom chat model class for interacting with Deepseek's chat API.
    Inherits from LangChain's BaseChatModel.
    """

    model_name: str = "deepseek-reasoner"
    temperature: float = 0.32
    max_tokens: Optional[int] = None
    api_key: Optional[str] = os.getenv("API_KEY",None)
    base_url: Optional[str] = "https://api.deepseek.com"
    PROXY_URL: Optional[str] = "http://127.0.0.1:7890"
    http_client: Optional[httpx.Client] = httpx.Client(
        proxy=PROXY_URL,
        transport=httpx.HTTPTransport(retries=3)
    )

    @property
    def _llm_type(self) -> str:
        """Return type of chat model."""
        return "deepseek-chat"

    def _generate(
            self,
            messages: List[BaseMessage],
            stop: Optional[List[str]] = None,
            run_manager: Optional[CallbackManagerForLLMRun] = None,
            **kwargs: Any,
    ) -> ChatResult:
        """
        Main method to generate chat completions from the Deepseek model.

        Args:
            messages: List of input messages.
            stop: Optional list of stop sequences.
            run_manager: Callback manager for LLM run.
            **kwargs: Additional model parameters.

        Returns:
            ChatResult containing the generated message.
        """
        # Convert LangChain messages to Deepseek API format
        deepseek_messages = self._convert_messages(messages)

        legal_keys = [
        "frequency_penalty",
        "function_call",
        "functions",
        "logit_bias",
        "logprobs",
        "max_completion_tokens",
        "max_tokens",
        "metadata",
        "modalities",
        "n",
        "parallel_tool_calls",
        "prediction",
        "presence_penalty",
        "reasoning_effort",
        "response_format",
        "seed",
        "service_tier",
        "stop",
        "store",
        "stream",
        "stream_options",
        "temperature",
        "tool_choice",
        "tools",
        "top_logprobs",
        "top_p",
        "user",
        "web_search_options",
        "extra_headers",
        "extra_query",
        "extra_body",
        "timeout",
        ]

        # Prepare API parameters
        params = {
            "model": self.model_name,
            "messages": deepseek_messages,
            "temperature": self.temperature,
        }

        if self.max_tokens is not None:
            params["max_tokens"] = self.max_tokens

        if stop is not None:
            params["stop"] = stop
        for key in legal_keys:
            if key in kwargs:
                params[key] = kwargs.get(key)

        # Call Deepseek API (this is a placeholder - implement actual API call)
        response = self._call_deepseek_api(params)

        # Process the response
        return self._create_chat_result(response)

    def _convert_messages(self, messages: List[BaseMessage]) -> List[Dict[str, str]]:
        """
        Convert LangChain messages to Deepseek API format.
        """
        deepseek_messages = []
        for message in messages:
            if isinstance(message, HumanMessage):
                role = "user"
            elif isinstance(message, AIMessage):
                role = "assistant"
            elif isinstance(message, SystemMessage):
                role = "system"
            else:
                role = "assistant"

            deepseek_messages.append({
                "role": role,
                "content": message.content
            })

        return deepseek_messages

    def _call_deepseek_api(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Use OpenAI's API as a backend for Deepseek compatibility."""
        api_key = params.get("api_key", self.api_key)
        base_url = params.get("base_url", self.base_url)
        http_client = self.http_client
        if params.get("http_client"):
            http_client = params["http_client"]
        elif params.get("proxy_url"):
            http_client = params["proxy_url"]
        client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            http_client=http_client
        )
        response = client.chat.completions.create(**params)
        print(response.usage)
        res = {
            "choices": [{
                "message": {
                    "role": response.choices[0].message.role,
                    "content": response.choices[0].message.content,
                    'reasoning_content': response.choices[0].message.reasoning_content if hasattr(response.choices[0].message, 'reasoning_content') else None
                }
            }]
        }
        if hasattr(response.choices[0].message, 'reasoning_content'):
            print(response.choices[0].message.reasoning_content)
        return res

    def _create_chat_result(self, response: Dict[str, Any]) -> ChatResult:
        """
        Convert Deepseek API response to LangChain ChatResult.
        """
        if "choices" not in response or len(response["choices"]) == 0:
            raise ValueError("No choices in response")

        message = response["choices"][0]["message"]
        generation = ChatGeneration(message=AIMessage(content=message["content"], reasoning_content=message["reasoning_content"]))

        return ChatResult(generations=[generation])
