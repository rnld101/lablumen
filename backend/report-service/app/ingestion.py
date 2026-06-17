"""In-cluster report ingestion: Textract OCR -> Nova summary -> Titan embeddings -> pgvector.

This is the docker-compose / single-instance equivalent of the S3-triggered Lambda in
serverless/ai-processing-pipeline (which is kept pristine for the EKS phase). It runs as a FastAPI
BackgroundTask after a staff upload, opening its own DB session because the request session is
already closed by the time the task runs.
"""

import asyncio
import logging

from sqlalchemy import text

from .bedrock import embed_text, summarize
from .chunking import chunk_text
from .config import settings
from .db import SessionLocal
from .textract import extract_text

logger = logging.getLogger(__name__)


def _vector_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in vec) + "]"


def _run_pipeline_sync(bucket: str, key: str) -> tuple[str, list[tuple[str, list[float]]]]:
    """Blocking boto3 work: OCR -> summary -> per-chunk embeddings."""
    report_text = extract_text(bucket, key)
    summary = summarize(report_text)
    chunks_with_vectors = [(chunk, embed_text(chunk)) for chunk in chunk_text(report_text)]
    return summary, chunks_with_vectors


async def process_report(report_id: str, key: str) -> None:
    """Background entrypoint: OCR + summarize + embed an uploaded report, then persist."""
    bucket = settings.reports_s3_bucket
    try:
        summary, chunks_with_vectors = await asyncio.to_thread(_run_pipeline_sync, bucket, key)
    except Exception:
        logger.exception("Ingestion failed for report_id=%s key=%s", report_id, key)
        return

    async with SessionLocal() as session:
        await session.execute(
            text(
                "UPDATE lab_reports SET ai_layman_summary = :s "
                "WHERE report_id = CAST(:rid AS uuid)"
            ),
            {"s": summary, "rid": report_id},
        )
        for chunk, vec in chunks_with_vectors:
            await session.execute(
                text(
                    "INSERT INTO report_embeddings (report_id, chunk_content, embedding) "
                    "VALUES (CAST(:rid AS uuid), :chunk, CAST(:vec AS vector))"
                ),
                {"rid": report_id, "chunk": chunk, "vec": _vector_literal(vec)},
            )
        await session.commit()
    logger.info("Ingested report_id=%s chunks=%d", report_id, len(chunks_with_vectors))
