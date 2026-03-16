from groq import Groq
from backend.core.config import settings
import requests

Provider = str

def generate_kdp_prompts(
    system_prompt: str,
    prefix_prompt: str, 
    suffix_prompt: str,
    topic: str,
    number_n: int,
    character_type: str,
    model: str | None = None,
    provider: Provider | None = None,
) -> list[str]:
    """Generates coloring book prompts using Groq and formats them."""
    provider_name, model_name = _resolve_provider_and_model(provider, model)
        
    # Force strict formatting on the prompt
    final_system = system_prompt.replace("{N}", str(number_n)).replace("{CHARACTER}", character_type)
    final_system += f"\n\nCRITICAL INSTRUCTION: You MUST output EXACTLY {number_n} lines. Each line MUST be a single prompt. DO NOT output any lists, numbers, asterisks, or introductory text like 'Here are the prompts'. DO NOT output any blank lines."

    raw_prompts = _chat_completion_text(
        provider=provider_name,
        model=model_name,
        messages=[
            {"role": "system", "content": final_system},
            {"role": "user", "content": f"Generate prompts for: {topic}. Ensure you generate exactly {number_n} prompts about {character_type}."},
        ],
        temperature=0.7,
    ).strip()
    
    # Return clean raw prompts only — frontend handles prefix/suffix composition
    composed_prompts = []
    import re
    
    for p in raw_prompts.split('\n'):
        # Remove numbers, bullets, asterisks at the start
        line = re.sub(r'^(\d+\.|\-|\*)\s*', '', p).strip()
        
        # Filter out obvious conversational filler
        line_lower = line.lower()
        if not line or len(line) < 10:
            continue
        if line_lower.startswith("here are") or line_lower.startswith("sure") or line_lower.startswith("prompts:"):
            continue
            
        composed_prompts.append(line)
        
    # Strictly return only N requested prompts to fix overflow bugs
    return composed_prompts[:number_n]


def _resolve_provider_and_model(provider: Provider | None, model: str | None) -> tuple[str, str]:
    provider_name = (provider or "").strip().lower()
    model_name = (model or "").strip()
    if ":" in model_name:
        prefix, rest = model_name.split(":", 1)
        p = prefix.strip().lower()
        if p in {"groq", "openai", "azure", "azure_openai", "gemini"}:
            provider_name = "azure_openai" if p in {"azure", "azure_openai"} else p
            model_name = rest.strip()
    provider_name = provider_name or "groq"
    model_name = model_name or ("openai/gpt-oss-120b" if provider_name == "groq" else "")
    return provider_name, model_name


def _chat_completion_text(
    provider: str,
    model: str,
    messages: list[dict],
    temperature: float = 0.7,
) -> str:
    p = (provider or "").strip().lower()
    if p == "groq":
        if not settings.groq_api_key:
            raise ValueError("Groq API Key is not configured in settings.")
        client = Groq(api_key=settings.groq_api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
        )
        return completion.choices[0].message.content or ""

    if p == "openai":
        if not settings.openai_api_key:
            raise ValueError("OpenAI API Key is not configured in settings.")
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=60)
        if resp.status_code >= 400:
            raise ValueError(f"OpenAI API error: {resp.status_code} {resp.text}")
        data = resp.json()
        return (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""

    if p == "azure_openai":
        endpoint = (settings.azure_openai_endpoint or "").strip().rstrip("/")
        api_key = (settings.azure_openai_api_key or "").strip()
        deployment = (model or "").strip() or (settings.azure_openai_deployment or "").strip()
        api_version = (settings.azure_openai_api_version or "").strip() or "2024-02-15-preview"
        if not endpoint or not api_key or not deployment:
            raise ValueError("Azure OpenAI is not configured in settings.")
        url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
        headers = {"api-key": api_key, "Content-Type": "application/json"}
        payload = {"messages": messages, "temperature": temperature}
        resp = requests.post(url, headers=headers, json=payload, timeout=60)
        if resp.status_code >= 400:
            raise ValueError(f"Azure OpenAI API error: {resp.status_code} {resp.text}")
        data = resp.json()
        return (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""

    if p == "gemini":
        api_key = (settings.gemini_api_key or "").strip()
        if not api_key:
            raise ValueError("Gemini API Key is not configured in settings.")
        m = model.strip()
        model_path = m if m.startswith("models/") else f"models/{m}"
        url = f"https://generativelanguage.googleapis.com/v1beta/{model_path}:generateContent?key={api_key}"
        system_parts = [m["content"] for m in messages if m.get("role") == "system" and isinstance(m.get("content"), str)]
        system_text = "\n".join([s for s in system_parts if s.strip()])
        contents = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content")
            if role == "system" or not isinstance(content, str):
                continue
            gem_role = "model" if role == "assistant" else "user"
            contents.append({"role": gem_role, "parts": [{"text": content}]})
        payload: dict = {"contents": contents}
        if system_text:
            payload["systemInstruction"] = {"parts": [{"text": system_text}]}
        resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=60)
        if resp.status_code >= 400:
            raise ValueError(f"Gemini API error: {resp.status_code} {resp.text}")
        data = resp.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return ""
        parts = ((candidates[0].get("content") or {}).get("parts")) or []
        texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
        return "".join(texts)

    raise ValueError(f"Unknown provider: {provider}")
