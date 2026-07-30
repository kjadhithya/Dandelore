# Knowledge Vault — DC Script Part 2 (lines 654–1167)

Source: `/Users/kjadhithya/Downloads/storium_extracted/design_handoff_knowledge_vault/Knowledge Vault.dc.html`, lines 654 through EOF (1167).

## Category / Tag / Note-meta methods (lines 654–669)

```js
onCatSearchKey(e){ if(e.key==='Enter'){ const v=this.state.catQuery.trim(); if(!v)return; const exact=this.state.categories.find(c=>c.toLowerCase()===v.toLowerCase()); if(exact){ this.setCategory(exact); } else { this.addCategoryGlobal(v); this.setCategory(v); } } else if(e.key==='Escape'){ this.setState({catMenuOpen:false}); } }
catCreate(){ const v=this.state.catQuery.trim(); if(!v)return; this.addCategoryGlobal(v); this.setCategory(v); }
onNewCatKey(e){ if(e.key==='Enter'){ const v=e.target.value.trim(); if(v){ this.addCategoryGlobal(v); this.setCategory(v); } e.target.value=''; } }
addCategoryTop(e){ if(e.key==='Enter'){ const v=e.target.value.trim(); if(v)this.addCategoryGlobal(v); e.target.value=''; } }
onCatContext(e,name){ e.preventDefault(); e.stopPropagation(); const x=Math.min(e.clientX,window.innerWidth-180),y=Math.min(e.clientY,window.innerHeight-130); this.setState({catCtx:{name,x,y}}); }
closeCatCtx(){ this.setState({catCtx:null}); }
catCtxRename(){ const name=this.state.catCtx.name; this.setState({catCtx:null,catRenaming:name},()=>{const el=document.getElementById('catRenameInput');if(el){el.focus();try{el.select();}catch(_){}}}); }
catCtxDelete(){ const name=this.state.catCtx.name; this.setState(s=>({categories:s.categories.filter(c=>c!==name),notes:s.notes.map(n=>n.category===name?{...n,category:''}:n),catCtx:null})); }
renameCategory(oldN,newN){ newN=(newN||'').trim(); this.setState(s=>{ if(!newN||(s.categories.includes(newN)&&newN.toLowerCase()!==oldN.toLowerCase()))return {catRenaming:null}; return {categories:s.categories.map(c=>c===oldN?newN:c),notes:s.notes.map(n=>n.category===oldN?{...n,category:newN}:n),catRenaming:null}; }); }
onCatRenameKey(e,oldN){ if(e.key==='Enter'){e.target.blur();} else if(e.key==='Escape'){this.setState({catRenaming:null});} }
stopCatRename(e,oldN){ this.renameCategory(oldN,e.target.value); }
onTagDraft(e){ this.setState({tagDraft:e.target.value}); }
addTag(tag){ tag=tag.replace(/^#/,'').trim(); const id=this.curId(); if(!tag||!id)return; this.setState(s=>({notes:s.notes.map(n=>{ if(n.id!==id)return n; const t=n.tags||[]; return t.includes(tag)?n:{...n,tags:[...t,tag]}; }),tagDraft:''})); }
onTagKey(e){ if(e.key==='Enter'){ this.addTag(e.target.value); } }
removeNoteTag(id,tag){ this.setState(s=>({notes:s.notes.map(n=>n.id===id?{...n,tags:(n.tags||[]).filter(x=>x!==tag)}:n)})); }
onDate(e){ const v=e.target.value,id=this.curId(); this.setState(s=>({notes:s.notes.map(n=>n.id===id?{...n,date:v}:n)})); }
```

## Note menu, accent/theme, clipboard, undo/redo (lines 671–687)

```js
toggleNoteMenu(){ this.setState(s=>({noteMenuOpen:!s.noteMenuOpen,noteMenuMove:false})); }
menuDuplicate(){ const id=this.curId(); this.setState({noteMenuOpen:false}); if(id)this.duplicateNote(id); }
menuMoveStart(){ this.setState({noteMenuMove:true}); }
menuMoveTo(folder){ const id=this.curId(); this.setState(s=>({notes:s.notes.map(n=>n.id===id?{...n,folder}:n),noteMenuOpen:false,noteMenuMove:false})); }
setAccent(hex){ this.setState({accentOverride:hex}); try{ localStorage.setItem('kv-accent',hex); }catch(_){} }
onAccent(e){ const hex=e.target.value; this.setState({accentOverride:hex}); try{ localStorage.setItem('kv-accent',hex); }catch(_){} }
openSettings(){ this.setState({settingsOpen:true}); }
closeSettings(){ this.setState({settingsOpen:false}); }
_copyText(text){
  let ok=false;
  try{ const ta=document.createElement('textarea'); ta.value=text; ta.style.cssText='position:fixed;top:-1000px;left:-1000px;opacity:0;'; document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0,text.length); ok=document.execCommand('copy'); document.body.removeChild(ta); }catch(_){}
  if(!ok && navigator.clipboard && navigator.clipboard.writeText){ try{ navigator.clipboard.writeText(text); }catch(_){} }
}
setTheme(t){ this.setState({themeOverride:t}); try{ localStorage.setItem('kv-theme',t); }catch(_){} }
pushUndo(id,content){ if(!id)return; this._undo=this._undo||{}; const u=this._undo[id]=this._undo[id]||{stack:[],redo:[],t:0}; const now=Date.now(); if(u.stack.length&&u.stack[u.stack.length-1]===content)return; if(u.stack.length&&now-u.t<450){ u.t=now; return; } u.stack.push(content); if(u.stack.length>100)u.stack.shift(); u.redo=[]; u.t=now; }
undo(){ const id=this._edNoteId||this.curId(); if(!id)return; const u=this._undo&&this._undo[id]; if(!u||!u.stack.length)return; const n=this.state.notes.find(x=>x.id===id); if(!n)return; u.redo.push(n.content); const prev=u.stack.pop(); this.setState(s=>({notes:s.notes.map(x=>x.id===id?{...x,content:prev}:x)}),()=>{ const nn=this.state.notes.find(x=>x.id===id); if(nn&&this._ed&&this._edNoteId===id)this.renderEditorFull(nn,this._edMode); }); }
redo(){ const id=this._edNoteId||this.curId(); if(!id)return; const u=this._undo&&this._undo[id]; if(!u||!u.redo.length)return; const n=this.state.notes.find(x=>x.id===id); if(!n)return; u.stack.push(n.content); const next=u.redo.pop(); this.setState(s=>({notes:s.notes.map(x=>x.id===id?{...x,content:next}:x)}),()=>{ const nn=this.state.notes.find(x=>x.id===id); if(nn&&this._ed&&this._edNoteId===id)this.renderEditorFull(nn,this._edMode); }); }
```

