const {test}=require('node:test');
const assert=require('node:assert/strict');
const {defaults,parse,mergePositions}=require('../static/layout-state.js');

test('custom positions and hidden widgets survive a save/reload',()=>{
  const items=defaults();
  Object.assign(items[0],{x:2,y:14,w:10,h:12,visible:false});
  items.find(item=>item.id==='summary').visible=true;
  assert.deepEqual(parse(JSON.stringify({version:2,widgets:items})),items);
});

test('rejects damaged, duplicate and out-of-bounds saved layouts',()=>{
  const invalid=[null,{}, {version:99,widgets:defaults()}];
  for(const patch of [{x:-1},{w:13},{h:0},{y:1.5},{id:'<script>'},{visible:'true'}]){
    const items=defaults();Object.assign(items[0],patch);invalid.push({version:2,widgets:items});
  }
  const duplicate=defaults();duplicate[1]={...duplicate[0]};invalid.push({version:2,widgets:duplicate});
  for(const value of invalid)assert.throws(()=>parse(JSON.stringify(value)));
  assert.throws(()=>parse('not json'));
});

test('only layout fields persist; injected content is ignored',()=>{
  const items=defaults();items[0].content='<img onerror=alert(1)>';items[0].price=123;
  const result=parse(JSON.stringify({version:2,widgets:items}));
  assert.deepEqual(result,defaults());
});

test('GridStack omitted minimum dimensions survive serialization',()=>{
  const initial=defaults();
  const compact=initial.filter(i=>i.visible).map(i=>({...i}));
  const market=compact.find(i=>i.id==='market');delete market.h;market.minH=4;
  const result=mergePositions(initial,compact);
  assert.deepEqual(parse(JSON.stringify({version:2,widgets:result})),initial);
  assert.equal(mergePositions(initial,[]).filter(i=>i.visible).length,0);
});

test('v0.5 positions and hidden panels survive migration; new widgets are added below',()=>{
  const old=defaults().filter(i=>!['heatmap','technical1','technical2'].includes(i.id));
  old.find(i=>i.id==='chart').h=9;old.find(i=>i.id==='news').visible=false;
  const result=parse(JSON.stringify({version:1,widgets:old}));
  assert.deepEqual(result.slice(0,7),old);
  assert.equal(result.length,10);
  assert.ok(result.slice(7).every(i=>i.visible&&i.y>=Math.max(...old.filter(i=>i.visible).map(i=>i.y+i.h))));
  assert.deepEqual(parse(JSON.stringify({version:2,widgets:result})),result);
});
