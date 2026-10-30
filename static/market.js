"use strict";

(() => {
  const el=id=>document.getElementById(id);
  const number=new Intl.NumberFormat("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2});
  const signed=new Intl.NumberFormat("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:"exceptZero"});
  const date=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  let data=null, busy=false, lastCheck=0;
  function render() {
    el("market-price").textContent=Number.isFinite(data?.price)?number.format(data.price):"—";
    const change=data?.change_percent, known=Number.isFinite(change)&&Number.isFinite(data?.change);
    el("market-change").textContent=known?`${signed.format(data.change)} poin (${signed.format(change)}%)` : "Perubahan sesi belum tersedia";
    el("market-change").className="market-change "+(known?(change>0?"up":change<0?"down":""):"");
    el("market-previous").textContent=Number.isFinite(data?.previous_close)?number.format(data.previous_close):"—";
    el("market-session").textContent=data?.session_date||"—";
    const stamp=data?.fetched_at?`Diambil ${date.format(new Date(data.fetched_at))} WIB`:"Belum ada data";
    el("market-status").textContent=`${stamp} · ${data?.error||data?.stale?"Gagal diperbarui; data lama jika tersedia.":"Data tertunda · Δ vs sesi sebelumnya"}`;
    el("market-status").classList.toggle("market-warning",Boolean(data?.error||data?.stale));
  }
  async function load() {
    if(busy)return;
    busy=true;lastCheck=Date.now();
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),35000);
    try {
      const response=await fetch("/api/quotes?symbols=IHSG",{signal:controller.signal});
      const payload=await response.json();
      const quote=payload.quotes?.find(q=>q.code==="IHSG"&&q.symbol==="^JKSE");
      if(!response.ok||!quote)throw new Error("IHSG unavailable");
      data=quote.error&&!Number.isFinite(quote.price)&&data?{...data,error:quote.error,stale:true}:quote;
    } catch {data={...data,error:"Gagal memperbarui IHSG.",stale:Boolean(data?.fetched_at)};}
    finally {clearTimeout(timeout);busy=false;render();}
  }
  function refresh(){if(!document.hidden&&el("auto-refresh").checked&&Date.now()-lastCheck>=61000)load();}
  el("market-open").addEventListener("click",()=>window.Terminal.selectSymbol("IHSG"));
  window.addEventListener("terminal:refresh",load);
  el("auto-refresh").addEventListener("change",refresh);
  document.addEventListener("visibilitychange",refresh);
  setInterval(refresh,1000);load();
})();
