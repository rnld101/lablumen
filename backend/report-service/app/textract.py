"""Synchronous Textract OCR (ported from the serverless ingestion pipeline).

`detect_document_text` is the synchronous API and suits single-page documents/images; multi-page
async Textract is intentionally out of scope for this in-cluster path.
"""

import boto3

from .config import settings

_textract = boto3.client("textract", region_name=settings.aws_region)


def extract_text(bucket: str, key: str) -> str:
    resp = _textract.detect_document_text(Document={"S3Object": {"Bucket": bucket, "Name": key}})
    lines = [b["Text"] for b in resp.get("Blocks", []) if b.get("BlockType") == "LINE"]
    return "\n\n".join(lines)
