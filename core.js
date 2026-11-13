(function(root){
  'use strict';
  const MAX_DURATION=7*86400000;
  function format(ms,centis=true){
    ms=Math.max(0,Math.floor(ms));const h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;
    return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+(centis?'.'+String(Math.floor(ms/10)%100).padStart(2,'0'):'');
  }
  function formatGroupDuration(ms){const seconds=Math.floor(Math.max(0,ms)/1000);return Math.floor(seconds/60)+'分'+seconds%60+'秒';}
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
  // A sample exactly at a lap marker belongs to the group that just ended.
  function getGroups(record,duration=record?.durationMs||0,ongoing=false){
    if(!record)return [];
    const groups=[];let start=0;
    for(const end of record.laps){groups.push({index:groups.length+1,start,end,durationMs:end-start,maxHeartRate:0,peakAt:null,ongoing:false});start=end;}
    if(duration>start||!groups.length)groups.push({index:groups.length+1,start,end:duration,durationMs:Math.max(0,duration-start),maxHeartRate:0,peakAt:null,ongoing});
    let i=0;for(const p of record.samples){while(i<groups.length-1&&p.t>groups[i].end)i++;const g=groups[i];if(p.t>=g.start&&p.t<=g.end&&p.bpm>g.maxHeartRate){g.maxHeartRate=p.bpm;g.peakAt=p.t;}}
    return groups;
  }
  function peakGroup(record){return getGroups(record).reduce((best,g)=>g.maxHeartRate>(best?.maxHeartRate||0)?g:best,null);}
  const SPORTS=Object.freeze([
    {name:'快走',verb:'快走',met:4.8},{name:'慢跑',verb:'慢跑',met:8.5},
    {name:'骑行',verb:'骑行',met:6.8},{name:'游泳',verb:'游泳',met:5.8},
    {name:'羽毛球',verb:'打羽毛球',met:5.5},{name:'篮球',verb:'打篮球',met:7.5},
    {name:'乒乓球',verb:'打乒乓球',met:4},{name:'网球',verb:'打网球',met:6.8},
    {name:'排球',verb:'打排球',met:3},{name:'足球',verb:'踢足球',met:7}
  ].map(Object.freeze));
  function shareCelebration(durationMs,random=Math.random){
    const duration=Math.max(0,Number.isFinite(durationMs)?durationMs:0),seconds=Math.floor(duration/1000),minutes=duration/60000;
    const sport=SPORTS[Math.min(SPORTS.length-1,Math.max(0,Math.floor(random()*SPORTS.length)))];
    // Default entertainment estimate: adult 70 kg, activity 4 MET, gross kcal.
    const kcal=4*70*duration/3600000,equivalentMinutes=minutes*4/sport.met;
    const readable=n=>n===0?'0':n<.1?'不足0.1':n.toFixed(1).replace(/\.0$/,'');
    return {minutes:Math.floor(seconds/60),seconds:seconds%60,kcal,equivalentMinutes,sport,
      lines:[`恭喜你坚持了${Math.floor(seconds/60)}分${seconds%60}秒，消耗约${readable(kcal)}卡路里，`,`相当于${sport.verb}了约${readable(equivalentMinutes)}分钟！`]};
  }
  root.TimerCore={format,formatGroupDuration,validateRecord,toCSV,fromCSV,decodeHeartRate,getGroups,peakGroup,shareCelebration,SPORTS,MAX_DURATION};
})(typeof module!=='undefined'?module.exports:window);
