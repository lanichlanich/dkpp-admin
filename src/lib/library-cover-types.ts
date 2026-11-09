export const LIBRARY_COVER_BUCKET = "dkpp-library-covers";
export const LIBRARY_COVER_DIRECTORY = "library-book-covers";
export const LIBRARY_COVER_MIME = "image/webp";
export const LIBRARY_COVER_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const libraryCoverNamePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/;

export function libraryCoverUrl(bookId: string, coverStorageName: string | null) {
  return coverStorageName ? `/api/library/books/${encodeURIComponent(bookId)}/cover?v=${encodeURIComponent(coverStorageName)}` : null;
}
