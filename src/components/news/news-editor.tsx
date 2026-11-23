"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code, CodeXml, Columns3, Eye, FileText, Heading2, Heading3, Heading4, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Pencil, Quote, Redo2, Rows3, Save, Send, Strikethrough, Table2, Tags, Trash2, Underline, Undo2, Unlink, Upload, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";
import { NEWS_MEDIA_PREFIX } from "@/lib/news-media-types";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { saveNewsAction } from "@/app/dashboard/berita/actions";
import type { NewsArticle, NewsTerm } from "@/lib/news";
import styles from "./news-editor.module.css";

function httpsUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function NewsEditor({ article, categories, tags, selectedTags }: { article?: NewsArticle & { categoryId: string }; categories: NewsTerm[]; tags: NewsTerm[]; selectedTags: string[] }) {
  const router = useRouter();
  const [meta, setMeta] = useState({ title: article?.title ?? "", summary: article?.summary ?? "", category: article?.category ?? "Umum", coverUrl: article?.coverUrl ?? "" });
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [uploading, setUploading] = useState(false);
  const pending = saving || refreshing || uploading;
  const [message, setMessage] = useState<{ ok: boolean; message: string }>();
  const [insert, setInsert] = useState<"link" | "image" | null>(null);
  const [insertUrl, setInsertUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [inlineFile, setInlineFile] = useState<File>();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, defaultProtocol: "https" } }), TextAlign.configure({ types: ["heading", "paragraph"] }), Image, TableKit],
    content: article?.bodyHtml || "",
    editorProps: { attributes: { role: "textbox", "aria-label": "Isi berita", "aria-multiline": "true" } },
  });
  const active = useEditorState({ editor, selector: ({ editor }) => editor ? Object.fromEntries(["bold", "italic", "underline", "strike", "bulletList", "orderedList", "blockquote", "code", "codeBlock", "link", "table"].map(key => [key, editor.isActive(key)])) : {} });

  useEffect(() => { editor?.setEditable(!pending && !preview); }, [editor, pending, preview]);

  function showInsert(mode: "link" | "image") {
    setInsert(mode); setInsertUrl(mode === "link" ? editor?.getAttributes("link").href ?? "" : ""); setAlt(""); setInlineFile(undefined); setMessage(undefined);
  }
  async function upload(file: File, target: "cover" | "image") {
    if (pending || (target === "image" && !editor)) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > MAX_UPLOAD_SIZE_BYTES) {
      setMessage({ ok: false, message: `Pilih JPG, PNG, atau WebP maksimal ${MAX_UPLOAD_SIZE_MB} MB.` }); return;
    }
    if (target === "image" && !alt.trim()) { setMessage({ ok: false, message: "Isi deskripsi gambar untuk pembaca layar." }); return; }
    setUploading(true); setMessage(undefined);
    try {
      const response = await fetch(NEWS_MEDIA_PREFIX.slice(0, -1), { method: "POST", body: file, headers: { "Content-Type": file.type } });
      const result = await response.json() as { url?: string; message?: string };
      if (!response.ok || !result.url) throw new Error(result.message ?? "Gambar gagal diunggah.");
      if (target === "cover") setMeta(current => ({ ...current, coverUrl: result.url! }));
      else { editor!.chain().focus().setImage({ src: result.url, alt: alt.trim() }).run(); setInsert(null); setInlineFile(undefined); }
      setMessage({ ok: true, message: "Gambar berhasil diunggah." });
    } catch (error) { setMessage({ ok: false, message: error instanceof Error ? error.message : "Gambar gagal diunggah." }); }
    finally { setUploading(false); }
  }
  function insertLink() {
    const href = httpsUrl(insertUrl);
    if (!editor || !href) { setMessage({ ok: false, message: "Gunakan URL HTTPS yang valid." }); return; }
    if (editor.state.selection.empty && !editor.isActive("link")) {
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
        if (!article) router.replace(`/dashboard/berita/buat?edit=${encodeURIComponent(result.id)}`);
        else router.refresh();
      });
    } catch { setMessage({ ok: false, message: "Berita belum tersimpan. Silakan coba lagi." }); }
    finally { setSaving(false); }
  }
  type Tool = [string, LucideIcon, () => unknown, boolean?];
  const tools: { label: string; tone: string; items: Tool[] }[] = editor ? [
    { label: "Gaya teks", tone: "indigo", items: [
      ["Paragraf", FileText, () => editor.chain().focus().setParagraph().run()],
      ["Judul 2", Heading2, () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
      ["Judul 3", Heading3, () => editor.chain().focus().toggleHeading({ level: 3 }).run()],
      ["Judul 4", Heading4, () => editor.chain().focus().toggleHeading({ level: 4 }).run()],
      ["Tebal", Bold, () => editor.chain().focus().toggleBold().run(), active?.bold],
      ["Miring", Italic, () => editor.chain().focus().toggleItalic().run(), active?.italic],
      ["Garis bawah", Underline, () => editor.chain().focus().toggleUnderline().run(), active?.underline],
      ["Coret", Strikethrough, () => editor.chain().focus().toggleStrike().run(), active?.strike],
    ] },
    { label: "Tata letak", tone: "teal", items: [
      ["Rata kiri", AlignLeft, () => editor.chain().focus().setTextAlign("left").run()],
      ["Rata tengah", AlignCenter, () => editor.chain().focus().setTextAlign("center").run()],
      ["Rata kanan", AlignRight, () => editor.chain().focus().setTextAlign("right").run()],
      ["Rata kiri–kanan", AlignJustify, () => editor.chain().focus().setTextAlign("justify").run()],
      ["Daftar poin", List, () => editor.chain().focus().toggleBulletList().run(), active?.bulletList],
      ["Daftar angka", ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), active?.orderedList],
      ["Kutipan", Quote, () => editor.chain().focus().toggleBlockquote().run(), active?.blockquote],
    ] },
    { label: "Sisipkan", tone: "amber", items: [
      ["Sisipkan tautan", Link2, () => showInsert("link"), active?.link],
      ["Lepas tautan", Unlink, () => editor.chain().focus().unsetLink().run()],
      ["Unggah gambar dalam isi", ImagePlus, () => showInsert("image")],
      ["Sisipkan tabel", Table2, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()],
      ["Kode", Code, () => editor.chain().focus().toggleCode().run(), active?.code],
      ["Blok kode", CodeXml, () => editor.chain().focus().toggleCodeBlock().run(), active?.codeBlock],
      ["Pemisah", Minus, () => editor.chain().focus().setHorizontalRule().run()],
      ...(active?.table ? [
        ["Tambah baris", Rows3, () => editor.chain().focus().addRowAfter().run()],
        ["Tambah kolom", Columns3, () => editor.chain().focus().addColumnAfter().run()],
        ["Hapus tabel", Trash2, () => editor.chain().focus().deleteTable().run()],
      ] as Tool[] : []),
    ] },
    { label: "Riwayat", tone: "rose", items: [
      ["Urungkan", Undo2, () => editor.chain().focus().undo().run()],
      ["Ulangi", Redo2, () => editor.chain().focus().redo().run()],
      ["Hapus format", X, () => editor.chain().focus().unsetAllMarks().clearNodes().run()],
    ] },
  ] : [];
  const fields = [{key:"title",label:"Judul berita",max:160},{key:"summary",label:"Ringkasan",max:320}] as const;
  const cover = meta.coverUrl;
  const accept = "image/jpeg,image/png,image/webp";
  return <form onSubmit={save} className={styles.form} aria-busy={pending}>
    <fieldset disabled={pending} className={styles.fieldset}>
    <input name="coverUrl" type="hidden" value={cover}/>
    <input name="revision" type="hidden" value={article?.revision ?? ""}/>
    <input name="id" type="hidden" value={article?.id ?? ""}/>
    <div className={styles.fields}>{fields.map(({key,label,max}) => <label key={key} className={key === "title" || key === "summary" ? styles.wide : ""}>{label}{key === "summary" ? <textarea name={key} rows={3} maxLength={max} value={meta[key]} onChange={event => setMeta({...meta,[key]:event.target.value})} /> : <input name={key} required={key === "title"} maxLength={max} value={meta[key]} onChange={event => setMeta({...meta,[key]:event.target.value})}/>}</label>)}</div>
    <div className={styles.media}>
      <div><h2 className="flex items-center gap-2 text-sm font-semibold"><ImagePlus className="size-4" aria-hidden/> Gambar sampul</h2>
        <p className="mb-2 text-xs">Pilih JPG, PNG, atau WebP · maks. {MAX_UPLOAD_SIZE_MB} MB</p>
        <Input type="file" accept={accept} aria-label="Unggah gambar sampul" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file, "cover"); }}/>
        {cover && <Button className="mt-2" variant="outline" type="button" onClick={() => setMeta({ ...meta, coverUrl: "" })}><Trash2 aria-hidden/> Hapus sampul</Button>}
      </div>
      {cover && <div className={styles.thumbnail}><CardCover url={cover} title={meta.title}/></div>}
    </div>
    <div className={styles.fields}>
      <label>Kategori<select name="categoryId" defaultValue={article?.categoryId ?? "default"} onChange={event => setMeta({...meta, category: categories.find(term => term.id === event.target.value)?.name ?? "Umum"})}>{categories.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
      <div><p className="mb-1 flex items-center gap-2 text-sm font-semibold"><Tags className="size-4" aria-hidden/> Tag <span className="font-normal text-muted-foreground">(maks. 20)</span></p><div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">{tags.map(term => <label key={term.id} className={styles.tag}><input type="checkbox" name="tagIds" value={term.id} defaultChecked={selectedTags.includes(term.id)} />{term.name}</label>)}{!tags.length && <p className="text-sm text-muted-foreground">Belum ada tag. Tambahkan dari menu Tag.</p>}</div></div>
    </div>
    <div className={styles.mode}><h2>{preview ? "Pratinjau berita" : "Isi berita"}</h2><Button type="button" variant="outline" disabled={!editor} onClick={() => { editor?.setEditable(preview); setPreview(!preview); setInsert(null); }}>{preview ? <Pencil aria-hidden/> : <Eye aria-hidden/>}{preview ? "Kembali menyunting" : "Pratinjau"}</Button></div>
    {preview && <div className={styles.preview}><p>{meta.category}</p><h3>{meta.title || "Judul belum diisi"}</h3><p>{meta.summary}</p>{cover && <CardCover url={cover} title={meta.title} />}</div>}
    {!preview && <TooltipProvider delay={250}><div className={styles.toolbar} role="group" aria-label="Format berita">{tools.map(group => <div key={group.label} role="group" aria-label={group.label} data-tone={group.tone} className={styles.toolGroup}>{group.items.map(([label, Icon, handler, value]) => <Tooltip key={label}><TooltipTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={label} aria-pressed={value} onMouseDown={event => event.preventDefault()} onClick={() => handler()} />}><Icon aria-hidden/></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>)}</div>)}</div></TooltipProvider>}
    {insert && <div className={styles.insert}>
      {insert === "link" ? <label>URL tautan HTTPS<Input type="url" value={insertUrl} onChange={event => setInsertUrl(event.target.value)} /></label> : <>
        <label>File gambar<Input type="file" accept={accept} onChange={event => setInlineFile(event.target.files?.[0])}/></label>
        <label>Deskripsi gambar<Input value={alt} maxLength={180} onChange={event => setAlt(event.target.value)}/></label>
      </>}
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={insert === "image" && (!inlineFile || !alt.trim())} onClick={() => insert === "link" ? insertLink() : inlineFile && void upload(inlineFile, "image")}>{insert === "image" ? <Upload aria-hidden/> : <Link2 aria-hidden/>}{insert === "image" ? "Unggah dan sisipkan" : "Sisipkan tautan"}</Button><Button type="button" variant="outline" onClick={() => setInsert(null)}><X aria-hidden/> Batal</Button></div>
    </div>}
    <EditorContent className={styles.content} editor={editor}/>
    <div className={styles.actions}><Button type="submit" variant="outline" value="draft" disabled={pending || !editor}><Save aria-hidden/>{article?.status === "published" ? "Tarik ke draf" : "Simpan draf"}</Button><Button type="submit" value="published" disabled={pending || !editor}><Send aria-hidden/>{article?.status === "published" ? "Perbarui terbitan" : "Terbitkan berita"}</Button></div>
    </fieldset>
    {pending && <p role="status">{uploading ? "Mengunggah gambar…" : "Menyimpan berita…"}</p>}
    {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}>{message.message}</p>}
  </form>;
}

function CardCover({url,title}:{url:string;title:string}) {
  // Direct browser request; never proxy or fetch arbitrary editor-supplied URLs on the server.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={title || "Gambar sampul"} referrerPolicy="no-referrer" />;
}
