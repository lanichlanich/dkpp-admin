import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BookOpen, Images, MapPin, Network, Phone, Sprout, Wheat } from "lucide-react";
import { sampleNews } from "@/lib/news-samples";
import { listPublishedNews, getPublishedNews } from "@/lib/news";
import { createPublicNewsReader } from "./public-news-selection";
import { fields, gallery, officialNews, officialSite } from "./public-home-content";
import { PublicNavigation } from "./public-navigation";
import glass from "./public-glass.module.css";
import s from "./public-news.module.css";

export const publicNews = createPublicNewsReader(listPublishedNews, getPublishedNews, sampleNews);
const calendar = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });
export const publicDate = (value: string | null) => value ? calendar.format(new Date(value)) : "";
export function Portal({ children, redesigned = false, overHero = false }: { children: React.ReactNode; redesigned?: boolean; overHero?: boolean }) {
  return <div className={`${s.portal}${redesigned ? ` ${glass.portal}` : ""}`}><a className={s.skip} href="#isi">Lewati ke isi</a><header className={redesigned ? `${glass.header} before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:content-['']${overHero ? ` ${glass.floatingHeader}` : ""}` : s.header}><div className={`${s.wrap} ${redesigned ? `${glass.headerInner}${overHero ? ` ${glass.referenceNavbar}` : ""}` : ""}`}><Link href="/" className={s.brand}><Image src="/logo-pemkab-indramayu.png" alt="Lambang Kabupaten Indramayu" width={55} height={44}/><span>DKPP Indramayu<small>KABUPATEN INDRAMAYU</small></span></Link>{redesigned ? <PublicNavigation/> : <nav aria-label="Navigasi publik"><Link href="/#profil">Profil</Link><Link href="/#sotk">SOTK</Link><Link href="/#berita">Berita</Link><Link href="/#galeri">Galeri</Link><Link href="/perpustakaan">Perpustakaan</Link><Link href="/#kontak">Kontak</Link><Link className={s.login} href="/login">Masuk Admin <ArrowUpRight size={15}/></Link></nav>}</div></header>{children}<footer className={s.footer}><div className={s.wrap}><div><strong>DKPP Kabupaten Indramayu</strong><p>Dinas Ketahanan Pangan dan Pertanian</p></div><Link href="/#berita">Berita dan kegiatan ↗</Link></div></footer></div>;
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
  return <Portal redesigned overHero><main id="isi" tabIndex={-1}>
  <div className={glass.heroShell}>
    <section className={glass.hero} aria-labelledby="hero-title">
      <div className={glass.heroPhoto}><Image src="/galeri/kunjungan-sawah.webp" alt="Tim berdiskusi di tengah hamparan padi" fill preload sizes="(max-width: 900px) 96vw, (max-width: 1230px) 55vw, 680px"/></div>
      <div className={`${s.wrap} ${glass.heroContent}`}><div className={glass.heroCopy}><p className={glass.kicker}><Wheat size={16} aria-hidden/> Kabupaten Indramayu</p><h1 id="hero-title">Dinas Ketahanan Pangan dan Pertanian</h1><p>Kabar kegiatan, profil dinas, dan informasi pangan serta pertanian Indramayu.</p><div className={glass.actions}><a className={glass.primary} href="#berita">Jelajahi berita <ArrowUpRight size={16} aria-hidden/></a><a className={glass.secondary} href="#profil">Kenali dinas</a></div></div></div>
    </section>
    <div className={`${s.wrap} ${glass.quickPosition}`}><aside className={`${glass.quick} ${glass.glass} ${glass.referenceGlass}`} aria-labelledby="quick-title"><h2 id="quick-title">Akses Cepat</h2><div><Link href="/perpustakaan#katalog"><BookOpen size={18} aria-hidden/> Cari Buku</Link><a href="#galeri"><Images size={18} aria-hidden/> Galeri Kegiatan</a><a href="#kontak"><Phone size={17} aria-hidden/> Kontak DKPP</a></div></aside></div>
  </div>
  <div className={glass.referenceProfileBand}><div className={`${s.wrap} ${glass.profileBand} ${glass.referenceProfileGrid}`}><section id="profil" className={glass.profilePanel} aria-labelledby="profil-title">
    <h2 id="profil-title"><Sprout aria-hidden size={24}/> Profil Dinas</h2>
    <div><p>DKPP merupakan perangkat daerah Kabupaten Indramayu yang menangani urusan pangan dan pertanian. Lingkupnya mencakup distribusi dan keamanan pangan, pembinaan budidaya, penyuluhan, peternakan, serta kesehatan hewan.</p><div className={s.aboutLinks}><a href={`${officialSite}/visi-misi/`}>Visi dan misi <ArrowUpRight size={16} aria-hidden/></a><a href={`${officialSite}/tugas-pokok-dan-fungsi/`}>Tugas dan fungsi <ArrowUpRight size={16} aria-hidden/></a><Link href="/perpustakaan"><BookOpen size={16} aria-hidden/> Katalog Perpustakaan</Link></div></div>
  </section>
  <section id="sotk" className={glass.profilePanel} aria-labelledby="sotk-title">
    <div><h2 id="sotk-title"><Network aria-hidden size={24}/> Struktur Organisasi</h2><p>Kepala Dinas memimpin Sekretariat dan bidang pelaksana. Unit pelaksana teknis mendukung kegiatan di wilayah dan layanan khusus.</p><a className={s.read} href={`${officialSite}/struktur-organisasi/`}>Lihat bagan SOTK di situs resmi <ArrowUpRight size={16} aria-hidden/></a></div>
    <details className={glass.sotk}><summary>Bidang di lingkungan DKPP</summary><ul>{fields.map((field, index) => <li key={field}><span aria-hidden>{String(index + 1).padStart(2, "0")}</span>{field}</li>)}</ul></details>
  </section></div></div>
  <section id="berita" className={`${s.wrap} ${s.news}`}><p className={s.eyebrow}>RUANG INFORMASI</p><div className={`${glass.sectionHeading} ${glass.referenceSectionHeading}`}><h2>Berita DKPP</h2><a href={`${officialSite}/category/berita-dkpp/`}>Berita di Situs Resmi <ArrowUpRight size={16} aria-hidden/></a></div>{featured?.isSample && <p className={s.notice}>Artikel berlabel <strong>Contoh</strong> adalah ilustrasi, bukan pengumuman resmi.</p>}{a && <Link className={s.featured} href={`/berita/${a.slug}`}><div className={s.featuredMedia}><Cover url={a.coverUrl}/></div><div><p className={s.kicker}>{featured.isSample && <span className={s.badge}>Contoh</span>}{a.category} <span>·</span> {publicDate(a.publishedAt)}</p><h3>{a.title}</h3><p>{a.summary}</p><span className={s.read}>Baca selengkapnya <ArrowUpRight size={16}/></span></div></Link>}
  <div className={s.grid}>{latest.map(({article,isSample}) => <article key={article.slug} className={s.card}><Link href={`/berita/${article.slug}`}><Cover url={article.coverUrl}/><div><p className={s.kicker}>{isSample && <span className={s.badge}>Contoh</span>}{article.category}</p><h3>{article.title}</h3><p>{article.summary}</p><p className={s.read}>{publicDate(article.publishedAt)} <ArrowUpRight size={16}/></p></div></Link></article>)}</div></section>
  <section className={`${s.wrap} ${s.sourceNews}`} aria-labelledby="source-news"><p className={s.eyebrow}>DARI SITUS RESMI DKPP</p><h2 id="source-news">Pilihan Kabar dari Situs Resmi DKPP</h2><div>{officialNews.map(item => <article key={item.url}><time dateTime={item.date}>{item.label}</time><h3><a href={item.url}>{item.title} <ArrowUpRight size={17} aria-hidden/></a></h3><p>{item.summary}</p><span className={glass.sourceLabel}>Situs resmi DKPP · tautan eksternal</span></article>)}</div></section>
  <section id="galeri" className={s.gallery} aria-labelledby="gallery-title"><div className={s.wrap}><p className={s.eyebrow}>DOKUMENTASI LAPANGAN</p><h2 id="gallery-title">Galeri kegiatan</h2><p>Pilih kategori atau buka foto untuk melihat ukuran penuh.</p><nav aria-label="Kategori galeri" className={glass.galleryNav}>{gallery.map((group,index) => <a key={group.title} href={`#galeri-${index+1}`}>{group.title}</a>)}</nav>{gallery.map((group,index) => <div key={group.title} id={`galeri-${index+1}`} className={s.galleryGroup}><h3>{group.title}</h3><div className={s.photoGrid}>{group.photos.map(([name, caption]) => <figure key={name}><a href={`/galeri/${name}.webp`} aria-label={`Lihat foto: ${caption}`}><Image src={`/galeri/${name}.webp`} alt={caption} fill sizes="(max-width: 440px) 90vw, (max-width: 760px) 45vw, 32vw"/></a><figcaption>{caption}</figcaption></figure>)}</div></div>)}</div></section>
  <section className={`${glass.libraryCallout} ${glass.referenceLibrary}`} aria-labelledby="home-library"><div className={`${s.wrap} ${glass.libraryCalloutInner}`}>
    <div><p className={glass.kicker}><BookOpen size={16} aria-hidden/> Bahan bacaan dan referensi</p><h2 id="home-library">Perpustakaan DKPP</h2><p>Temukan buku pertanian, peternakan, dan bacaan lainnya. Cek ketersediaan sebelum berkunjung.</p></div>
    <Link className={`${glass.glass} ${glass.catalogShortcut} ${glass.referenceGlass} ${glass.referenceCatalog}`} href="/perpustakaan#katalog"><BookOpen size={23} aria-hidden/> Jelajahi Katalog <ArrowUpRight size={19} aria-hidden/></Link>
  </div></section>
  <section id="kontak" className={glass.contactBand} aria-labelledby="contact-title"><div className={`${s.wrap} ${s.contact} ${glass.contactInner}`}><div><p className={s.eyebrow}>HUBUNGI DINAS</p><h2 id="contact-title">Kontak DKPP</h2></div><div><p><MapPin size={18} aria-hidden/> Jl. Pasar Baru No. 445, Karangmalang, Indramayu 45213</p><p><Phone size={18} aria-hidden/> <a href="tel:+62234272082">(0234) 272082</a></p><a className={s.read} href={officialSite}>Kunjungi situs resmi DKPP <ArrowUpRight size={16} aria-hidden/></a></div></div></section>
  </main></Portal>;
}
export function NewsDetail({ entry }: { entry: NonNullable<Awaited<ReturnType<typeof publicNews.get>>> }) {
  const { article:a, isSample } = entry;
  return <Portal><main id="isi" className={`${s.wrap} ${s.detail}`}><Link className={s.read} href="/#berita">← Semua berita</Link><p className={s.kicker}>{isSample && <span className={s.badge}>Contoh</span>}{a.category} · {publicDate(a.publishedAt)}</p><h1>{a.title}</h1><p className={s.lead}>{a.summary}</p>{isSample && <p className={s.notice}>Contoh berita · bukan pengumuman resmi.</p>}<Cover url={a.coverUrl} eager/><article className={s.prose} dangerouslySetInnerHTML={{__html:a.bodyHtml}}/></main></Portal>;
}
