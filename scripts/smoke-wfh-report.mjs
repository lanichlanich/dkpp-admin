import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import PizZip from "pizzip";

const db = new Database("data/admin.db");
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const users = [0, 1].map(() => ({ id: "wfh-report-test-" + randomUUID(), token: randomBytes(32).toString("hex") }));
const employee = db.prepare("SELECT nip,name,rank,position,unit FROM employees WHERE status='Aktif' AND length(nip)=18 AND position<>'' AND unit<>'' LIMIT 1").get();
assert(employee, "Active employee required");
const tasks = [
  ["08:00", "10:00", "Memeriksa kelengkapan data administrasi unit kerja.", "Daftar data yang perlu dilengkapi telah disusun."],
  ["10:00", "12:00", "Menyusun rekapitulasi dokumen kegiatan unit kerja.", "Rekapitulasi dokumen selesai diperbarui."],
  ["13:00", "14:00", "Mengoordinasikan tindak lanjut data melalui komunikasi daring.", "Catatan tindak lanjut hasil koordinasi tersedia."],
  ["14:00", "16:00", "Menyusun ringkasan pelaksanaan tugas harian.", "Draf laporan harian telah disusun."]
].map(([start,end,activity,output], i) => ({ start,end,activity,output,status: i === 3 ? 75 : 100 }));
const input = { nip: employee.nip, rank: employee.rank || "Penata / III/c", date: "2026-09-22", tasks, reviewed: true };
const post = (payload, user=users[0], endpoint="/api/wfh-reports/generate") => fetch(base+endpoint, { method:"POST", headers:{"Content-Type":"application/json", ...(user ? {Cookie:"admin_session="+user.token}: {})}, body: JSON.stringify(payload) });
let report;
try {
  for(const user of users) {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO users(id,name,username,email,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(user.id,"WFH Report Test",user.id,user.id+"@example.test","unused",now,now);
    db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").run(createHash("sha256").update(user.token).digest("hex"),user.id,new Date(Date.now()+600000).toISOString(),now);
  }
  assert.equal((await post(input,null)).status,401);
  for(const invalid of [{reviewed:false},{date:"2026-02-30"},{nip:"000000000000000000"},{tasks:tasks.slice(1)},{tasks:tasks.map((t,i)=> i===1 ? {...t,start:"09:00"}:t)},{tasks:tasks.map((t,i)=> i===0 ? {...t,status:101}:t)}]) assert.equal((await post({...input,...invalid})).status,422);
  const result = await post(input);
  report=await result.json();
  assert.equal(result.status,200, JSON.stringify(report));
  const url = base+report.downloadUrl;
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{Cookie:"admin_session="+users[1].token}})).status,404);
  const download = await fetch(url,{headers:{Cookie:"admin_session="+users[0].token}});
  assert.equal(download.status,200);
  const bytes=Buffer.from(await download.arrayBuffer());
  const output = new PizZip(bytes), source = new PizZip(readFileSync("src/templates/template-wfh-report.docx"));
  assert.deepEqual(Object.keys(output.files).sort(), Object.keys(source.files).sort());
  for(const name of Object.keys(source.files)) if(name!=="word/document.xml" && !source.files[name].dir) assert(source.file(name).asNodeBuffer().equals(output.file(name).asNodeBuffer()),"Preserved part changed: "+name);
  const xml=output.file("word/document.xml").asText();
  const text=[...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join("").replaceAll("&amp;","&").replaceAll("&lt;","<").replaceAll("&gt;",">");
  for(const expected of [employee.name,employee.nip,employee.position,employee.unit,"75%","Selasa","22-09-2026",...tasks.flatMap(t=>[t.activity,t.output])]) assert(text.includes(expected),"Missing value: "+expected);
  assert(!/<(?:aktivitas|output|nama_pegawai|nip|jabatan)/.test(text));
  const stored=db.prepare("SELECT * FROM wfh_reports WHERE id=? AND user_id=?").get(report.id,users[0].id);
  assert(stored);
  assert.equal(JSON.parse(stored.payload).tasks[3].status,75);
  assert(readFileSync(path.join("data/wfh-reports",report.id+".docx")).equals(bytes));
  const page=await fetch(base+"/dashboard/laporan-wfh",{headers:{Cookie:"admin_session="+users[0].token}});
  assert.equal(page.status,200);
  assert((await page.text()).includes(report.downloadUrl));
  mkdirSync(".tmp/wfh-report",{recursive:true});
  writeFileSync(".tmp/wfh-report/sample.docx",bytes);
  if(process.env.SMOKE_GEMINI_LIVE==="1") {
    const ai=await post({nip:input.nip,date:input.date},users[0],"/api/wfh-reports/suggest");
    const response=await ai.json();
    assert.equal(ai.status,200,JSON.stringify(response));
    assert.equal(response.tasks.length,4);
    assert(response.tasks.every(t=>t.activity && t.targetOutput && !("status" in t)));
    console.log("Live Gemini WFH suggestions passed: "+response.model);
  }
  console.log("WFH report: validation, authentication, ownership, archive, download and all preserved DOCX parts passed.");
} finally {
  for(const user of users) {
    const exists=db.prepare("SELECT 1 FROM sqlite_master WHERE name='wfh_reports'").get();
    if(exists) {
      for(const row of db.prepare("SELECT id FROM wfh_reports WHERE user_id=?").all(user.id)) rmSync(path.join("data/wfh-reports",row.id+".docx"),{force:true});
      db.prepare("DELETE FROM wfh_reports WHERE user_id=?").run(user.id);
    }
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    db.prepare("DELETE FROM users WHERE id=?").run(user.id);
  }
  db.close();
}
