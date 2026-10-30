(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.HeatmapModel=factory();})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  function classify(quote){
    if(!quote||quote.stale||quote.error||!Number.isFinite(quote.price)||!Number.isFinite(quote.change_percent))return "missing";
    return quote.change_percent>0?"up":quote.change_percent<0?"down":"flat";
  }
  function color(quote){
    const kind=classify(quote);if(kind==="missing"||kind==="flat")return "rgb(35,47,64)";
    const base=[35,47,64],end=kind==="up"?[27,114,88]:[139,44,62],ratio=Math.min(Math.abs(quote.change_percent)/5,1);
    return `rgb(${base.map((x,i)=>Math.round(x+(end[i]-x)*ratio)).join(",")})`;
  }
  return {classify,color};
});
