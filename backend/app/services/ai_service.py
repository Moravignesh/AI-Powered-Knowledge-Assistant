import logging
import time
import asyncio
import httpx
import json
from typing import List, Dict, Any, AsyncGenerator
from app.core.config import settings

logger = logging.getLogger(__name__)

NO_KEY_MSG = (
    "⚠️ Groq API key is not configured.\n\n"
    "To enable AI answers (100% FREE):\n"
    "1. Go to https://console.groq.com\n"
    "2. Sign up for free\n"
    "3. Go to https://console.groq.com/keys\n"
    "4. Click 'Create API Key'\n"
    "5. Open backend/.env\n"
    "6. Set GROQ_API_KEY=your-key-here\n"
    "7. Restart the backend server"
)

# Groq free models - very fast, no rate limit issues
FALLBACK_MODELS = [
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
    "llama3-70b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "gemma-7b-it",
]

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


def _is_valid_key(key: str) -> bool:
    return bool(key and len(key) > 10)


def _friendly_error(err: str) -> str:
    if "401" in err or "unauthorized" in err.lower() or "invalid" in err.lower():
        return (
            "❌ Invalid Groq API key.\n\n"
            "Fix:\n"
            "1. Go to https://console.groq.com/keys\n"
            "2. Create a new API key\n"
            "3. Update GROQ_API_KEY in backend/.env\n"
            "4. Restart the backend"
        )
    elif "429" in err or "rate" in err.lower():
        return (
            "❌ Rate limit hit. Please wait a moment and try again."
        )
    return f"❌ AI error: {err}"


