/**
 * Shared types for the RAG Assistant
 */

export interface DocumentChunk {
  id: string;
  text: string;
  pageNumber: number;
  embedding?: number[];
}

export interface IndexResponse {
  success: boolean;
  message: string;
  chunkCount: number;
}

export interface QueryRequest {
  question: string;
}

export interface QueryResponse {
  answer: string;
  retrievedChunks: {
    text: string;
    pageNumber: number;
    similarity: number;
  }[];
}

export interface SystemStatus {
  hasDocument: boolean;
  chunkCount: number;
  documentName: string;
}
