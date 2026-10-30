const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../static/indicators.js');
const H=require('../static/heatmap-model.js');
const synthetic=(n=340)=>({code:'TEST',symbol:'TEST.JK',interval:'5m',show_volume:true,candles:Array.from({length:n},(_,i)=>{
  const close=100+i*.07+3*Math.sin(i*.55)+1.8*Math.cos(i*.13),open=close+Math.sin(i)*.35;
  return {open,close,high:Math.max(open,close)+.8,low:Math.min(open,close)-.7,volume:1000+(i%17)*111,chart_time:`2026-01-${String(2+Math.floor(i/75)).padStart(2,'0')}T${String(9+Math.floor((i%75)*5/60)).padStart(2,'0')}:${String(i*5%60).padStart(2,'0')}:00`};
})});

test('averages seed only after sufficient candles and Wilder RSI has known values',()=>{
  assert.deepEqual(T.sma([1,2,3,4,5],3),[null,null,2,3,4]);
  assert.deepEqual(T.ema([1,2,3,4,5],3),[null,null,2,3,4]);
  assert.deepEqual(T.wma([1,2,3,4],3),[null,null,14/6,20/6]);
  const closes=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28];
  assert.ok(Math.abs(T.rsi(closes,14)[14]-70.464135021097)<1e-9);
});

test('40 families are causal, aligned and never emit Infinity or NaN',()=>{
  assert.equal(new Set(T.catalog.map(d=>d.family)).size,40);
  const full=synthetic(),short={...full,candles:full.candles.slice(0,175)};
  for(const def of T.catalog){
    const result=T.calculate(def.id,full),prefix=T.calculate(def.id,short);
    assert.ok(result.lines.length,def.id);
    assert.ok(result.lines.some(line=>line.values.some(Number.isFinite)),def.id+' must calculate');
    for(let i=0;i<result.lines.length;i++){
      const values=result.lines[i].values;assert.equal(values.length,340,def.id);
      assert.ok(values.every(v=>v===null||Number.isFinite(v)),def.id);
      assert.deepEqual(values.slice(0,175),prefix.lines[i].values,def.id+' must not look ahead');
    }
  }
});

test('VWAP resets per WIB session and undefined volume never becomes zero price',()=>{
  const data={interval:'5m',show_volume:true,candles:[
    {high:10,low:10,close:10,volume:10,chart_time:'2026-01-02T09:00:00'},
    {high:20,low:20,close:20,volume:30,chart_time:'2026-01-02T09:05:00'},
    {high:30,low:30,close:30,volume:20,chart_time:'2026-01-05T09:00:00'},
  ]};
  assert.deepEqual(T.calculate('vwap',data).lines[0].values,[10,17.5,30]);
  assert.equal(T.calculate('vwap',{...data,interval:'1d'}).lines.length,0);
  for(const def of T.catalog.filter(d=>d.volume))assert.equal(T.calculate(def.id,{...data,show_volume:false}).lines.length,0,def.id);
});

test('insufficient history, flat prices and zero denominators are explicit',()=>{
  const short=synthetic(63);assert.match(T.calculate('sma200',short).note,/200.*63/);
  const flat={...synthetic(100),candles:synthetic(100).candles.map(r=>({...r,open:10,high:10,low:10,close:10,volume:100}))};
  assert.equal(T.calculate('rsi',flat).lines[0].values.at(-1),50);
  assert.equal(T.calculate('mfi',flat).lines[0].values.at(-1),50);
  assert.equal(T.calculate('atr',flat).lines[0].values.at(-1),0);
  assert.equal(T.calculate('percentb',flat).lines[0].values.at(-1),null);
  for(const def of T.catalog)for(const line of T.calculate(def.id,flat).lines)assert.ok(line.values.every(v=>v===null||Number.isFinite(v)),def.id);
});

test('Ichimoku spans are shifted by candle count and do not fabricate future dates',()=>{
  const data=synthetic(120),result=T.calculate('ichimoku',data);
  assert.equal(result.lines[0].values.findIndex(Number.isFinite),51);
  assert.equal(result.lines[1].values.findIndex(Number.isFinite),77);
  assert.equal(result.lines[0].values.length,data.candles.length);
  const win=data.candles.slice(0,52),mid=(Math.max(...win.map(r=>r.high))+Math.min(...win.map(r=>r.low)))/2;
  assert.equal(result.lines[1].values[77],mid);
});

test('Supertrend initializes down and switches using the trailing bands',()=>{
  // Hand-calculated from the TradingView published recurrence, ATR(2), multiplier 1.
  const data={candles:[2,2,2,5,6,3,2].map(close=>({open:close,close,high:close+.5,low:close-.5,volume:100}))};
  const lines=T.calculate('supertrend',data,{period:2,multiplier:1}).lines;
  assert.deepEqual(lines[0].values,[null,null,null,2.75,4.125,null,null]);
  assert.deepEqual(lines[1].values,[null,null,3,null,null,5.6875,4.09375]);
});

test('heatmap treats zero as unchanged, stale quotes as unavailable, and clamps colors only',()=>{
  const base={price:100,change_percent:0};assert.equal(H.classify(base),'flat');
  assert.equal(H.classify({...base,change_percent:5}),'up');assert.equal(H.classify({...base,change_percent:-5}),'down');
  assert.equal(H.classify({...base,change_percent:5,stale:true}),'missing');assert.equal(H.classify({...base,error:'offline'}),'missing');
  assert.equal(H.classify({...base,change_percent:null}),'missing');
  assert.equal(H.color({...base,change_percent:200}),H.color({...base,change_percent:5}));
  assert.equal(H.color({...base,change_percent:-200}),H.color({...base,change_percent:-5}));
});

test('parameters reject invalid magnitudes and keep ordered periods',()=>{
  const def=T.catalog.find(d=>d.id==='ultimate');
  const p=T.parameters(def,{fast:999,middle:999,slow:-2});
  assert.ok(p.fast<p.middle&&p.middle<p.slow&&p.slow<=300);
  assert.doesNotThrow(()=>T.parameters(def,null));
});
