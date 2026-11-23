import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BookOpen, MapPin, Phone, Sprout, Wheat } from "lucide-react";
import { sampleNews } from "@/lib/news-samples";
import { listPublishedNews, getPublishedNews } from "@/lib/news";
import { createPublicNewsReader } from "./public-news-selection";
import { fields, gallery, officialNews, officialSite } from "./public-home-content";
import s from "./public-news.module.css";

export const publicNews = createPublicNewsReader(listPublishedNews, getPublishedNews, sampleNews);
const calendar = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });
export const publicDate = (value: string | null) => value ? calendar.format(new Date(value)) : "";
export function Portal({ children }: { children: React.ReactNode }) {
  return <div className={s.portal}><a className={s.skip} href="#isi">Lewati ke isi</a><header className={s.header}><div className={s.wrap}><Link href="/" className={s.brand}><Image src="/logo-pemkab-indramayu.png" alt="Lambang Kabupaten Indramayu" width={55} height={44}/><span>DKPP Indramayu<small>KABUPATEN INDRAMAYU</small></span></Link><nav aria-label="Navigasi publik"><Link href="/#profil">Profil</Link><Link href="/#sotk">SOTK</Link><Link href="/#berita">Berita</Link><Link href="/#galeri">Galeri</Link><Link href="/perpustakaan">Perpustakaan</Link><Link href="/#kontak">Kontak</Link><Link className={s.login} href="/login">Masuk Admin <ArrowUpRight size={15}/></Link></nav></div></header>{children}<footer className={s.footer}><div className={s.wrap}><div><strong>DKPP Kabupaten Indramayu</strong><p>Dinas Ketahanan Pangan dan Pertanian</p></div><Link href="/#berita">Berita dan kegiatan ↗</Link></div></footer></div>;
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
  return <Portal><main id="isi">
  <section className={`${s.wrap} ${s.photoHero}`} aria-labelledby="hero-title">
    <Image src="/galeri/kunjungan-sawah.webp" alt="Tim berdiskusi di tengah hamparan padi" fill preload sizes="(max-width: 760px) 95vw, 1180px" />
    <div className={s.heroCopy}><p className={s.eyebrow}><Wheat size={16} aria-hidden/> KABUPATEN INDRAMAYU</p><h1 id="hero-title">Dinas Ketahanan Pangan dan Pertanian</h1><p>Kabar kegiatan, profil dinas, dan informasi pangan serta pertanian Indramayu.</p><div className={s.heroLinks}><a href="#berita">Jelajahi berita <ArrowUpRight size={18} aria-hidden/></a><a href="#profil">Kenali dinas</a></div></div>
  </section>
  <section id="profil" className={`${s.wrap} ${s.about}`} aria-labelledby="profil-title">
    <div><p className={s.eyebrow}>PROFIL DINAS</p><h2 id="profil-title">Dari pangan hingga pertanian</h2></div>
    <div><p>DKPP merupakan perangkat daerah Kabupaten Indramayu yang menangani urusan pangan dan pertanian. Lingkupnya mencakup distribusi dan keamanan pangan, pembinaan budidaya, penyuluhan, peternakan, serta kesehatan hewan.</p><div className={s.aboutLinks}><a href={`${officialSite}/visi-misi/`}>Visi dan misi <ArrowUpRight size={16} aria-hidden/></a><a href={`${officialSite}/tugas-pokok-dan-fungsi/`}>Tugas dan fungsi <ArrowUpRight size={16} aria-hidden/></a><Link href="/perpustakaan"><BookOpen size={16} aria-hidden/> Katalog Perpustakaan</Link></div></div>
  </section>
  <section id="sotk" className={s.organization} aria-labelledby="sotk-title"><div className={`${s.wrap} ${s.orgGrid}`}>
    <div><p className={s.eyebrow}>STRUKTUR ORGANISASI DAN TATA KERJA</p><h2 id="sotk-title">Bagaimana dinas bekerja</h2><p>Kepala Dinas memimpin Sekretariat dan bidang pelaksana. Unit pelaksana teknis mendukung kegiatan di wilayah dan layanan khusus.</p><a className={s.read} href={`${officialSite}/struktur-organisasi/`}>Lihat bagan SOTK di situs resmi <ArrowUpRight size={16} aria-hidden/></a></div>
    <ul>{fields.map((field, index) => <li key={field}><span aria-hidden>{String(index + 1).padStart(2, "0")}</span>{field}</li>)}</ul>
  </div></section>
  <section id="berita" className={`${s.wrap} ${s.news}`}><p className={s.eyebrow}>RUANG INFORMASI</p><h2>Berita DKPP</h2>{featured?.isSample && <p className={s.notice}>Artikel berlabel <strong>Contoh</strong> adalah ilustrasi, bukan pengumuman resmi.</p>}{a && <Link className={s.featured} href={`/berita/${a.slug}`}><Cover url={a.coverUrl}/><div><p className={s.kicker}>{featured.isSample && <span className={s.badge}>Contoh</span>}{a.category} <span>·</span> {publicDate(a.publishedAt)}</p><h3>{a.title}</h3><p>{a.summary}</p><span className={s.read}>Baca selengkapnya <ArrowUpRight size={16}/></span></div></Link>}
  <div className={s.grid}>{latest.map(({article,isSample}) => <article key={article.slug} className={s.card}><Link href={`/berita/${article.slug}`}><Cover url={article.coverUrl}/><div><p className={s.kicker}>{isSample && <span className={s.badge}>Contoh</span>}{article.category}</p><h3>{article.title}</h3><p>{article.summary}</p><p className={s.read}>{publicDate(article.publishedAt)} <ArrowUpRight size={16}/></p></div></Link></article>)}</div></section>
  <section className={`${s.wrap} ${s.sourceNews}`} aria-labelledby="source-news"><p className={s.eyebrow}>DARI SITUS RESMI DKPP</p><h2 id="source-news">Pilihan kabar Indramayu</h2><div>{officialNews.map(item => <article key={item.url}><time dateTime={item.date}>{item.label}</time><h3><a href={item.url}>{item.title} <ArrowUpRight size={17} aria-hidden/></a></h3><p>{item.summary}</p></article>)}</div></section>
  <section id="galeri" className={s.gallery} aria-labelledby="gallery-title"><div className={s.wrap}><p className={s.eyebrow}>DOKUMENTASI LAPANGAN</p><h2 id="gallery-title">Galeri kegiatan</h2><p>Pilih foto untuk melihat ukuran penuh.</p>{gallery.map(group => <div key={group.title} className={s.galleryGroup}><h3>{group.title}</h3><div className={s.photoGrid}>{group.photos.map(([name, caption]) => <figure key={name}><a href={`/galeri/${name}.webp`} aria-label={`Lihat foto: ${caption}`}><Image src={`/galeri/${name}.webp`} alt={caption} fill sizes="(max-width: 440px) 90vw, (max-width: 760px) 45vw, 32vw"/></a><figcaption>{caption}</figcaption></figure>)}</div></div>)}</div></section>
  <section id="kontak" className={`${s.wrap} ${s.contact}`} aria-labelledby="contact-title"><div><p className={s.eyebrow}>HUBUNGI DINAS</p><h2 id="contact-title">Kontak DKPP</h2></div><div><p><MapPin size={18} aria-hidden/> Jl. Pasar Baru No. 445, Karangmalang, Indramayu 45213</p><p><Phone size={18} aria-hidden/> <a href="tel:+62234272082">(0234) 272082</a></p><a className={s.read} href={officialSite}>Kunjungi situs resmi DKPP <ArrowUpRight size={16} aria-hidden/></a></div></section>
  </main></Portal>;
}
export function NewsDetail({ entry }: { entry: NonNullable<Awaited<ReturnType<typeof publicNews.get>>> }) {
  const { article:a, isSample } = entry;
  return <Portal><main id="isi" className={`${s.wrap} ${s.detail}`}><Link className={s.read} href="/#berita">← Semua berita</Link><p className={s.kicker}>{isSample && <span className={s.badge}>Contoh</span>}{a.category} · {publicDate(a.publishedAt)}</p><h1>{a.title}</h1><p className={s.lead}>{a.summary}</p>{isSample && <p className={s.notice}>Contoh berita · bukan pengumuman resmi.</p>}<Cover url={a.coverUrl} eager/><article className={s.prose} dangerouslySetInnerHTML={{__html:a.bodyHtml}}/></main></Portal>;
}
