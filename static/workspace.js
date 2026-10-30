"use strict";

(() => {
  const el = id=>document.getElementById(id);
  const {definitions, defaults, parse, mergePositions} = window.TerminalLayout;
  const storageKey = "nusantara.layout.v1";
  const wrappers = new Map(), catalog = new Map();
  let state = defaults(), busy = true, saveTimer;
  function status(text) {el("layout-status").textContent=text;}
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw!==null) {state=parse(raw);status("Susunan tersimpan dipulihkan");}
  } catch {status("Susunan tidak terbaca; memakai susunan awal.");}

  const grid = GridStack.init({column:12, cellHeight:64, margin:6, animate:false,
    handle:".widget-handle", draggable:{cancel:"button:not(.widget-grip), input, select, a"},
    resizable:{handles:"se"}, alwaysShowResizeHandle:true,
    columnOpts:{breakpoints:[{w:900,c:1}]}, auto:false}, el("widget-grid"));

  function updateCatalog() {
    let count=0;
    for (const item of state) {
      const button=catalog.get(item.id);
      button.disabled=item.visible;
      button.querySelector(".widget-add-state").textContent=item.visible?"AKTIF":"＋";
      button.setAttribute("aria-label",`${item.visible?"Sudah tampil":"Tambah widget"}: ${definitions.find(d=>d.id===item.id).label}`);
      if(item.visible) count++;
    }
    el("widget-count").textContent=`${count} widget aktif`;
    el("layout-empty").hidden=count!==0;
  }

  function capture() {
    // GridStack saves the largest layout, preserving desktop coordinates on mobile.
    state = mergePositions(state,grid.save(false));
  }
  function save() {
    if (busy) return;
    capture();updateCatalog();
    try {
      const serialized=JSON.stringify({version:2,widgets:state});
      parse(serialized);
      localStorage.setItem(storageKey,serialized);status("Tersimpan otomatis di browser");return true;
    } catch(error) {
      console.warn("Susunan tidak dapat disimpan",error);
      status("Susunan belum dapat disimpan; berlaku selama tab ini terbuka.");
      return false;
    }
  }
  function scheduleSave() {if(!busy){clearTimeout(saveTimer);saveTimer=setTimeout(save,120);}}

  function show(id,focus=true) {
    if(!wrappers.has(id))return;
    if (state.find(item=>item.id===id)?.visible) return;
    const item=state.find(item=>item.id===id), def=definitions.find(d=>d.id===id), wrapper=wrappers.get(id);
    el("widget-grid").append(wrapper);
    grid.makeWidget(wrapper,{...item,id,autoPosition:true,minW:def.minW,minH:def.minH});
    save();
    if(focus){wrapper.querySelector(".widget-grip").focus({preventScroll:true});wrapper.scrollIntoView({behavior:"smooth",block:"nearest"});}
    window.dispatchEvent(new Event("terminal:layout"));
  }
  function hide(id) {
    capture();
    const wrapper=wrappers.get(id);
    grid.removeWidget(wrapper,false);
    el("widget-storage").append(wrapper);
    state.find(item=>item.id===id).visible=false;
    save();
    if(el("widget-catalog").hidden) {
      el("widget-catalog").hidden=false;el("add-widget-toggle").setAttribute("aria-expanded","true");
    }
    catalog.get(id).focus({preventScroll:true});
  }

  for (const def of definitions) {
    const panel=document.querySelector(`[data-widget="${def.id}"]`);
    const wrapper=document.createElement("div");wrapper.className="grid-stack-item";wrapper.dataset.widgetId=def.id;
    panel.classList.add("grid-stack-item-content");wrapper.append(panel);wrappers.set(def.id,wrapper);
    const header=panel.querySelector(".panel-header");header.classList.add("widget-handle");
    const grip=document.createElement("button");grip.type="button";grip.className="widget-grip";grip.textContent="⋮⋮";
    grip.setAttribute("aria-label",`Atur widget ${def.label}`);
    grip.title="Geser panel. Keyboard: panah untuk pindah; Shift + panah untuk ukuran.";
    grip.addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
      event.preventDefault();const n=wrapper.gridstackNode;if(!n)return;
      const dx=event.key==="ArrowRight"?1:event.key==="ArrowLeft"?-1:0;
      const dy=event.key==="ArrowDown"?1:event.key==="ArrowUp"?-1:0;
      const c=grid.getColumn();
      if(event.shiftKey)grid.update(wrapper,{w:Math.min(c-n.x,Math.max(Math.min(c,def.minW),n.w+dx)),h:Math.min(50,Math.max(def.minH,n.h+dy))});
      else grid.update(wrapper,{x:Math.max(0,Math.min(c-n.w,n.x+dx)),y:Math.max(0,Math.min(1000,n.y+dy))});
      save();window.dispatchEvent(new Event("terminal:layout"));
    });
    header.prepend(grip);
    const close=document.createElement("button");close.type="button";close.className="widget-close";close.textContent="×";
    close.title="Tutup widget";close.setAttribute("aria-label",`Tutup widget ${def.label}`);
    close.addEventListener("click",()=>hide(def.id));header.append(close);
    const button=document.createElement("button");button.type="button";button.className="widget-add";
    const text=document.createElement("span"),name=document.createElement("strong"),description=document.createElement("small"),tag=document.createElement("span");
    name.textContent=def.label;description.textContent=def.description;text.append(name,description);
    tag.className="widget-add-state";button.append(text,tag);
    button.addEventListener("click",()=>show(def.id));el("widget-catalog").append(button);catalog.set(def.id,button);
  }

  function restore(items) {
    busy=true;clearTimeout(saveTimer);grid.batchUpdate();grid.removeAll(false,false);
    for(const wrapper of wrappers.values())el("widget-storage").append(wrapper);
    // Restore at 12 columns first so a mobile load retains the desktop layout.
    grid.column(12);
    state=items.map(item=>({...item}));
    for(const item of [...state].sort((a,b)=>a.y-b.y||a.x-b.x)) {
      if(!item.visible)continue;
      const def=definitions.find(d=>d.id===item.id),wrapper=wrappers.get(item.id);
      el("widget-grid").append(wrapper);
      grid.makeWidget(wrapper,{...item,minW:def.minW,minH:def.minH,maxH:50});
    }
    grid.batchUpdate(false);grid.onResize();busy=false;updateCatalog();
    window.dispatchEvent(new Event("terminal:layout"));
  }
  restore(state);
  grid.on("change",scheduleSave);
  grid.on("dragstop resizestop",()=>{scheduleSave();window.dispatchEvent(new Event("terminal:layout"));});
  el("reset-layout").addEventListener("click",()=>{restore(defaults());if(save())status("Susunan awal dipulihkan & disimpan");});
  el("add-widget-toggle").addEventListener("click",()=>{
    const panel=el("widget-catalog");panel.hidden=!panel.hidden;
    el("add-widget-toggle").setAttribute("aria-expanded",String(!panel.hidden));
  });
  window.addEventListener("pagehide",save);

  let resizeTimer;
  function resizeChart() {
    clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
      const chart=el("chart");
      if(chart.offsetWidth&&chart.offsetHeight&&chart.data)Plotly.Plots.resize(chart).catch(()=>{});
    },80);
  }
  new ResizeObserver(resizeChart).observe(el("chart").parentElement);
  window.addEventListener("terminal:layout",resizeChart);
  window.TerminalWorkspace={show};
})();
