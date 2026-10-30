"use strict";
(() => {
  const el=id=>document.getElementById(id),money=new Intl.NumberFormat("id-ID",{maximumFractionDigits:2}),percent=new Intl.NumberFormat("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:"exceptZero"});
  const date=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  let snapshot={codes:[],quotes:[]};
  const make=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
  function render(){
    const rows=snapshot.codes.filter(code=>window.Terminal.instrumentInfo(code).kind==="stock").map(code=>({code,...snapshot.quotes.find(q=>q.code===code)}));
    const counts={up:0,down:0,flat:0,missing:0};for(const row of rows)counts[HeatmapModel.classify(row)]++;
    el("heatmap-count").textContent=`${rows.length} saham`;
    el("heatmap-breadth").textContent=`${counts.up} naik · ${counts.down} turun · ${counts.flat} tetap`+(counts.missing?` · ${counts.missing} belum tersedia / lama`:"");
    rows.sort((a,b)=>el("heatmap-sort").value==="change"?(HeatmapModel.classify(b)==="missing"?-Infinity:b.change_percent)-(HeatmapModel.classify(a)==="missing"?-Infinity:a.change_percent)||a.code.localeCompare(b.code):a.code.localeCompare(b.code));
    const tiles=el("heatmap-tiles");tiles.replaceChildren();
    for(const row of rows){
      const kind=HeatmapModel.classify(row),button=make("button","heatmap-tile "+kind+(window.Terminal.getSymbol()===row.code?" selected":""),"");button.type="button";button.style.background=HeatmapModel.color(row);
      const change=kind==="missing"?(row.stale?"DATA LAMA":"BELUM TERSEDIA"):percent.format(row.change_percent)+"%";
      button.append(make("strong","heatmap-code",row.code),make("span","heatmap-change",change),make("span","heatmap-price",Number.isFinite(row.price)?"Rp "+money.format(row.price):"Harga —"));
      if(row.session_date)button.append(make("small","",`Sesi ${row.session_date.slice(8,10)}/${row.session_date.slice(5,7)}`));
      const stamp=row.fetched_at&&Number.isFinite(Date.parse(row.fetched_at))?date.format(new Date(row.fetched_at))+" WIB":"belum tersedia";
      button.title=`${row.code} · ${row.name||row.code}\n${change} vs close sesi sebelumnya\nSesi ${row.session_date||"—"} · Diambil ${stamp}${kind==="missing"?" · Jangan dianggap sebagai perubahan terkini":" · Data tertunda"}`;
      button.setAttribute("aria-label",`Buka ${row.code} dari heatmap, ${change}`);
      button.addEventListener("click",()=>{window.Terminal.selectSymbol(row.code);window.TerminalWorkspace?.show("chart");window.TerminalWorkspace?.show("news",false);});tiles.append(button);
    }
    if(!rows.length)tiles.append(make("p","heatmap-empty","Belum ada saham di watchlist. Tambahkan kode saham lewat widget Watchlist; IHSG tidak termasuk kotak saham."));
    const sessions=[...new Set(rows.filter(r=>HeatmapModel.classify(r)!=="missing").map(r=>r.session_date).filter(Boolean))];
    el("heatmap-status").textContent=sessions.length>1?"Tanggal sesi data berbeda antar saham. Periksa tanggal pada kotak sebelum membandingkan.":sessions.length?`Sesi data ${sessions[0]} · Data tertunda · Refresh mengikuti Auto 60 dtk.`:"Menunggu perubahan harga yang valid dari watchlist.";
  }
  window.addEventListener("terminal:quotes",event=>{snapshot=event.detail;render();});
  window.addEventListener("terminal:symbol",render);el("heatmap-sort").addEventListener("change",render);
  if(window.TerminalWatchlist)snapshot=window.TerminalWatchlist.getSnapshot();render();
})();