Note: `undo`/`redo` operate on a per-note stack keyed on `this._undo[id]={stack:[],redo:[],t:0}`. `pushUndo` dedupes consecutive identical pushes and coalesces rapid edits within 450ms into a single undo step (updates `u.t` but doesn't push). Stack capped at 100 entries.

## Multiselect & bulk actions (lines 688–701)

```js
toggleSelect(id,e){ if(e)e.stopPropagation(); this.setState(s=>{ const has=s.selectedIds.includes(id); return {selectedIds:has?s.selectedIds.filter(x=>x!==id):[...s.selectedIds,id],selectAnchor:id}; }); }
clearSelection(){ this.setState({selectedIds:[],selectAnchor:null}); }
rowClick(id,e){
  if(e&&(e.metaKey||e.ctrlKey)){ e.preventDefault(); this.toggleSelect(id,e); return; }
  if(e&&e.shiftKey&&this.state.selectAnchor){ e.preventDefault(); const order=this._visibleOrder||[id]; const a=order.indexOf(this.state.selectAnchor), b=order.indexOf(id); if(a===-1||b===-1){ this.toggleSelect(id,e); return; } const lo=Math.min(a,b),hi=Math.max(a,b); this.setState({selectedIds:order.slice(lo,hi+1)}); return; }
  if(this.state.selectedIds.length){ this.setState({selectedIds:[],selectAnchor:id}); }
  this.navigate(id);
}
openBulkCtx(e){ const x=Math.min(e.clientX,window.innerWidth-230); const y=Math.min(e.clientY,window.innerHeight-220); this.setState({bulkCtx:{x,y,move:false}}); }
closeBulkCtx(){ this.setState({bulkCtx:null}); }
bulkCtxMoveStart(){ this.setState(s=>({bulkCtx:{...s.bulkCtx,move:true}})); }
bulkNewFolder(){ const ids=this.state.selectedIds; let base='New Folder',name=base,i=2; while(this.state.folderList.includes(name)){name=base+' '+i;i++;} this.setState(s=>({folderList:[...s.folderList,name],expanded:{...s.expanded,[name]:true},notes:s.notes.map(n=>ids.includes(n.id)?{...n,folder:name}:n),bulkCtx:null,selectedIds:[],folderRenaming:name,folderRenameDraft:name}),()=>{ const el=document.getElementById('folderRenameInput'); if(el){el.focus(); try{el.select();}catch(_){}}}); }
bulkMoveTo(folder){ const ids=this.state.selectedIds; this.setState(s=>({notes:s.notes.map(n=>ids.includes(n.id)?{...n,folder}:n),bulkCtx:null,selectedIds:[]})); }
bulkDelete(){ const ids=new Set(this.state.selectedIds); this.setState(s=>{ const notes=s.notes.filter(n=>!ids.has(n.id)); const tabs=s.tabs.map(t=>{ const hist=t.hist.filter(v=>!(v.kind==='note'&&ids.has(v.id))); if(!hist.length)return this.mkTab({kind:'home'}); return {hist,hi:Math.min(t.hi,hist.length-1)}; }); let split=s.split; if(split){ const st=split.tabs.map(t=>({hist:t.hist.filter(v=>!(v.kind==='note'&&ids.has(v.id))),hi:0})).filter(t=>t.hist.length); split=st.length?{...split,tabs:st,active:Math.min(split.active,st.length-1)}:null; } return {notes,tabs,split,selectedIds:[],bulkCtx:null}; }); }
onAppFont(e){ this.setState({appFont:e.target.value}); }
onNoteFont(e){ this.setState({noteFont:e.target.value}); }
```

Selection logic: Cmd/Ctrl+click toggles a single id in `selectedIds` and sets `selectAnchor`. Shift+click computes a contiguous range using `this._visibleOrder` (built during `renderVals()` as notes are laid out in the sidebar tree) between the anchor and the clicked id. Plain click with an existing selection clears it and resets anchor. `openBulkCtx`/`bulkCtx` state (`{x,y,move}`) drives the bulk context menu: `bulkNewFolder` creates a uniquely-named "New Folder" (appending " 2", " 3"...) and moves selected notes into it, opening a rename input; `bulkMoveTo` moves selected notes to an existing folder; `bulkDelete` removes selected notes plus prunes any tab/split history entries referencing them (falling back to a home tab if a tab's history becomes empty).

## Import / Export / Attachments (lines 705–711)

```js
triggerImport(){ const el=document.getElementById('importInput'); if(el)el.click(); }
onImport(e){ const files=[...e.target.files]; if(!files.length)return; let pending=files.length; const created=[]; files.forEach(f=>{ const r=new FileReader(); r.onload=()=>{ const id='n'+Date.now()+Math.random().toString(36).slice(2,6); const title=f.name.replace(/\.(md|markdown|txt)$/i,''); created.push({id,title,folder:'Notes',date:TODAY,modified:new Date().toISOString(),category:'',tags:[],attachments:{},content:String(r.result)}); if(--pending===0)this.setState(s=>({notes:[...s.notes,...created],settingsOpen:false}),()=>this.navigate(created[0].id)); }; r.readAsText(f); }); e.target.value=''; }
triggerAttach(){ if(!this.curId())return; const el=document.getElementById('attachInput'); if(el)el.click(); }
onAttach(e){ const files=[...e.target.files]; const id=this.curId(); if(!files.length||!id){e.target.value='';return;} let pending=files.length; const add={}; const inserts=[]; files.forEach(f=>{ const r=new FileReader(); r.onload=()=>{ add[f.name]={url:String(r.result),type:f.type||'',w:'100%'}; inserts.push('![['+f.name+']]'); if(--pending===0)this.setState(s=>({notes:s.notes.map(n=>n.id!==id?n:{...n,attachments:{...(n.attachments||{}),...add},content:n.content.replace(/\s*$/,'')+'\n\n'+inserts.join('\n\n')+'\n'}),noteMenuOpen:false})); }; r.readAsDataURL(f); }); e.target.value=''; }
download(name,text,type){ try{ const blob=new Blob([text],{type:type||'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }catch(err){} }
exportJson(){ const data={vault:'My Vault',exportedAt:new Date().toISOString(),folders:this.state.folderList,categories:this.state.categories,notes:this.state.notes}; this.download('my-vault.json',JSON.stringify(data,null,2),'application/json'); this.setState({settingsOpen:false,noteMenuOpen:false}); }
exportNote(){ const n=this.cur(); if(n)this.download((n.title||'note')+'.md',n.content,'text/markdown'); this.setState({noteMenuOpen:false}); }
```

Import: reads each dropped/selected file as text (`FileReader.readAsText`), strips `.md`/`.markdown`/`.txt` extension for the title, and creates a new note per file (default folder `'Notes'`, `date: TODAY`, empty tags/category/attachments). Waits for all `pending` reads to finish before appending and navigating to the first created note.

Attachments: read via `FileReader.readAsDataURL` (base64 data-URI, in-memory only — no blob storage/server upload). Each attachment is stored on the note as `note.attachments[fileName] = {url, type, w:'100%'}` and an embed reference `![[fileName]]` is appended to the note content for every attached file. `exportJson` downloads the whole vault (folders, categories, notes) as pretty-printed JSON; `exportNote` downloads the current note's raw markdown content as a `.md` file.

## Live Markdown Editor Engine (lines 713–853)

### ensureEditor / dual-pane context management

```js
/* ---------- live editor (dual-pane) ---------- */
ensureEditor(){
  this._mainCtx=this._mainCtx||{key:'main'};
  const v=this.curView(); const mnote=(v&&v.kind==='note')?this.cur():null;
  this._ensurePane(this._mainCtx, this.hostRef.current, mnote, this.state.reading);
  const sp=this.state.split; const sid=this.splitCurId(); const snote=sp&&sid?this.state.notes.find(n=>n.id===sid):null;
  if(sp&&snote){ this._splitCtx=this._splitCtx||{key:'split'}; this._ensurePane(this._splitCtx, this.splitRenderRef.current, snote, this.state.splitReading); }
  else { this._splitCtx=null; }
  if(!this._curCtx||!this._curCtx.ed){ if(this._mainCtx.ed)this._useCtx(this._mainCtx); }
}
_useCtx(ctx){ if(!ctx)return; if(this._curCtx===ctx){ this._ed=ctx.ed; this._edNoteId=ctx.noteId; this._edMode=ctx.mode; return; } if(this._curCtx)this._curCtx.active=this._active; this._curCtx=ctx; this._ed=ctx.ed; this._edNoteId=ctx.noteId; this._edMode=ctx.mode; this._active=ctx.active; }
_ensurePane(ctx, host, note, reading){
  if(!host){ ctx.ed=null; ctx.host=null; ctx.noteId=null; return; }
  if(!note){ if(ctx.host===host&&host)host.innerHTML=''; ctx.ed=null; ctx.host=null; ctx.noteId=null; return; }
  if(host!==ctx.host){ host.innerHTML=''; const ed=document.createElement('div'); ed.className='liveedit'; ed.style.minHeight='300px'; ed.style.whiteSpace='pre-wrap'; ed.setAttribute('spellcheck','false'); host.appendChild(ed); ctx.ed=ed; ctx.host=host; ctx.noteId=null; ctx.active=null; this._attachEditor(ed,ctx); }
  const mode=reading?'read':'edit'; const fsz=(this.props.editorFontSize||14); const fsig=this.state.noteFont+'|'+fsz;
  if(ctx.noteId!==note.id || ctx.mode!==mode || ctx.fsig!==fsig){
    ctx.ed.style.fontFamily=FONTS[this.state.noteFont]||FONTS.Serif; ctx.ed.style.fontSize=(fsz+1)+'px'; ctx.ed.style.color='var(--ink)';
    const p=[this._ed,this._edNoteId,this._edMode,this._active,this._curCtx];
    this._ed=ctx.ed; this._edNoteId=note.id; this._edMode=mode; this._active=null;
    this.renderEditorFull(note,mode);
    ctx.active=this._active; ctx.noteId=note.id; ctx.mode=mode; ctx.fsig=fsig;
    if(p[4]&&p[4]!==ctx){ this._ed=p[0]; this._edNoteId=p[1]; this._edMode=p[2]; this._active=p[3]; } else { this._curCtx=ctx; }
  }
}
_attachEditor(ed,ctx){
  ed.addEventListener('input',(e)=>{ this._useCtx(ctx); this.onEdInput(e); });
  ed.addEventListener('keydown',(e)=>{ this._useCtx(ctx); this.onEdKeydown(e); });
  ed.addEventListener('keyup',()=>{ this._useCtx(ctx); this.updateActive(); });
  ed.addEventListener('mouseup',()=>{ this._useCtx(ctx); this.updateActive(); this.detectLink(); });
  ed.addEventListener('focus',()=>{ this._useCtx(ctx); });
  ed.addEventListener('click',(e)=>{ this._useCtx(ctx); this.onEdClick(e); });
  ed.addEventListener('compositionend',()=>{ this._useCtx(ctx); this.rebuildAll(); this.commitLive(); });
}
```

There are two "panes" (`_mainCtx` keyed `'main'`, `_splitCtx` keyed `'split'`), each with its own `{ed, host, noteId, mode, fsig, active}`. `_useCtx` switches the "currently focused" editor context (`this._ed`, `this._edNoteId`, `this._edMode`, `this._active`) to whichever pane last fired an event, saving off the previous context's active line. `_ensurePane` lazily creates the contenteditable `div.liveedit` host, and re-renders full content (`renderEditorFull`) whenever the note id, reading/edit mode, or font signature (`noteFont|fontSize`) changes.

### Full render / per-line render / inline parsing

```js
renderEditorFull(note,mode){
  const ed=this._ed; if(!ed)return;
  if(mode==='read'){ ed.contentEditable='false'; ed.style.whiteSpace='normal'; ed.className='liveedit readview'; ed.innerHTML=this.md2html(note.content, note.attachments||{},0); this.decorateReading(note); return; }
  ed.className='liveedit'; ed.contentEditable='true'; ed.style.whiteSpace='pre-wrap'; ed.innerHTML='';
  const lines=note.content.split('\n'); (lines.length?lines:['']).forEach(ln=>ed.appendChild(this.makeLine(ln)));
  this._active=null; this.decorateBlocks();
}
makeLine(text){ const d=document.createElement('div'); const r=this.renderLineLive(text); d.className=r.cls; d.innerHTML=r.html; return d; }
updateLine(div,text){ const wasActive=div.classList.contains('active'); const r=this.renderLineLive(text); div.className=r.cls+(wasActive?' active':''); div.innerHTML=r.html; }
renderLineLive(text){
  if(text==='') return {cls:'ln p', html:'<br>'};
  let m;
  if(/^```/.test(text)) return {cls:'ln fence', html:esc(text)||'<br>'};
  if((m=text.match(/^(#{1,6})(\s+)(.*)$/))) return {cls:'ln h'+m[1].length, html:'<span class="m">'+esc(m[1]+m[2])+'</span>'+this.inlineLive(m[3])};
  if((m=text.match(/^(\s*>\s?)(.*)$/))) return {cls:'ln bq', html:'<span class="m">'+esc(m[1])+'</span>'+this.inlineLive(m[2])};
  if((m=text.match(/^(\s*[-*]\s+\[( |x|X)\]\s?)(.*)$/))) return {cls:'ln task'+(m[2].toLowerCase()==='x'?' done':''), html:'<span class="m">'+esc(m[1])+'</span><span class="bt">'+this.inlineLive(m[3])+'</span>'};
  if((m=text.match(/^(\s*[-*]\s+)(.*)$/))) return {cls:'ln bullet', html:'<span class="m">'+esc(m[1])+'</span>'+this.inlineLive(m[2])};
  if((m=text.match(/^(\s*\d+\.\s+)(.*)$/))) return {cls:'ln ol', html:'<span style="color:var(--muted);">'+esc(m[1])+'</span>'+this.inlineLive(m[2])};
  if(/^(---|\*\*\*|___)\s*$/.test(text)) return {cls:'ln hr', html:esc(text)};
  return {cls:'ln p', html:this.inlineLive(text)};
}
inlineLive(s){
  s=esc(s);
  s=s.replace(/`([^`]+)`/g,'<span class="m">`</span><code class="ic">$1</code><span class="m">`</span>');
  s=s.replace(/!\[\[([^\]]+)\]\]/g,(mm,x)=>'<span class="m">![[</span><span class="wl">'+x+'</span><span class="m">]]</span>');
  s=s.replace(/\[\[([^\]]+)\]\]/g,(mm,x)=>{ const cls=this.byTitle(x.trim())?'wl':'wl missing'; return '<span class="m">[[</span><a class="'+cls+'" data-wikilink="'+escAttr(x.trim())+'">'+x+'</a><span class="m">]]</span>'; });
  s=s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<span class="m">[</span><a class="exlink" data-ext="1" href="$2">$1</a><span class="m">]($2)</span>');
  s=s.replace(/\*\*([^*]+)\*\*/g,'<span class="m">**</span><strong>$1</strong><span class="m">**</span>');
  s=s.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<span class="m">*</span><em>$2</em><span class="m">*</span>');
  s=s.replace(/(^|\s)#([a-z0-9][\w\/-]*)/gi,'$1<span class="tag" data-tag="$2">#$2</span>');
  return s;
}
```

**Line classification order** (first match wins), each producing `{cls, html}`:
1. Empty string → `cls:'ln p'`, `html:'<br>'`
2. Fenced code delimiter `` ^``` `` → `cls:'ln fence'` (raw escaped text, no inline parsing)
3. Heading `^(#{1,6})(\s+)(.*)$` → `cls:'ln h'+level` (1–6), marker span + `inlineLive` on body
4. Blockquote `^(\s*>\s?)(.*)$` → `cls:'ln bq'`
5. Task list item `^(\s*[-*]\s+\[( |x|X)\]\s?)(.*)$` → `cls:'ln task'` (+ `' done'` if checked `x`/`X`), body wrapped in `<span class="bt">`
6. Bullet `^(\s*[-*]\s+)(.*)$` → `cls:'ln bullet'`
7. Ordered list `^(\s*\d+\.\s+)(.*)$` → `cls:'ln ol'` (marker rendered in muted color, not `<span class="m">`)
8. Horizontal rule `^(---|\*\*\*|___)\s*$` → `cls:'ln hr'`
9. Fallback → `cls:'ln p'` with `inlineLive`

**Inline parsing (`inlineLive`, in this exact order)**: escape HTML first, then: inline code `` `code` `` (wrapped with muted marker spans + `<code class="ic">`), embed wikilink `![[x]]` (marker spans + `<span class="wl">`), wikilink `[[x]]` — resolved via `this.byTitle(x.trim())`: if found, class `wl`; if not found, class `wl missing` (this is the "missing note" styling hook), rendered as `<a data-wikilink="...">`; external markdown link `[text](url)` → `<a class="exlink" data-ext="1" href="url">`; bold `**text**` → marker spans + `<strong>`; italic `*text*` (regex `(^|[^*])\*([^*\n]+)\*` — avoids matching inside `**bold**` by requiring the char before `*` not be `*`) → marker spans + `<em>`; `#tags` (regex `(^|\s)#([a-z0-9][\w\/-]*)`, case-insensitive) → `<span class="tag" data-tag="...">#...</span>`.

### Serialization, caret/cursor position, active-line tracking

```js
serialize(){ const ed=this._ed; if(!ed)return ''; const parts=[]; ed.childNodes.forEach(n=>{ if(n.nodeType===3)parts.push(n.data); else if(n.nodeType===1){ if(n.classList&&n.classList.contains('blockdeco'))return; if(n.tagName==='BR')parts.push(''); else parts.push(n.textContent); } }); return parts.join('\n'); }
lineDivOf(node){ const ed=this._ed; if(!node)return null; if(node===ed){ const idx=Math.min(node.childNodes.length-1, Math.max(0,0)); return ed.children[0]||null; } let n=node; while(n&&n.parentNode!==ed) n=n.parentNode; return n; }
caretInfo(){ const ed=this._ed; const sel=window.getSelection(); if(!sel||!sel.rangeCount)return null; const rng=sel.getRangeAt(0); if(!ed.contains(rng.startContainer))return null; let line=rng.startContainer; if(line===ed){ line=ed.children[rng.startOffset]||ed.children[ed.children.length-1]; return {line,idx:[].indexOf.call(ed.children,line),col:0}; } while(line&&line.parentNode!==ed) line=line.parentNode; if(!line)return null; const col=this.colOf(line,rng.startContainer,rng.startOffset); return {line,idx:[].indexOf.call(ed.children,line),col}; }
colOf(line,node,offset){ if(node===line){ let c=0; for(let i=0;i<offset&&i<line.childNodes.length;i++)c+=(line.childNodes[i].textContent||'').length; return c; } const walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT,null); let c=0,tn; while((tn=walker.nextNode())){ if(tn===node)return c+offset; c+=tn.data.length; } return c; }
setCol(line,col){ const sel=window.getSelection(); const rng=document.createRange(); const walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT,null); let c=0,tn,last=null; while((tn=walker.nextNode())){ last=tn; if(c+tn.data.length>=col){ rng.setStart(tn,Math.max(0,col-c)); rng.collapse(true); sel.removeAllRanges(); sel.addRange(rng); return; } c+=tn.data.length; } if(last){ rng.setStart(last,last.data.length); } else { rng.setStart(line,0); } rng.collapse(true); sel.removeAllRanges(); sel.addRange(rng); }
setActive(line){ const ed=this._ed; if(this._active&&this._active!==line)this._active.classList.remove('active'); if(line)line.classList.add('active'); this._active=line; }
updateActive(){ const ci=this.caretInfo(); if(ci&&ci.line!==this._active)this.setActive(ci.line); this.detectLink(); this.decorateBlocks(); }
```

`serialize()` walks `ed.childNodes` (each is a line `<div>`), skipping any `.blockdeco` overlay nodes, joining `textContent` (or `''` for a bare `<br>`) with `\n` to reconstruct the raw markdown string. `caretInfo()` returns `{line, idx, col}` using `colOf`/a `TreeWalker` over text nodes to compute a flat character column within the line; `setCol` reverses this to place the DOM selection. `setActive`/`updateActive` toggle a CSS `active` class on the current line div (used to render raw markdown markers on the focused line, and suppress block-decoration overlays on it — see `decorateBlocks`).

### Input, rebuild, commit, insertion, keydown handling

```js
onEdInput(e){ if(e&&e.isComposing)return; const it=e&&e.inputType||''; if(it==='insertFromPaste'||it==='insertFromDrop'){ this.rebuildAll(); this.commitLive(); this.detectLink(); return; } const ci=this.caretInfo(); if(!ci){ this.commitLive(); return; } this.updateLine(ci.line, ci.line.textContent); if(ci.line.previousElementSibling){ const p=ci.line.previousElementSibling; this.updateLine(p,p.textContent); } this.setActive(ci.line); this.setCol(ci.line,ci.col); this.maybeAutocloseFence(ci.line); this.commitLive(); this.detectLink(); }
rebuildAll(){ const ci=this.caretInfo(); const content=this.serialize(); const ed=this._ed; ed.innerHTML=''; (content.split('\n')).forEach(ln=>ed.appendChild(this.makeLine(ln))); if(ci){ const line=ed.children[Math.min(ci.idx,ed.children.length-1)]; if(line){ this.setActive(line); this.setCol(line,ci.col); } } this.decorateBlocks(); }
commitLive(){ if(this._edMode==='read')return; const content=this.serialize(); const id=this._edNoteId; if(!id)return; const old=this.state.notes.find(n=>n.id===id); if(old&&old.content!==content)this.pushUndo(id,old.content); this._edSuppress=true; this.setState(s=>({notes:s.notes.map(n=>n.id===id?{...n,content,modified:new Date().toISOString()}:n)})); }
insertText(line,col,ins,caretAfter){ const text=line.textContent; const nt=text.slice(0,col)+ins+text.slice(col); this.updateLine(line,nt); this.setActive(line); this.setCol(line,caretAfter); this.commitLive(); }
insertNewLine(ci,prefix){ const line=ci.line; const text=line.textContent; const before=text.slice(0,ci.col); const after=prefix+text.slice(ci.col); this.updateLine(line,before); const nl=this.makeLine(after); if(line.nextSibling)this._ed.insertBefore(nl,line.nextSibling); else this._ed.appendChild(nl); this.setActive(nl); this.setCol(nl,prefix.length); this.commitLive(); }
onEdKeydown(e){
  if((e.metaKey||e.ctrlKey)&&(e.key==='z'||e.key==='Z')){ e.preventDefault(); if(e.shiftKey)this.redo(); else this.undo(); return; }
  if((e.metaKey||e.ctrlKey)&&(e.key==='y'||e.key==='Y')){ e.preventDefault(); this.redo(); return; }
  if(this.state.linkQuery!=null||this.state.tagAcQuery!=null){ if(e.key==='Escape'){ e.preventDefault(); this.setState({linkQuery:null,tagAcQuery:null}); return; } if(e.key==='Enter'){ const sug=this._acSug||[]; if(sug.length){ e.preventDefault(); const idx=Math.min(this.state.linkActiveIdx,sug.length-1); if(this.state.linkQuery!=null)this.pickLink(sug[idx]); else this.pickTag(sug[idx]); return; } } if(e.key==='ArrowDown'){ e.preventDefault(); this.setState(s=>({linkActiveIdx:Math.min((this._acSug||[]).length-1,s.linkActiveIdx+1)})); return; } if(e.key==='ArrowUp'){ e.preventDefault(); this.setState(s=>({linkActiveIdx:Math.max(0,s.linkActiveIdx-1)})); return; } }
  if(e.key==='Enter'&&!e.shiftKey&&this.state.linkQuery==null){ const ci=this.caretInfo(); if(ci){ const text=ci.line.textContent; let m;
    if((m=text.match(/^(\s*>\s?)(.*)$/))){ e.preventDefault(); if(m[2].trim()===''){ this.updateLine(ci.line,''); this.setActive(ci.line); this.setCol(ci.line,0); this.commitLive(); } else { this.insertNewLine(ci,'> '); } return; }
    if((m=text.match(/^(\s*)([-*])\s+(\[( |x|X)\]\s?)?(.*)$/))){ e.preventDefault(); if(m[5].trim()===''){ this.updateLine(ci.line,''); this.setActive(ci.line); this.setCol(ci.line,0); this.commitLive(); } else { this.insertNewLine(ci, m[1]+m[2]+' '+(m[3]?'[ ] ':'')); } return; }
    if((m=text.match(/^(\s*)(\d+)\.\s+(.*)$/))){ e.preventDefault(); if(m[3].trim()===''){ this.updateLine(ci.line,''); this.setActive(ci.line); this.setCol(ci.line,0); this.commitLive(); } else { this.insertNewLine(ci, m[1]+(parseInt(m[2],10)+1)+'. '); } return; }
    e.preventDefault(); this.insertNewLine(ci,''); return; } }
  if(e.key==='['){ const sel=window.getSelection(); const ci=this.caretInfo(); if(!ci)return; if(sel&&!sel.isCollapsed){ const rng=sel.getRangeAt(0); if(rng.startContainer&&this._ed.contains(rng.startContainer)){ let l1=rng.startContainer; while(l1&&l1.parentNode!==this._ed)l1=l1.parentNode; let l2=rng.endContainer; while(l2&&l2.parentNode!==this._ed)l2=l2.parentNode; if(l1===l2&&l1){ e.preventDefault(); const a=this.colOf(l1,rng.startContainer,rng.startOffset); const b=this.colOf(l1,rng.endContainer,rng.endOffset); const lo=Math.min(a,b),hi=Math.max(a,b); const text=l1.textContent; const nt=text.slice(0,lo)+'[['+text.slice(lo,hi)+']]'+text.slice(hi); this.updateLine(l1,nt); this.setActive(l1); this.setCol(l1,hi+4); this.commitLive(); setTimeout(()=>this.detectLink(),0); return; } } } else { const text=ci.line.textContent; if(text[ci.col-1]==='['){ e.preventDefault(); this.insertText(ci.line,ci.col,'[]]',ci.col+1); setTimeout(()=>this.detectLink(),0); return; } } }
}
```

Key behaviors: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y = redo. When the wikilink/tag autosuggest popup is open (`linkQuery`/`tagAcQuery` non-null), Escape closes it, Enter picks the highlighted suggestion (`pickLink`/`pickTag`), Arrow Up/Down move `linkActiveIdx`. Enter (no shift, no autosuggest open) has list-continuation logic: inside a blockquote, bullet/task, or ordered list — if the line's content after the marker is empty, it clears the line (exits the list); otherwise it inserts a new line continuing the same prefix (`'> '` for blockquote, `marker + ' ' + '[ ] '` for task/bullet, incremented `N+1+'. '` for ordered lists). Typing `[` with a selection spanning a single line auto-wraps the selection in `[[...]]`; typing `[` right after an existing `[` (i.e., typing `[[`) auto-inserts the closing `]]` via `insertText(..., '[]]', ...)`.

### Wikilink / tag autosuggest positioning and detection

```js
caretScreenPos(){
  const sel=window.getSelection();
  if(sel&&sel.rangeCount){ const rng=sel.getRangeAt(0).cloneRange(); rng.collapse(true); let rect=rng.getClientRects()[0]||rng.getBoundingClientRect(); if(rect&&(rect.width||rect.height||rect.top||rect.left)) return {x:rect.left,y:rect.bottom+6}; }
  const ci=this.caretInfo(); if(ci&&ci.line){ const r=ci.line.getBoundingClientRect(); return {x:r.left,y:r.bottom+6}; }
  return {x:100,y:100};
}
detectLink(){
  const ed=this._ed; if(!ed||this._edMode==='read'){ if(this.state.linkQuery!=null||this.state.tagAcQuery!=null)this.setState({linkQuery:null,tagAcQuery:null}); return; }
  const ci=this.caretInfo();
  if(!ci){ if(this.state.linkQuery!=null||this.state.tagAcQuery!=null)this.setState({linkQuery:null,tagAcQuery:null}); return; }
  const text=ci.line.textContent; const before=text.slice(0,ci.col);
  const lastOpen=before.lastIndexOf('[[');
  if(lastOpen!==-1){ const between=before.slice(lastOpen+2);
    if(!/\]\]/.test(between)&&!between.includes('[[')){
      this._acLine=ci.line; this._acCol=ci.col; this._acQ=between;
      const pos=this.caretScreenPos();
      this.setState({linkQuery:between,tagAcQuery:null,linkPos:pos,linkActiveIdx:0});
      return;
    }
  }
  const tagMatch=before.match(/(^|\s)#([\w\/-]*)$/);
  if(tagMatch){
    this._acLine=ci.line; this._acCol=ci.col; this._acQ=tagMatch[2];
    const pos=this.caretScreenPos();
    this.setState({tagAcQuery:tagMatch[2],linkQuery:null,linkPos:pos,linkActiveIdx:0});
    return;
  }
  if(this.state.linkQuery!=null||this.state.tagAcQuery!=null)this.setState({linkQuery:null,tagAcQuery:null});
}
pickTag(name){ const line=this._acLine,col=this._acCol,q=this._acQ||''; if(!line){ this.setState({tagAcQuery:null}); return; } const text=line.textContent; const hashIdx=col-q.length-1; const before=text.slice(0,hashIdx); const after=text.slice(col); const nt=before+'#'+name+after; const caret=before.length+1+name.length; this.setState({tagAcQuery:null},()=>{ this.updateLine(line,nt); this.setActive(line); this.setCol(line,caret); this._ed.focus(); this.commitLive(); }); }
pickLink(title){ const line=this._acLine,col=this._acCol,q=this._acQ||''; if(!line){ this.setState({linkQuery:null}); return; } const text=line.textContent; let before=text.slice(0,col-q.length); let after=text.slice(col); if(after.slice(0,2)===']]')after=after.slice(2); if(before.slice(-2)!=='[[')before=text.slice(0,col-q.length); const nt=before+title+']]'+after; const caret=before.length+title.length+2; this.setState({linkQuery:null},()=>{ this.updateLine(line,nt); this.setActive(line); this.setCol(line,caret); this._ed.focus(); this.commitLive(); }); }
onEdClick(e){ const reading=this._edMode==='read'; let t=e.target;
  const cb=t.closest&&t.closest('input[data-task]'); if(cb){ if(reading){ e.preventDefault(); this.toggleTask(parseInt(cb.getAttribute('data-task'),10)); } return; }
  const tg=t.closest&&t.closest('[data-tag]'); if(tg){ e.preventDefault(); this.openSearch('tag:'+tg.getAttribute('data-tag')); return; }
  const wl=t.closest&&t.closest('[data-wikilink]'); if(wl){ e.preventDefault(); this.openOrCreate(wl.getAttribute('data-wikilink')); return; }
  const ex=t.closest&&t.closest('[data-ext]'); if(ex){ if(reading||e.metaKey||e.ctrlKey){ e.preventDefault(); const h=ex.getAttribute('href'); if(h)window.open(h,'_blank'); } return; }
}
toggleTask(idx){ const id=this.curId(); const note=this.cur(); if(!note)return; let cnt=-1; const lines=note.content.split('\n').map(l=>{ const m=l.match(/^(\s*[-*]\s+)\[( |x|X)\]/); if(m){cnt++; if(cnt===idx){ const d=m[2].toLowerCase()==='x'; return l.replace(/\[( |x|X)\]/,'['+(d?' ':'x')+']'); }} return l; }); const v=lines.join('\n'); this.setState(s=>({notes:s.notes.map(n=>n.id===id?{...n,content:v}:n)}),()=>{ this._edNoteId=null; this.ensureEditor(); }); }
```

Popup positioning uses `caretScreenPos()` — prefers `Range.getClientRects()[0]` of the collapsed selection, falling back to the active line's bounding rect, offset `+6px` below (`linkPos:{x,y}`, rendered via `acPopStyle` — `position:fixed;left:...;top:...`). Detection (`detectLink`) is driven off the caret's text-before-cursor on the current line: finds the last unclosed `[[` (no `]]` and no nested `[[` in between) to open the wikilink popup (`linkQuery`), else matches trailing `#word` via `/(^|\s)#([\w\/-]*)$/` to open the tag popup (`tagAcQuery`). Both close if neither pattern matches. Selection resets `linkActiveIdx:0` each time. `pickTag`/`pickLink` splice the chosen value back into the line text at the recorded `_acLine/_acCol/_acQ` position and refocus/commit.

### Fenced-code autoclose

```js
maybeAutocloseFence(line){ const t=line.textContent; if(!/^```[a-zA-Z0-9+#.\-]*$/.test(t))return; let before=0,p=line.previousElementSibling; while(p){ if(p.classList&&p.classList.contains('ln')&&/^```/.test(p.textContent))before++; p=p.previousElementSibling; } if(before%2!==0)return; let closed=false,n=line.nextElementSibling; while(n){ if(n.classList&&n.classList.contains('ln')&&/^```/.test(n.textContent)){closed=true;break;} n=n.nextElementSibling; } if(closed)return; const empty=this.makeLine(''); const close=this.makeLine('```'); if(line.nextSibling){ this._ed.insertBefore(empty,line.nextSibling); this._ed.insertBefore(close,empty.nextSibling); } else { this._ed.appendChild(empty); this._ed.appendChild(close); } this.setActive(empty); this.setCol(empty,0); this.commitLive(); }
```

Counts preceding lines starting with `` ``` `` to determine parity (i.e., whether the just-typed fence is an *opening* fence); if even (opening) and no closing fence exists later, it auto-inserts a blank line + a `` ``` `` closing line after the current one, and places the caret on the new blank line.

### Block-level decoration (fenced code w/ copy button, tables) inside the editor

```js
_sepLine(t){ return /\|/.test(t)&&/-/.test(t)&&/^\s*\|?[\s:|-]+$/.test(t); }
enterBlock(line){ if(!line)return; this._ed.focus(); this.setActive(line); this.setCol(line,line.textContent.length); this.decorateBlocks(); }
decorateBlocks(){ const ed=this._ed; if(!ed||this._edMode==='read')return; ed.querySelectorAll('.blockdeco').forEach(o=>o.remove()); const all=[].filter.call(ed.children,c=>c.classList&&c.classList.contains('ln')); all.forEach(l=>{ l.style.display=''; }); const txt=all.map(l=>l.textContent); const active=this._active; let i=0;
  while(i<all.length){ const t=txt[i];
    if(/^```/.test(t)){ let j=i+1; while(j<all.length&&!/^```/.test(txt[j]))j++; if(j<all.length){ const els=all.slice(i,j+1); if(!(active&&els.indexOf(active)>=0))this._fenceDeco(els,txt.slice(i,j+1)); i=j+1; continue; } i++; continue; }
    if(/\|/.test(t)&&t.trim()&&i+1<all.length&&this._sepLine(txt[i+1])){ let j=i+2; while(j<all.length&&/\|/.test(txt[j])&&txt[j].trim())j++; const els=all.slice(i,j); if(!(active&&els.indexOf(active)>=0))this._tableDeco(els,txt.slice(i,j)); i=j; continue; }
    i++; }
}
_fenceDeco(els,lines){ const code=lines.slice(1,-1).join('\n'); const lang=(lines[0].replace(/^```/,'').trim()); const wrap=document.createElement('div'); wrap.className='blockdeco'; wrap.contentEditable='false'; wrap.style.cssText='position:relative;margin:12px 0;'; const pre=document.createElement('pre'); pre.textContent=code||' '; pre.style.cssText='background:'+C.code+';border:1px solid var(--border);border-radius:8px;padding:14px 16px;overflow:auto;font-family:IBM Plex Mono,ui-monospace,monospace;font-size:12.5px;line-height:1.6;color:var(--text);margin:0;cursor:text;white-space:pre;'; pre.addEventListener('mousedown',(e)=>{ e.preventDefault(); this.enterBlock(els[1]||els[0]); }); wrap.appendChild(pre); if(lang){ const tag=document.createElement('span'); tag.textContent=lang; tag.style.cssText='position:absolute;top:8px;left:14px;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);pointer-events:none;'; wrap.appendChild(tag); pre.style.paddingTop='24px'; } const btn=document.createElement('span'); btn.title='Copy'; btn.style.cssText='position:absolute;top:8px;right:8px;height:26px;padding:0 8px;display:flex;align-items:center;gap:5px;justify-content:center;border-radius:6px;background:var(--bg);border:1px solid var(--border);color:var(--muted);cursor:pointer;font-size:11.5px;white-space:nowrap;'; const copyIcon='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 012-2h10"></path></svg>'; btn.innerHTML=copyIcon; btn.addEventListener('mousedown',(e)=>{ e.preventDefault(); e.stopPropagation(); this._copyText(code); btn.style.color=C.accentText; btn.style.borderColor=C.accentText; btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="'+C.accentText+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"></path></svg><span>Copied!</span>'; setTimeout(()=>{ btn.style.color=''; btn.style.borderColor=''; btn.innerHTML=copyIcon; }, 4000); }); wrap.appendChild(btn); els[0].parentNode.insertBefore(wrap,els[0]); els.forEach(l=>l.style.display='none'); }
_tableDeco(els,lines){ const row=(l)=>l.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(c=>c.trim()); const head=row(lines[0]); const body=lines.slice(2).map(row); const wrap=document.createElement('div'); wrap.className='blockdeco'; wrap.contentEditable='false'; wrap.style.cssText='margin:12px 0;overflow-x:auto;cursor:text;'; wrap.addEventListener('mousedown',(e)=>{ e.preventDefault(); this.enterBlock(els[0]); }); const tbl=document.createElement('table'); tbl.style.cssText='border-collapse:collapse;width:100%;font-size:13px;border:1px solid var(--border-soft);border-radius:8px;overflow:hidden;'; let html='<thead><tr>'+head.map(h=>'<th style="text-align:left;padding:7px 11px;border:1px solid var(--border-soft);background:var(--panel);color:'+C.mut+';font-weight:600;">'+this.inlineLive(h)+'</th>').join('')+'</tr></thead><tbody>'; body.forEach(r=>{ html+='<tr>'+head.map((_,k)=>'<td style="padding:7px 11px;border:1px solid var(--border-soft);color:'+C.ink+';">'+this.inlineLive(r[k]||'')+'</td>').join('')+'</tr>'; }); html+='</tbody>'; tbl.innerHTML=html; wrap.appendChild(tbl); els[0].parentNode.insertBefore(wrap,els[0]); els.forEach(l=>l.style.display='none'); }
```

`decorateBlocks()` scans consecutive `.ln` line divs for fenced-code regions (opening/closing `` ``` ``) and markdown tables (a `|`-containing header line immediately followed by a separator line matching `_sepLine`, i.e. contains `|` and `-` and only `[\s:|-]` chars). For each detected block **not containing the currently active line**, it renders a non-editable `.blockdeco` overlay (`contentEditable=false`) in front of the raw lines and hides (`display:none`) the raw `.ln` divs — this is what gives "live preview" block rendering while still editing raw markdown underneath. Clicking the overlay calls `enterBlock` to reveal/focus the raw lines. The fence overlay includes a language tag (uppercase, from the opening fence's info string) and a Copy button with an SVG clipboard icon that swaps to a checkmark + "Copied!" label for 4 seconds after copying (`_copyText`).

## Reading-view Markdown → HTML renderer (`md2html`, lines 854–881)

```js
md2html(md,atts,taskStart){
  atts=atts||{}; let taskIdx=(taskStart||0)-1;
  const lines=md.split('\n'); let out='',i=0; const listOpen={ul:false,ol:false};
  const closeLists=()=>{ if(listOpen.ul){out+='</ul>';listOpen.ul=false;} if(listOpen.ol){out+='</ol>';listOpen.ol=false;} };
  const inline=(s)=>{ s=esc(s);
    s=s.replace(/`([^`]+)`/g,'<code style="background:'+C.code+';padding:1px 5px;border-radius:4px;font-family:IBM Plex Mono,monospace;font-size:.88em;">$1</code>');
    s=s.replace(/!\[\[([^\]]+)\]\]/g,(m,nm)=>{ const a=atts[nm.trim()]; if(!a)return '<span style="color:'+C.accentFadedRgba+';">['+nm.trim()+' — missing]</span>'; const t=a.type||''; if(t.indexOf('image')===0)return '<img data-embed="'+escAttr(nm.trim())+'" src="'+a.url+'" style="width:'+(a.w||'100%')+';border-radius:8px;margin:8px 0;display:block;">'; if(t.indexOf('video')===0)return '<video src="'+a.url+'" controls style="max-width:100%;border-radius:8px;margin:8px 0;display:block;"></video>'; if(t.indexOf('audio')===0)return '<audio src="'+a.url+'" controls style="width:100%;margin:8px 0;"></audio>'; if(t.indexOf('pdf')>=0)return '<embed src="'+a.url+'" type="application/pdf" style="width:100%;height:420px;border-radius:8px;border:1px solid var(--border);margin:8px 0;">'; return '<a href="'+a.url+'" download="'+escAttr(nm.trim())+'" style="display:inline-block;padding:8px 12px;background:'+C.code+';border-radius:8px;border:1px solid var(--border);margin:6px 0;">⬇ '+nm.trim()+'</a>'; });
    s=s.replace(/\[\[([^\]]+)\]\]/g,(m,t)=>'<a class="wl'+(this.byTitle(t.trim())?'':' missing')+'" data-wikilink="'+escAttr(t.trim())+'" href="#">'+t.trim()+'</a>');
    s=s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a class="exlink" data-ext="1" href="$2" target="_blank">$1</a>');
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/(^|[^*\w])\*([^*\n]+)\*/g,'$1<em>$2</em>');
    s=s.replace(/(^|\s)#([a-z0-9][\w\/-]*)/gi,'$1<span data-tag="$2" style="color:'+C.accentText+';cursor:pointer;">#$2</span>');
    return s;
  };
  while(i<lines.length){ let ln=lines[i];
    if(/^```/.test(ln)){ closeLists(); let buf=[]; i++; while(i<lines.length&&!/^```/.test(lines[i])){buf.push(lines[i]);i++;} i++; out+='<pre style="background:'+C.code+';border:1px solid var(--border);border-radius:8px;padding:12px 14px;overflow:auto;font-family:IBM Plex Mono,monospace;font-size:12.5px;line-height:1.6;color:var(--text);margin:12px 0;">'+esc(buf.join('\n'))+'</pre>'; continue; }
    if(/\|/.test(ln)&&i+1<lines.length&&/^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i+1])){ closeLists(); const row=(l)=>l.replace(/^\||\|$/g,'').split('|').map(c=>c.trim()); const head=row(ln); i+=2; let body=[]; while(i<lines.length&&/\|/.test(lines[i])&&lines[i].trim()){body.push(row(lines[i]));i++;} out+='<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:13px;"><thead><tr>'+head.map(h=>'<th style="text-align:left;padding:7px 10px;border-bottom:2px solid var(--border-soft);color:'+C.mut+';font-weight:600;">'+inline(h)+'</th>').join('')+'</tr></thead><tbody>'; body.forEach(r=>{out+='<tr>'+r.map(c=>'<td style="padding:7px 10px;border-bottom:1px solid var(--border-soft);color:'+C.ink+';">'+inline(c)+'</td>').join('')+'</tr>';}); out+='</tbody></table>'; continue; }
    if(/^#{1,6}\s/.test(ln)){ closeLists(); const lvl=ln.match(/^#+/)[0].length; const sz=[0,26,21,18,16,15,14][lvl]; const mtb=[0,[2,4],[12,3],[10,2],[8,2],[8,2],[8,2]][lvl]; out+='<h'+lvl+' style="font-family:Spectral,serif;font-weight:600;font-size:'+sz+'px;color:var(--ink);margin:'+mtb[0]+'px 0 '+mtb[1]+'px;line-height:1.25;">'+inline(ln.replace(/^#+\s/,''))+'</h'+lvl+'>'; i++; continue; }
    if(/^\s*>/.test(ln)){ closeLists(); out+='<blockquote style="border-left:3px solid '+C.accentText+';margin:12px 0;padding:2px 14px;color:var(--text);font-style:italic;background:var(--active);border-radius:0 6px 6px 0;">'+inline(ln.replace(/^\s*>\s?/,''))+'</blockquote>'; i++; continue; }
    if(/^\s*[-*]\s+\[( |x|X)\]/.test(ln)){ if(listOpen.ol){out+='</ol>';listOpen.ol=false;} if(!listOpen.ul){out+='<ul style="list-style:none;padding:0;margin:6px 0;">';listOpen.ul=true;} taskIdx++; const done=/\[(x|X)\]/.test(ln); const txt=ln.replace(/^\s*[-*]\s+\[( |x|X)\]\s?/,''); out+='<li style="display:flex;align-items:flex-start;gap:9px;margin:5px 0;line-height:1.6;"><input type="checkbox" data-task="'+taskIdx+'" '+(done?'checked':'')+' style="margin-top:4px;accent-color:'+C.sage+';cursor:pointer;width:15px;height:15px;flex:0 0 auto;"><span style="'+(done?'color:var(--faint);text-decoration:line-through;':'color:var(--ink);')+'">'+inline(txt)+'</span></li>'; i++; continue; }
    if(/^\s*[-*]\s+/.test(ln)){ if(listOpen.ol){out+='</ol>';listOpen.ol=false;} if(!listOpen.ul){out+='<ul style="padding-left:20px;margin:0.875em 0;">';listOpen.ul=true;} out+='<li style="margin:0;line-height:1.75;color:var(--ink);">'+inline(ln.replace(/^\s*[-*]\s+/,''))+'</li>'; i++; continue; }
    if(/^\s*\d+\.\s+/.test(ln)){ if(listOpen.ul){out+='</ul>';listOpen.ul=false;} if(!listOpen.ol){out+='<ol style="padding-left:22px;margin:0.875em 0;">';listOpen.ol=true;} out+='<li style="margin:0;line-height:1.75;color:var(--ink);">'+inline(ln.replace(/^\s*\d+\.\s+/,''))+'</li>'; i++; continue; }
    if(/^\s*(---|\*\*\*)\s*$/.test(ln)){ closeLists(); out+='<hr style="border:none;border-top:1px solid var(--border-soft);margin:16px 0;">'; i++; continue; }
    if(/^\s*$/.test(ln)){ closeLists(); i++; continue; }
    closeLists(); out+='<p style="margin:0.875em 0;line-height:1.75;color:var(--ink);">'+inline(ln)+'</p>'; i++;
  }
  closeLists(); return out;
}
```

Signature: `md2html(md, atts, taskStart)` — `atts` is the note's `attachments` map, `taskStart` offsets the running `data-task` checkbox index (used because `taskIdx` starts at `(taskStart||0)-1` and increments per task line — allows task indices to stay in sync with `toggleTask`'s flat count across the document). Block order checked per-line: fenced code (raw `<pre>`, no inline parsing) → table (header + separator regex `/^\s*\|?[\s:-]+\|[\s:|-]*$/`) → heading (`h1`–`h6`, with per-level `sz`/`margin` arrays `[0,26,21,18,16,15,14]px` and `[[0,0],[2,4],[12,3],[10,2],[8,2],[8,2],[8,2]]`) → blockquote → task list (checkbox `input[data-task]`, strikethrough+faint when done) → bullet list → ordered list → hr (`---`/`***`) → blank line (closes lists) → paragraph fallback. `inline()` handles: inline code, embeds `![[name]]` (dispatches on MIME type prefix: `image` → `<img>`, `video` → `<video controls>`, `audio` → `<audio controls>`, `pdf` → `<embed type="application/pdf">`, else a download link `⬇ name`; missing attachment → faded "`[name — missing]`" span using `C.accentFadedRgba`), wikilinks `[[x]]` (adds `.missing` class if `!this.byTitle(t.trim())`), external links `[text](url)` (`target="_blank"`), bold, italic, `#tags`.

## `sortNotes` (line 883)

```js
sortNotes(arr){ const s=this.state.sort; const a=[...arr]; const by={ 'name-az':(x,y)=>x.title.localeCompare(y.title),'name-za':(x,y)=>y.title.localeCompare(x.title),'created-new':(x,y)=>(y.date||'').localeCompare(x.date||''),'created-old':(x,y)=>(x.date||'').localeCompare(y.date||''),'mod-new':(x,y)=>((y.modified||y.date||'')+'').localeCompare((x.modified||x.date||'')+''),'mod-old':(x,y)=>((x.modified||x.date||'')+'').localeCompare((y.modified||y.date||'')+'') }; a.sort(by[s]||by['name-az']); return a; }
```

Sort keys: `name-az`, `name-za`, `created-new`, `created-old`, `mod-new`, `mod-old` (default `name-az`).

## Graph view (lines 885–941)

```js
/* ---------- graph ---------- */
ensureGraph(){
  const at=this.curView(); const isGraph=at&&at.kind==='graph'; const host=this.graphRef.current;
  this._ensureGraphSlot('main', isGraph, host);
  const sp=this.state.split; const st=sp?sp.tabs[sp.active]:null; const sv=st?st.hist[st.hi]:null; const isSplitGraph=!!(sp&&sv&&sv.kind==='graph'); const shost=this.splitGraphRef?this.splitGraphRef.current:null;
  this._ensureGraphSlot('split', isSplitGraph, shost);
}
_ensureGraphSlot(slot,isGraph,host){
  this._graphs=this._graphs||{};
  const g=this._graphs[slot];
  if(!isGraph||!host){ if(g){ cancelAnimationFrame(g.raf); if(g.cleanup)g.cleanup(); this._graphs[slot]=null; } return; }
  if(g && g.host===host && g.nodes.length===this.state.notes.length) return;
  if(g){ cancelAnimationFrame(g.raf); if(g.cleanup)g.cleanup(); }
  this.initGraph(host,slot);
}
initGraph(host,slot){
  host.innerHTML=''; const canvas=document.createElement('canvas'); canvas.style.cssText='width:100%;height:100%;display:block;cursor:grab;'; host.appendChild(canvas);
  const ctx=canvas.getContext('2d'); const dpr=window.devicePixelRatio||1;
  const notes=this.state.notes; const idOf={}; notes.forEach((n,i)=>idOf[n.id]=i);
  const nodes=notes.map((n,i)=>({id:n.id,title:n.title,empty:!n.content||!n.content.trim(),x:(Math.random()-.5)*260,y:(Math.random()-.5)*260,vx:0,vy:0}));
  const links=[]; const nb={}; notes.forEach(n=>nb[n.id]=new Set());
  notes.forEach(n=>this.linksOf(n).forEach(t=>{ const tg=this.byTitle(t); if(tg&&tg.id!==n.id){ links.push([idOf[n.id],idOf[tg.id]]); nb[n.id].add(tg.id); nb[tg.id].add(n.id); } }));
  const deg={}; nodes.forEach(n=>deg[n.id]=nb[n.id].size);
  const gr={canvas,ctx,dpr,nodes,links,nb,deg,idOf,scale:1,tx:0,ty:0,hover:null,dragNode:null,panning:false,last:null,moved:0,raf:null,host,slot};
  this._graphs=this._graphs||{}; this._graphs[slot]=gr;
  const resize=()=>{ const w=host.clientWidth,h=host.clientHeight; canvas.width=w*dpr; canvas.height=h*dpr; canvas.style.width=w+'px'; canvas.style.height=h+'px'; gr.w=w; gr.h=h; if(gr.tx===0&&gr.ty===0){ gr.tx=w/2; gr.ty=h/2; } };
  resize(); gr._ro=new ResizeObserver(resize); gr._ro.observe(host);
  const toWorld=(mx,my)=>({x:(mx-gr.tx)/gr.scale, y:(my-gr.ty)/gr.scale});
  const nodeAt=(mx,my)=>{ const w=toWorld(mx,my); let best=null,bd=1e9; nodes.forEach(n=>{ const r=6+Math.min(deg[n.id],5)*1.7; const d=Math.hypot(n.x-w.x,n.y-w.y); if(d<r+5&&d<bd){bd=d;best=n;} }); return best; };
  const rel=(e)=>{ const b=canvas.getBoundingClientRect(); return {x:e.clientX-b.left,y:e.clientY-b.top}; };
  const onDown=(e)=>{ const p=rel(e); const n=nodeAt(p.x,p.y); gr.moved=0; gr.last=p; if(n){ gr.dragNode=n; n.fx=true; } else { gr.panning=true; canvas.style.cursor='grabbing'; } };
  const onMove=(e)=>{ const p=rel(e); if(gr.dragNode){ const w=toWorld(p.x,p.y); gr.dragNode.x=w.x; gr.dragNode.y=w.y; gr.dragNode.vx=0; gr.dragNode.vy=0; gr.moved+=Math.abs(p.x-(gr.last?gr.last.x:p.x))+Math.abs(p.y-(gr.last?gr.last.y:p.y)); gr.last=p; } else if(gr.panning){ gr.tx+=p.x-gr.last.x; gr.ty+=p.y-gr.last.y; gr.moved+=Math.abs(p.x-gr.last.x)+Math.abs(p.y-gr.last.y); gr.last=p; } else { const n=nodeAt(p.x,p.y); gr.hover=n?n.id:null; canvas.style.cursor=n?'pointer':'grab'; } };
  const onUp=(e)=>{ if(gr.dragNode){ if(gr.moved<4){ if(slot==='split'){ this.setState({lastPane:'split'},()=>this.splitOpenNote(gr.dragNode.id)); } else { this.openNote(gr.dragNode.id); } } gr.dragNode.fx=false; gr.dragNode=null; } gr.panning=false; canvas.style.cursor='grab'; };
  const onWheel=(e)=>{ e.preventDefault(); const p=rel(e); const f=Math.exp(-e.deltaY*0.0015); const ns=Math.max(0.25,Math.min(4,gr.scale*f)); const wx=(p.x-gr.tx)/gr.scale, wy=(p.y-gr.ty)/gr.scale; gr.scale=ns; gr.tx=p.x-wx*ns; gr.ty=p.y-wy*ns; };
  canvas.addEventListener('mousedown',onDown); window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp); canvas.addEventListener('wheel',onWheel,{passive:false});
  canvas.addEventListener('mousemove',onMove);
  gr.cleanup=()=>{ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); if(gr._ro)gr._ro.disconnect(); };
  const step=()=>{ const g=(this._graphs||{})[slot]; if(!g)return; const N=g.nodes;
    for(let a=0;a<N.length;a++){ for(let b=a+1;b<N.length;b++){ const A=N[a],B=N[b]; let dx=A.x-B.x,dy=A.y-B.y; let d2=dx*dx+dy*dy; if(d2<0.01){d2=0.01;dx=Math.random();dy=Math.random();} const d=Math.sqrt(d2); const rep=2600/d2; const fx=dx/d*rep, fy=dy/d*rep; A.vx+=fx;A.vy+=fy;B.vx-=fx;B.vy-=fy; } }
    g.links.forEach(([a,b])=>{ const A=N[a],B=N[b]; let dx=B.x-A.x,dy=B.y-A.y; const d=Math.hypot(dx,dy)||1; const k=(d-96)*0.02; const fx=dx/d*k,fy=dy/d*k; A.vx+=fx;A.vy+=fy;B.vx-=fx;B.vy-=fy; });
    N.forEach(n=>{ n.vx+=-n.x*0.006; n.vy+=-n.y*0.006; if(!n.fx){ n.vx*=0.82; n.vy*=0.82; n.x+=n.vx; n.y+=n.vy; } });
    this.drawGraph(slot); g.raf=requestAnimationFrame(step);
  };
  gr.raf=requestAnimationFrame(step);
}
drawGraph(slot){ const g=(this._graphs||{})[slot]; if(!g)return; const {ctx,dpr,nodes,links,nb,deg}=g; const dark=this.effTheme().indexOf('Dark')===0; const acc=this.effAccent();
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,g.w,g.h); ctx.save(); ctx.translate(g.tx,g.ty); ctx.scale(g.scale,g.scale);
  const cur=slot==='split'?this.splitCurId():this.curId(); const hov=g.hover; const hset=hov?new Set([hov,...nb[hov]]):null;
  const edgeCol=dark?'#47423a':'#c3b79a'; const nodeCol=mixHex(acc, dark?'#4a4a4a':'#bdbdbd', 0.5); const ring=dark?'#1d1b17':'#faf5ea'; const txtCol=dark?'#b8ad98':'#6f6552';
  links.forEach(([a,b])=>{ const A=nodes[a],B=nodes[b]; const on=hov&&(nodes[a].id===hov||nodes[b].id===hov); ctx.strokeStyle=on?acc:edgeCol; ctx.globalAlpha=hov?(on?0.9:0.12):0.65; ctx.lineWidth=(on?1.6:1)/1; ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke(); });
  ctx.globalAlpha=1;
  const emptyNodeCol=mixHex(nodeCol, dark?'#141414':'#faf5ea', 0.4);
  nodes.forEach(n=>{ const r=6+Math.min(deg[n.id],5)*1.7; const active=n.id===cur; const dim=hset&&!hset.has(n.id); ctx.globalAlpha=dim?0.22:1; ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2); ctx.fillStyle=n.empty&&!active&&hov!==n.id?emptyNodeCol:(active?acc:(hov===n.id?acc:nodeCol)); ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=ring; ctx.stroke();
    ctx.globalAlpha=dim?0.22:1;
    if(g.scale>0.55||n.id===hov||active){ ctx.fillStyle=(active||n.id===hov)?acc:txtCol; ctx.font=((active||n.id===hov)?'600 ':'500 ')+(11)+"px 'IBM Plex Sans',sans-serif"; ctx.textAlign='center'; const label=n.title.length>20?n.title.slice(0,19)+'…':n.title; ctx.fillText(label,n.x,n.y-r-6); } });
  ctx.globalAlpha=1; ctx.restore();
}
```

There are two independent graph "slots" (`'main'` and `'split'`), each a canvas-based force-directed layout stored in `this._graphs[slot]`.

**Node/edge computation**: one node per note: `{id, title, empty: !content||!content.trim(), x/y: random in [-130,130], vx:0, vy:0}`. Edges are computed by resolving each note's outgoing wikilinks (`this.linksOf(n)`) against `this.byTitle(t)` — an edge `[idOf[sourceId], idOf[targetId]]` is added only if the target note exists and isn't self-referential. Node "degree" (`deg[id]`) = size of its neighbor set, used for radius scaling.

**Physics (`step`, runs every `requestAnimationFrame`)**:
- Repulsion: all-pairs O(n²) inverse-square repulsion, `rep = 2600 / d²`, applied along the normalized delta vector (with a fallback random jitter if two nodes coincide, `d² < 0.01`).
- Spring/attraction along edges: `k = (d - 96) * 0.02` (rest length 96px) pulling/pushing each linked pair toward that distance.
- Centering: `vx += -x*0.006; vy += -y*0.006` (weak spring to origin).
- Damping: `vx *= 0.82; vy *= 0.82` each frame (skipped for the node currently being dragged, flagged `fx:true`).

**Interaction**: `nodeAt` hit-tests using `r = 6 + min(deg,5)*1.7` (node radius grows with degree, capped). Mouse down on empty canvas starts panning (`gr.panning`, updates `gr.tx/ty`); mouse down on a node starts dragging (`gr.dragNode`, position pinned to cursor in world space, velocity zeroed). Mouse up with total drag movement `<4px` treats it as a click → opens that note (`openNote` for main slot, `splitOpenNote` + `lastPane:'split'` for split slot). Wheel zooms around the cursor point (`scale` clamped `[0.25, 4]`, exponential based on `deltaY`).

**Drawing (`drawGraph`)**: transforms by device-pixel-ratio, translate by `(tx,ty)`, scale by `scale`. Colors depend on dark vs light theme (`dark = effTheme().indexOf('Dark')===0`): `edgeCol` `#47423a` (dark) / `#c3b79a` (light); `nodeCol = mixHex(accentColor, dark?'#4a4a4a':'#bdbdbd', 0.5)`; ring stroke color `#1d1b17`/`#faf5ea`; label text color `#b8ad98`/`#6f6552`. On hover, a highlight set (`hset`) of the hovered node + its neighbors is computed — non-highlighted links/nodes are dimmed to `globalAlpha 0.12`/`0.22` respectively; highlighted/current-note links get full opacity and thicker (`1.6px` vs `1px`) accent-colored strokes. **Empty-note styling**: nodes whose note has empty content (`n.empty`) and are not active/hovered are filled with `emptyNodeCol = mixHex(nodeCol, dark?'#141414':'#faf5ea', 0.4)` — i.e., faded/washed-out toward the background. Active (current) node and hovered node are filled with the accent color. Node labels (title, truncated to 19 chars + `…` if longer) are drawn above the node only when zoomed in enough (`scale>0.55`) or when hovered/active, in `'IBM Plex Sans'` 11px, bold-ish (`600`) weight when active/hovered vs `500` otherwise.

## Quick switcher / Command palette open/close, misc handlers (lines 943–951)

```js
onQuick(e){ this.setState({quickQuery:e.target.value}); }
toggleQuick(){ this.setState(s=>({quickOpen:!s.quickOpen,cmdOpen:false,quickQuery:''}),()=>{const el=document.getElementById('qsInput'); if(el&&this.state.quickOpen)el.focus();}); }
closeQuick(){ this.setState({quickOpen:false}); }
onCmd(e){ this.setState({cmdQuery:e.target.value}); }
openCmd(){ this.setState(s=>({cmdOpen:!s.cmdOpen,quickOpen:false,cmdQuery:''}),()=>{const el=document.getElementById('cmdInput'); if(el&&this.state.cmdOpen)el.focus();}); }
closeCmd(){ this.setState({cmdOpen:false}); }
prevMonth(){ this.setState(s=>{ let m=s.calMonth-1,y=s.calYear; if(m<0){m=11;y--;} return {calMonth:m,calYear:y}; }); }
nextMonth(){ this.setState(s=>{ let m=s.calMonth+1,y=s.calYear; if(m>11){m=0;y++;} return {calMonth:m,calYear:y}; }); }
```

(The actual filtered result lists — `quickResults` for the switcher and `commands` for the palette — are computed in `renderVals()`; see below.)

## Note context menu / rename (lines 952–963)

```js
onNoteContext(e,id){ e.preventDefault(); e.stopPropagation(); if(this.state.selectedIds.includes(id)&&this.state.selectedIds.length>1){ this.openBulkCtx(e); return; } const x=Math.min(e.clientX,window.innerWidth-210); const y=Math.min(e.clientY,window.innerHeight-330); this.setState({ctxMenu:{id,x,y},ctxMove:false}); }
closeCtx(){ this.setState({ctxMenu:null,ctxMove:false}); }
ctxOpenNote(){ const id=this.state.ctxMenu.id; this.setState({ctxMenu:null}); this.openNoteNewTab(id); }
ctxDuplicate(){ const id=this.state.ctxMenu.id; const o=this.state.notes.find(n=>n.id===id); if(!o){this.setState({ctxMenu:null});return;} const nid='n'+Date.now(); const copy={...o,id:nid,title:o.title+' copy',tags:[...(o.tags||[])],attachments:{...(o.attachments||{})}}; this.setState(s=>({notes:[...s.notes,copy],ctxMenu:null}),()=>this.navigate(nid)); }
ctxRename(){ const id=this.state.ctxMenu.id; this.setState({ctxMenu:null,renaming:id,sideMode:'files'},()=>{const el=document.getElementById('renameInput');if(el){el.focus();try{el.select();}catch(_){}}}); }
ctxDelete(){ const id=this.state.ctxMenu.id; this.setState({ctxMenu:null}); this.deleteNote(id); }
ctxMoveStart(){ this.setState({ctxMove:true}); }
moveCtx(folder){ const id=this.state.ctxMenu.id; this.setState(s=>({notes:s.notes.map(n=>n.id===id?{...n,folder}:n),ctxMenu:null,ctxMove:false})); }
onRenameLive(e,id){ const v=e.target.value; this.setState(s=>({notes:s.notes.map(n=>n.id===id?{...n,title:v}:n)})); }
onRenameKey(e){ if(e.key==='Enter'){e.target.blur();} else if(e.key==='Escape'){this.setState({renaming:null});} }
stopRename(){ this.setState({renaming:null}); }
```

Right-clicking a note that's part of a multi-selection (`selectedIds.length>1`) opens the bulk context menu instead of the single-note one. Context menu position is clamped to stay within the viewport (`x: min(clientX, innerWidth-210)`, `y: min(clientY, innerHeight-330)`).

## Drag-and-drop for folders/notes (from `renderVals()`, folder tree building — lines 976–1005)

These handlers are declared inline while building `folderRows`/root-note drop zones inside `renderVals()`:

```js
onDragStartFolder:(e)=>{ this.setState({draggingFolder:fname,draggingId:null}); if(e.dataTransfer)e.dataTransfer.effectAllowed='move'; },
onDragOver:(e)=>{e.preventDefault(); if(e.dataTransfer)e.dataTransfer.dropEffect='move'; if(this.state.dragOverFolder!==fname||this.state.rootDragOver)this.setState({dragOverFolder:fname,rootDragOver:false});},
onDragLeave:(e)=>{ if(e.currentTarget&&e.relatedTarget&&e.currentTarget.contains(e.relatedTarget))return; if(this.state.dragOverFolder===fname)this.setState({dragOverFolder:null}); },
onDrop:(e)=>{e.preventDefault(); e.stopPropagation(); const st=this.state; this.setState({dragOverFolder:null,rootDragOver:false}); if(st.draggingFolder){ this.reparentFolder(st.draggingFolder,fname); } else if(st.draggingId){ this.moveNoteTo(st.draggingId,fname); } },
```

...and per-note-row:

```js
onDragStart:(e)=>{this.setState({draggingId:n.id,draggingFolder:null}); if(e.dataTransfer)e.dataTransfer.effectAllowed='move';},
```

...and the root drop-zone (`rootDrop`):

```js
const rootDrop={ onDragOver:(e)=>{e.preventDefault(); if(e.dataTransfer)e.dataTransfer.dropEffect='move'; if(!s.rootDragOver||s.dragOverFolder)this.setState({rootDragOver:true,dragOverFolder:null});}, onDragEnter:(e)=>{e.preventDefault(); if(!this.state.rootDragOver)this.setState({rootDragOver:true,dragOverFolder:null});}, onDragLeave:(e)=>{ if(e.currentTarget&&e.relatedTarget&&e.currentTarget.contains(e.relatedTarget))return; if(this.state.rootDragOver)this.setState({rootDragOver:false}); }, onDrop:(e)=>{e.preventDefault(); const st=this.state; this.setState({rootDragOver:false,dragOverFolder:null}); if(st.draggingFolder){ this.reparentFolder(st.draggingFolder,''); } else if(st.draggingId){ this.moveNoteTo(st.draggingId,''); } } };
```

Uses native HTML5 drag-and-drop (`draggable` + `dragstart`/`dragover`/`dragleave`/`drop`). State tracks `draggingId` (note) xor `draggingFolder` (folder) plus `dragOverFolder`/`rootDragOver` for hover-highlight styling (`wrapStyle`/`rootDropStyle` apply an accent-tinted background + inset box-shadow ring when `over`/`rootDragOver` is true). Dropping a dragged folder onto another folder row calls `reparentFolder(draggingFolder, targetFolderName)`; dropping onto the root zone reparents to `''`. Dropping a dragged note calls `moveNoteTo(draggingId, folderName|'')`.

## `renderVals()` — the master render/bindings function (lines 964–1163)

This single method computes every value consumed by the JSX template (part 1, lines 1–653). Full verbatim body is reproduced in the subsections below, in source order.

### Header, accent/theme resolution

```js
renderVals(){
  const s=this.state, cur=this.cur();
  C.accent=this.effAccent();
  const isDarkTheme=this.effTheme().indexOf('Dark')===0;
  const baseForText=saturateHex(C.accent,isDarkTheme?22:14);
  C.accentText=accessibleAccent(baseForText, THEME_BG[this.effTheme()]||'#faf5ea', isDarkTheme?7:4.8);
  { const rgb=hexToRgb(C.accentText); C.accentFadedRgba='rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.55)'; }
  const view=this.curView(), kind=view?view.kind:'empty';
  const tab=s.tabs[s.active];
  const curFolder=cur?cur.folder:null;
```

### Folder tree construction (with DnD, rename, selection dot color) — see full block above (lines 975–1005)

Builds `folderRows` recursively (`buildFolders(parent,depth)`) sorted alphabetically per level, each row carrying computed inline `style` strings for indentation (`nIndent=20+depth*13`, `hIndent=8+depth*13`), open/closed caret rotation, drag-over highlight, and a `notes` array (each with `dot` color logic: selected → `accentText`, active → `accentText`, else `var(--edge)`). Also builds `rootNotes` (notes with no folder or an orphaned folder) and `rootDrop` handlers. `this._visibleOrder` is populated as notes are laid out — this is the flat order used by shift-click range selection.

### Search parsing (`path:`, `file:`, `tag:`, `category:`/`cat:`, `line:`, `section:`)

```js
const rawq=s.searchQuery.trim(); let sr=[];
if(rawq){ let mode='text',term=rawq.toLowerCase(); const pre=rawq.match(/^(tag|file|path|line|section|cat|category)\s*:/i); if(pre){ mode=pre[1].toLowerCase(); if(mode==='category')mode='cat'; term=rawq.slice(pre[0].length).trim().toLowerCase(); }
  let matched=s.notes.filter(n=>{ if(!term)return true; if(mode==='tag')return this.noteTags(n).some(t=>t.toLowerCase().includes(term)); if(mode==='cat')return (n.category||'').toLowerCase().includes(term); if(mode==='file')return n.title.toLowerCase().includes(term); if(mode==='path')return (n.folder+'/'+n.title).toLowerCase().includes(term); if(mode==='line')return n.content.toLowerCase().split('\n').some(l=>l.includes(term)); if(mode==='section')return n.content.split('\n').some(l=>/^#{1,6}\s/.test(l)&&l.toLowerCase().includes(term)); return n.title.toLowerCase().includes(term)||n.content.toLowerCase().includes(term); });
  matched=this.sortNotes(matched);
  sr=matched.map(n=>{ let snip; if(mode==='tag')snip='tags: '+this.noteTags(n).join(' '); else if(mode==='cat')snip='category: '+(n.category||'—'); else if(mode==='path'||mode==='file')snip='in '+n.folder; else { const line=(n.content.split('\n').find(l=>l.toLowerCase().includes(term))||n.content).replace(/[#*`>\[\]]/g,'').trim(); snip=line.slice(0,80)||n.folder; } return {title:n.title,snippet:snip,onClick:()=>this.navigate(n.id)}; });
}
const searchOptions=[['path:','match path of the file'],['file:','match file name'],['tag:','search for tags'],['category:','search by category'],['line:','keywords on same line'],['section:','keywords under same heading']].map(o=>({prefix:o[0],desc:o[1],onClick:()=>this.setState({searchQuery:o[0]},()=>{const e=document.getElementById('sidebarSearch');if(e)e.focus();})}));
const history=s.searchHistory.map(q=>({q,onClick:()=>this.openSearch(q)}));
```

Parsing: the query prefix is matched via `/^(tag|file|path|line|section|cat|category)\s*:/i`; `category` is normalized to `cat`. The remaining text after the colon (trimmed, lowercased) is the search `term`. Matching per mode:
- `tag:` — any of `this.noteTags(n)` includes term
- `cat:` — `note.category` includes term
- `file:` — `note.title` includes term
- `path:` — `folder+'/'+title` includes term
- `line:` — any content line (lowercased) includes term
- `section:` — any heading line (`/^#{1,6}\s/`) includes term
- no prefix (`text` mode, default) — title OR full content includes term

Results are sorted via `sortNotes` (current sort setting) then mapped to `{title, snippet, onClick}`. Snippet logic: for `tag:` → `'tags: '+joined tags`; for `cat:` → `'category: '+(category||'—')`; for `path:`/`file:` → `'in '+folder`; otherwise → the first matching content line (or the whole content) with markdown syntax chars `#*>[]` stripped, truncated to 80 chars.

`searchOptions` (shown when the search box is empty) is a fixed list of `[prefix, description]` pairs, in this exact order and wording:
| prefix | description |
|---|---|
| `path:` | match path of the file |
| `file:` | match file name |
| `tag:` | search for tags |
| `category:` | search by category |
| `line:` | keywords on same line |
| `section:` | keywords under same heading |

Clicking an option sets `searchQuery` to that prefix and focuses `#sidebarSearch`. `history` maps `s.searchHistory` to `{q, onClick: openSearch(q)}`.

### Right-panel backlinks / outgoing links / tag+link autosuggest results

```js
const _splitIdForRight=this.splitCurId(); const splitNoteForRight=_splitIdForRight?s.notes.find(n=>n.id===_splitIdForRight):null;
const focusOnSplit = s.lastPane==='split' && !!s.split;
const rightNote = focusOnSplit ? splitNoteForRight : cur;
let backlinks=[],outgoing=[],linkSuggestions=[];
if(rightNote){ const others=s.notes.filter(n=>n.id!==rightNote.id);
  backlinks=others.filter(n=>this.linksOf(n).some(t=>t.toLowerCase()===rightNote.title.toLowerCase())).map(n=>{ let sn=n.content.replace(/[#*`>\[\]]/g,'').replace(/\n+/g,' ').trim(); sn=sn.length>72?sn.slice(0,72)+'…':sn; return {title:n.title,snippet:sn,onClick:()=>this.navigate(n.id),onContext:(e)=>this.onNoteContext(e,n.id)}; });
  outgoing=this.linksOf(rightNote).map(t=>{ const tgt=this.byTitle(t); return {title:t,color:tgt?C.accentText:C.accentFadedRgba,tag:tgt?'':'· new',onClick:()=>this.openOrCreate(t),onContext:(e)=>{ if(tgt)this.onNoteContext(e,tgt.id); else e.preventDefault(); }}; });
}
let tagAcSuggestions=[];
if(s.linkQuery!=null){ const dq=s.linkQuery.toLowerCase(); const titles=s.notes.map(n=>n.title).filter(t=>!dq||t.toLowerCase().includes(dq)).slice(0,8); linkSuggestions=titles.map(t=>({label:t,color:'var(--ink)',onMouseDown:(e)=>{e.preventDefault(); this.pickLink(t);}})); if(dq&&!s.notes.some(n=>n.title.toLowerCase()===dq))linkSuggestions.push({label:'Create "'+s.linkQuery+'"',color:'var(--sage)',onMouseDown:(e)=>{e.preventDefault(); this.pickLink(s.linkQuery);}}); this._acSug=linkSuggestions.map(x=>x.label.indexOf('Create ')===0?s.linkQuery:x.label); }
if(s.tagAcQuery!=null){ const dq=s.tagAcQuery.toLowerCase(); const tags=this.allTags().filter(t=>!dq||t.toLowerCase().includes(dq)).slice(0,8); tagAcSuggestions=tags.map(t=>({label:t,onMouseDown:(e)=>{e.preventDefault(); this.pickTag(t);}})); this._acSug=tagAcSuggestions.map(x=>x.label); }
const acOpen=(s.linkQuery!=null&&linkSuggestions.length>0)||(s.tagAcQuery!=null&&tagAcSuggestions.length>0);
const acPopStyle='position:fixed;left:'+s.linkPos.x+'px;top:'+s.linkPos.y+'px;z-index:70;min-width:220px;max-width:360px;max-height:280px;overflow-y:auto;background:var(--bg);border:1px solid var(--border);border-radius:10px;box-shadow:0 16px 40px -12px rgba(25,20,12,.5);padding:5px;';
```

Wikilink autosuggest: filters all note titles case-insensitively containing the query, capped to 8 results (`linkSuggestions`), colored `var(--ink)`; if the exact-match title doesn't exist, appends a `'Create "<query>"'` option colored `var(--sage)`. Tag autosuggest: filters `this.allTags()` similarly, capped to 8 (`tagAcSuggestions`). `this._acSug` stores the flat label list consumed by keyboard nav in `onEdKeydown`. Popup only renders (`acOpen`) if the relevant query is non-null AND has results.

### Tabs / quick switcher results / command palette commands

```js
const viewLabel=(v)=>{ if(!v)return {label:'New tab',dot:'var(--edge)'}; if(v.kind==='note'){const n=s.notes.find(x=>x.id===v.id); return {label:n?n.title:'(deleted)',dot:C.accent};} if(v.kind==='graph')return {label:'Graph view',dot:'#6f92a0'}; if(v.kind==='journal')return {label:'Calendar',dot:C.accent}; if(v.kind==='categories')return {label:'Categories',dot:'var(--sage)'}; return {label:'New tab',dot:'var(--edge)'}; };
const tabs=s.tabs.map((t,i)=>{ const active=i===s.active; const vl=viewLabel(t.hist[t.hi]); const dot=active?vl.dot:'var(--edge)'; return {key:'t'+i,label:vl.label,dot, style:'display:flex;align-items:center;gap:7px;min-width:110px;max-width:200px;padding:7px 8px 7px 12px;border-radius:9px 9px 0 0;cursor:pointer;font-size:12.5px;border:1px solid '+(active?'var(--border-soft)':'transparent')+';border-bottom:none;background:'+(active?'var(--bg)':'transparent')+';color:'+(active?'var(--ink)':'var(--muted)')+';'+(active?'font-weight:500;':''), onClick:()=>this.selectTab(i), onClose:(e)=>{e.stopPropagation();this.closeTab(i);}}; });

