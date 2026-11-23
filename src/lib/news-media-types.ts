export const NEWS_MEDIA_DIRECTORY = "news-media";
export const newsMediaNamePattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.webp$/;
export const NEWS_MEDIA_PREFIX = "/api/news/media/";

export function newsMediaNames(cover: unknown, html: unknown) {
  const sources = [String(cover ?? ""), ...Array.from(String(html ?? "").matchAll(/<img\b[^>]*?\ssrc="([^"<>]*)"[^>]*>/g), match => match[1])];
  return [...new Set(sources.filter(src => src.startsWith(NEWS_MEDIA_PREFIX)).map(src => src.slice(NEWS_MEDIA_PREFIX.length)).filter(name => newsMediaNamePattern.test(name)))];
}
