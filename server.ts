import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import multer from "multer";
import { PDFParse } from "pdf-parse";

dotenv.config();

// Define our types locally or import them
interface DocumentChunk {
  id: string;
  text: string;
  pageNumber: number;
  embedding?: number[];
}

// Global state to store currently indexed document chunks for the session
let indexedChunks: DocumentChunk[] = [];
let currentDocumentName = "";

// Initialize standard Express app
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" })); // Support large document text payloads

// Create server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper: Cosine Similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 1. API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "AI Study Assistant Backend is running!" });
});

// 2. API: Get Current Status
app.get("/api/status", (req, res) => {
  res.json({
    hasDocument: indexedChunks.length > 0,
    chunkCount: indexedChunks.length,
    documentName: currentDocumentName,
  });
});

// 3. API: Clear Document Index
app.post("/api/clear", (req, res) => {
  indexedChunks = [];
  currentDocumentName = "";
  res.json({ success: true, message: "Study material cleared." });
});

// 4. API: Index Document Content (Create Embeddings)
app.post("/api/index-document", async (req, res) => {
  try {
    const { documentName, chunks } = req.body;

    if (!documentName || !chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid document chunks payload" });
    }

    console.log(`Indexing document "${documentName}" with ${chunks.length} chunks...`);

    // Reset current storage
    indexedChunks = [];
    currentDocumentName = documentName;

    // We fetch embeddings for each chunk
    const initializedChunks: DocumentChunk[] = [];

    // Process chunk-by-chunk to ensure stability and respect rate limiting
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedResponse = await ai.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: chunk.text,
        });

        const embeddingsProp = (embedResponse as any).embeddings;
        let embeddingValues: number[] | undefined = undefined;
        if (embeddingsProp) {
          if (Array.isArray(embeddingsProp)) {
            embeddingValues = embeddingsProp[0]?.values;
          } else {
            embeddingValues = embeddingsProp.values;
          }
        }

        if (embeddingValues) {
          initializedChunks.push({
            id: chunk.id || `chunk-${i}`,
            text: chunk.text,
            pageNumber: chunk.pageNumber || 1,
            embedding: embeddingValues,
          });
        } else {
          console.warn(`Could not fetch embedding values for chunk index ${i}`);
          // Fallback empty embedding, or skip. Here we skip to keep RAG pure
        }
      } catch (err: any) {
        console.error(`Error embedding chunk ${i}:`, err.message || err);
        // Continue index with whatever parses, or fail. We'll skip this chunk
      }
    }

    indexedChunks = initializedChunks;
    console.log(`Successfully indexed ${indexedChunks.length} chunks with embeddings!`);

    res.json({
      success: true,
      message: `Successfully indexed "${documentName}". Ready for reading!`,
      chunkCount: indexedChunks.length,
    });
  } catch (error: any) {
    console.error("Indexing failed:", error);
    res.status(500).json({ success: false, message: error.message || "Unknown error during indexing" });
  }
});

// Configure Multer for processing file uploads in memory safely
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB size limit
  },
});

// 4b. API: Upload and Index Document (Text or PDF formats)
app.post("/api/upload-file", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file was uploaded." });
    }

    const documentName = file.originalname;
    const extension = documentName.split(".").pop()?.toLowerCase();

    console.log(`Received file "${documentName}" of type "${file.mimetype}", size: ${file.size} bytes`);
    let textContent = "";

    if (extension === "pdf") {
      try {
        const parser = new PDFParse({ data: file.buffer });
        const parsedPdf = await parser.getText();
        textContent = parsedPdf.text;
      } catch (pdfErr: any) {
        console.error("PDF Parsing error:", pdfErr);
        return res.status(400).json({
          success: false,
          message: `Failed to parse PDF file correctly. Ensure it is not password-protected. Details: ${pdfErr.message || pdfErr}`,
        });
      }
    } else {
      // Decode the buffer as standard UTF-8 string
      textContent = file.buffer.toString("utf-8");
    }

    if (!textContent || textContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file does not contain any readable text or could not be parsed successfully.",
      });
    }

    // Server-side chunker
    const chunks: DocumentChunk[] = [];
    const chunkSize = 500; // character block size
    const overlap = 100;

    let idx = 0;
    let pageCount = 1;
    let chunkCounter = 0;

    // Split text content into paragraphs first to keep alignment, or standard substring chunker
    const normalizedText = textContent.replace(/\r\n/g, "\n");
    
    while (idx < normalizedText.length) {
      const textChunk = normalizedText.substring(idx, idx + chunkSize).trim();
      if (textChunk.length > 20) {
        chunks.push({
          id: `file-chunk-${chunkCounter}`,
          text: textChunk,
          pageNumber: pageCount,
        });
        chunkCounter++;
        // Roll page boundary every 2 chunks as a general layout approximation
        if (chunkCounter % 2 === 0) {
          pageCount++;
        }
      }
      idx += (chunkSize - overlap);
    }

    if (chunks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No indexable study fragments could be derived from this document.",
      });
    }

    console.log(`Successfully parsed document. Total chunks generated: ${chunks.length}. Preparing vectorization...`);

    // Reset session document
    indexedChunks = [];
    currentDocumentName = documentName;

    const initializedChunks: DocumentChunk[] = [];

    // Process chunk-by-chunk to acquire Gemini embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedResponse = await ai.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: chunk.text,
        });

        const embeddingsProp = (embedResponse as any).embeddings;
        let embeddingValues: number[] | undefined = undefined;
        if (embeddingsProp) {
          if (Array.isArray(embeddingsProp)) {
            embeddingValues = embeddingsProp[0]?.values;
          } else {
            embeddingValues = embeddingsProp.values;
          }
        }

        if (embeddingValues) {
          initializedChunks.push({
            id: chunk.id,
            text: chunk.text,
            pageNumber: chunk.pageNumber,
            embedding: embeddingValues,
          });
        }
      } catch (err: any) {
        console.error(`Error embedding file chunk index ${i}:`, err.message || err);
      }
    }

    indexedChunks = initializedChunks;
    console.log(`Vector indexing complete for uploaded file! Loaded chunks count: ${indexedChunks.length}`);

    res.json({
      success: true,
      message: `Successfully indexed "${documentName}". Ready for reading!`,
      chunkCount: indexedChunks.length,
    });
  } catch (error: any) {
    console.error("File upload and indexing failed:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Unknown error occurred while processing and vector indexing this study file.",
    });
  }
});

