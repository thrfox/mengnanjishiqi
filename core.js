(function(root){
  'use strict';
  const MAX_DURATION=7*86400000;
  function format(ms,centis=true){
    ms=Math.max(0,Math.floor(ms));const h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;
    return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+(centis?'.'+String(Math.floor(ms/10)%100).padStart(2,'0'):'');
  }
  function validateRecord(r){
    if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id||r.id.length>150||!Number.isFinite(Date.parse(r.startedAt))||!Number.isFinite(r.durationMs)||r.durationMs<0||r.durationMs>MAX_DURATION||typeof r.note!=='string'||r.note.length>2000||typeof r.device!=='string'||r.device.length>200||!Array.isArray(r.laps)||!Array.isArray(r.samples)||r.laps.length>10000||r.samples.length>100000)throw Error('记录格式无效或超过支持范围');
    let previous=-1;
    const laps=r.laps.map(t=>{if(!Number.isFinite(t)||t<0||t>r.durationMs||t<previous)throw Error('掐表数据无效');previous=t;return t;});previous=-1;
    const samples=r.samples.map(p=>{if(!p||!Number.isFinite(p.t)||p.t<0||p.t>r.durationMs||p.t<previous||!Number.isInteger(p.bpm)||p.bpm<1||p.bpm>300)throw Error('心率数据无效');previous=p.t;return {t:p.t,bpm:p.bpm};});
    return {id:r.id,startedAt:new Date(r.startedAt).toISOString(),durationMs:r.durationMs,note:r.note,device:r.device,laps,samples,maxHeartRate:samples.reduce((a,p)=>Math.max(a,p.bpm),0)};
  }
  function parseCSV(text){
    const rows=[];let row=[],cell='',quoted=false,closed=false;
    text=text.replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
      else if(c==='"'){if(cell||closed)throw Error('CSV 引号格式无效');quoted=true;}
      else if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;rows.push(row);row=[];}}
      else{if(closed)throw Error('CSV 格式无效');cell+=c;}
    }
    if(quoted)throw Error('CSV 引号未闭合');if(cell||row.length||closed){row.push(cell);rows.push(row);}return rows.filter(r=>r.some(Boolean));
  }
  const columns=['版本','记录ID','开始时间','时长毫秒','最高心率','备注','设备','掐表JSON','心率JSON'];
  function toCSV(records){const quote=s=>'"'+String(s).replace(/"/g,'""')+'"';return '\uFEFF'+[columns,...records.map(r=>[1,"'"+r.id,r.startedAt,r.durationMs,r.maxHeartRate,"'"+r.note,"'"+r.device,JSON.stringify(r.laps),JSON.stringify(r.samples)])].map(r=>r.map(quote).join(',')).join('\r\n');}
  function fromCSV(text){const rows=parseCSV(text);if(!rows.length||JSON.stringify(rows.shift())!==JSON.stringify(columns))throw Error('请选择本工具导出的 CSV 文件');if(rows.length>10000)throw Error('单次最多导入 10000 条记录');return rows.map(c=>{if(c.length!==9||c[0]!=='1'||![c[1],c[5],c[6]].every(s=>s.startsWith("'")))throw Error('CSV 记录格式无效');return validateRecord({id:c[1].slice(1),startedAt:c[2],durationMs:Number(c[3]),note:c[5].slice(1),device:c[6].slice(1),laps:JSON.parse(c[7]),samples:JSON.parse(c[8])});});}
  function decodeHeartRate(view){if(view.byteLength<2)throw Error('心率数据不完整');const wide=view.getUint8(0)&1;if(wide&&view.byteLength<3)throw Error('心率数据不完整');const bpm=wide?view.getUint16(1,true):view.getUint8(1);return bpm>=1&&bpm<=300?bpm:null;}
  root.TimerCore={format,validateRecord,toCSV,fromCSV,decodeHeartRate,MAX_DURATION};
})(typeof module!=='undefined'?module.exports:window);
