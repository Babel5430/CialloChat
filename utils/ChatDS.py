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
from openai import OpenAI, APIConnectionError as OpenAIAPIConnectionError
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
    api_key: Optional[str] = os.getenv("API_KEY", None)
    base_url: Optional[str] = "https://api.deepseek.com"
    PROXY_URL: Optional[str] = "http://127.0.0.1:7890"

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
        deepseek_messages = self._convert_messages(messages)
        params = {
            "model": self.model_name,
            "messages": deepseek_messages,
            "temperature": self.temperature,
        }

        if self.max_tokens is not None:
            params["max_tokens"] = self.max_tokens

        if stop is not None:
            params["stop"] = stop

        client_config_keys = {"api_key", "base_url", "http_client", "proxy_url"}
        for key, value in kwargs.items():
            if key not in client_config_keys:
                params[key] = value
        response = self._call_deepseek_api(**params)
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

    def _call_deepseek_api(self, **kwargs) -> Dict[str, Any]:
        """Use OpenAI's API as a backend for Deepseek compatibility."""
        current_api_key = kwargs.get("api_key", self.api_key)
        current_base_url = kwargs.get("base_url", self.base_url)

        if current_api_key is None:
            raise ValueError(
                "API_KEY must be provided either via environment variable, class initialization, or call kwargs.")

        user_provided_http_client = kwargs.get("http_client")
        user_provided_proxy_url = kwargs.get("proxy_url")

        legal_keys = [
        "model",
        "messages",
        "temperature",
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
        params = {}
        for key in legal_keys:
            if key in kwargs:
                params[key] = kwargs.get(key)

        def _execute_call(client: OpenAI) -> Dict[str, Any]:
            # print(f"Attempting API call with client transport: {client._custom_httpx_client}")
            response_openai = client.chat.completions.create(**params)
            # print(f"API call successful. Usage: {response_openai.usage}")

            reasoning_content = None
            if response_openai.choices and response_openai.choices[0].message:
                reasoning_content = getattr(response_openai.choices[0].message, 'reasoning_content', None)

            res_data = {
                "choices": [{
                    "message": {
                        "role": response_openai.choices[0].message.role,
                        "content": response_openai.choices[0].message.content,
                        "reasoning_content": reasoning_content
                    }
                }]
            }
            # if reasoning_content:
            #    print(f"Reasoning Content from API: {reasoning_content}")
            return res_data

        if user_provided_http_client:
            # print("Using user-provided http_client from call_kwargs.")
            client = OpenAI(api_key=current_api_key, base_url=current_base_url, http_client=user_provided_http_client)
            return _execute_call(client)

        if user_provided_proxy_url:
            # print(f"Using user-provided proxy_url from call_kwargs: {user_provided_proxy_url}")
            custom_proxy_http_client = httpx.Client(proxy=user_provided_proxy_url,
                                                    transport=httpx.HTTPTransport(retries=1))
            client = OpenAI(api_key=current_api_key, base_url=current_base_url, http_client=custom_proxy_http_client)
            return _execute_call(client)
        try:
            # print("Attempting direct connection (no proxy)...")
            direct_http_client = httpx.Client(
                transport=httpx.HTTPTransport(retries=1))  # Fewer retries for the first attempt
            client_direct = OpenAI(api_key=current_api_key, base_url=current_base_url, http_client=direct_http_client)
            return _execute_call(client_direct)
        except (httpx.ConnectError, OpenAIAPIConnectionError) as e:  # Catch specific connection errors
            # print(f"Direct connection failed: {type(e).__name__} - {e}.")

            if self.PROXY_URL:
                # print(f"Attempting connection with class PROXY_URL: {self.PROXY_URL}...")
                try:
                    proxy_http_client = httpx.Client(proxy=self.PROXY_URL, transport=httpx.HTTPTransport(retries=3))
                    client_proxy = OpenAI(api_key=current_api_key, base_url=current_base_url,
                                          http_client=proxy_http_client)
                    return _execute_call(client_proxy)
                except (httpx.ConnectError, OpenAIAPIConnectionError) as e_proxy:
                    # print(f"Connection with PROXY_URL ({self.PROXY_URL}) also failed: {type(e_proxy).__name__} - {e_proxy}")
                    raise e_proxy
            else:
                # print("No class PROXY_URL configured for fallback. Raising original direct connection error.")
                raise e

    def _create_chat_result(self, response: Dict[str, Any]) -> ChatResult:
        """
        Convert Deepseek API response to LangChain ChatResult.
        """
        if "choices" not in response or not response["choices"]:
            raise ValueError(f"No choices in response from API. Response: {response}")

        choice = response["choices"][0]
        if "message" not in choice:
            raise ValueError(f"No 'message' in choice. Choice: {choice}")

        message_data = choice["message"]
        ai_message_kwargs = {}
        if "reasoning_content" in message_data and message_data["reasoning_content"] is not None:
            ai_message_kwargs["reasoning_content"] = message_data["reasoning_content"]
        generation = ChatGeneration(
            message=AIMessage(
                content=message_data.get("content", ""),
                additional_kwargs=ai_message_kwargs
            )
        )
        return ChatResult(generations=[generation])
