"use strict";

const $ = (id) => document.getElementById(id);
const instrumentConfig = JSON.parse($("instrument-config").textContent);
function normaliseCode(value) {
  const code = String(value).trim().toUpperCase().replace(/\.JK$/, "");
  return Object.hasOwn(instrumentConfig.aliases,code) ? instrumentConfig.aliases[code] : code;
}
function instrumentInfo(value) {
  const code = normaliseCode(value);
  return Object.hasOwn(instrumentConfig.instruments,code) ? instrumentConfig.instruments[code] : {code,symbol:code+".JK",name:code,kind:"stock",unit:"IDR",suffix:".JK",show_volume:true};
}
const number = new Intl.NumberFormat("id-ID", {maximumFractionDigits:2});
const integer = new Intl.NumberFormat("id-ID", {maximumFractionDigits:0});
const dateTime = new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta", day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hourCycle:"h23"});
const tableTime = new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta", day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", hourCycle:"h23"});
const intervalLabels = {"1m":"1 menit","5m":"5 menit","15m":"15 menit","30m":"30 menit","60m":"1 jam","1d":"1 hari","1wk":"1 minggu"};
const rangeIntervals = {"1d":["1m","5m","15m","30m"],"5d":["5m","15m","30m","60m"],"1m":["30m","60m","1d"],"3m":["1d","1wk"],"6m":["1d","1wk"],"1y":["1d","1wk"]};
const defaultIntervals = {"1d":"5m","5d":"5m","1m":"30m","3m":"1d","6m":"1d","1y":"1d"};
const dayLabel = new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"2-digit"});
let symbol = "BBCA", range = "1d", interval = "5m", current = null, requestId = 0, controller = null, busy = false, lastAttempt = 0, chartEventsBound = false;

function clock() {
  $("clock").textContent = new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date()).replaceAll(".",":") + " WIB";
}
clock(); setInterval(clock, 1000);

function message(text, error = false) {
  $("message").hidden = !text;
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
}

function connection(text, type = "") {
  $("connection-status").textContent = text;
  $("connection-status").className = "connection-state " + type;
}