// 5. API: Ask Question (Embedding + Retreival + Flash Generation)
app.post("/api/query", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ success: false, message: "Valid text question is required" });
    }

    if (indexedChunks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No study materials uploaded. Please upload a study guide or note first.",
      });
    }

    console.log(`Processing search query: "${question}"`);

    // A. Generate embedding for query
    const queryEmbedResp = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: question,
    });

    const queryEmbeddingsProp = (queryEmbedResp as any).embeddings;
    let queryVec: number[] | undefined = undefined;
    if (queryEmbeddingsProp) {
      if (Array.isArray(queryEmbeddingsProp)) {
        queryVec = queryEmbeddingsProp[0]?.values;
      } else {
        queryVec = queryEmbeddingsProp.values;
      }
    }
    if (!queryVec) {
      throw new Error("Failed to generate embedding vector for the question");
    }

    // B. Calculate similarities and retrieve top text chunks
    const similarityScores = indexedChunks.map((chunk) => {
      const similarity = chunk.embedding ? cosineSimilarity(queryVec, chunk.embedding) : 0;
      return {
        text: chunk.text,
        pageNumber: chunk.pageNumber,
        similarity,
      };
    });

    // Sort by descending similarity score
    similarityScores.sort((a, b) => b.similarity - a.similarity);

    // Filter relevant-only elements (e.g. similarity > 0.15) and pick top 4
    const retrievedChunks = similarityScores.slice(0, 4);

    // C. Format search context
    const contextText = retrievedChunks
      .map((c, i) => `[Source Block ${i + 1} - Page ${c.pageNumber}]:\n${c.text}`)
      .join("\n\n");

    console.log(`Retrieved ${retrievedChunks.length} chunks. Constructing response prompt...`);

    // D. Request Gemini 3.5 Flash for beginner-friendly accessible synthesis
    const prompt = `You are a friendly, compassionate AI Study Material Assistant specifically designed to help visually impaired students learn.

Instructions:
1. Provide a highly beginner-friendly, clear, and comprehensive explanation to answer the student's question.
2. The student relies on Text-to-Speech (TTS) to listen to your response. Avoid complicated formatting, math formulas, long itemized structures like nested lists, heavy markdown symbols (like stars * or hashes #), or long lines. Instead, write in complete, flowing, warm, and natural conversational sentences that sound incredibly clean when read aloud.
3. Keep the language simple and highly encouraging.
4. If the retrieved context does not contain enough information to answer, mention that warm-heartedly, but still try to give the best explanation possible using general study context.

Study Guide Context:
${contextText}

Student Question:
"${question}"

Conversational TTS-friendly Explanation:`;

    const chatResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const answer = chatResponse.text || "I was unable to retrieve a response from the study model. Please try asking again.";

    res.json({
      answer,
      retrievedChunks,
    });
  } catch (error: any) {
    console.error("Query lookup failed:", error);
    res.status(500).json({ success: false, message: error.message || "Unknown error during study query parsing" });
  }
});

// Configure Vite middleware in development or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Run vite development server integration
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted for local dev server asset pipeline.");
  } else {
    // Serve static compiled assets in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express application successfully listening on port ${PORT}`);
  });
}

startServer();
