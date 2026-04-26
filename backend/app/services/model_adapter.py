import json
import base64
import logging
from abc import ABC, abstractmethod

import httpx
import anthropic
from google import genai

logger = logging.getLogger(__name__)


class ModelProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list, model: str, api_key: str, **kwargs) -> str:
        ...

    async def understand(self, image_base64: str, prompt: str, model: str, api_key: str, **kwargs) -> str:
        return await self.chat(
            messages=[
                {"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                ]}
            ],
            model=model,
            api_key=api_key,
            **kwargs
        )

    async def rerank(self, query: str, chunks: list[str], model: str, api_key: str, top_k: int = 10) -> list[int]:
        prompt = f"""请根据与查询的相关性对以下片段进行排序。
查询: {query}
片段:
"""
        for i, chunk in enumerate(chunks):
            prompt += f"\n[{i}] {chunk[:500]}"
        prompt += f"\n\n请返回最相关的 {top_k} 个片段编号，按相关性从高到低排列，格式: [1, 3, 5, ...]"
        response = await self.chat(messages=[{"role": "user", "content": prompt}], model=model, api_key=api_key)
        try:
            cleaned = response.strip().strip("[]")
            indices = [int(x.strip()) for x in cleaned.split(",") if x.strip().isdigit()]
            return indices[:top_k]
        except (ValueError, json.JSONDecodeError):
            logger.warning(f"Failed to parse rerank response: {response}")
            return list(range(min(top_k, len(chunks))))


class OpenaiProvider(ModelProvider):
    async def chat(self, messages: list, model: str, api_key: str, **kwargs) -> str:
        import openai
        client = openai.AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model=model, messages=messages,
            **{k: v for k, v in kwargs.items() if k in ("temperature", "max_tokens", "top_p")},
        )
        return response.choices[0].message.content or ""


class OpenaiCompatibleProvider(ModelProvider):
    def __init__(self, base_url: str):
        self.base_url = base_url

    async def chat(self, messages: list, model: str, api_key: str, **kwargs) -> str:
        import openai
        client = openai.AsyncOpenAI(api_key=api_key, base_url=self.base_url)
        response = await client.chat.completions.create(
            model=model, messages=messages,
            **{k: v for k, v in kwargs.items() if k in ("temperature", "max_tokens", "top_p")},
        )
        return response.choices[0].message.content or ""


class AnthropicProvider(ModelProvider):
    async def chat(self, messages: list, model: str, api_key: str, **kwargs) -> str:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        system_msg = ""
        anthropic_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                anthropic_messages.append({"role": m["role"], "content": m["content"]})
        response = await client.messages.create(
            model=model, max_tokens=kwargs.get("max_tokens", 4096),
            system=system_msg or None, messages=anthropic_messages,
        )
        return response.content[0].text if response.content else ""


class GoogleProvider(ModelProvider):
    async def chat(self, messages: list, model: str, api_key: str, **kwargs) -> str:
        client = genai.Client(api_key=api_key)
        contents = []
        for m in messages:
            if m["role"] == "system": continue
            if isinstance(m["content"], str): contents.append(m["content"])
            elif isinstance(m["content"], list):
                contents.extend(c["text"] for c in m["content"] if c.get("type") == "text")
        response = client.models.generate_content(model=model, contents=contents)
        return response.text


class BaiduProvider(ModelProvider):
    async def get_access_token(self, api_key: str, secret_key: str) -> str:
        url = "https://aip.baidubce.com/oauth/2.0/token"
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, params={"grant_type": "client_credentials", "client_id": api_key, "client_secret": secret_key})
            return resp.json().get("access_token", "")

    async def chat(self, messages: list, model: str, api_key: str, **kwargs) -> str:
        parts = api_key.split(":")
        ak = parts[0] if parts else api_key
        sk = parts[1] if len(parts) > 1 else ""
        token = await self.get_access_token(ak, sk)
        url = f"https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{model}"
        payload = {
            "messages": [{"role": m["role"], "content": m["content"] if isinstance(m["content"], str) else json.dumps(m["content"])} for m in messages],
            "temperature": kwargs.get("temperature", 0.7),
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, params={"access_token": token}, json=payload)
            return resp.json().get("result", "")


class ZhipuaiProvider(ModelProvider):
    async def chat(self, messages: list, model: str, api_key: str, **kwargs) -> str:
        from zhipuai import ZhipuAI
        client = ZhipuAI(api_key=api_key)
        response = client.chat.completions.create(model=model, messages=messages)
        return response.choices[0].message.content if response.choices else ""


