"""
ChromaDB Vector Store — semantic document memory for SEC filings and news.
"""

import logging
import time
from pathlib import Path
from typing import Any, Optional

import chromadb
from chromadb.utils import embedding_functions

from config import settings

logger = logging.getLogger(__name__)

# Constants
CHROMA_PATH = str(Path(settings.DB_PATH).parent / "chroma")
COLLECTION_NAME = "finsight_memory"

# Lazy-loaded client and collection
_client = None
_collection = None


def _get_collection():
    """Initialize ChromaDB client and collection."""
    global _client, _collection
    if _collection is None:
        try:
            # Ensure path exists
            Path(CHROMA_PATH).mkdir(parents=True, exist_ok=True)

            _client = chromadb.PersistentClient(path=CHROMA_PATH)
            
            # Using all-MiniLM-L6-v2 as specified in PRD 5
            emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )

            _collection = _client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=emb_fn,
                metadata={"hnsw:space": "cosine"}
            )
            logger.info(f"[vector] Initialized ChromaDB at {CHROMA_PATH}")
        except Exception as e:
            logger.error(f"[vector] Failed to initialize ChromaDB: {e}")
            raise e
    return _collection


def embed_document(ticker: str, doc_type: str, text: str, metadata: Optional[dict] = None):
    """
    Chunk and embed a document into ChromaDB.
    Overwrites existing entries for the same ticker + doc_type.
    """
    if not text:
        return

    collection = _get_collection()
    
    # 1. Simple chunking: 500 chars with 50 char overlap
    chunk_size = 500
    overlap = 50
    chunks = []
    
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += (chunk_size - overlap)

    # 2. Prepare data for Chroma
    ids = [f"{ticker.upper()}_{doc_type}_{i}" for i in range(len(chunks))]
    
    base_metadata = {
        "ticker": ticker.upper(),
        "doc_type": doc_type,
        "timestamp": time.time(),
    }
    if metadata:
        base_metadata.update(metadata)
        
    metadatas = [base_metadata for _ in chunks]

    # 3. Upsert
    try:
        collection.upsert(
            ids=ids,
            documents=chunks,
            metadatas=metadatas
        )
        logger.info(f"[vector] Embedded {len(chunks)} chunks for {ticker} ({doc_type})")
    except Exception as e:
        logger.error(f"[vector] Embedding failed for {ticker}: {e}")


def retrieve_from_vector_store(query: str, ticker: Optional[str] = None, n_results: int = 5) -> dict[str, Any]:
    """
    Semantic search over the vector store.
    If ticker is provided, filters results to that ticker only.
    """
    try:
        collection = _get_collection()
        
        where = {}
        if ticker:
            where["ticker"] = ticker.upper()
            
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where if where else None
        )
        
        # Format results
        formatted = []
        if results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            
            for i in range(len(docs)):
                formatted.append({
                    "text": docs[i],
                    "metadata": metas[i]
                })

        return {
            "status": "AVAILABLE" if formatted else "UNAVAILABLE",
            "query": query,
            "results": formatted,
            "count": len(formatted),
            "source": "vector_store"
        }

    except Exception as e:
        logger.error(f"[vector] Retrieval failed: {e}")
        return {
            "status": "UNAVAILABLE",
            "error": str(e),
            "source": "vector_store"
        }


def has_documents(ticker: str, doc_type: str) -> bool:
    """Check if we have any documents for this ticker/type."""
    try:
        collection = _get_collection()
        res = collection.get(
            where={"$and": [{"ticker": ticker.upper()}, {"doc_type": doc_type}]},
            limit=1
        )
        return len(res["ids"]) > 0
    except:
        return False
