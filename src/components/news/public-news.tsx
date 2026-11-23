import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Sprout, Wheat, Tractor } from "lucide-react";
import { sampleNews } from "@/lib/news-samples";
import { listPublishedNews, getPublishedNews } from "@/lib/news";
import { createPublicNewsReader } from "./public-news-selection";
import s from "./public-news.module.css";

export const publicNews = createPublicNewsReader(listPublishedNews, getPublishedNews, sampleNews);
const calendar = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });
export const publicDate = (value: string | null) => value ? calendar.format(new Date(value)) : "";
export function Portal({ children }: { children: React.ReactNode }) {
  return <div className={s.portal}><a className={s.skip} href="#isi">Lewati ke isi</a><header className={s.header}><div className={s.wrap}><Link href="/" className={s.brand}><Image src="/logo-pemkab-indramayu.png" alt="Lambang Kabupaten Indramayu" width={55} height={44}/><span>DKPP Indramayu<small>KABUPATEN INDRAMAYU</small></span></Link><nav aria-label="Navigasi publik"><Link href="/#profil">Profil</Link><Link href="/#berita">Berita</Link><Link href="/perpustakaan">Perpustakaan</Link><Link className={s.login} href="/login">Masuk Admin <ArrowUpRight size={15}/></Link></nav></div></header>{children}<footer className={s.footer}><div className={s.wrap}><div><strong>DKPP Kabupaten Indramayu</strong><p>Dinas Ketahanan Pangan dan Pertanian</p></div><Link href="/#berita">Berita dan kegiatan ↗</Link></div></footer></div>;
}
export function Cover({ url, eager = false }: { url: string; eager?: boolean }) {
  if (!url) return <div className={s.placeholder}><Sprout size={50} aria-hidden="true"/></div>;
  // Images from editors are fetched only by browsers, never proxied by Next Image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={s.cover} src={url} alt="" loading={eager ? "eager" : "lazy"} referrerPolicy="no-referrer" />;
}
export function NewsHome({ entries }: { entries: Awaited<ReturnType<typeof publicNews.list>> }) {
  const [featured, ...latest] = entries;
  const a = featured?.article;
  return <Portal><main id="isi"><section className={s.hero}><div className={s.wrap}><div className={s.intro}><p className={s.eyebrow}><span/> PEMERINTAH KABUPATEN INDRAMAYU</p><h1>Dinas Ketahanan Pangan <em>dan Pertanian.</em></h1><p className={s.lead}>Informasi kegiatan, layanan, dan perkembangan pangan serta pertanian di Kabupaten Indramayu.</p><a className={s.cta} href="#berita">Baca berita <ArrowUpRight size={18}/></a></div><div className={s.heroArt}><Image src="/news/sawah.svg" alt="Ilustrasi petak sawah" fill priority sizes="(max-width: 760px) 95vw, 45vw"/><span><Wheat size={18}/> PANGAN · PERTANIAN · INDRAMAYU</span></div></div></section>
  <section id="berita" className={`${s.wrap} ${s.news}`}><p className={s.eyebrow}>RUANG INFORMASI</p><h2>Berita DKPP</h2>{featured?.isSample && <p className={s.notice}>Artikel berlabel <strong>Contoh</strong> adalah ilustrasi, bukan pengumuman resmi.</p>}{a && <Link className={s.featured} href={`/berita/${a.slug}`}><Cover url={a.coverUrl}/><div><p className={s.kicker}>{featured.isSample && <span className={s.badge}>Contoh</span>}{a.category} <span>·</span> {publicDate(a.publishedAt)}</p><h3>{a.title}</h3><p>{a.summary}</p><span className={s.read}>Baca selengkapnya <ArrowUpRight size={16}/></span></div></Link>}
  <div className={s.grid}>{latest.map(({article,isSample}) => <article key={article.slug} className={s.card}><Link href={`/berita/${article.slug}`}><Cover url={article.coverUrl}/><div><p className={s.kicker}>{isSample && <span className={s.badge}>Contoh</span>}{article.category}</p><h3>{article.title}</h3><p>{article.summary}</p><p className={s.read}>{publicDate(article.publishedAt)} <ArrowUpRight size={16}/></p></div></Link></article>)}</div></section>
  <section id="profil" className={s.profile}><div className={s.wrap}><div><p className={s.eyebrow}>TENTANG DKPP</p><h2>Pangan dan pertanian Indramayu</h2></div><div><Sprout aria-hidden="true"/><h3>Ketahanan Pangan</h3><p>Informasi tentang ketersediaan, keragaman, dan pemanfaatan pangan.</p></div><div><Tractor aria-hidden="true"/><h3>Pertanian</h3><p>Informasi tentang budidaya, penyuluhan, dan kegiatan pertanian.</p></div></div></section></main></Portal>;
}
export function NewsDetail({ entry }: { entry: NonNullable<Awaited<ReturnType<typeof publicNews.get>>> }) {
  const { article:a, isSample } = entry;
  return <Portal><main id="isi" className={`${s.wrap} ${s.detail}`}><Link className={s.read} href="/#berita">← Semua berita</Link><p className={s.kicker}>{isSample && <span className={s.badge}>Contoh</span>}{a.category} · {publicDate(a.publishedAt)}</p><h1>{a.title}</h1><p className={s.lead}>{a.summary}</p>{isSample && <p className={s.notice}>Contoh berita · bukan pengumuman resmi.</p>}<Cover url={a.coverUrl} eager/><article className={s.prose} dangerouslySetInnerHTML={{__html:a.bodyHtml}}/></main></Portal>;
}