class AIService:
    def __init__(self):
        self.model = FALLBACK_MODELS[0]

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

    def _build_system_prompt(self) -> str:
        return (
            "You are an intelligent knowledge assistant. "
            "Answer questions based ONLY on the provided document context.\n\n"
            "Rules:\n"
            "1. Use ONLY the context provided. Do not use outside knowledge.\n"
            "2. If the answer is not in the context, say: "
            "'I couldn't find relevant information about this in the uploaded documents.'\n"
            "3. Be clear and concise. Use markdown formatting when it helps readability.\n"
            "4. Mention which document the information comes from when relevant."
        )

    def _build_context(self, search_results: List[Dict[str, Any]]) -> str:
        if not search_results:
            return "No relevant document sections found."
        parts = []
        for i, r in enumerate(search_results, 1):
            parts.append(f"[Source {i} — {r['document_name']}]\n{r['chunk_text']}")
        return "\n\n---\n\n".join(parts)

    def _build_messages(self, question: str, search_results: List[Dict[str, Any]]) -> list:
        context = self._build_context(search_results)
        return [
            {"role": "system", "content": self._build_system_prompt()},
            {
                "role": "user",
                "content": f"Document context:\n\n{context}\n\n---\n\nQuestion: {question}",
            },
        ]

    def _try_generate(self, messages: list) -> tuple:
        """Try each Groq model in order. Returns (answer, model_used)."""
        if not _is_valid_key(settings.GROQ_API_KEY):
            return None, "no_key"

        last_error = ""
        for model_name in FALLBACK_MODELS:
            try:
                logger.info(f"Trying Groq model: {model_name}")
                with httpx.Client(timeout=30) as client:
                    response = client.post(
                        GROQ_API_URL,
                        headers=self._get_headers(),
                        json={
                            "model": model_name,
                            "messages": messages,
                            "max_tokens": 1500,
                            "temperature": 0.1,
                        },
                    )

                if response.status_code == 200:
                    data = response.json()
                    answer = data["choices"][0]["message"]["content"]
                    logger.info(f"Success with Groq model: {model_name}")
                    return answer, model_name

                elif response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 3))
                    wait = min(retry_after, 5)
                    logger.warning(f"Rate limited on {model_name}, waiting {wait}s...")
                    time.sleep(wait)
                    last_error = "429"
                    continue

                elif response.status_code == 404:
                    logger.warning(f"Model not found: {model_name}")
                    last_error = "404"
                    continue

                elif response.status_code == 401:
                    logger.error("Invalid Groq API key")
                    return None, "401 unauthorized - check your GROQ_API_KEY in .env"

                else:
                    last_error = f"{response.status_code}: {response.text[:100]}"
                    logger.warning(f"Model {model_name} failed: {last_error}")
                    continue

            except Exception as e:
                last_error = str(e)
                logger.warning(f"Model {model_name} exception: {last_error[:100]}")
                continue

        return None, last_error

    async def answer_question(
        self,
        question: str,
        search_results: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not _is_valid_key(settings.GROQ_API_KEY):
            return {
                "answer": NO_KEY_MSG,
                "model": "none",
                "tokens_used": 0,
                "response_time_ms": 0,
            }

        start = time.time()
        messages = self._build_messages(question, search_results)

        try:
            loop = asyncio.get_event_loop()
            answer, model_used = await loop.run_in_executor(
                None, lambda: self._try_generate(messages)
            )
            elapsed = int((time.time() - start) * 1000)

            if answer is None:
                return {
                    "answer": _friendly_error(model_used or "All models failed"),
                    "model": "none",
                    "tokens_used": 0,
                    "response_time_ms": elapsed,
                }
            return {
                "answer": answer,
                "model": model_used,
                "tokens_used": 0,
                "response_time_ms": elapsed,
            }
        except Exception as e:
            logger.error(f"answer_question error: {e}")
            return {
                "answer": _friendly_error(str(e)),
                "model": "none",
                "tokens_used": 0,
                "response_time_ms": int((time.time() - start) * 1000),
            }

    async def stream_answer(
        self,
        question: str,
        search_results: List[Dict[str, Any]],
    ) -> AsyncGenerator[str, None]:
        if not _is_valid_key(settings.GROQ_API_KEY):
            yield NO_KEY_MSG
            return

        messages = self._build_messages(question, search_results)
        last_error = ""

        for model_name in FALLBACK_MODELS:
            try:
                if last_error:
                    await asyncio.sleep(2)

                logger.info(f"Streaming with Groq: {model_name}")
                yielded = False

                with httpx.Client(timeout=60) as client:
                    with client.stream(
                        "POST",
                        GROQ_API_URL,
                        headers=self._get_headers(),
                        json={
                            "model": model_name,
                            "messages": messages,
                            "max_tokens": 1500,
                            "temperature": 0.1,
                            "stream": True,
                        },
                    ) as response:
                        if response.status_code == 401:
                            yield _friendly_error("401 unauthorized")
                            return
                        if response.status_code in (429, 404):
                            last_error = str(response.status_code)
                            continue
                        if response.status_code != 200:
                            last_error = str(response.status_code)
                            continue

                        for line in response.iter_lines():
                            if line.startswith("data: "):
                                data_str = line[6:]
                                if data_str.strip() == "[DONE]":
                                    break
                                try:
                                    data = json.loads(data_str)
                                    delta = data["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                                        yielded = True
                                except Exception:
                                    continue

                if yielded:
                    return

            except Exception as e:
                last_error = str(e)
                logger.warning(f"Stream failed for {model_name}: {last_error[:100]}")
                continue

        yield f"\n\n{_friendly_error(last_error)}"

    async def summarize_document(self, text: str, doc_name: str) -> str:
        if not _is_valid_key(settings.GROQ_API_KEY):
            return NO_KEY_MSG

        truncated = text[:8000] + ("..." if len(text) > 8000 else "")
        messages = [
            {
                "role": "user",
                "content": f"Provide a clear structured summary of '{doc_name}':\n\n{truncated}",
            }
        ]

        try:
            loop = asyncio.get_event_loop()
            answer, _ = await loop.run_in_executor(
                None, lambda: self._try_generate(messages)
            )
            return answer or "Could not generate summary."
        except Exception as e:
            return _friendly_error(str(e))


ai_service = AIService()