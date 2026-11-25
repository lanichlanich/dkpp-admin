"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import s from "./public-glass.module.css";

const links = [["Profil", "/#profil"], ["SOTK", "/#sotk"], ["Berita", "/#berita"], ["Galeri", "/#galeri"], ["Perpustakaan", "/perpustakaan"], ["Kontak", "/#kontak"]];

export function PublicNavigation() {
  const menu = useRef<HTMLDetailsElement>(null);
  function items() {
    return <>{links.map(([label, url]) => <Link key={url} href={url}>{label}</Link>)}<Link className={s.admin} href="/login">Masuk Admin <ArrowUpRight size={15} aria-hidden/></Link></>;
  }
  return <>
    <nav className={s.desktopNav} aria-label="Navigasi publik">{items()}</nav>
    <details className={s.mobileNav} ref={menu} onKeyDown={event => { if (event.key === "Escape" && menu.current?.open) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } }}>
      <summary><Menu size={18} aria-hidden/> Menu</summary>
      <nav className={s.glass} aria-label="Navigasi publik" onClick={event => { if (event.target instanceof Element && event.target.closest("a") && menu.current) menu.current.open = false; }}>{items()}</nav>
    </details>
  </>;
}