function updateSelection() {
  document.querySelectorAll("[data-symbol]").forEach(button => {
    const active = button.dataset.symbol === symbol;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-range]").forEach(button => {
    const active = button.dataset.range === range;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("symbol-input").value = symbol;
  $("candle-interval").replaceChildren(...rangeIntervals[range].map(value=>{
    const option = document.createElement("option");
    option.value = value; option.textContent = intervalLabels[value]; option.selected = value === interval;
    return option;
  }));
}

function clearData() {
  current = null;
  window.dispatchEvent(new CustomEvent("terminal:data",{detail:null}));
  const info = instrumentInfo(symbol), isIndex = info.kind === "index";
  $("ticker").replaceChildren(document.createTextNode(symbol));
  const suffix = document.createElement("span"); suffix.textContent = info.suffix; $("ticker").append(suffix);
  $("company-name").textContent = info.name === symbol ? "Saham Bursa Efek Indonesia" : info.name;
  $("chart-meta").textContent = info.symbol + " · " + info.unit.toUpperCase();
  $("price-unit").textContent = info.unit.toUpperCase();
  $("price-label").textContent = isIndex ? "Nilai indeks candle terakhir" : "Harga candle terakhir";
  $("stat-volume-row").hidden = !info.show_volume;
  $("volume-column").hidden = !info.show_volume;
  $("summary-note").textContent = isIndex ? "Nilai indeks dalam poin. Mengikuti rentang grafik; volume hanya ditampilkan untuk saham." : "Mengikuti rentang grafik. Volume dalam lembar saham.";
  $("chart").setAttribute("aria-label",isIndex ? "Grafik IHSG dalam poin" : "Grafik candlestick dan volume");
  for (const id of ["last-price","stat-open","stat-high","stat-low","stat-volume","candle-time","fetch-time"]) $(id).textContent = "—";
  $("range-label").textContent = "—";
  $("interval-info").textContent = "Menunggu data · WIB";
  $("candle-note").hidden = true;
  $("rows-info").textContent = "OHLCV · WIB";
  $("candle-rows").innerHTML = `<tr><td colspan="${info.show_volume?6:5}" class="empty-cell">Belum ada data.</td></tr>`;
  if (window.Plotly && $("chart").data) Plotly.purge($("chart"));
  chartEventsBound = false;
  empty("Menyiapkan grafik", "Mengambil candle dari Yahoo Finance…");
}

function empty(title, detail) {
  $("chart-empty").hidden = false;
  $("chart-empty").querySelector("strong").textContent = title;
  $("chart-empty").querySelector("p").textContent = detail;
}


function visiblePriceRange(bounds) {
  const rows = current.candles;
  const left = bounds ? Math.max(0, Math.ceil(Number(bounds[0]))) : 0;
  const right = bounds ? Math.min(rows.length-1, Math.floor(Number(bounds[1]))) : rows.length-1;
  if (left > right) return null;
  const visible = rows.slice(left, right+1);
  let low = Math.min(...visible.map(row=>row.low)), high = Math.max(...visible.map(row=>row.high));
  for (const indicator of window.TerminalIndicators.overlayResults(current)) {
    for (const line of indicator.lines) {
      const values=line.values.slice(left,right+1).filter(Number.isFinite);
      if(values.length){low=Math.min(low,...values);high=Math.max(high,...values);}
    }
  }
  const pad = Math.max((high-low)*.09, .5);
  return [Math.max(0,low-pad),high+pad];
}

function fitVisiblePrice() {
  if (!current || !$("chart").layout) return;
  const axis = $("chart").layout.xaxis;
  const next = visiblePriceRange(axis.autorange ? null : axis.range);
  if (next) return Plotly.relayout($("chart"),{"yaxis.range":next,"yaxis.autorange":false});
}

function zoomChart(factor) {
  if (!current || !$("chart").layout) return;
  const n = current.candles.length, axis = $("chart").layout.xaxis;
  const bounds = axis.range || [-.75,n-.25];
  const width = Math.min(n+.5, Math.max(Math.min(12,n+.5),(bounds[1]-bounds[0])*factor));
  const right = Math.min(n-.25,Math.max(width-.75,Number(bounds[1])));
  return Plotly.relayout($("chart"),{"xaxis.range":[right-width,right],"xaxis.autorange":false});
}

async function drawChart() {
  if (!current) return;
  if (!window.Plotly) throw new Error("Komponen grafik gagal dimuat. Pastikan folder static ikut diekstrak, lalu muat ulang halaman.");
  const rows = current.candles, x = rows.map(row => row.chart_time), close = rows.map(row => row.close);
  const showVolume = current.show_volume !== false;
  const intraday = !["1d","1wk"].includes(current.interval);
  const labels = Object.fromEntries(rows.map(row=>[row.chart_time, current.range === "1d" ? row.chart_time.slice(11,16) : dayLabel.format(new Date(row.timestamp)) + (intraday ? "<br>"+row.chart_time.slice(11,16) : "")]));
  const hoverTimes = rows.map(row=>intraday ? dateTime.format(new Date(row.timestamp))+" WIB" : dayLabel.format(new Date(row.timestamp)));
  const green = "#52cdb0", red = "#f17d85", gold = "#e7b661";
  const priceTrace = $("chart-type").value === "line" ? {
    type:"scatter", mode:"lines", x, y:close, name:"Close", line:{color:green,width:1.6}, text:hoverTimes,
    hovertemplate:`%{text}<br>Close: %{y:,.2~f} ${current.unit}<extra></extra>`,
  } : {
    type:"candlestick", x, open:rows.map(row=>row.open), high:rows.map(row=>row.high), low:rows.map(row=>row.low), close,
    name:current.symbol, increasing:{line:{color:green,width:1.3},fillcolor:green}, decreasing:{line:{color:red,width:1.3},fillcolor:red},
    text:hoverTimes, whiskerwidth:0,
    hovertemplate:`%{text}<br>OHLC · ${current.unit}<br>Open: %{open:,.2~f}<br>High: %{high:,.2~f}<br>Low: %{low:,.2~f}<br>Close: %{close:,.2~f}<extra></extra>`,
  };
  const traces = [priceTrace];
  if (showVolume) traces.push({
    type:"bar",x,y:rows.map(row=>row.volume), yaxis:"y2",name:"Volume",marker:{color:rows.map(row=>row.close>=row.open?"rgba(82,205,176,.45)":"rgba(241,125,133,.45)")},
    customdata:hoverTimes, hovertemplate:"%{customdata}<br>Volume: %{y:,.0f} lembar<extra></extra>",
  });
  for (const indicator of window.TerminalIndicators.overlayResults(current)) {
    for (const line of indicator.lines) traces.push({type:"scatter",mode:"lines",x,y:line.values,name:indicator.label+" · "+line.name,
      line:{color:line.color||indicator.color,width:1.2,dash:line.dash||"solid"},
      fill:line.fill?"tonexty":undefined,fillcolor:line.fill?"rgba(120,160,210,.08)":undefined,
      text:hoverTimes,hovertemplate:`%{text}<br>${line.name}: %{y:,.2~f}<extra></extra>`,connectgaps:false});
  }
  const layout = {
    autosize:true, paper_bgcolor:"#121a27",plot_bgcolor:"#121a27",font:{family:"Consolas, monospace",color:"#8c9bb0",size:10},
    margin:{l:17,r:65,t:14,b:42},showlegend:false,dragmode:"pan",hovermode:"x",bargap:.25,boxgap:.25,
    uirevision:current.symbol + current.range + current.interval, separators:",.",
    xaxis:{type:"category",categoryorder:"array",categoryarray:x,labelalias:labels,rangeslider:{visible:false},showgrid:true,gridcolor:"#1d293a",zeroline:false,tickfont:{size:9},
      tickangle:0,nticks:6,showline:true,linecolor:"#293649",anchor:showVolume?"y2":"y"},
    yaxis:{domain:[showVolume ? .27 : 0,1],side:"right",showgrid:true,gridcolor:"#223044",zeroline:false,tickformat:",.2~f",nticks:5,fixedrange:false,autorange:false,range:visiblePriceRange()},
    yaxis2:{domain:[0,.17],visible:showVolume,side:"right",showgrid:false,zeroline:false,tickformat:".2s",nticks:2,fixedrange:true,rangemode:"tozero"},
    hoverlabel:{bgcolor:"#1d2c40",bordercolor:"#445671",font:{family:"Consolas, monospace",size:10}},
    annotations:showVolume?[{xref:"paper",yref:"paper",x:0,y:.195,text:"VOLUME",showarrow:false,xanchor:"left",font:{size:8,color:"#7488a4"}}]:[],
  };
  $("chart-empty").hidden = true;
  await Plotly.react($("chart"), traces, layout, {responsive:true,scrollZoom:true,displayModeBar:false,displaylogo:false});
  if (!chartEventsBound) {
    $("chart").on("plotly_relayout",event=>{
      if (Object.keys(event).some(key=>key.startsWith("xaxis.range") || key==="xaxis.autorange")) fitVisiblePrice();
    });
    chartEventsBound = true;
  }
  await fitVisiblePrice();
}

function renderData(data) {
  window.dispatchEvent(new CustomEvent("terminal:data",{detail:data}));
  const summary = data.summary;
  $("last-price").textContent = number.format(summary.last);
  $("stat-open").textContent = number.format(summary.open);
  $("stat-high").textContent = number.format(summary.high);
  $("stat-low").textContent = number.format(summary.low);
  $("stat-volume").textContent = Number.isFinite(summary.volume) ? integer.format(summary.volume) : "—";
  $("range-label").textContent = data.range_label;
  $("candle-time").textContent = dateTime.format(new Date(summary.last_timestamp));
  $("fetch-time").textContent = dateTime.format(new Date(data.fetched_at));
  $("interval-info").textContent = `1 candle = ${data.interval_label} · WIB · ${data.candles.length} candle`;
  const flat = data.candles.filter(row=>row.open===row.high && row.high===row.low && row.low===row.close).length;
  $("candle-note").hidden = flat < data.candles.length*.1;
  $("candle-note").textContent = `${flat} dari ${data.candles.length} candle memiliki Open = High = Low = Close pada data Yahoo, sehingga tampak sebagai garis datar. Harga ditampilkan sesuai data sumber.`;
  $("rows-info").textContent = "8 terbaru · interval " + data.interval_label;
  $("candle-rows").replaceChildren();
  data.candles.slice(-8).reverse().forEach(candle => {
    const row = document.createElement("tr");
    const values = [tableTime.format(new Date(candle.timestamp)), ...["open","high","low","close"].map(key=>number.format(candle[key]))];
    if (data.show_volume !== false) values.push(integer.format(candle.volume));
    values.forEach((value, i) => {
      const cell = document.createElement("td"); cell.textContent = value;
      if (i === 4) cell.className = candle.close >= candle.open ? "up" : "down";
      row.append(cell);
    });
    $("candle-rows").append(row);
  });
}

async function loadData() {
  const id = ++requestId;
  if (controller) controller.abort();
  const thisRequest = new AbortController();
  controller = thisRequest;
  const timeout = setTimeout(()=>thisRequest.abort(), 45000);
  const requestSymbol = symbol, requestRange = range, requestInterval = interval;
  const changed = !current || current.symbol !== instrumentInfo(symbol).symbol || current.range !== range || current.interval !== interval;
  if (changed) clearData();
  updateSelection(); busy = true; lastAttempt = Date.now();
  $("refresh-button").disabled = true;
  connection("MENGAMBIL DATA");
  message(current ? "Memeriksa data terbaru…" : `Mengambil ${symbol} dari Yahoo Finance…`);
  try {
    const response = await fetch(`/api/history?symbol=${encodeURIComponent(requestSymbol)}&range=${requestRange}&interval=${requestInterval}`, {signal:thisRequest.signal});
    const data = await response.json();
    if (id !== requestId) return;
    if (!response.ok) throw new Error(data.error || "Gagal mengambil data.");
    if (data.symbol !== instrumentInfo(requestSymbol).symbol) throw new Error("Respons data tidak sesuai kode yang dipilih.");
    if (!data.candles?.length) throw new Error("Belum ada candle untuk ditampilkan.");
    current = data;
    renderData(data);
    await drawChart();
    if (id !== requestId) return;
    connection("TERHUBUNG · DATA TERTUNDA", "ok");
    message("");
  } catch (error) {
    if (id !== requestId) return;
    const detail = error.name === "AbortError" ? "Permintaan terlalu lama. Periksa koneksi lalu coba lagi setelah satu menit." : error.message;
    message(detail + (current ? " Data yang terlihat berasal dari pengambilan sebelumnya; lihat waktu data." : ""), true);
    connection(current ? "GAGAL MEMPERBARUI" : "DATA BELUM TERSEDIA", "error");
    if (!current) empty("Data belum tersedia", "Periksa kode saham dan koneksi internet, lalu klik Perbarui setelah satu menit.");
  } finally {
    clearTimeout(timeout);
    if (id === requestId) {busy = false; $("refresh-button").disabled = false;}
  }
}

$("search-form").addEventListener("submit", event => {
  event.preventDefault();
  const value = normaliseCode($("symbol-input").value);
  if (!/^[A-Z][A-Z0-9]{1,7}$/.test(value)) {message("Masukkan IHSG atau kode saham BEI, misalnya BBCA.", true);return;}
  selectSymbol(value);
});
function selectSymbol(value) {
  const next = normaliseCode(value);
  if (!/^[A-Z][A-Z0-9]{1,7}$/.test(next)) return;
  const changed = next !== symbol;
  symbol = next;
  loadData();
  if (changed) window.dispatchEvent(new CustomEvent("terminal:symbol", {detail:{symbol}}));
}
document.querySelectorAll("[data-range]").forEach(button=>button.addEventListener("click",()=>{
  if (range !== button.dataset.range) {range=button.dataset.range;interval=defaultIntervals[range];}
  loadData();
}));
$("candle-interval").addEventListener("change",()=>{interval=$("candle-interval").value;loadData();});
$("refresh-button").addEventListener("click", () => {loadData();window.dispatchEvent(new Event("terminal:refresh"));});
const redraw = ()=>drawChart().catch(error=>message(error.message,true));
$("chart-type").addEventListener("change", redraw);
window.addEventListener("terminal:indicators",redraw);
$("zoom-in").addEventListener("click",()=>zoomChart(.6));
$("zoom-out").addEventListener("click",()=>zoomChart(1/.6));
$("reset-zoom").addEventListener("click",()=>{if(current&&window.Plotly) Plotly.relayout($("chart"),{"xaxis.autorange":true,"yaxis.range":visiblePriceRange(),"yaxis.autorange":false});});
function maybeRefresh() {if($("auto-refresh").checked && !document.hidden && !busy && Date.now()-lastAttempt>=61000) loadData();}
setInterval(maybeRefresh, 1000);
document.addEventListener("visibilitychange",maybeRefresh);
$("auto-refresh").addEventListener("change",maybeRefresh);
$("open-ihsg").addEventListener("click",()=>selectSymbol("IHSG"));
window.Terminal = {selectSymbol, getSymbol:()=>symbol, companyName:code=>instrumentInfo(code).name, normaliseCode, instrumentInfo};
loadData();