const qq=s.quickQuery.trim().toLowerCase();
const qsrc=qq?s.notes.filter(n=>n.title.toLowerCase().includes(qq)||n.content.toLowerCase().includes(qq)):s.notes.slice().reverse();
const quickResults=qsrc.slice(0,8).map(n=>{ let sub=n.content.replace(/^#\s.*$/m,'').replace(/[#*`>\[\]]/g,'').replace(/\n+/g,' ').trim(); sub=sub.slice(0,60)||'Empty note'; return {title:n.title,sub,folder:n.folder,dot:n.id===this.curId()?C.accent:'var(--sage)',onClick:()=>this.navigate(n.id)}; });

const allCmds=[ {glyph:'+',label:'New note',run:()=>this.newNote()},{glyph:'⌕',label:'Quick switcher',hint:'⌘O',run:()=>this.toggleQuick()},{glyph:'⌕',label:'Search notes',run:()=>this.setState({sideMode:'search',leftOpen:true},()=>{const e=document.getElementById('sidebarSearch');if(e)e.focus();})},{glyph:'◉',label:'Graph view',run:()=>this.goGraph()},{glyph:'▦',label:'Journal',run:()=>this.goJournal()},{glyph:'☼',label:"Today's daily note",run:()=>this.openOrCreate(TODAY,'Journal')},{glyph:'⚙',label:'Settings',run:()=>this.openSettings()},{glyph:'⇊',label:'Import Markdown',run:()=>this.triggerImport()},{glyph:'⇈',label:'Export vault (JSON)',run:()=>this.exportJson()},{glyph:'⎘',label:'Attach file',run:()=>this.triggerAttach()},{glyph:'👁',label:'Toggle reading view',run:()=>this.toggleReading()},{glyph:'🗑',label:'Delete note',run:()=>this.deleteCurrent()},{glyph:'▤',label:'New folder',run:()=>{this.setState({leftOpen:true});this.newFolder();}} ];
const cq=s.cmdQuery.trim().toLowerCase();
const commands=allCmds.filter(c=>!cq||c.label.toLowerCase().includes(cq)).map(c=>({glyph:c.glyph,label:c.label,hint:c.hint||'',onClick:()=>{this.setState({cmdOpen:false});c.run();}}));
```

**Quick switcher (⌘O) filtering**: `quickQuery` trimmed/lowercased; if empty, source is all notes reversed (most-recently-created first, since new notes are appended); if non-empty, filters notes whose title OR content includes the query (substring, case-insensitive). Capped to 8 results. Each result's `sub` (preview) strips the first `# Heading` line and all markdown syntax chars, collapses newlines to spaces, truncated to 60 chars (falls back to `'Empty note'`). `dot` color is the accent for the currently-open note, sage green otherwise.

**Command palette (⌘P) — full `commands` array**, in this exact order (glyph, label, hint):

| Glyph | Label | Hint | Action |
|---|---|---|---|
| `+` | New note | — | `this.newNote()` |
| `⌕` | Quick switcher | `⌘O` | `this.toggleQuick()` |
| `⌕` | Search notes | — | opens sidebar search mode, focuses `#sidebarSearch` |
| `◉` | Graph view | — | `this.goGraph()` |
| `▦` | Journal | — | `this.goJournal()` |
| `☼` | Today's daily note | — | `this.openOrCreate(TODAY,'Journal')` |
| `⚙` | Settings | — | `this.openSettings()` |
| `⇊` | Import Markdown | — | `this.triggerImport()` |
| `⇈` | Export vault (JSON) | — | `this.exportJson()` |
| `⎘` | Attach file | — | `this.triggerAttach()` |
| `👁` | Toggle reading view | — | `this.toggleReading()` |
| `🗑` | Delete note | — | `this.deleteCurrent()` |
| `▤` | New folder | — | opens left sidebar + `this.newFolder()` |

Filtered by `cmdQuery` (case-insensitive substring match against `label`); clicking closes the palette (`cmdOpen:false`) then runs the command's `run()`.

### Sort options, calendar/journal cells, categories view

```js
const sortDefs=[['name-az','File name (A to Z)'],['name-za','File name (Z to A)'],['DIV'],['mod-new','Modified time (new to old)'],['mod-old','Modified time (old to new)'],['DIV'],['created-new','Created time (new to old)'],['created-old','Created time (old to new)']];
const sortLabels={'name-az':'Name A–Z','name-za':'Name Z–A','mod-new':'Modified (new)','mod-old':'Modified (old)','created-new':'Created (new)','created-old':'Created (old)'};
const sortOptions=sortDefs.map(d=> d[0]==='DIV'?{divider:true,item:false}:{item:true,label:d[1],check:s.sort===d[0]?'✓':'',onClick:()=>this.setSort(d[0])});

const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const y=s.calYear,mo=s.calMonth; const firstDow=new Date(y,mo,1).getDay(); const days=new Date(y,mo+1,0).getDate();
const byDay={}; s.notes.forEach(n=>{ if(n.date){(byDay[n.date]=byDay[n.date]||[]).push(n);} });
const cells=[]; for(let k=0;k<firstDow;k++)cells.push({label:'',style:'height:50px;',onClick:()=>{}});
for(let d=1;d<=days;d++){ const iso=y+'-'+String(mo+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'); const has=!!byDay[iso],today=iso===TODAY,sel=iso===s.calSelected; cells.push({label:String(d),hasNote:has,dotColor:sel?'#fff':C.accent, style:'height:50px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:9px;cursor:pointer;font-size:13px;'+(sel?'background:'+C.accent+';color:#fff;font-weight:600;':today?'background:var(--active);color:var(--ink);font-weight:600;border:1px solid var(--border);':has?'background:var(--panel);color:var(--ink);border:1px solid var(--border);':'background:var(--bg);color:var(--faint);border:1px solid var(--border-soft);'), onClick:()=>this.setState({calSelected:iso})}); }
const dayNotes=(byDay[s.calSelected]||[]).map(n=>{ let sn=n.content.replace(/^#\s.*$/m,'').replace(/[#*`>\[\]]/g,'').replace(/\n+/g,' ').trim().slice(0,50); return {title:n.title,folder:n.folder,snippet:sn||'—',onClick:()=>this.navigate(n.id)}; });