class ModelAdapter:
    def __init__(self):
        self._providers: dict[str, ModelProvider] = {}
        self._init_providers()

    def _init_providers(self):
        self._providers["openai"] = OpenaiProvider()
        self._providers["anthropic"] = AnthropicProvider()
        self._providers["google"] = GoogleProvider()
        self._providers["baidu"] = BaiduProvider()
        self._providers["zhipuai"] = ZhipuaiProvider()
        self._providers["aliyun"] = OpenaiCompatibleProvider("https://dashscope.aliyuncs.com/compatible-mode/v1")
        self._providers["deepseek"] = OpenaiCompatibleProvider("https://api.deepseek.com/v1")
        self._providers["tencent"] = OpenaiCompatibleProvider("https://api.hunyuan.cloud.tencent.com/v1")
        self._providers["siliconflow"] = OpenaiCompatibleProvider("https://api.siliconflow.cn/v1")
        self._providers["moonshot"] = OpenaiCompatibleProvider("https://api.moonshot.cn/v1")

    def get_provider(self, provider_name: str) -> ModelProvider:
        provider = self._providers.get(provider_name.lower())
        if not provider:
            raise ValueError(f"Unsupported provider: {provider_name}")
        return provider

    async def chat(self, messages: list, provider: str, model: str, api_key: str, **kwargs) -> str:
        return await self.get_provider(provider).chat(messages, model, api_key, **kwargs)

    async def understand(self, image_base64: str, prompt: str, provider: str, model: str, api_key: str, **kwargs) -> str:
        return await self.get_provider(provider).understand(image_base64, prompt, model, api_key, **kwargs)

    async def rerank(self, query: str, chunks: list[str], provider: str, model: str, api_key: str, top_k: int = 10) -> list[int]:
        return await self.get_provider(provider).rerank(query, chunks, model, api_key, top_k)

    async def extract_knowledge(self, text: str, provider: str, model: str, api_key: str) -> list[dict]:
        prompt = """从以下文本中提取核心知识点及其关系。输出JSON格式的知识三元组列表。

要求:
1. 知识点名称应保持适当抽象——提取的是"章节/主题级"概念而非过细的术语。例如：提取"微积分基本定理"而非"牛顿-莱布尼茨公式的证明步骤"。
2. 较详细的内容应放入description字段，而非放在entity名称中。
3. 关系描述应明确该知识点之间的逻辑关联。
4. 实体名称请使用标准化学术术语，同一概念应使用统一名称。

格式要求:
[{"entity": "标准化实体名称", "relation": "关系描述", "target": "标准化目标实体", "relation_type": "prerequisite|is_a|related|derived", "description": "该知识点的简要定义或概括（1-2句话）"}, ...]
文本内容:
""" + text[:8000]
        response = await self.chat(messages=[{"role": "user", "content": prompt}], provider=provider, model=model, api_key=api_key, temperature=0.1)
        try:
            cleaned = response.strip()
            if cleaned.startswith("```json"): cleaned = cleaned[7:]
            elif cleaned.startswith("```"): cleaned = cleaned[3:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse knowledge extraction: {e}")
            return []

    async def standardize_knowledge(self, kps: list[str], provider: str, model: str, api_key: str) -> list[dict]:
        prompt = f"""请规范化和归并以下知识点列表。将同一概念的不同表述合并为一个标准名称。
输出JSON格式，每个对象包含标准化后的名称、别名列表和简要描述。
知识点列表:{json.dumps(kps, ensure_ascii=False, indent=2)}
输出格式:[{{"standard_name": "标准名称", "aliases": ["别名1", "别名2"], "description": "简要描述"}}, ...]"""
        response = await self.chat(messages=[{"role": "user", "content": prompt}], provider=provider, model=model, api_key=api_key, temperature=0.1)
        try:
            cleaned = response.strip()
            if cleaned.startswith("```json"): cleaned = cleaned[7:]
            elif cleaned.startswith("```"): cleaned = cleaned[3:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse knowledge standardization: {e}")
            return [{"standard_name": n, "aliases": [], "description": ""} for n in kps]

    async def generate_quiz(self, kp_name: str, kp_description: str, difficulty: str, provider: str, model: str, api_key: str) -> dict:
        prompt = f"""根据以下知识点生成一道{difficulty}难度的题目。
知识点: {kp_name}
描述: {kp_description}
请输出JSON格式:
```json
{{"type": "choice|fill|short_answer", "question": "题目内容", "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"], "answer": "正确答案", "explanation": "解析"}}
```"""
        response = await self.chat(messages=[{"role": "user", "content": prompt}], provider=provider, model=model, api_key=api_key, temperature=0.3)
        try:
            cleaned = response.strip()
            if cleaned.startswith("```json"): cleaned = cleaned[7:]
            elif cleaned.startswith("```"): cleaned = cleaned[3:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse quiz: {e}")
            return {"type": "short_answer", "question": response[:500], "answer": "", "explanation": ""}

    async def generate_quiz_batch(self, kps: list[dict], difficulty: str, count: int,
                                    prompt_hint: str, question_types: list[str],
                                    provider: str, model: str, api_key: str,
                                    generated_so_far: list[dict] = None) -> list[dict]:
        per_call = 2 if count >= 3 else 1
        kp_desc = "\n".join([f"- {k['name']}: {k.get('description', '')}" for k in kps[:5]])
        types_str = "、".join(question_types) if question_types else "单项选择题、填空题"
        avoid = ""
        if generated_so_far:
            avoid = "\n已生成的题目请避免重复:\n" + "\n".join([f"- {g.get('question','')[:60]}" for g in generated_so_far[-4:]])
        prompt = f"""根据以下知识点生成{per_call}道{difficulty}难度的题目。题目类型: {types_str}
知识点:{kp_desc}
{prompt_hint if prompt_hint else ""}
{avoid}
请输出JSON数组,每道题包含: type(single_choice/multiple_choice/fill/subjective), question, options(选择题), answer, explanation, kp_name(对应知识点名称)
```json
[{{"type":"single_choice","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","kp_name":"..."}}]
```"""
        response = await self.chat(messages=[{"role": "user", "content": prompt}], provider=provider, model=model, api_key=api_key, temperature=0.3)
        try:
            cleaned = response.strip()
            if cleaned.startswith("```json"): cleaned = cleaned[7:]
            elif cleaned.startswith("```"): cleaned = cleaned[3:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
            result = json.loads(cleaned.strip())
            if isinstance(result, dict): return [result]
            return result[:per_call]
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse batch quiz: {e}")
            return [{"type":"subjective","question":response[:500],"answer":"","explanation":"","kp_name":kps[0]["name"] if kps else ""}]

    async def grade_subjective(self, question: str, model_answer: str, user_answer: str,
                                provider: str, model: str, api_key: str) -> dict:
        prompt = f"""请对以下主观题答案进行批改。
题目: {question}
参考答案: {model_answer if model_answer else '无标准答案'}
学生答案: {user_answer}
请输出JSON: {{"score": 0-100, "is_correct": true/false, "comment": "评语", "corrected_answer": "修正答案"}}
60分以上为正确。"""
        response = await self.chat(messages=[{"role": "user", "content": prompt}], provider=provider, model=model, api_key=api_key, temperature=0.2)
        try:
            cleaned = response.strip()
            if cleaned.startswith("```json"): cleaned = cleaned[7:]
            elif cleaned.startswith("```"): cleaned = cleaned[3:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse grading: {e}")
            return {"score": 0, "is_correct": False, "comment": "批改失败，请重试", "corrected_answer": ""}

    async def generate_review(self, kps: list[dict], provider: str, model: str, api_key: str) -> str:
        kp_list = "\n".join([f"- {kp['name']}: {kp.get('description', '')} (掌握度: {kp.get('mastery', 0):.0%})" for kp in kps])
        return await self.chat(messages=[{"role": "user", "content": f"""作为一名AI学习助手，请根据以下知识点列表及其掌握度，为学生生成个性化的复习讲解。
知识点:{kp_list}
请针对掌握度较低的知识点重点讲解。"""}], provider=provider, model=model, api_key=api_key, temperature=0.3)

    async def auto_organize_knowledge(self, kps: list[dict], provider: str, model: str, api_key: str) -> dict:
        prompt = f"""请对以下知识点进行分析处理，输出JSON格式。要求:1.归并去重（相同概念合并为一个，删除冗余/重复的知识点） 2.知识组归类（将关联知识点归入同一组） 3.为每个知识点生成简洁的定义描述
知识点列表:{json.dumps(kps, ensure_ascii=False, indent=2)}
输出:{{"consolidation":[{{"keep_index":0,"merge_indices":[1,2],"standard_name":"标准名称","description":"定义"}}],"groups":[{{"group_name":"组名","kp_indices":[0,1]}}]}}"""
        response = await self.chat(messages=[{"role": "user", "content": prompt}], provider=provider, model=model, api_key=api_key, temperature=0.1)
        try:
            cleaned = response.strip()
            if cleaned.startswith("```json"): cleaned = cleaned[7:]
            elif cleaned.startswith("```"): cleaned = cleaned[3:]
            if cleaned.endswith("```"): cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse auto_organize: {e}")
            return {"consolidation": [{"keep_index":i,"merge_indices":[],"standard_name":kps[i]["name"],"description":""} for i in range(len(kps))], "groups": [{"group_name":"默认分组","kp_indices":list(range(len(kps)))}]}


model_adapter = ModelAdapter()
