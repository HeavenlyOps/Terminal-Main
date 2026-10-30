"use strict";
(() => {
  const T=window.Technicals, el=id=>document.getElementById(id), storageKey="nusantara.indicators.v1";
  const overlays=T.catalog.filter(d=>d.group==="overlay"), oscillators=T.catalog.filter(d=>d.group!=="overlay");
  const maTypes=["sma","ema","wma","hma","dema","tema","vwma"];
  const colors=["#e7b661","#77b7ff","#d397ed","#58d8c5","#ef95b8","#a4c686","#e69561"];
  const fmt=new Intl.NumberFormat("id-ID",{maximumFractionDigits:3});
  let data=null, activeTab="overlay", plotSeq=[0,0], resizeTimers=[null,null];
  const state={overlays:Object.fromEntries(overlays.map(d=>[d.id,{enabled:d.id==="sma20",params:T.parameters(d)}])),panels:[{id:"rsi",params:{}},{id:"macd",params:{}}]};
  const definition=id=>T.catalog.find(d=>d.id===id);
  function title(def,params){return maTypes.includes(def.family)?def.family.toUpperCase()+" "+params.period:def.label+(Object.keys(params).length?" ("+Object.values(params).join(", ")+")":"");}
  try {
    const saved=JSON.parse(localStorage.getItem(storageKey));
    if(saved?.version===1){
      for(const def of overlays){const item=saved.overlays?.[def.id];if(item&&typeof item.enabled==="boolean")state.overlays[def.id]={enabled:item.enabled,params:T.parameters(def,item.params)};}
      for(let i=0;i<2;i++){const item=saved.panels?.[i],def=oscillators.find(d=>d.id===item?.id);if(def)state.panels[i]={id:def.id,params:T.parameters(def,item.params)};}
    }
  } catch {el("indicator-storage-note").textContent="Pengaturan tersimpan tidak terbaca; memakai pilihan awal.";}
  for(const panel of state.panels)panel.params=T.parameters(definition(panel.id),panel.params);
  function make(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify({version:1,...state}));el("indicator-storage-note").textContent="Pilihan dan parameter tersimpan otomatis di browser.";}catch{el("indicator-storage-note").textContent="Browser menolak penyimpanan. Pilihan hanya berlaku pada tab ini.";}}
  function changed(){save();renderChips();renderPanels();window.dispatchEvent(new Event("terminal:indicators"));}
  function paramsForm(def,params,onChange){
    const box=make("div","indicator-fields");
    for(const [key,spec] of Object.entries(def.params)){
      const label=make("label","",spec.label),input=make("input","");input.type="number";input.min=spec.min;input.max=spec.max;input.step=spec.step;input.value=params[key];
      input.setAttribute("aria-label",`${def.label} — ${spec.label}`);
      input.addEventListener("change",()=>{if(!input.checkValidity()||input.value===""){input.reportValidity();input.value=params[key];return;}onChange(T.parameters(def,{...params,[key]:Number(input.value)}));});
      label.append(input);box.append(label);
    }
    return box;
  }
  function selectPanel(index,id){const def=definition(id);state.panels[index]={id,params:T.parameters(def)};changed();renderLibrary();}
  function renderLibrary(){
    const query=el("indicator-search").value.toLowerCase().trim(),list=el("indicator-library-list");list.replaceChildren();
    const chosen=activeTab==="overlay"?overlays:oscillators;
    for(const def of chosen.filter(d=>(d.label+" "+d.description+" "+d.group).toLowerCase().includes(query))){
      const card=make("div","indicator-card"),heading=make("div","indicator-card-heading"),body=make("div","");
      body.append(make("strong","",def.label),make("small","indicator-category",(def.group==="overlay"?"DI GRAFIK":def.group.toUpperCase())+(def.volume?" · VOLUME":"")));
      heading.append(body);
      if(activeTab==="overlay"){
        const toggle=make("input","");toggle.type="checkbox";toggle.checked=state.overlays[def.id].enabled;toggle.setAttribute("aria-label",`Aktifkan ${def.label}`);
        toggle.addEventListener("change",()=>{state.overlays[def.id].enabled=toggle.checked;changed();renderLibrary();});heading.append(toggle);
      }else{
        const buttons=make("div","indicator-slot-buttons");
        for(let i=0;i<2;i++){const button=make("button",state.panels[i].id===def.id?"active":"",`Panel ${i+1}`);button.type="button";button.setAttribute("aria-label",`Pakai ${def.label} di panel ${i+1}`);button.addEventListener("click",()=>selectPanel(i,def.id));buttons.append(button);}heading.append(buttons);
      }
      card.append(heading,make("p","",def.description));
      if(activeTab==="overlay"&&state.overlays[def.id].enabled){
        card.append(paramsForm(def,state.overlays[def.id].params,params=>{state.overlays[def.id].params=params;changed();renderLibrary();}));
        if(data){const result=T.calculate(def.id,data,state.overlays[def.id].params);if(result.note)card.append(make("p","indicator-warning",result.note));}
      }
      list.append(card);
    }
    if(!list.children.length)list.append(make("p","indicator-no-match","Tidak ada indikator yang cocok."));
    document.querySelectorAll("[data-indicator-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.indicatorTab===activeTab)));
  }
  function renderChips(){
    const active=overlays.filter(d=>state.overlays[d.id].enabled),box=el("active-indicators");box.replaceChildren();
    el("indicator-count").textContent=active.length;el("show-sma").checked=state.overlays.sma20.enabled;
    el("quick-sma-label").textContent=title(definition("sma20"),state.overlays.sma20.params);
    const warnings=[];
    for(const [i,def] of active.entries()){
      const label=title(def,state.overlays[def.id].params),button=make("button","indicator-chip",label+" ×");button.type="button";button.style.setProperty("--indicator-color",colors[i%colors.length]);button.setAttribute("aria-label",`Nonaktifkan ${label}`);
      button.addEventListener("click",()=>{state.overlays[def.id].enabled=false;changed();});
      if(data){const result=T.calculate(def.id,data,state.overlays[def.id].params);button.title=result.note||def.description;if(result.note){button.classList.add("incomplete");warnings.push(`${label}: ${result.note}`);}}
      box.append(button);
    }
    box.hidden=active.length===0;
    el("indicator-note").textContent=warnings.length?warnings.join(" "):data?`Periode = jumlah candle. Dihitung dari ${data.candles.length} candle pada rentang ini; EMA/indikator kumulatif dapat berubah saat awal rentang berubah.`:"Indikator mengikuti saham dan interval grafik.";
    el("indicator-note").classList.toggle("indicator-warning",warnings.length>0);
  }
  function overlayResults(input){return overlays.filter(d=>state.overlays[d.id].enabled).map((def,i)=>({...T.calculate(def.id,input,state.overlays[def.id].params),color:colors[i%colors.length]}));}
  function panelControls(index){
    const config=state.panels[index],def=definition(config.id),select=el(`technical-select-${index}`);select.value=config.id;
    const box=el(`technical-settings-${index}`);box.replaceChildren(paramsForm(def,config.params,params=>{config.params=params;changed();}));
    if(!Object.keys(def.params).length)box.append(make("p","","Indikator ini tidak memiliki parameter periode."));
    el(`technical-description-${index}`).textContent=def.description;
  }
  async function renderPanel(index){
    const seq=++plotSeq[index],chart=el(`technical-chart-${index}`),empty=el(`technical-empty-${index}`),values=el(`technical-values-${index}`),note=el(`technical-note-${index}`),config=state.panels[index],def=definition(config.id);
    values.replaceChildren();
    if(!data){if(chart.data)Plotly.purge(chart);el(`technical-meta-${index}`).textContent="—";empty.hidden=false;empty.textContent="Menunggu data grafik…";note.textContent="Mengikuti kode dan interval grafik utama.";return;}
    const result=T.calculate(config.id,data,config.params);
    el(`technical-meta-${index}`).textContent=`${data.code} · ${data.interval_label}`;
    for(const line of result.lines){if(line.type==="bar"&&result.lines.length>1)continue;const value=line.values.at(-1),item=make("span","",line.name+" ");item.append(make("strong","",finite(value)?fmt.format(value):"—"));values.append(item);}
    note.textContent=result.note||`${title(def,config.params)} · ${data.candles.length} candle · Waktu mengikuti grafik utama.`;
    note.classList.toggle("indicator-warning",Boolean(result.note));
    const usable=result.lines.some(line=>line.values.some(finite));empty.hidden=usable;
    if(!usable){if(chart.data)Plotly.purge(chart);empty.textContent=result.note||"Belum ada nilai indikator.";return;}
    if(!chart.offsetWidth||!chart.offsetHeight)return;
    const x=data.candles.map(r=>r.chart_time),labels=Object.fromEntries(x.map(t=>[t,data.range==="1d"?t.slice(11,16):t.slice(8,10)+"/"+t.slice(5,7)]));
    const traces=result.lines.map((line,i)=>({type:line.type||"scatter",mode:"lines",x,y:line.values,name:line.name,connectgaps:false,
      line:{color:line.color||colors[i%colors.length],width:1.35},...(line.type==="bar"?{marker:{color:line.values.map(v=>v>=0?"#52cdb080":"#f17d8580")}}:{}),
      customdata:data.candles.map(r=>r.chart_time.replace("T"," ")+" WIB"),hovertemplate:`%{customdata}<br>${line.name}: %{y:,.3~f}<extra></extra>`}));
    const layout={autosize:true,paper_bgcolor:"#121a27",plot_bgcolor:"#121a27",font:{family:"Consolas,monospace",size:9,color:"#8fa2bc"},margin:{l:12,r:53,t:9,b:28},showlegend:false,hovermode:"x",dragmode:"pan",separators:",.",
      uirevision:data.symbol+data.range+data.interval+config.id+JSON.stringify(config.params),
      xaxis:{type:"category",categoryorder:"array",categoryarray:x,labelalias:labels,gridcolor:"#223044",nticks:4,zeroline:false},
      yaxis:{side:"right",gridcolor:"#223044",zeroline:false,nticks:4,tickformat:["Volume"].includes(def.group)&&!["mfi","cmf"].includes(def.id)?".3s":",.3~f",...(result.range?{range:result.range,fixedrange:true}:{autorange:true})},
      shapes:result.levels.map(y=>({type:"line",xref:"paper",x0:0,x1:1,y0:y,y1:y,line:{color:"#63748c",width:1,dash:"dot"}}))};
    await Plotly.react(chart,traces,layout,{responsive:true,scrollZoom:true,displayModeBar:false});
    if(seq!==plotSeq[index])return;
  }
  const finite=Number.isFinite;
  function reportPlotError(i,error){console.error("Grafik indikator gagal dimuat",error);el(`technical-empty-${i}`).hidden=false;el(`technical-empty-${i}`).textContent="Grafik indikator gagal dimuat. Coba muat ulang halaman.";}
  function renderPanels(){for(let i=0;i<2;i++){panelControls(i);renderPanel(i).catch(error=>reportPlotError(i,error));}}
  for(let i=0;i<2;i++){
    const select=el(`technical-select-${i}`);
    for(const group of [...new Set(oscillators.map(d=>d.group))]){const optgroup=make("optgroup","");optgroup.label=group;for(const def of oscillators.filter(d=>d.group===group)){const option=make("option","",def.label);option.value=def.id;optgroup.append(option);}select.append(optgroup);}
    select.addEventListener("change",()=>selectPanel(i,select.value));
    const redraw=()=>{clearTimeout(resizeTimers[i]);resizeTimers[i]=setTimeout(()=>renderPanel(i).catch(error=>reportPlotError(i,error)),100);};
    new ResizeObserver(redraw).observe(el(`technical-chart-${i}`).parentElement);
    window.addEventListener("terminal:layout",redraw);
  }
  const dialog=el("indicator-dialog");
  el("indicator-open").addEventListener("click",()=>{renderLibrary();dialog.showModal();el("indicator-search").focus();});
  el("indicator-close").addEventListener("click",()=>dialog.close());el("indicator-done").addEventListener("click",()=>dialog.close());
  el("indicator-search").addEventListener("input",renderLibrary);
  document.querySelectorAll("[data-indicator-tab]").forEach(button=>button.addEventListener("click",()=>{activeTab=button.dataset.indicatorTab;renderLibrary();}));
  const presets={basic:{overlays:["sma20","sma50","sma200"],panels:["rsi","macd"]},trend:{overlays:["ema9","ema21","supertrend"],panels:["adx","aroon"]},volatility:{overlays:["bb","kc"],panels:["atr","bbwidth"]},volume:{overlays:["vwap","vwma20"],panels:["mfi","obv"]}};
  document.querySelectorAll("[data-indicator-preset]").forEach(button=>button.addEventListener("click",()=>{
    const preset=presets[button.dataset.indicatorPreset];for(const def of overlays)state.overlays[def.id]={enabled:preset?.overlays.includes(def.id)||false,params:T.parameters(def)};
    if(preset)state.panels=preset.panels.map(id=>({id,params:T.parameters(definition(id))}));changed();renderLibrary();
  }));
  el("show-sma").addEventListener("change",()=>{state.overlays.sma20.enabled=el("show-sma").checked;changed();});
  window.addEventListener("terminal:data",event=>{data=event.detail;renderChips();renderPanels();});
  window.TerminalIndicators={overlayResults,getSettings:()=>state};
  renderChips();renderPanels();
})();
