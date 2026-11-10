import "server-only";

// Compatibility for existing callers; all extraction now uses OpenAI.
export { extractDocumentData as extractLocalDocumentData, DocumentAiError as LocalDocumentAiError } from "@/lib/document-ai";
