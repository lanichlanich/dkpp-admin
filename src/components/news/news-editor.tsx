"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { saveNewsAction } from "@/app/dashboard/berita/actions";
import type { NewsArticle } from "@/lib/news";
import styles from "./news-editor.module.css";

function httpsUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function NewsEditor({ article }: { article?: NewsArticle }) {
  const router = useRouter();
  const [meta, setMeta] = useState({ title: article?.title ?? "", summary: article?.summary ?? "", category: article?.category ?? "", coverUrl: article?.coverUrl ?? "" });
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const pending = saving || refreshing;
  const [message, setMessage] = useState<{ ok: boolean; message: string }>();
  const [insert, setInsert] = useState<"link" | "image" | null>(null);
  const [insertUrl, setInsertUrl] = useState("");
  const [alt, setAlt] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, defaultProtocol: "https" } }), TextAlign.configure({ types: ["heading", "paragraph"] }), Image, TableKit],
    content: article?.bodyHtml || "",
    editorProps: { attributes: { role: "textbox", "aria-label": "Isi berita", "aria-multiline": "true" } },
  });
  const active = useEditorState({ editor, selector: ({ editor }) => editor ? Object.fromEntries(["bold", "italic", "underline", "strike", "bulletList", "orderedList", "blockquote", "code", "codeBlock", "link", "table"].map(key => [key, editor.isActive(key)])) : {} });

  useEffect(() => { editor?.setEditable(!pending && !preview); }, [editor, pending, preview]);

  function showInsert(mode: "link" | "image") {
    setInsert(mode); setInsertUrl(mode === "link" ? editor?.getAttributes("link").href ?? "" : ""); setAlt(""); setMessage(undefined);
  }
  function insertMedia() {
    const href = httpsUrl(insertUrl);
    if (!editor || !href) { setMessage({ ok: false, message: "Gunakan URL HTTPS yang valid." }); return; }
    if (insert === "image") {
      if (!alt.trim()) { setMessage({ ok: false, message: "Isi deskripsi gambar untuk pembaca layar." }); return; }
      editor.chain().focus().setImage({ src: href, alt: alt.trim() }).run();
    } else if (editor.state.selection.empty && !editor.isActive("link")) {
      editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else { editor.chain().focus().extendMarkRange("link").setLink({ href }).run(); }
    setInsert(null); setMessage(undefined);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (!editor || pending || !submitter) return;
    const form = new FormData(event.currentTarget);
    form.set("bodyHtml", editor.getHTML()); form.set("status", submitter.value);
    editor.setEditable(false);
    setSaving(true); setMessage(undefined);
    try {
      const result = await saveNewsAction(form); setMessage(result);
      if (result.ok) startRefresh(() => {
        if (!article) router.replace(`/dashboard/berita?edit=${encodeURIComponent(result.id)}`);
        else router.refresh();
      });
    } catch { setMessage({ ok: false, message: "Berita belum tersimpan. Silakan coba lagi." }); }
    finally { setSaving(false); }
  }
  const tools = editor ? [
    ["Tebal", () => editor.chain().focus().toggleBold().run(), active?.bold],
    ["Miring", () => editor.chain().focus().toggleItalic().run(), active?.italic],
    ["Garis bawah", () => editor.chain().focus().toggleUnderline().run(), active?.underline],
    ["Coret", () => editor.chain().focus().toggleStrike().run(), active?.strike],
    ["Daftar poin", () => editor.chain().focus().toggleBulletList().run(), active?.bulletList],
    ["Daftar angka", () => editor.chain().focus().toggleOrderedList().run(), active?.orderedList],
    ["Kutipan", () => editor.chain().focus().toggleBlockquote().run(), active?.blockquote],
    ["Rata kiri", () => editor.chain().focus().setTextAlign("left").run()],
    ["Tengah", () => editor.chain().focus().setTextAlign("center").run()],
    ["Rata kanan", () => editor.chain().focus().setTextAlign("right").run()],
    ["Kiri–kanan", () => editor.chain().focus().setTextAlign("justify").run()],
    ["Tautan", () => showInsert("link"), active?.link],
    ["Lepas tautan", () => editor.chain().focus().unsetLink().run()],
    ["Gambar", () => showInsert("image")],
    ["Tabel", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()],
    ["Kode", () => editor.chain().focus().toggleCode().run(), active?.code],
    ["Blok kode", () => editor.chain().focus().toggleCodeBlock().run(), active?.codeBlock],
    ["Pemisah", () => editor.chain().focus().setHorizontalRule().run()],
    ...(active?.table ? [["+ Baris", () => editor.chain().focus().addRowAfter().run()], ["+ Kolom", () => editor.chain().focus().addColumnAfter().run()], ["Hapus tabel", () => editor.chain().focus().deleteTable().run()]] : []),
    ["Hapus format", () => editor.chain().focus().unsetAllMarks().clearNodes().run()],
    ["Urungkan", () => editor.chain().focus().undo().run()],
    ["Ulangi", () => editor.chain().focus().redo().run()],
  ] as [string, () => unknown, boolean?][] : [];
  const fields = [{key:"title",label:"Judul berita",max:160},{key:"category",label:"Kategori",max:60},{key:"summary",label:"Ringkasan",max:320},{key:"coverUrl",label:"Gambar sampul (URL HTTPS)",max:1000}] as const;
  const cover = httpsUrl(meta.coverUrl) ?? (/^\/news\/[a-z0-9_.-]+$/i.test(meta.coverUrl) ? meta.coverUrl : null);
  return <form onSubmit={save} className={styles.form} aria-busy={pending}>
    <fieldset disabled={pending} className={styles.fieldset}>
    <input name="revision" type="hidden" value={article?.revision ?? ""}/>
    <input name="id" type="hidden" value={article?.id ?? ""}/>
    <div className={styles.fields}>{fields.map(({key,label,max}) => <label key={key} className={key === "title" || key === "summary" ? styles.wide : ""}>{label}{key === "summary" ? <textarea name={key} rows={3} maxLength={max} value={meta[key]} onChange={event => setMeta({...meta,[key]:event.target.value})} /> : <input name={key} required={key === "title"} maxLength={max} value={meta[key]} onChange={event => setMeta({...meta,[key]:event.target.value})}/>}</label>)}</div>
    <div className={styles.mode}><h2>{preview ? "Pratinjau berita" : "Isi berita"}</h2><button type="button" disabled={!editor} onClick={() => { editor?.setEditable(preview); setPreview(!preview); setInsert(null); }}>{preview ? "Kembali menyunting" : "Pratinjau"}</button></div>
    {preview && <div className={styles.preview}><p>{meta.category}</p><h3>{meta.title || "Judul belum diisi"}</h3><p>{meta.summary}</p>{cover && <CardCover url={cover} title={meta.title} />}</div>}
    {!preview && <div className={styles.toolbar} role="group" aria-label="Format berita"><label><span className="sr-only">Terapkan gaya paragraf</span><select disabled={!editor} value="" onChange={event => { const level = Number(event.target.value) as 2 | 3 | 4; if (level) editor?.chain().focus().toggleHeading({ level }).run(); else editor?.chain().focus().setParagraph().run(); }}><option value="" disabled>Gaya paragraf</option><option value="0">Paragraf</option><option value="2">Judul 2</option><option value="3">Judul 3</option><option value="4">Judul 4</option></select></label>{tools.map(([label, handler, value]) => <button key={label} type="button" aria-pressed={value} onMouseDown={event => event.preventDefault()} onClick={() => handler()}>{label}</button>)}</div>}
    {insert && <div className={styles.insert}><label>URL HTTPS<input value={insertUrl} onChange={event => setInsertUrl(event.target.value)}/></label>{insert === "image" && <label>Deskripsi gambar<input value={alt} maxLength={180} onChange={event => setAlt(event.target.value)}/></label>}<button type="button" onClick={insertMedia}>Sisipkan</button><button type="button" onClick={() => setInsert(null)}>Batal</button></div>}
    <EditorContent className={styles.content} editor={editor}/>
    <div className={styles.actions}><button type="submit" value="draft" disabled={pending || !editor}>{article?.status === "published" ? "Tarik ke draf" : "Simpan draf"}</button><button type="submit" value="published" disabled={pending || !editor}>{article?.status === "published" ? "Perbarui terbitan" : "Terbitkan berita"}</button></div>
    </fieldset>
    {pending && <p role="status">Menyimpan berita…</p>}
    {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}>{message.message}</p>}
  </form>;
}

function CardCover({url,title}:{url:string;title:string}) {
  // Direct browser request; never proxy or fetch arbitrary editor-supplied URLs on the server.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={title || "Gambar sampul"} referrerPolicy="no-referrer" />;
}
