"""Amazon Bedrock access via raw boto3 (no LangChain).

Embeddings: amazon.titan-embed-text-v1 (1536-dim).
Generation: amazon.nova-2-lite-v1:0 (via the Converse API).
"""

import json

import boto3

from .config import settings

_client = boto3.client("bedrock-runtime", region_name=settings.aws_region)

_SUMMARY_SYSTEM = (
    "You write a short, empathetic, plain-language summary of a patient's lab report. "
    "Avoid jargon, do not diagnose, and remind the reader to discuss results with their clinician."
)


def embed_text(text: str) -> list[float]:
    """Return the 1536-dim embedding for a piece of text."""
    resp = _client.invoke_model(
        modelId=settings.bedrock_embed_model_id,
        body=json.dumps({"inputText": text}),
        accept="application/json",
        contentType="application/json",
    )
    payload = json.loads(resp["body"].read())
    return payload["embedding"]


def generate_answer(system_prompt: str, user_prompt: str) -> str:
    """Generate a grounded answer with Nova via the Converse API."""
    resp = _client.converse(
        modelId=settings.bedrock_text_model_id,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        inferenceConfig={"maxTokens": 512, "temperature": 0.2},
    )
    return resp["output"]["message"]["content"][0]["text"]


def summarize(report_text: str) -> str:
    """Produce a plain-language layman summary of an OCR'd report (Nova, Converse API)."""
    resp = _client.converse(
        modelId=settings.bedrock_text_model_id,
        system=[{"text": _SUMMARY_SYSTEM}],
        messages=[{"role": "user", "content": [{"text": report_text}]}],
        inferenceConfig={"maxTokens": 600, "temperature": 0.2},
    )
    return resp["output"]["message"]["content"][0]["text"]
