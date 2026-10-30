/* Persist coordinates only, never HTML or data-provider responses. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TerminalLayout = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const definitions = [
    {id:"chart", label:"Price Chart", description:"Grafik saham & indikator", x:0,y:0,w:8,h:10,minW:6,minH:8,visible:true},
    {id:"watchlist", label:"Watchlist", description:"Harga & perubahan sesi", x:8,y:0,w:4,h:6,minW:3,minH:4,visible:true},
    {id:"market", label:"Market / IHSG", description:"Ringkasan pasar tetap", x:8,y:6,w:4,h:4,minW:3,minH:4,visible:true},
    {id:"news", label:"News", description:"Berita mengikuti pilihan", x:8,y:10,w:4,h:12,minW:3,minH:6,visible:true},
    {id:"summary", label:"Ringkasan", description:"Open, high, low & volume", x:8,y:10,w:4,h:5,minW:3,minH:4,visible:false},
    {id:"status", label:"Status Data", description:"Waktu candle & pengambilan", x:8,y:15,w:4,h:5,minW:3,minH:4,visible:false},
    {id:"candles", label:"Tabel Candle", description:"Delapan candle terakhir", x:0,y:20,w:12,h:6,minW:6,minH:4,visible:false},
    {id:"heatmap", label:"Heatmap", description:"Perubahan saham watchlist", x:0,y:16,w:8,h:6,minW:3,minH:5,visible:true},
    {id:"technical1", label:"Indikator 1", description:"RSI, MACD & 25 pilihan lain", x:0,y:10,w:4,h:6,minW:3,minH:5,visible:true},
    {id:"technical2", label:"Indikator 2", description:"Bandingkan indikator kedua", x:4,y:10,w:4,h:6,minW:3,minH:5,visible:true},
  ];
  const defaults = () => definitions.map(({id,x,y,w,h,visible})=>({id,x,y,w,h,visible}));
  function parse(raw) {
    const saved = JSON.parse(raw);
    const legacy=saved?.version===1,newIds=["heatmap","technical1","technical2"];
    if (![1,2].includes(saved?.version) || !Array.isArray(saved.widgets) || saved.widgets.length !== (legacy?7:definitions.length)) throw new Error("Unknown layout");
    const seen = new Set();
    const items=saved.widgets.map(item=>{
      const def = definitions.find(d=>d.id===item?.id);
      if (!def || (legacy&&newIds.includes(item.id)) || seen.has(item.id) || typeof item.visible!=="boolean") throw new Error("Invalid widget");
      seen.add(item.id);
      if (![item.x,item.y,item.w,item.h].every(Number.isInteger) || item.x<0 || item.y<0 || item.y>1000 || item.w<def.minW || item.w>12 || item.x+item.w>12 || item.h<def.minH || item.h>50) throw new Error(`Invalid coordinates: ${JSON.stringify(item)}`);
      return {id:item.id,x:item.x,y:item.y,w:item.w,h:item.h,visible:item.visible};
    });
    if(legacy){const bottom=Math.max(0,...items.filter(i=>i.visible).map(i=>i.y+i.h));newIds.forEach((id,i)=>items.push({id,x:i*4,y:Math.min(1000,bottom),w:4,h:6,visible:true}));}
    return items;
  }
  function mergePositions(state, saved) {
    const positions=new Map(saved.map(item=>[item.id,item]));
    return state.map(item=>{
      const p=positions.get(item.id);
      // GridStack omits dimensions equal to minW/minH in serialized output.
      return p?{id:item.id,x:p.x||0,y:p.y||0,w:p.w||p.minW||1,h:p.h||p.minH||1,visible:true}:{...item,visible:false};
    });
  }
  return {definitions, defaults, parse, mergePositions};
});
