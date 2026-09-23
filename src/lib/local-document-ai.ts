import "server-only";

// Compatibility for existing callers; all extraction now uses Gemini.
export { extractGeminiDocumentData as extractLocalDocumentData, DocumentAiError as LocalDocumentAiError } from "@/lib/gemini-document-ai";