const catQ=s.catQuery.trim().toLowerCase();
const catFiltered=s.categories.filter(c=>!catQ||c.toLowerCase().includes(catQ));
const catOptions=cur?catFiltered.map(c=>{ const idx=catQ?c.toLowerCase().indexOf(catQ):-1; return {name:c,mark:cur.category===c?'●':'', pre:idx>=0?c.slice(0,idx):'', match:idx>=0?c.slice(idx,idx+catQ.length):'', post:idx>=0?c.slice(idx+catQ.length):c, onClick:()=>this.setCategory(c)}; }):[];
const catShowCreate=!!(cur&&s.catQuery.trim()&&!s.categories.some(c=>c.toLowerCase()===catQ));
const catCreateLabel=s.catQuery.trim();

const catViewList=s.categories.map(c=>{ const ns=this.sortNotes(s.notes.filter(n=>n.category===c)); return {name:c,count:ns.length,renaming:(s.catRenaming===c),notRenaming:(s.catRenaming!==c),onContext:(e)=>this.onCatContext(e,c),onMenu:(e)=>this.onCatContext(e,c),onRenameKey:(e)=>this.onCatRenameKey(e,c),onRenameBlur:(e)=>this.stopCatRename(e,c),notes:ns.map(n=>({id:n.id,title:n.title,folder:n.folder||'—',onClick:()=>this.navigate(n.id),onContext:(e)=>this.onNoteContext(e,n.id)}))}; });
const uncatNotes=this.sortNotes(s.notes.filter(n=>!n.category)).map(n=>({id:n.id,title:n.title,folder:n.folder||'—',onClick:()=>this.navigate(n.id),onContext:(e)=>this.onNoteContext(e,n.id)}));
```

`sortOptions` (menu, in order): "File name (A to Z)" [`name-az`], "File name (Z to A)" [`name-za`], — divider —, "Modified time (new to old)" [`mod-new`], "Modified time (old to new)" [`mod-old`], — divider —, "Created time (new to old)" [`created-new`], "Created time (old to new)" [`created-old`]. Checkmark `✓` shown for the active `s.sort`.

Calendar grid: leading blank cells for `firstDow` (day-of-week of the 1st), then one cell per day-of-month with an ISO date key `YYYY-MM-DD`; cell styling differs for selected (accent bg, white text), today (active bg + border), has-note (panel bg + border), and empty (faint text). `dayNotes` lists notes dated to the selected day with a 50-char cleaned snippet.

Category autocomplete (`catOptions`) highlights the matched substring (`pre`/`match`/`post` split) and marks the current note's category with `●`. `catShowCreate` is true when there's a non-empty query with no exact case-insensitive category match. `catViewList` is the full Categories-view listing (category name, note count, per-category note rows), plus `uncatNotes` for notes without a category.

### Split-pane tabs/meta, note tag chips, style constants, theme cards, accent swatches, font options, cheatsheet data

```js
const splitTabs=s.split?s.split.tabs.map((t,i)=>{ const vl=viewLabel(t.hist[t.hi]); const active=i===s.split.active; return {key:'sp'+i,label:vl.label,active, style:'display:flex;align-items:center;gap:6px;max-width:170px;padding:5px 7px 5px 11px;border-radius:8px 8px 0 0;cursor:pointer;font-size:12px;background:'+(active?'var(--bg)':'transparent')+';color:'+(active?'var(--ink)':'var(--muted)')+';', onClick:()=>this.splitSelect(i), onClose:(e)=>{e.stopPropagation();this.splitCloseTab(i);}}; }):[];
const splitTitle=(()=>{ const id=this.splitCurId(); const n=id&&s.notes.find(x=>x.id===id); return n?n.title:''; })();
const splitNoteObj=splitNoteForRight;
const splitTagChips=splitNoteObj?(splitNoteObj.tags||[]).map(t=>({name:t,onRemove:()=>this.splitRemoveTag(splitNoteObj.id,t)})):[];

