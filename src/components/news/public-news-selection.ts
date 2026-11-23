type Article = { slug: string; status?: string };
export function createPublicNewsReader<T extends Article, S extends Article>(listPublished: () => Promise<readonly T[]>, getPublished: (slug: string) => Promise<T | null>, samples: readonly S[]) {
  const real = async () => (await listPublished()).filter(article => article.status === "published");
  return {
    async list() {
      const rows = await real();
      return rows.length ? rows.map(article => ({ article, isSample: false })) : samples.map(article => ({ article, isSample: true }));
    },
    async get(slug: string) {
      const article = await getPublished(slug);
      if (article?.status === "published") return { article, isSample: false };
      const sample = samples.find(entry => entry.slug === slug);
      return sample && !(await real()).length ? { article: sample, isSample: true } : null;
    },
  };
}
