export const MAX_UPLOAD_SIZE_MB = 2;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

// Multipart requests add headers and form fields beyond the file bytes.
export const MAX_MULTIPART_REQUEST_SIZE_BYTES = MAX_UPLOAD_SIZE_BYTES + 64 * 1024;