const noteTagChips=cur?(cur.tags||[]).map(t=>({name:t,onRemove:()=>this.removeNoteTag(cur.id,t),onSearch:()=>this.openSearch('tag:'+t)})):[];
const draft=s.tagDraft.replace(/^#/,'').trim().toLowerCase();
const tagSuggestions=(cur&&draft)?this.allTags().filter(t=>t.toLowerCase().includes(draft)&&!(cur.tags||[]).includes(t)&&t.toLowerCase()!==draft).slice(0,6).map(t=>({name:t,onMouseDown:(e)=>{e.preventDefault(); this.addTag(t);}})):[];
const hasCat=!!(cur&&cur.category); const hasDate=!!(cur&&cur.date);
const metaHasContent=hasCat||(cur&&(cur.tags||[]).length>0)||hasDate;

const toolBtn='width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:7px;cursor:pointer;color:var(--muted);';
const toolOn=toolBtn.replace('color:var(--muted);','color:var(--ink);background:var(--active);');
const ribBtn='width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:9px;cursor:pointer;color:var(--muted);';
const ribOn=ribBtn.replace('color:var(--muted);','color:#fff;background:'+C.accent+';');
const iconBtn='cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);';
const menuItem='padding:8px 13px;font-size:13px;color:var(--ink);cursor:pointer;border-radius:6px;';
const seg=(a)=>'cursor:pointer;padding:5px 14px;border-radius:7px;font-size:12.5px;font-weight:500;'+(a?'background:var(--bg);color:'+C.accent+';':'color:var(--muted);');
const THEME_SW={ 'Light':{bar:'#e0e0e0',bg:'#f5f5f5',dot:'#c9c9c9'}, 'Light Warm':{bar:'#e8ddc4',bg:'#f9f2e2',dot:'#d8c8a6'}, 'Dark':{bar:'#2c2c2c',bg:'#141414',dot:'#404040'}, 'Dark Warm':{bar:'#2c2820',bg:'#181510',dot:'#463f30'} };
const themeCards=['Light','Light Warm','Dark','Dark Warm'].map(name=>{ const sw=THEME_SW[name]; const on=this.effTheme()===name; return {name, sel:on, wrapStyle:'cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;', thumbStyle:'width:78px;height:54px;border-radius:9px;overflow:hidden;background:'+sw.bg+';box-shadow:'+(on?('0 0 0 2px '+C.accent+', 0 0 0 5px '+C.accent+'33'):'0 0 0 1px var(--border)')+';display:flex;flex-direction:column;', barStyle:'height:12px;background:'+sw.bar+';display:flex;align-items:center;gap:3px;padding:0 6px;flex:0 0 auto;', dotStyle:'width:4px;height:4px;border-radius:50%;background:'+sw.dot+';', labelStyle:'font-size:12px;color:'+(on?'var(--ink)':'var(--muted)')+';font-weight:'+(on?'600':'400')+';', onClick:()=>this.setTheme(name)}; });
```

**`themeCards`** — 4 theme preview cards, `name → {bar, bg, dot}` swatch colors:

| Theme name | bar | bg | dot |
|---|---|---|---|
| `Light` | `#e0e0e0` | `#f5f5f5` | `#c9c9c9` |
| `Light Warm` | `#e8ddc4` | `#f9f2e2` | `#d8c8a6` |
| `Dark` | `#2c2c2c` | `#141414` | `#404040` |
| `Dark Warm` | `#2c2820` | `#181510` | `#463f30` |

Each card thumb is a 78×54px rounded rect filled with `bg`, containing a 12px-tall top bar filled with `bar` color holding a small 4px dot (`dot` color) — mimicking a mini title-bar. Selected card gets a 2px accent ring + 5px soft accent halo (`accent + '33'` alpha) box-shadow; unselected gets a 1px `var(--border)` ring. Label text is bold ink when selected, muted/regular otherwise.

Note tag chips (`noteTagChips`) render each tag with a remove (`x`) handler and a click-to-search handler (`openSearch('tag:'+t)`). `tagSuggestions` (autocomplete while typing a new tag in `tagDraft`) filters `this.allTags()` for substring matches, excluding tags already on the note and an exact match of the draft itself, capped to 6.

### Continued — accent swatches, font options, markdown cheatsheet, remaining style constants, JSX host elements

```js
const navBtn=(en)=>'width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;'+(en?'cursor:pointer;color:var(--muted);':'color:var(--border);pointer-events:none;');
const canBack=!!(tab&&tab.hi>0); const canFwd=!!(tab&&tab.hi<tab.hist.length-1);
const el=React.createElement;
if(!this._edHostEl) this._edHostEl=el('div',{key:'edhost', ref:this.hostRef});
if(!this._grHostEl) this._grHostEl=el('div',{key:'grhost', ref:this.graphRef, style:{position:'absolute',inset:'0'}});
if(!this._grHostElSplit) this._grHostElSplit=el('div',{key:'grhostsplit', ref:this.splitGraphRef, style:{position:'absolute',inset:'0'}});
if(!this._splitHostEl) this._splitHostEl=el('div',{key:'sphost', ref:this.splitRenderRef});
const eyeIcon=(on)=> on ? el('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round'}, el('path',{d:'M12 20h9'}), el('path',{d:'M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z'})) : el('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round'}, el('path',{d:'M4 5.5A2.5 2.5 0 016.5 3H12v16H6.5A2.5 2.5 0 004 20.5z'}), el('path',{d:'M20 5.5A2.5 2.5 0 0017.5 3H12v16h5.5a2.5 2.5 0 012.5 1.5z'}));
const readIcon = eyeIcon(s.reading); const splitReadIconVal = eyeIcon(s.splitReading);
const splitViewObj=(s.split&&s.split.tabs[s.split.active])?s.split.tabs[s.split.active].hist[s.split.tabs[s.split.active].hi]:null;
const splitKind=splitViewObj?splitViewObj.kind:'empty';

const bulkFolders=s.folderList.concat(['(no folder)']).map(f=>({name:f,onClick:()=>this.bulkMoveTo(f==='(no folder)'?'':f)}));
const bulkCtxStyle=s.bulkCtx?('position:fixed;left:'+s.bulkCtx.x+'px;top:'+s.bulkCtx.y+'px;z-index:65;min-width:230px;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:0 16px 40px -12px rgba(25,20,12,.5);padding:5px;'):'';
```

`eyeIcon(on)` returns a pencil-style icon (edit mode indicator) when `on` is falsy vs. an open-book/eye icon when `on` is true — used for the reading-view toggle button in both the main pane and split pane (icon toggles between "edit" pencil glyph and "read" eye glyph depending on `s.reading`/`s.splitReading`). `el('div',{ref:...})` host elements for the editor, graph (main + split), and split-render pane are memoized on the instance (`this._edHostEl` etc.) so they're only created once and reused across re-renders (avoids remounting the imperatively-managed DOM subtrees).

### The `return {...}` object — full field list (lines 1095–1162)

```js
return {
  rootStyle:'height:100vh;width:100vw;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;--accent:'+C.accent+';--accent-text:'+C.accentText+';--accent-faded:'+C.accentFadedRgba+';--accent-sel:'+(()=>{ const rgb=hexToRgb(C.accent); return 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.32)'; })()+';font-family:'+(FONTS[s.appFont]||FONTS.Sans)+';',
  theme:this.themeKey(this.effTheme()), accentColorVal:C.accent, accentTextVal:C.accentText,
  ribBtn, ribGraph:kind==='graph'?ribOn:ribBtn, ribJournal:kind==='journal'?ribOn:ribBtn, ribCat:kind==='categories'?ribOn:ribBtn, ribFiles:(s.sideMode==='files'&&s.leftOpen&&kind!=='graph'&&kind!=='journal'&&kind!=='categories')?ribOn:ribBtn, newNote:()=>this.newNote(), newTab:()=>this.newTab(), toggleQuick:()=>this.toggleQuick(), goGraph:()=>this.goGraph(), goJournal:()=>this.goJournal(), goCategories:()=>this.goCategories(), showFiles:()=>this.showFiles(), openCmd:()=>this.openCmd(), openSettings:()=>this.openSettings(), toggleLeft:()=>this.toggleLeft(),
  leftOpen:s.leftOpen, sidebarStyle:'width:'+s.leftWidth+'px;flex:0 0 auto;background:var(--panel);display:flex;flex-direction:column;',
  isFilesMode:s.sideMode==='files', isSearchMode:s.sideMode==='search',
  toolBtn, toolSearch:s.sideMode==='search'?toolOn:toolBtn, toolReveal:s.autoReveal?toolOn:toolBtn,
  newFolder:()=>this.newFolder(), toggleSearchMode:()=>this.toggleSearchMode(), toggleReveal:()=>this.toggleReveal(), toggleAllFolders:()=>this.toggleAllFolders(),
  toggleSortMenu:()=>this.toggleSortMenu(), sortMenuOpen:s.sortMenuOpen, sortOptions,
  hasSelection:s.selectedIds.length>0, selCount:s.selectedIds.length, clearSelection:()=>this.clearSelection(),
  bulkCtxOpen:!!s.bulkCtx, bulkCtxStyle, bulkMainView:!!(s.bulkCtx&&!s.bulkCtx.move), bulkMoveView:!!(s.bulkCtx&&s.bulkCtx.move), bulkCount:s.selectedIds.length, bulkFolders,
  bulkNewFolder:()=>this.bulkNewFolder(), bulkCtxMoveStart:()=>this.bulkCtxMoveStart(), bulkDelete:()=>this.bulkDelete(), closeBulkCtx:()=>this.closeBulkCtx(),
  folders, rootNotes, hasRootNotes:rootNotes.length>0, rootDropStyle, rootOnDragOver:rootDrop.onDragOver, rootOnDragEnter:rootDrop.onDragEnter, rootOnDragLeave:rootDrop.onDragLeave, rootOnDrop:rootDrop.onDrop, onRenameKey:(e)=>this.onRenameKey(e), stopRename:()=>this.stopRename(), startResize:(e)=>this.startResize(e),
  searchQuery:s.searchQuery, onSearchQuery:(e)=>this.onSearchQuery(e), onSearchKey:(e)=>this.onSearchKey(e), clearSearch:()=>this.clearSearch(), hasSearchText:rawq!=='', onFolderRenameDraft:(e)=>this.onFolderRenameDraft(e),
  showOptions:rawq==='', showResults:rawq!=='', searchOptions, hasHistory:s.searchHistory.length>0, history, clearHistory:()=>this.clearHistory(),
  resultCount:sr.length+' result'+(sr.length===1?'':'s'), sortLabel:sortLabels[s.sort]||'', searchResults:sr, searchEmpty:rawq!==''&&sr.length===0,
  tabs,
  isEditor:kind==='note'&&!!cur, isGraph:kind==='graph', isJournal:kind==='journal', isCategories:kind==='categories', isHome:kind==='home', isEmpty:kind==='empty'||(kind==='note'&&!cur),
  homeEdit:()=>this.newNote(), homeSearch:()=>this.toggleQuick(), homeClose:()=>this.closeTab(s.active),
  goBack:()=>this.goBack(), goForward:()=>this.goForward(), backStyle:navBtn(canBack), fwdStyle:navBtn(canFwd), showNavBar:kind==='graph'||kind==='journal'||kind==='categories'||kind==='home',
  noteTitle:cur?cur.title:'', onTitle:(e)=>this.onTitle(e),
  iconBtn, iconBtnR:iconBtn+(s.showRight&&!focusOnSplit?'background:var(--active);color:var(--ink);':''), iconBtnRSplit:iconBtn+(s.showRight&&focusOnSplit?'background:var(--active);color:var(--ink);':''),
  toggleReading:()=>this.toggleReading(), readingIcon:readIcon, readingTitle:s.reading?'Edit':'Reading view', splitOpenNewMain:()=>this.splitOpenNewMain(),
  openMeta:()=>this.openMeta(), toggleNoteMenu:()=>this.toggleNoteMenu(), noteMenuOpen:s.noteMenuOpen, noteMenuMove:s.noteMenuMove, noteMenuMain:!s.noteMenuMove, menuItem,
  menuAttach:()=>this.triggerAttach(), menuDuplicate:()=>this.menuDuplicate(), menuMoveStart:()=>this.menuMoveStart(), menuMoveFolders:s.folderList.concat(['(no folder)']).map(f=>({name:f,onClick:()=>this.menuMoveTo(f==='(no folder)'?'':f)})), splitRight:(e)=>{e.stopPropagation();this.splitOpen('right');}, splitDown:(e)=>{e.stopPropagation();this.splitOpen('down');}, menuExportNote:()=>this.exportNote(), menuExportVault:()=>this.exportJson(), menuDelete:()=>this.deleteCurrent(),
  toggleRight:()=>this.toggleRightMain(), toggleRightSplit:()=>this.toggleRightSplit(),
  metaOpen:s.metaOpen, closeMeta:()=>this.closeMeta(), chipsVisible:!s.metaOpen&&metaHasContent,
  hasCategory:hasCat, noteCategory:cur?cur.category:'', catLabel:(cur&&cur.category)?cur.category:'None', searchCategory:()=>{ if(cur&&cur.category)this.openSearch('cat:'+cur.category); },
  toggleCatMenu:()=>this.toggleCatMenu(), catMenuOpen:s.catMenuOpen, catOptions, catQuery:s.catQuery, onCatSearch:(e)=>this.onCatSearch(e), onCatSearchKey:(e)=>this.onCatSearchKey(e), catShowCreate, catCreateLabel, catCreate:()=>this.catCreate(), clearCategory:()=>this.clearCategory(), onNewCatKey:(e)=>this.onNewCatKey(e),
  noteTagChips, tagDraft:s.tagDraft, onTagDraft:(e)=>this.onTagDraft(e), onTagKey:(e)=>this.onTagKey(e), tagSuggestions, tagSuggestOpen:tagSuggestions.length>0,
  hasDate, noteDate:cur?cur.date:'', onDate:(e)=>this.onDate(e),
  editorHost:this._edHostEl, graphHost:this._grHostEl, splitGraphHost:this._grHostElSplit,
  isSplitNoteKind:splitKind==='note'&&!!splitNoteObj, isSplitGraphKind:splitKind==='graph', isSplitJournalKind:splitKind==='journal', isSplitCategoriesKind:splitKind==='categories', isSplitHomeKind:splitKind==='home', isSplitEmptyKind:splitKind==='empty'||(splitKind==='note'&&!splitNoteObj),
  splitHomeEdit:()=>this.splitHomeEdit(), splitHomeSearch:()=>this.splitHomeSearch(), splitHomeClose:()=>this.splitHomeClose(),
  isSplit:!!s.split, mainWrapStyle:'flex:1;min-width:0;display:flex;flex-direction:'+((s.split&&s.split.dir==='down')?'column':'row')+';background:var(--bg);', splitPaneStyle:(s.split&&s.split.dir==='down')?('flex:0 0 '+(100-s.splitSize)+'%;min-height:0;min-width:0;display:flex;flex-direction:column;background:var(--bg);'):('flex:0 0 '+(100-s.splitSize)+'%;min-width:0;min-height:0;display:flex;flex-direction:column;background:var(--bg);'), splitResizerStyle:(s.split&&s.split.dir==='down')?'height:1px;flex:0 0 auto;cursor:row-resize;background:var(--border);position:relative;display:flex;align-items:center;justify-content:center;':'width:1px;flex:0 0 auto;cursor:col-resize;background:var(--border);position:relative;display:flex;align-items:center;justify-content:center;', startSplitResize:(e)=>this.startSplitResize(e), splitGripStyle:(s.split&&s.split.dir==='down')?'position:absolute;width:34px;height:13px;display:flex;align-items:center;justify-content:center;border-radius:5px;background:var(--panel);box-shadow:0 1px 4px rgba(40,32,20,.22);color:var(--muted);':'position:absolute;width:13px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:5px;background:var(--panel);box-shadow:0 1px 4px rgba(40,32,20,.22);color:var(--muted);',
  splitTabs, splitTitle, splitHost:this._splitHostEl, splitToMain:()=>this.splitToMain(), splitCloseAll:()=>this.splitCloseAll(), splitBack:()=>this.splitBack(), splitForward:()=>this.splitForward(), splitBackStyle:navBtn(!!(s.split&&s.split.tabs[s.split.active]&&s.split.tabs[s.split.active].hi>0)), splitFwdStyle:navBtn(!!(s.split&&s.split.tabs[s.split.active]&&s.split.tabs[s.split.active].hi<s.split.tabs[s.split.active].hist.length-1)), toggleSplitReading:()=>this.toggleSplitReading(), splitReadingTitle:s.splitReading?'Edit':'Reading view', splitReadIcon:splitReadIconVal, onSplitTitle:(e)=>this.onSplitTitle(e),
  setMainPane:()=>this.setMainPane(), setSplitPane:()=>this.setSplitPane(), splitNewTab:()=>this.splitNewTab(),
  splitMetaOpen:s.splitMetaOpen, openSplitMeta:()=>this.splitOpenMeta(), closeSplitMeta:()=>this.splitCloseMeta(),
  categories:s.categories, splitCategoryVal:splitNoteObj?(splitNoteObj.category||''):'', onSplitCategorySelect:(e)=>this.onSplitCategorySelect(e),
  splitTagChips, splitTagDraft:s.splitTagDraft, onSplitTagDraft:(e)=>this.splitOnTagDraft(e), onSplitTagKey:(e)=>this.splitOnTagKey(e),
  splitNoteDate:splitNoteObj?(splitNoteObj.date||''):'', onSplitDate:(e)=>this.splitOnDate(e),
  splitToggleNoteMenu:()=>this.splitToggleNoteMenu(), splitNoteMenuOpen:s.splitNoteMenuOpen, splitNoteMenuMain:!s.splitNoteMenuMove, splitNoteMenuMove:s.splitNoteMenuMove,
  splitMenuDuplicate:()=>this.splitMenuDuplicate(), splitMenuMoveStart:()=>this.splitMenuMoveStart(), splitMenuMoveFolders:s.folderList.concat(['(no folder)']).map(f=>({name:f,onClick:()=>this.splitMenuMoveTo(f==='(no folder)'?'':f)})), splitMenuExportNote:()=>this.splitMenuExportNote(), splitMenuDelete:()=>this.splitMenuDelete(),
  catViewList, uncatNotes, hasUncat:uncatNotes.length>0, catAddTop:(e)=>this.addCategoryTop(e), acOpen, acIsLink:s.linkQuery!=null, acIsTag:s.tagAcQuery!=null, linkSuggestions, tagAcSuggestions, acPopStyle,
  showRight:s.showRight&&!!rightNote,
  backlinks, backlinkCount:backlinks.length, hasBacklinks:backlinks.length>0, noBacklinks:backlinks.length===0,
  outgoing, hasOutgoing:outgoing.length>0, noOutgoing:outgoing.length===0,
  weekdays:['Su','Mo','Tu','We','Th','Fr','Sa'], monthLabel:MN[mo]+' '+y, prevMonth:()=>this.prevMonth(), nextMonth:()=>this.nextMonth(), calendar:cells, dayNotes, noDayNotes:dayNotes.length===0, dayHeading:s.calSelected, newDaily:()=>this.openOrCreate(s.calSelected,'Journal'),
  themeCards,
  settingsOpen:s.settingsOpen, closeSettings:()=>this.closeSettings(), setLight:()=>this.setTheme('Light'), setDark:()=>this.setTheme('Dark'), segLight:seg(this.effTheme()==='Light'), segDark:seg(this.effTheme()==='Dark'), triggerImport:()=>this.triggerImport(), exportJson:()=>this.exportJson(),
  accentValue:C.accent, onAccent:(e)=>this.onAccent(e), accentSwatches:['#b0623b','#7d8a5f','#5f7d8a','#8a5f7d','#a8843a','#9d5b5b','#5f6f8a','#4c4a44'].map(hex=>({hex,sel:C.accent.toLowerCase()===hex,onClick:()=>this.setAccent(hex),style:'width:26px;height:26px;border-radius:50%;cursor:pointer;background:'+hex+';box-shadow:0 0 0 '+(C.accent.toLowerCase()===hex?'2px var(--bg),0 0 0 4px '+hex:'1px var(--border)')+';'})), fontOptions:FONT_OPTS, appFont:s.appFont, noteFont:s.noteFont, onAppFont:(e)=>this.onAppFont(e), onNoteFont:(e)=>this.onNoteFont(e),
  cheatOpen:s.cheatOpen, openCheat:()=>this.setState({cheatOpen:true}), closeCheat:()=>this.setState({cheatOpen:false}),
  mdHelpGroups:[
    {group:'Headings & text',items:[{label:'Heading',syntax:'# H1   ## H2   ### H3'},{label:'Bold',syntax:'**bold**'},{label:'Italic',syntax:'*italic*'},{label:'Divider',syntax:'---'}]},
    {group:'Lists',items:[{label:'Bullet list',syntax:'- item'},{label:'Numbered list',syntax:'1. item'},{label:'Checkbox',syntax:'- [ ] todo   - [x] done'}]},
    {group:'Links & tags',items:[{label:'Internal link',syntax:'[[Note title]]'},{label:'External link',syntax:'[text](https://…)'},{label:'Tag',syntax:'#tag'}]},
    {group:'Code & quotes',items:[{label:'Inline code',syntax:'`code`'},{label:'Code block',syntax:'```\ncode\n```'},{label:'Quote',syntax:'> quoted text'}]},
    {group:'Table',items:[{label:'Table',syntax:'| A | B |\n|---|---|\n| 1 | 2 |'}]},
  ],
  anyMenuOpen:s.sortMenuOpen||s.noteMenuOpen||s.catMenuOpen, closeMenus:()=>this.setState({sortMenuOpen:false,noteMenuOpen:false,noteMenuMove:false,catMenuOpen:false}), closeMenusCtx:(e)=>{e.preventDefault();this.setState({sortMenuOpen:false,noteMenuOpen:false,noteMenuMove:false,catMenuOpen:false});},
  catCtxOpen:!!s.catCtx, catCtxStyle:s.catCtx?('position:fixed;left:'+s.catCtx.x+'px;top:'+s.catCtx.y+'px;min-width:150px;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:0 18px 44px -12px rgba(25,20,12,.55);padding:5px;z-index:62;'):'', closeCatCtx:()=>this.closeCatCtx(), catCtxRename:()=>this.catCtxRename(), catCtxDelete:()=>this.catCtxDelete(),
  folderCtxOpen:!!s.folderCtx, folderCtxStyle:s.folderCtx?('position:fixed;left:'+s.folderCtx.x+'px;top:'+s.folderCtx.y+'px;min-width:150px;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:0 18px 44px -12px rgba(25,20,12,.55);padding:5px;z-index:62;'):'', closeFolderCtx:()=>this.closeFolderCtx(), folderCtxRename:()=>this.startFolderRename(s.folderCtx&&s.folderCtx.name), folderCtxDelete:()=>this.deleteFolder(s.folderCtx&&s.folderCtx.name), folderCtxNew:()=>this.newSubfolder(s.folderCtx&&s.folderCtx.name),
  ctxOpen:!!s.ctxMenu, ctxStyle:s.ctxMenu?('position:fixed;left:'+s.ctxMenu.x+'px;top:'+s.ctxMenu.y+'px;min-width:194px;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:0 18px 44px -12px rgba(25,20,12,.55);padding:5px;'):'', closeCtx:()=>this.closeCtx(), closeCtxCtx:(e)=>{e.preventDefault();this.closeCtx();}, ctxMainView:!!s.ctxMenu&&!s.ctxMove, ctxMoveView:!!s.ctxMenu&&s.ctxMove, ctxOpenNote:()=>this.ctxOpenNote(), ctxDuplicate:()=>this.ctxDuplicate(), ctxRename:()=>this.ctxRename(), ctxDelete:()=>this.ctxDelete(), ctxMoveStart:()=>this.ctxMoveStart(), ctxFolders:s.folderList.concat(['(no folder)']).map(f=>({name:f,onClick:()=>this.moveCtx(f==='(no folder)'?'':f)})),
  stop:(e)=>e.stopPropagation(),
  quickOpen:s.quickOpen, quickQuery:s.quickQuery, onQuick:(e)=>this.onQuick(e), closeQuick:()=>this.closeQuick(), quickResults, quickEmpty:quickResults.length===0,
  cmdOpen:s.cmdOpen, cmdQuery:s.cmdQuery, onCmd:(e)=>this.onCmd(e), closeCmd:()=>this.closeCmd(), commands, cmdEmpty:commands.length===0,
  onImport:(e)=>this.onImport(e), onAttach:(e)=>this.onAttach(e),
};
```

**`accentSwatches`** default swatch hex colors, in order:
`#b0623b`, `#7d8a5f`, `#5f7d8a`, `#8a5f7d`, `#a8843a`, `#9d5b5b`, `#5f6f8a`, `#4c4a44`.
Each rendered as a 26px circle; selected swatch (matching `C.accent`, case-insensitive) gets a double ring (`0 0 0 2px var(--bg), 0 0 0 4px <hex>`), unselected gets a single `1px var(--border)` ring. `onClick` calls `this.setAccent(hex)`.

**`fontOptions`**: bound directly to the module-level `FONT_OPTS` constant (defined earlier in the file, in lines 1–653 — not redefined here); used for both the app font (`appFont`) and per-note font (`noteFont`) `<select>` dropdowns in Settings.

**`mdHelpGroups`** — the full markdown cheatsheet data structure, verbatim, 5 groups:

1. **Headings & text**
   - Heading — `# H1   ## H2   ### H3`
   - Bold — `**bold**`
   - Italic — `*italic*`
   - Divider — `---`
2. **Lists**
   - Bullet list — `- item`
   - Numbered list — `1. item`
   - Checkbox — `- [ ] todo   - [x] done`
3. **Links & tags**
   - Internal link — `[[Note title]]`
   - External link — `[text](https://…)`
   - Tag — `#tag`
4. **Code & quotes**
   - Inline code — `` `code` ``
   - Code block — ` ```\ncode\n``` `
   - Quote — `> quoted text`
5. **Table**
   - Table — `| A | B |\n|---|---|\n| 1 | 2 |`

**Import/export vault JSON logic** is bound here via `triggerImport`/`exportJson` (implementations shown above in the Import/Export/Attachments section — `exportJson` downloads `{vault:'My Vault', exportedAt, folders, categories, notes}` as `my-vault.json`; `onImport` reads dropped/selected `.md`/`.markdown`/`.txt` files as text and creates one note per file in the `'Notes'` folder).

**Render/JSX-binding pattern**: `renderVals()` is called once per render and returns a single flat(ish) plain object whose keys are referenced by the JSX template (part 1, lines 1–653) via `{{ }}`-style bindings — e.g. template bindings like `{{rootStyle}}`, `{{folders}}`, `{{commands}}`, `{{themeCards}}`, `{{mdHelpGroups}}` map 1:1 to the corresponding keys computed above. Style strings are precomputed as full inline CSS text (not objects) and interpolated directly; event handlers are precomputed closures (`()=>this.someMethod()`) rather than referencing methods with `.bind`; list-shaped template sections (folders, notes, tabs, commands, search results, etc.) are pre-mapped arrays of small view-model objects with both display fields and closures for their own click/context/drag handlers, so the template layer stays purely declarative/mechanical.

## Closing script tag and trailing HTML (lines 1164–1167)

```
}
</script>
</body>
</html>
```

Line 1164 closes the Component class (`}`). No other script blocks, trailing config, or markup follow — `</script>` is immediately followed by `</body>` and `</html>`, which are the final two lines of the file (EOF at line 1167).

---

**Note on `C.*` and helper constants referenced above** (`C.accent`, `C.accentText`, `C.accentFadedRgba`, `C.code`, `C.ink`, `C.mut`, `C.sage`, `THEME_BG`, `FONTS`, `FONT_OPTS`, `TODAY`, `mixHex`, `hexToRgb`, `saturateHex`, `accessibleAccent`, `esc`, `escAttr`) are module-level objects/functions defined earlier in the file (lines 1–653, already captured separately) — this part-2 extraction only covers their usage sites, not their definitions.
