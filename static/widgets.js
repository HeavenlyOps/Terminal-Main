"use strict";

(() => {
  const el = id => document.getElementById(id);
  const key = "nusantara.watchlist.v1";
  const defaults = ["IHSG", "BBCA", "BBRI", "BMRI", "TLKM", "ASII"];
  const valid = value => /^[A-Z][A-Z0-9]{1,7}$/.test(value);
  const normalise = value => window.Terminal.normaliseCode(value);
  const money = new Intl.NumberFormat("id-ID", {maximumFractionDigits:2});
  const percent = new Intl.NumberFormat("id-ID", {minimumFractionDigits:2, maximumFractionDigits:2, signDisplay:"exceptZero"});
  const date = new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  const clock = new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  let watchlist = [...defaults], quotes = new Map(), quoteBusy = false, quoteSeq = 0, quoteController, lastQuoteCheck = 0;
  let newsData = null, newsBusy = false, newsSeq = 0, newsController, lastNewsCheck = 0;

  function tellWatchlist(text) {el("watchlist-message").textContent=text;el("watchlist-message").hidden=!text;}
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      const values = JSON.parse(saved);
      if (!Array.isArray(values)) throw new Error("Invalid saved watchlist");
      watchlist = [...new Set(values.filter(value=>typeof value==="string").map(normalise).filter(valid))].slice(0,12);
    }
  } catch {tellWatchlist("Daftar tersimpan tidak dapat dibaca. Memakai daftar awal.");}

  function saveWatchlist() {
    try {localStorage.setItem(key,JSON.stringify(watchlist));}
    catch {tellWatchlist("Browser tidak mengizinkan penyimpanan. Daftar tetap berlaku selama tab ini terbuka.");}
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderWatchlist() {
    el("watchlist-count").textContent = `${watchlist.length} / 12`;
    const list = el("watchlist-items"); list.replaceChildren();
    if (!watchlist.length) list.append(make("p","watchlist-empty","Watchlist kosong. Tambahkan IHSG atau kode saham di atas."));
    for (const code of watchlist) {
      const quote = quotes.get(code), selected = code === window.Terminal.getSymbol();
      const row = make("div","watch-row" + (selected ? " selected" : "") + (quote?.stale ? " stale" : ""));
      const open = make("button","watch-open"); open.type="button"; open.dataset.symbol=code;
      open.setAttribute("aria-pressed",String(selected));
      open.setAttribute("aria-label",`Buka ${code}: grafik dan berita`);
      const company = make("span","watch-company");
      company.append(make("strong","",code),make("small","",quote?.name || window.Terminal.companyName(code)));
      const values = make("span","watch-values");
      const hasPrice = Number.isFinite(quote?.price);
      values.append(make("strong","",hasPrice ? money.format(quote.price) : "—"));
      const change = quote?.change_percent;
      const changeText = Number.isFinite(change) ? percent.format(change) + "%" : (quote?.error ? "Tidak tersedia" : "…");
      const changeClass = Number.isFinite(change) ? (change>0?"up":change<0?"down":"") : "";
      values.append(make("small",changeClass, changeText + (quote?.stale ? " !" : "")));
      if (hasPrice) open.title=`${code} · ${quote.unit || window.Terminal.instrumentInfo(code).unit} · Sesi ${quote.session_date} · Diambil ${date.format(new Date(quote.fetched_at))} WIB${quote.stale?" · Data lama: gagal diperbarui":" · Data tertunda"}`;
      else open.title=quote?.error || "Mengambil harga…";
      open.append(company,values);
      open.addEventListener("click",()=>window.Terminal.selectSymbol(code));
      const remove = make("button","watch-remove","×"); remove.type="button";
      remove.setAttribute("aria-label",`Hapus ${code} dari watchlist`); remove.title=`Hapus ${code}`;
      remove.addEventListener("click",()=>{
        watchlist=watchlist.filter(value=>value!==code); quotes.delete(code);
        tellWatchlist("");saveWatchlist();renderWatchlist();loadQuotes();
      });
      row.append(open,remove);list.append(row);
    }
    window.dispatchEvent(new CustomEvent("terminal:quotes",{detail:getSnapshot()}));
  }

  function getSnapshot(){return {codes:[...watchlist],quotes:watchlist.map(code=>({code,...quotes.get(code)}))};}
  window.TerminalWatchlist={getSnapshot};

  el("watchlist-form").addEventListener("submit",event=>{
    event.preventDefault();
    const code=normalise(el("watchlist-input").value);
    if(!valid(code)){tellWatchlist("Isi IHSG atau kode saham, misalnya BBCA.");return;}
    if(watchlist.includes(code)){tellWatchlist(`${code} sudah ada di watchlist.`);return;}
    if(watchlist.length>=12){tellWatchlist("Maksimal 12 kode saham/indeks. Hapus salah satu untuk menambah kode baru.");return;}
    watchlist.push(code);el("watchlist-input").value="";tellWatchlist("");
    saveWatchlist();renderWatchlist();loadQuotes();window.Terminal.selectSymbol(code);
  });

  async function loadQuotes() {
    const seq=++quoteSeq;
    quoteController?.abort();
    const controller=new AbortController();quoteController=controller;
    const timeout=setTimeout(()=>controller.abort(),90000);
    const selected=[...watchlist];quoteBusy=true;lastQuoteCheck=Date.now();
    if(!selected.length){clearTimeout(timeout);quoteBusy=false;el("quotes-status").textContent="Belum ada kode dipantau.";return;}
    el("quotes-status").textContent="Memeriksa harga…";
    try {
      const response=await fetch(`/api/quotes?symbols=${encodeURIComponent(selected.join(","))}`,{signal:controller.signal});
      const data=await response.json();
      if(seq!==quoteSeq)return;
      if(!response.ok)throw new Error(data.error||"Harga belum tersedia.");
      for(const quote of data.quotes||[]){
        if(!selected.includes(quote.code))continue;
        const old=quotes.get(quote.code);
        quotes.set(quote.code,quote.error&&!Number.isFinite(quote.price)&&old ? {...old,error:quote.error,stale:true} : quote);
      }
      renderWatchlist();
      const failed=selected.filter(code=>!Number.isFinite(quotes.get(code)?.price)||quotes.get(code)?.error).length;
      el("quotes-status").textContent=failed?`${failed} kode gagal diperbarui · arahkan kursor untuk detail.`:"Data tersedia · refresh ±60 detik";
    }catch(error){
      if(seq!==quoteSeq)return;
      selected.forEach(code=>{quotes.set(code,{...quotes.get(code),stale:true,error:"Gagal memperbarui harga."});});
      renderWatchlist();el("quotes-status").textContent="Gagal memeriksa harga. Data lama ditandai !.";
    }finally{clearTimeout(timeout);if(seq===quoteSeq)quoteBusy=false;}
  }

  function notice(text,error=false){el("news-notice").hidden=!text;el("news-notice").textContent=text;el("news-notice").classList.toggle("error",error);}
  function clearNews(code){
    newsData=null;el("news-symbol").textContent=code;el("news-company").textContent=window.Terminal.companyName(code);
    el("news-title-label").textContent=code==="IHSG"?"BERITA IHSG":"BERITA EMITEN";
    el("news-count").textContent="Memuat berita…";el("news-checked").textContent="Belum diperiksa";
    el("news-sources").replaceChildren();
    el("news-list").replaceChildren(make("p","news-empty",`Mencari berita terkait ${code}…`));
    el("news-search").href="https://news.google.com/search?"+new URLSearchParams({q:code,hl:"id",gl:"ID",ceid:"ID:id"});
    notice("");
  }
  function safeLink(value){
    try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
  }
  function renderNews(data){
    el("news-company").textContent=data.company||window.Terminal.getSymbol();
    el("news-count").textContent=`${data.items.length} berita · 30 hari terakhir`;
    if(data.checked_at)el("news-checked").textContent=`Diperiksa ${clock.format(new Date(data.checked_at))} WIB · cache ≤2 menit`;
    const list=el("news-list");list.replaceChildren();
    if(!data.items.length)list.append(make("p","news-empty",data.error?"Sumber berita belum tersedia. Coba perbarui setelah dua menit.":`Belum ada berita yang cocok untuk ${window.Terminal.getSymbol()} pada feed yang berhasil diambil.`));
    for(const article of data.items){
      const href=safeLink(article.url);if(!href)continue;
      const card=make("article","news-item");
      const meta=make("div","news-meta");meta.append(make("span","news-publisher",article.source));
      const published=make("time","",date.format(new Date(article.published_at))+" WIB");published.dateTime=article.published_at;published.title="Waktu publikasi dari sumber";
      meta.append(published);
      const link=make("a","news-title",article.title);link.href=href;link.target="_blank";link.rel="noopener noreferrer";
      const heading=make("h3","");heading.append(link);card.append(meta,heading);list.append(card);
    }
    const sources=el("news-sources");sources.replaceChildren();
    for(const source of data.sources||[]){
      const state=source.ok?"tersedia":source.stale?"data lama":"gagal diakses";
      const time=source.fetched_at?` · diambil ${date.format(new Date(source.fetched_at))} WIB`:"";
      const item=make("li",source.ok?"source-ok":"source-warning",`${source.name}: ${state}${time}`);sources.append(item);
    }
    const search=safeLink(data.search_url);if(search)el("news-search").href=search;
    notice(data.error||data.warning||"",Boolean(data.error));
  }

  async function loadNews(){
    const seq=++newsSeq,code=window.Terminal.getSymbol();
    const expectedSymbol=window.Terminal.instrumentInfo(code).symbol;
    newsController?.abort();
    const controller=new AbortController();newsController=controller;
    const timeout=setTimeout(()=>controller.abort(),60000);
    if(!newsData||newsData.symbol!==expectedSymbol)clearNews(code);
    newsBusy=true;lastNewsCheck=Date.now();el("news-refresh").disabled=true;
    if(newsData)el("news-count").textContent="Memeriksa pembaruan…";
    try{
      const response=await fetch(`/api/news?symbol=${encodeURIComponent(code)}`,{signal:controller.signal});
      const data=await response.json();
      if(seq!==newsSeq)return;
      if(data.symbol!==expectedSymbol||!Array.isArray(data.items))throw new Error(data.error||"Respons berita belum tersedia.");
      if(!response.ok && newsData?.items.length){
        renderNews({...newsData,checked_at:data.checked_at,sources:data.sources,error:data.error||"Gagal memperbarui. Menampilkan hasil sebelumnya."});
      }else{newsData=data;renderNews(data);}
    }catch(error){
      if(seq!==newsSeq)return;
      if(newsData)renderNews(newsData);
      else{el("news-count").textContent="Berita belum tersedia";el("news-list").replaceChildren(make("p","news-empty","Periksa koneksi internet, lalu coba lagi setelah dua menit."));}
      notice("Gagal memperbarui berita."+(newsData?.items.length?" Hasil sebelumnya tetap ditampilkan dengan waktu publikasi aslinya.":""),true);
    }finally{clearTimeout(timeout);if(seq===newsSeq){newsBusy=false;el("news-refresh").disabled=false;}}
  }

  function maybeRefresh(){
    if(document.hidden)return;
    if(el("auto-refresh").checked&&!quoteBusy&&Date.now()-lastQuoteCheck>=61000)loadQuotes();
    if(el("news-auto").checked&&!newsBusy&&Date.now()-lastNewsCheck>=121000)loadNews();
  }
  window.addEventListener("terminal:symbol",()=>{renderWatchlist();loadNews();});
  window.addEventListener("terminal:refresh",()=>{loadQuotes();loadNews();});
  el("news-refresh").addEventListener("click",loadNews);
  el("news-auto").addEventListener("change",maybeRefresh);
  el("auto-refresh").addEventListener("change",maybeRefresh);
  document.addEventListener("visibilitychange",maybeRefresh);
  setInterval(maybeRefresh,1000);
  renderWatchlist();loadQuotes();loadNews();
})();
