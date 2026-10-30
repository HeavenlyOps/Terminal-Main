/* Pure technical-analysis calculations. Null = insufficient/undefined data.
   EMA/RMA use an SMA seed. All windows are candle counts, never calendar days. */
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.Technicals=factory();})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const finite=Number.isFinite, blank=n=>Array(n).fill(null);
  const map2=(a,b,f)=>a.map((v,i)=>finite(v)&&finite(b[i])?f(v,b[i]):null);
  const div=(a,b)=>b===0?null:a/b;
  function rolling(a,n,fn){return a.map((_,i)=>{if(i<n-1)return null;const w=a.slice(i-n+1,i+1);return w.every(finite)?fn(w):null;});}
  const sum=(a,n)=>rolling(a,n,w=>w.reduce((s,v)=>s+v,0));
  const sma=(a,n)=>rolling(a,n,w=>w.reduce((s,v)=>s+v,0)/n);
  const high=(a,n)=>rolling(a,n,w=>Math.max(...w)),low=(a,n)=>rolling(a,n,w=>Math.min(...w));
  function smooth(a,n,alpha){let prior=null,seed=[];return a.map(v=>{if(!finite(v)){prior=null;seed=[];return null;}if(prior===null){seed.push(v);if(seed.length<n)return null;prior=seed.reduce((s,x)=>s+x,0)/n;}else prior=alpha*v+(1-alpha)*prior;return prior;});}
  const ema=(a,n)=>smooth(a,n,2/(n+1)),rma=(a,n)=>smooth(a,n,1/n);
  const wma=(a,n)=>rolling(a,n,w=>w.reduce((s,v,i)=>s+v*(i+1),0)/(n*(n+1)/2));
  const std=(a,n)=>rolling(a,n,w=>{const m=w.reduce((s,v)=>s+v,0)/n;return Math.sqrt(w.reduce((s,v)=>s+(v-m)**2,0)/n);});
  const delta=a=>a.map((v,i)=>i&&finite(v)&&finite(a[i-1])?v-a[i-1]:null);
  const shift=(a,n)=>a.map((_,i)=>i-n>=0&&i-n<a.length?a[i-n]:null);
  function tr(rows){return rows.map((r,i)=>i?Math.max(r.high-r.low,Math.abs(r.high-rows[i-1].close),Math.abs(r.low-rows[i-1].close)):null);}
  function rsi(close,n){const d=delta(close),g=rma(d.map(v=>v===null?null:Math.max(v,0)),n),l=rma(d.map(v=>v===null?null:Math.max(-v,0)),n);return map2(g,l,(g,l)=>g+l===0?50:100*g/(g+l));}
  function bollinger(close,n,k){const middle=sma(close,n),s=std(close,n);return {middle,upper:map2(middle,s,(m,s)=>m+k*s),lower:map2(middle,s,(m,s)=>m-k*s)};}
  const period=(label,value)=>({label,value,min:2,max:300,step:1});
  const mult=value=>({label:"Pengali",value,min:.1,max:10,step:.1});
  const catalog=[];
  function add(id,family,label,group,params,description,extra={}){catalog.push({id,family,label,group,params,description,...extra});}
  for(const [type,periods] of [["sma",[20,50,200]],["ema",[9,21,50]],["wma",[20]],["hma",[20]],["dema",[20]],["tema",[20]],["vwma",[20]]])
    for(const n of periods)add(type+n,type,type.toUpperCase()+" "+n,"overlay",{period:period("Periode",n)},({sma:"Rata-rata sederhana harga Close.",ema:"Rata-rata eksponensial; seed SMA.",wma:"Rata-rata berbobot linear; candle terbaru berbobot terbesar.",hma:"Hull MA: WMA dari 2×WMA(n/2) − WMA(n).",dema:"Double EMA: 2×EMA − EMA(EMA).",tema:"Triple EMA: 3×EMA − 3×EMA² + EMA³.",vwma:"Rata-rata Close berbobot volume."})[type],{volume:type==="vwma"});
  add("vwap","vwap","VWAP sesi","overlay",{},"Harga tipikal × volume, diakumulasi ulang setiap tanggal WIB. Hanya intraday.",{volume:true,intraday:true});
  add("bb","bb","Bollinger Bands","overlay",{period:period("Periode",20),multiplier:mult(2)},"SMA ± pengali × standar deviasi populasi.");
  add("kc","kc","Keltner Channels","overlay",{period:period("EMA",20),atrPeriod:period("ATR",10),multiplier:mult(2)},"Varian modern: EMA Close ± pengali × ATR Wilder.");
  add("dc","dc","Donchian Channels","overlay",{period:period("Periode",20)},"High tertinggi, Low terendah, dan titik tengah, termasuk candle saat ini.");
  add("supertrend","supertrend","Supertrend","overlay",{period:period("ATR",10),multiplier:mult(3)},"Band berbasis ATR Wilder dengan pergantian arah saat Close menembus band.");
  add("ichimoku","ichimoku","Ichimoku Cloud","overlay",{fast:period("Tenkan",9),slow:period("Kijun / geser",26),span:period("Span B",52)},"Tenkan, Kijun, Span A/B. Cloud digeser ke kanan; bagian di luar candle tersedia tidak ditampilkan. Tanpa Chikou.");
  add("rsi","rsi","RSI","Momentum",{period:period("Periode",14)},"RSI dengan smoothing Wilder. Garis acuan 30/70; seri datar bernilai 50.",{levels:[30,70],range:[0,100]});
  add("macd","macd","MACD","Momentum",{fast:period("Cepat",12),slow:period("Lambat",26),signal:period("Sinyal",9)},"EMA cepat − EMA lambat, EMA sinyal, dan histogram selisih.",{levels:[0]});
  add("stoch","stoch","Stochastic","Momentum",{period:period("Lookback",14),smoothK:period("SMA K",3),smoothD:period("SMA D",3)},"Slow Stochastic: %K dihaluskan SMA, lalu %D.",{levels:[20,80],range:[0,100]});
  add("stochrsi","stochrsi","Stochastic RSI","Momentum",{period:period("RSI / lookback",14),smoothK:period("SMA K",3),smoothD:period("SMA D",3)},"Posisi RSI di rentang RSI, dihaluskan K/D; skala 0–100.",{levels:[20,80],range:[0,100]});
  add("cci","cci","CCI","Momentum",{period:period("Periode",20)},"Deviasi harga tipikal dari SMA dibagi 0,015 × mean absolute deviation.",{levels:[-100,100]});
  add("roc","roc","ROC","Momentum",{period:period("Periode",12)},"Persentase perubahan Close terhadap n candle sebelumnya.",{levels:[0]});
  add("momentum","momentum","Momentum","Momentum",{period:period("Periode",10)},"Selisih Close dengan Close n candle sebelumnya, dalam satuan harga.",{levels:[0]});
  add("williams","williams","Williams %R","Momentum",{period:period("Periode",14)},"Posisi Close terhadap High/Low periode; skala −100 sampai 0.",{levels:[-80,-20],range:[-100,0]});
  add("ultimate","ultimate","Ultimate Oscillator","Momentum",{fast:period("Cepat",7),middle:period("Tengah",14),slow:period("Lambat",28)},"Rasio buying pressure/true range pada tiga periode, bobot 4:2:1.",{levels:[30,70],range:[0,100]});
  add("ao","ao","Awesome Oscillator","Momentum",{fast:period("Cepat",5),slow:period("Lambat",34)},"SMA cepat − lambat dari (High + Low)/2.",{levels:[0]});
  add("ppo","ppo","PPO","Momentum",{fast:period("Cepat",12),slow:period("Lambat",26),signal:period("Sinyal",9)},"MACD dibagi EMA lambat × 100, beserta sinyal dan histogram.",{levels:[0]});
  add("trix","trix","TRIX","Momentum",{period:period("Periode",15)},"Perubahan persen satu candle dari EMA yang dihaluskan tiga kali.",{levels:[0]});
  add("bop","bop","Balance of Power","Momentum",{},"(Close − Open)/(High − Low); candle tanpa rentang bernilai nol.",{levels:[0],range:[-1,1]});
  add("adx","adx","ADX + DMI","Tren",{period:period("Periode",14)},"ADX, +DI, −DI dengan smoothing Wilder; acuan kekuatan tren 25.",{levels:[25],range:[0,100]});
  add("aroon","aroon","Aroon","Tren",{period:period("Periode",25)},"Aroon Up/Down dari jarak candle terhadap ekstrem terbaru pada n+1 candle.",{levels:[30,70],range:[0,100]});
  add("atr","atr","ATR","Volatilitas",{period:period("Periode",14)},"True Range dihaluskan Wilder, dalam satuan harga.");
  add("natr","natr","NATR","Volatilitas",{period:period("Periode",14)},"ATR / Close × 100.");
  add("stddev","stddev","Standard Deviation","Volatilitas",{period:period("Periode",20)},"Standar deviasi populasi harga Close.");
  add("bbwidth","bbwidth","Bollinger Bandwidth","Volatilitas",{period:period("Periode",20),multiplier:mult(2)},"(Band atas − band bawah) / band tengah × 100.");
  add("percentb","percentb","Bollinger %B","Volatilitas",{period:period("Periode",20),multiplier:mult(2)},"(Close − band bawah)/(band atas − band bawah). Bisa di luar 0–1.",{levels:[0,1]});
  add("obv","obv","OBV","Volume",{},"Volume kumulatif sesuai arah Close. Dimulai dari volume candle pertama.",{volume:true});
  add("mfi","mfi","Money Flow Index","Volume",{period:period("Periode",14)},"Rasio arus uang positif/negatif berdasarkan perubahan harga tipikal.",{volume:true,levels:[20,80],range:[0,100]});
  add("cmf","cmf","Chaikin Money Flow","Volume",{period:period("Periode",20)},"Jumlah money flow volume / jumlah volume pada periode.",{volume:true,levels:[0],range:[-1,1]});
  add("adl","adl","Accumulation / Distribution","Volume",{},"Kumulatif money flow multiplier × volume; candle tanpa rentang menyumbang nol.",{volume:true});
  add("chaikin","chaikin","Chaikin Oscillator","Volume",{fast:period("Cepat",3),slow:period("Lambat",10)},"EMA cepat − lambat dari A/D Line.",{volume:true,levels:[0]});
  add("vpt","vpt","Volume Price Trend","Volume",{},"Kumulatif volume × perubahan persentase Close (rasio). Dimulai dari nol.",{volume:true,levels:[0]});
  add("force","force","Force Index","Volume",{period:period("EMA",13)},"EMA dari perubahan Close × volume.",{volume:true,levels:[0]});
  function parameters(def,provided={}){
    if(!provided||typeof provided!=="object")provided={};
    const p={};for(const [key,spec] of Object.entries(def.params)){const v=Number(provided[key]??spec.value);p[key]=finite(v)?Math.max(spec.min,Math.min(spec.max,spec.step===1?Math.round(v):Math.round(v*10)/10)):spec.value;}
    if(p.fast&&p.slow&&p.fast>=p.slow){p.fast=Math.max(2,p.slow-1);p.slow=Math.max(p.slow,p.fast+1);}
    if(p.middle){p.fast=Math.min(p.fast,298);p.middle=Math.max(p.fast+1,Math.min(299,p.middle));p.slow=Math.max(p.middle+1,p.slow);}
    if(p.span)p.span=Math.max(p.slow,p.span);
    return p;
  }
  function calculate(id,data,provided={}){
    const def=catalog.find(d=>d.id===id);if(!def)throw new Error("Indikator tidak dikenal");
    const p=parameters(def,provided),rows=data.candles||[],c=rows.map(r=>r.close),h=rows.map(r=>r.high),l=rows.map(r=>r.low),v=rows.map(r=>r.volume),n=rows.length;
    const result={id,label:def.label,params:p,lines:[],levels:def.levels||[],range:def.range,note:"",minBars:1};
    if(def.volume&&(data.show_volume===false||!v.some(x=>finite(x)&&x>0))){result.note="Memerlukan volume saham yang tersedia; tidak digunakan untuk IHSG.";return result;}
    if(def.intraday&&["1d","1wk"].includes(data.interval)){result.note="VWAP sesi hanya untuk candle intraday (menit/jam).";return result;}
    const line=(name,values,extra={})=>result.lines.push({name,values:values.map(x=>finite(x)?x:null),...extra});
    const tp=rows.map(r=>(r.high+r.low+r.close)/3),hl=rows.map(r=>(r.high+r.low)/2),atr=rma(tr(rows),p.atrPeriod||p.period||14);
    const minimum=value=>result.minBars=value;
    const band=(middle,upper,lower)=>{line("Atas",upper,{color:"#8da9ff"});line("Bawah",lower,{color:"#8da9ff",fill:true});line("Tengah",middle,{color:"#d4b471",dash:"dot"});};
    const mfv=()=>rows.map((r,i)=>r.high===r.low?0:((2*r.close-r.high-r.low)/(r.high-r.low))*v[i]);
    const cumulative=a=>{let total=0;return a.map(x=>total+=x);};
    switch(def.family){
      case "sma":line("SMA "+p.period,sma(c,p.period));minimum(p.period);break;
      case "ema":line("EMA "+p.period,ema(c,p.period));minimum(p.period);break;
      case "wma":line("WMA "+p.period,wma(c,p.period));minimum(p.period);break;
      case "hma":{const half=Math.floor(p.period/2),root=Math.floor(Math.sqrt(p.period));line("HMA "+p.period,wma(map2(wma(c,half),wma(c,p.period),(a,b)=>2*a-b),root));minimum(p.period+root-1);break;}
      case "dema":{const e=ema(c,p.period);line("DEMA "+p.period,map2(e,ema(e,p.period),(a,b)=>2*a-b));minimum(2*p.period-1);break;}
      case "tema":{const a=ema(c,p.period),b=ema(a,p.period),d=ema(b,p.period);line("TEMA "+p.period,d.map((x,i)=>finite(x)?3*a[i]-3*b[i]+x:null));minimum(3*p.period-2);break;}
      case "vwma":line("VWMA "+p.period,map2(sum(map2(c,v,(a,b)=>a*b),p.period),sum(v,p.period),div));minimum(p.period);break;
      case "vwap":{let date=null,pv=0,vol=0;line("VWAP sesi",rows.map((r,i)=>{const day=r.chart_time.slice(0,10);if(day!==date){date=day;pv=0;vol=0;}pv+=tp[i]*v[i];vol+=v[i];return div(pv,vol);}));break;}
      case "bb":{const b=bollinger(c,p.period,p.multiplier);band(b.middle,b.upper,b.lower);minimum(p.period);break;}
      case "kc":{const mid=ema(c,p.period);band(mid,map2(mid,atr,(a,b)=>a+p.multiplier*b),map2(mid,atr,(a,b)=>a-p.multiplier*b));minimum(Math.max(p.period,p.atrPeriod+1));break;}
      case "dc":{const up=high(h,p.period),down=low(l,p.period);band(map2(up,down,(a,b)=>(a+b)/2),up,down);minimum(p.period);break;}
      case "supertrend":{let up=null,down=null,trend=null,last=null;const rising=blank(n),falling=blank(n);for(let i=0;i<n;i++){if(!finite(atr[i]))continue;const bu=hl[i]+p.multiplier*atr[i],bl=hl[i]-p.multiplier*atr[i],oldUp=up;up=up===null||bu<up||c[i-1]>up?bu:up;down=down===null||bl>down||c[i-1]<down?bl:down;trend=last===null?-1:last===oldUp?(c[i]>up?1:-1):(c[i]<down?-1:1);last=trend===1?down:up;(trend===1?rising:falling)[i]=last;}line("Supertrend naik",rising,{color:"#52cdb0"});line("Supertrend turun",falling,{color:"#f17d85"});minimum(p.period+1);break;}
      case "ichimoku":{const mid=k=>map2(high(h,k),low(l,k),(a,b)=>(a+b)/2),tenkan=mid(p.fast),kijun=mid(p.slow);line("Span A",shift(map2(tenkan,kijun,(a,b)=>(a+b)/2),p.slow),{color:"#7fa4c9"});line("Span B",shift(mid(p.span),p.slow),{color:"#7fa4c9",fill:true});line("Tenkan",tenkan,{color:"#64cee0"});line("Kijun",kijun,{color:"#db95b8"});minimum(p.span+p.slow);break;}
      case "rsi":line("RSI",rsi(c,p.period));minimum(p.period+1);break;
      case "macd":case "ppo":{const fast=ema(c,p.fast),slow=ema(c,p.slow),m=map2(fast,slow,(a,b)=>def.family==="ppo"?div((a-b)*100,b):a-b),signal=ema(m,p.signal);line("Histogram",map2(m,signal,(a,b)=>a-b),{type:"bar"});line(def.family.toUpperCase(),m,{color:"#79baff"});line("Sinyal",signal,{color:"#e7b661"});minimum(p.slow+p.signal-1);break;}
      case "stoch":case "stochrsi":{const source=def.family==="stochrsi"?rsi(c,p.period):c,hi=high(def.family==="stochrsi"?source:h,p.period),lo=low(def.family==="stochrsi"?source:l,p.period),raw=source.map((x,i)=>finite(x)&&finite(hi[i])&&finite(lo[i])?hi[i]===lo[i]?50:100*(x-lo[i])/(hi[i]-lo[i]):null),k=sma(raw,p.smoothK);line("%K",k,{color:"#79baff"});line("%D",sma(k,p.smoothD),{color:"#e7b661"});minimum((def.family==="stochrsi"?2*p.period:p.period)+p.smoothK+p.smoothD-2);break;}
      case "cci":line("CCI",rolling(tp,p.period,w=>{const mean=w.reduce((s,x)=>s+x,0)/p.period,mad=w.reduce((s,x)=>s+Math.abs(x-mean),0)/p.period;return mad===0?0:(w.at(-1)-mean)/(.015*mad);}));minimum(p.period);break;
      case "roc":case "momentum":line(def.label,c.map((x,i)=>i<p.period?null:def.family==="roc"?div((x-c[i-p.period])*100,c[i-p.period]):x-c[i-p.period]));minimum(p.period+1);break;
      case "williams":{const hi=high(h,p.period),lo=low(l,p.period);line("%R",c.map((x,i)=>finite(hi[i])?hi[i]===lo[i]?-50:-100*(hi[i]-x)/(hi[i]-lo[i]):null));minimum(p.period);break;}
      case "ultimate":{const bp=rows.map((r,i)=>i?r.close-Math.min(r.low,c[i-1]):null),ranges=tr(rows),ratio=k=>map2(sum(bp,k),sum(ranges,k),(a,b)=>b===0?.5:a/b),a=ratio(p.fast),b=ratio(p.middle),d=ratio(p.slow);line("UO",d.map((x,i)=>finite(x)&&finite(a[i])&&finite(b[i])?100*(4*a[i]+2*b[i]+x)/7:null));minimum(p.slow+1);break;}
      case "ao":line("AO",map2(sma(hl,p.fast),sma(hl,p.slow),(a,b)=>a-b),{type:"bar"});minimum(p.slow);break;
      case "trix":{const triple=ema(ema(ema(c,p.period),p.period),p.period);line("TRIX",triple.map((x,i)=>i&&finite(x)&&finite(triple[i-1])?div((x-triple[i-1])*100,triple[i-1]):null));minimum(3*p.period-1);break;}
      case "bop":line("BOP",rows.map(r=>r.high===r.low?0:(r.close-r.open)/(r.high-r.low)));break;
      case "adx":{const plus=rows.map((r,i)=>{if(!i)return null;const u=r.high-h[i-1],d=l[i-1]-r.low;return u>0&&u>d?u:0;}),minus=rows.map((r,i)=>{if(!i)return null;const u=r.high-h[i-1],d=l[i-1]-r.low;return d>0&&d>u?d:0;}),pd=map2(rma(plus,p.period),atr,(a,b)=>b===0?0:100*a/b),md=map2(rma(minus,p.period),atr,(a,b)=>b===0?0:100*a/b),dx=map2(pd,md,(a,b)=>a+b===0?0:100*Math.abs(a-b)/(a+b));line("ADX",rma(dx,p.period),{color:"#e7b661"});line("+DI",pd,{color:"#52cdb0"});line("−DI",md,{color:"#f17d85"});minimum(2*p.period);break;}
      case "aroon":{const extremum=(a,up)=>rolling(a,p.period+1,w=>{const extreme=up?Math.max(...w):Math.min(...w);return 100*w.lastIndexOf(extreme)/p.period;});line("Aroon Up",extremum(h,true),{color:"#52cdb0"});line("Aroon Down",extremum(l,false),{color:"#f17d85"});minimum(p.period+1);break;}
      case "atr":line("ATR",atr);minimum(p.period+1);break;
      case "natr":line("NATR",map2(atr,c,(a,b)=>div(100*a,b)));minimum(p.period+1);break;
      case "stddev":line("Std Dev",std(c,p.period));minimum(p.period);break;
      case "bbwidth":case "percentb":{const b=bollinger(c,p.period,p.multiplier);line(def.label,c.map((x,i)=>finite(b.upper[i])?def.family==="bbwidth"?div(100*(b.upper[i]-b.lower[i]),b.middle[i]):div(x-b.lower[i],b.upper[i]-b.lower[i]):null));minimum(p.period);break;}
      case "obv":line("OBV",cumulative(c.map((x,i)=>!i?v[i]:x>c[i-1]?v[i]:x<c[i-1]?-v[i]:0)));break;
      case "mfi":{const flow=tp.map((x,i)=>x*v[i]),positive=flow.map((x,i)=>i?tp[i]>tp[i-1]?x:0:null),negative=flow.map((x,i)=>i?tp[i]<tp[i-1]?x:0:null);line("MFI",map2(sum(positive,p.period),sum(negative,p.period),(a,b)=>a+b===0?50:100*a/(a+b)));minimum(p.period+1);break;}
      case "cmf":line("CMF",map2(sum(mfv(),p.period),sum(v,p.period),div));minimum(p.period);break;
      case "adl":line("A/D",cumulative(mfv()));break;
      case "chaikin":{const ad=cumulative(mfv());line("Chaikin",map2(ema(ad,p.fast),ema(ad,p.slow),(a,b)=>a-b));minimum(p.slow);break;}
      case "vpt":line("VPT",cumulative(c.map((x,i)=>i&&c[i-1]!==0?v[i]*(x-c[i-1])/c[i-1]:0)));minimum(2);break;
      case "force":line("Force Index",ema(map2(delta(c),v,(a,b)=>a*b),p.period));minimum(p.period+1);break;
    }
    if(n<result.minBars)result.note=`Perlu ${result.minBars} candle agar komponen lengkap; tersedia ${n}. Pilih rentang lebih panjang.`;
    else if(!result.lines.some(l=>l.values.some(finite)))result.note="Nilai tidak terdefinisi pada data ini (misalnya pembagi nol).";
    return result;
  }
  return {catalog,parameters,calculate,sma,ema,rma,wma,std,rsi,tr,merge:map2};
});
