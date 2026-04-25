"""
PDF Processing Service for RAG Chatbot
Handles PDF extraction, text chunking, and storage in Qdrant
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import io
import re
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class PDFChunk:
    """Represents a chunk of text from a PDF"""

    def __init__(self, text: str, page: int, chunk_id: int, filename: str):
        self.text = text
        self.page = page
        self.chunk_id = chunk_id
        self.filename = filename

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "page": self.page,
            "chunk_id": self.chunk_id,
            "filename": self.filename
        }


class PDFService:
    """Service for processing PDFs and preparing them for RAG"""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self.db = db
        self.chunk_size = 500  # words per chunk
        self.chunk_overlap = 50  # words overlap between chunks

    async def extract_pdf_text(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Extract text from PDF file

        Args:
            file_content: PDF file bytes
            filename: Original filename

        Returns:
            Dict with pages and text content
        """
        try:
            import PyPDF2

            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            pages_data = []

            logger.info(f"📄 Extracting text from PDF: {filename} ({len(pdf_reader.pages)} pages)")

            for page_num, page in enumerate(pdf_reader.pages, 1):
                try:
                    text = page.extract_text()
                    if text:
                        # Clean up text
                        text = self._clean_text(text)
                        pages_data.append({
                            "page": page_num,
                            "text": text
                        })
                        logger.info(f"  ✅ Page {page_num}: {len(text)} chars")
                except Exception as e:
                    logger.warning(f"  ⚠️ Failed to extract page {page_num}: {e}")

            if not pages_data:
                raise ValueError("No text could be extracted from PDF")

            return {
                "filename": filename,
                "total_pages": len(pdf_reader.pages),
                "extracted_pages": len(pages_data),
                "pages": pages_data
            }

        except ImportError:
            logger.error("PyPDF2 not installed. Install with: pip install PyPDF2")
            raise ValueError("PDF processing not available - PyPDF2 not installed")
        except Exception as e:
            logger.error(f"❌ PDF extraction failed: {e}")
            raise

    def _clean_text(self, text: str) -> str:
        """Clean extracted text"""
        # Remove multiple spaces
        text = re.sub(r'\s+', ' ', text)
        # Remove special control characters
        text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t')
        return text.strip()

    def chunk_text(self, text: str, filename: str, page: int) -> List[PDFChunk]:
        """
        Split text into overlapping chunks

        Args:
            text: Full page text
            filename: PDF filename
            page: Page number

        Returns:
            List of PDFChunk objects
        """
        words = text.split()
        chunks = []
        chunk_id = 0

        i = 0
        while i < len(words):
            # Get chunk_size words
            chunk_words = words[i:i + self.chunk_size]
            chunk_text = ' '.join(chunk_words)

            if chunk_text.strip():  # Only add non-empty chunks
                chunks.append(PDFChunk(
                    text=chunk_text,
                    page=page,
                    chunk_id=chunk_id,
                    filename=filename
                ))
                chunk_id += 1

            # Move forward by chunk_size - overlap
            i += self.chunk_size - self.chunk_overlap

        logger.info(f"📦 Created {len(chunks)} chunks from page {page}")
        return chunks

    async def process_pdf(
        self,
        file_content: bytes,
        filename: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Full PDF processing pipeline

        Args:
            file_content: PDF file bytes
            filename: Original filename
            user_id: User who uploaded the PDF

        Returns:
            Processing results with chunks
        """
        logger.info(f"🔄 Processing PDF: {filename} for user {user_id}")

        # Extract text from PDF
        extraction_result = await self.extract_pdf_text(file_content, filename)

        # Chunk the text from all pages
        all_chunks = []
        for page_data in extraction_result["pages"]:
            page_num = page_data["page"]
            page_text = page_data["text"]
            chunks = self.chunk_text(page_text, filename, page_num)
            all_chunks.extend(chunks)

        # Store PDF metadata in MongoDB
        pdf_metadata = {
            "filename": filename,
            "user_id": user_id,
            "upload_date": datetime.utcnow().isoformat(),
            "total_pages": extraction_result["total_pages"],
            "extracted_pages": extraction_result["extracted_pages"],
            "total_chunks": len(all_chunks),
            "status": "processed"
        }

        if self.db is not None:
            try:
                result = await self.db["pdf_documents"].insert_one(pdf_metadata)
                pdf_metadata["_id"] = result.inserted_id
                logger.info(f"✅ PDF metadata saved: {result.inserted_id}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to save PDF metadata: {e}")

        return {
            "success": True,
            "filename": filename,
            "total_chunks": len(all_chunks),
            "total_pages": extraction_result["total_pages"],
            "chunks": [chunk.to_dict() for chunk in all_chunks],
            "metadata": pdf_metadata
        }

    async def get_user_pdfs(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all PDFs uploaded by user"""
        if self.db is None:
            return []

        try:
            cursor = self.db["pdf_documents"].find(
                {"user_id": user_id},
                {"chunks": 0}  # Don't retrieve chunk data in list view
            ).sort("upload_date", -1)

            pdfs = await cursor.to_list(None)
            return pdfs
        except Exception as e:
            logger.warning(f"Failed to get user PDFs: {e}")
            return []

    async def delete_pdf(self, pdf_id: str, user_id: str) -> bool:
        """Delete a PDF and its chunks from Qdrant"""
        if self.db is None:
            return False

        try:
            from bson import ObjectId

            # Convert string ID to ObjectId
            try:
                pdf_id_obj = ObjectId(pdf_id)
            except Exception:
                logger.warning(f"Invalid PDF ID format: {pdf_id}")
                return False

            result = await self.db["pdf_documents"].delete_one({
                "_id": pdf_id_obj,
                "user_id": user_id
            })
            logger.info(f"✅ Deleted PDF {pdf_id}")
            return result.deleted_count > 0
        except Exception as e:
            logger.warning(f"Failed to delete PDF: {e}")
            return False
