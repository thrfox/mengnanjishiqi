/* No network storage, analytics, or external dependencies. */
'use strict';
const $=id=>document.getElementById(id),C=window.TimerCore,KEY='mengnan-timer:v1',DRAFT='mengnan-timer:draft:v1';
let shareBlob=null,shareUrl=null,shareName='';
let records=[],current=null,running=false,selectedId=null,startMono=0,device=null,characteristic=null,connecting=false,latestHR=null,lastHRAt=0,lastPaint=0,lastPersist=0,noteId=null,deleteId=null,toastTimer,storageReady=true;
const dateText=s=>new Date(s).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function saveHistory(next=records){try{localStorage.setItem(KEY,JSON.stringify(next));return true;}catch(e){toast('浏览器存储失败，请先导出备份；本次数据仍在页面内。');return false;}}
function checkpoint(){if(!running||!current)return;current.durationMs=elapsed();try{localStorage.setItem(DRAFT,JSON.stringify(current));}catch(e){if(storageReady){toast('无法保存计时草稿，请结束后导出备份。');storageReady=false;}}}
function removeDraft(){try{localStorage.removeItem(DRAFT);}catch(e){toast('无法清除草稿，请检查浏览器存储权限。');}}
function elapsed(){return running?Math.min(C.MAX_DURATION,performance.now()-startMono):current?.durationMs||0;}
function newRecord(){return {id:crypto.randomUUID(),startedAt:new Date().toISOString(),durationMs:0,maxHeartRate:0,note:'',device:'',laps:[],samples:[]};}
function toggleTimer(){
  if(running){current.durationMs=elapsed();running=false;records.unshift(current);selectedId=current.id;if(saveHistory())removeDraft();renderAll();toast('本次记录已结束'+(storageReady?'':'，请导出备份'));return;}
  current=newRecord();selectedId=null;startMono=performance.now();running=true;lastPersist=Date.now();checkpoint();renderAll();
}
function lap(){if(!running)return;if(current.laps.length>=10000){toast('掐表已达 10000 次上限');return;}current.laps.push(elapsed());checkpoint();renderLaps();drawChart();}
function renderTimer(){const time=C.format(elapsed()),dot=time.lastIndexOf('.');$('timer').replaceChildren(document.createTextNode(time.slice(0,dot)));const sub=document.createElement('span');sub.textContent=time.slice(dot);$('timer').append(sub);$('totalLabel').textContent='总时长 '+time;}
function renderAll(){
  renderTimer();$('startBtn').textContent=running?'结束计时 ':'开始计时 ';const k=document.createElement('kbd');k.textContent='Enter';$('startBtn').append(k);$('lapBtn').disabled=!running;$('newBtn').hidden=running||!current;
  $('sessionStatus').textContent=running?'计时中':current?'历史回看':'准备就绪';$('sessionStatus').classList.toggle('running',running);$('sessionDate').textContent=current?dateText(current.startedAt)+(current.device?' · '+current.device:''):'回车开始计时';
  renderHeart();renderLaps();renderHistory();drawChart();
}
function renderHeart(){const fresh=latestHR!==null&&Date.now()-lastHRAt<=15000;$('heartLabel').textContent='实时心率';$('heart').textContent=fresh?latestHR:'—';$('peak').textContent=current?.maxHeartRate||'—';if(characteristic&&latestHR!==null&&!fresh)bluetoothStatus('超过 15 秒未收到更新，请检查手环测量状态。');}
function renderLaps(){const laps=current?.laps||[];$('lapCount').textContent=String(laps.length).padStart(2,'0');$('laps').replaceChildren();if(!laps.length){const s=document.createElement('span');s.className='muted';s.textContent='按下空格，留下一个时间点。';$('laps').append(s);return;}laps.forEach((t,i)=>{const chip=document.createElement('div');chip.className='lap-chip';const num=document.createElement('em');num.textContent=String(i+1).padStart(2,'0');const text=document.createElement('div');text.textContent=C.format(t-(laps[i-1]||0));const small=document.createElement('small');small.textContent='累计 '+C.format(t);text.append(small);chip.append(num,text);$('laps').append(chip);});$('laps').scrollLeft=$('laps').scrollWidth;}
function renderHistory(){
  records.sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));
  renderLongest();
  $('historyCount').textContent=records.length+' 次记录';$('history').replaceChildren();if(!records.length){const empty=document.createElement('div');empty.className='history-empty';const icon=document.createElement('b');icon.textContent='00';empty.append(icon,document.createTextNode('暂无历史记录'));$('history').append(empty);return;}
  records.forEach((r,i)=>{const card=document.createElement('article');card.className='history-card'+(r.id===selectedId?' selected':'');const top=document.createElement('div');top.className='record-top';const date=document.createElement('span');date.textContent=dateText(r.startedAt);const index=document.createElement('span');index.textContent='#'+String(records.length-i).padStart(2,'0');top.append(date,index);const duration=document.createElement('div');duration.className='record-duration';duration.textContent=C.format(r.durationMs);const meta=document.createElement('div');meta.className='record-meta';meta.textContent='最高心率 ';const peak=document.createElement('b');peak.textContent=r.maxHeartRate?r.maxHeartRate+' BPM':'—';meta.append(peak);const lapMeta=document.createElement('small');lapMeta.style.display='block';lapMeta.textContent=r.laps.length+' 次掐表';meta.append(lapMeta);const metrics=document.createElement('div');metrics.className='record-metrics';metrics.append(duration,meta);card.append(top,metrics);if(r.note){const p=document.createElement('p');p.className='record-note';p.textContent=r.note;card.append(p);}const actions=document.createElement('div');actions.className='record-actions';[['查看',()=>{if(running){toast('请先结束当前计时，再查看历史。');return;}current=r;selectedId=r.id;renderAll();if(innerWidth<=760)$('timer').scrollIntoView({behavior:'smooth',block:'center'});}],['备注',()=>{noteId=r.id;$('noteDialog').returnValue='';$('noteInput').value=r.note;$('noteDialog').showModal();}],['删除',()=>{deleteId=r.id;$('deleteDialog').returnValue='';$('deleteDialog').showModal();}]].forEach(([label,fn])=>{const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',label+' '+dateText(r.startedAt)+' 的记录');b.onclick=fn;actions.append(b);});card.append(actions);$('history').append(card);});
}
function renderLongest(){
  const box=$('longestRecord');box.replaceChildren();box.hidden=!records.length;if(!records.length)return;
  const r=records.reduce((best,r)=>r.durationMs>best.durationMs||(r.durationMs===best.durationMs&&Date.parse(r.startedAt)>Date.parse(best.startedAt))?r:best);
  const title=document.createElement('h2');title.className='longest-title';title.textContent='最长记录';
  const duration=document.createElement('div');duration.className='longest-duration';duration.textContent=C.format(r.durationMs);
  const date=document.createElement('div');date.className='longest-date';date.textContent=dateText(r.startedAt);
  const meta=document.createElement('div');meta.className='longest-meta';meta.textContent='最高心率 '+(r.maxHeartRate?r.maxHeartRate+' BPM':'—')+' · '+r.laps.length+' 次掐表';box.append(title,duration,date,meta);
  if(r.note){const note=document.createElement('p');note.textContent=r.note;box.append(note);}
  const view=document.createElement('button');view.textContent='查看记录 ↗';view.setAttribute('aria-label','查看最长记录');view.onclick=()=>{if(running){toast('请先结束当前计时，再查看历史。');return;}current=r;selectedId=r.id;renderAll();if(innerWidth<=760)$('timer').scrollIntoView({behavior:'smooth',block:'center'});};box.append(view);
}
function drawPlot(ctx,width,height,record,duration){
  const pad={l:42,r:18,t:18,b:56},w=width-pad.l-pad.r,h=height-pad.t-pad.b;if(w<20||h<20)return;
  const samples=record?.samples||[],laps=record?.laps||[],maxBpm=samples.reduce((a,p)=>Math.max(a,p.bpm),160),minBpm=samples.reduce((a,p)=>Math.min(a,p.bpm),60),low=Math.max(0,Math.floor((minBpm-20)/20)*20),high=Math.max(180,Math.ceil((maxBpm+20)/20)*20),end=Math.max(10000,duration),x=t=>pad.l+t/end*w,y=bpm=>pad.t+(high-bpm)/(high-low)*h;
  ctx.font='10px Consolas, monospace';ctx.textAlign='right';ctx.textBaseline='middle';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const bpm=low+(high-low)*i/4,yy=y(bpm);ctx.strokeStyle='#39212d';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(width-pad.r,yy);ctx.stroke();ctx.fillStyle='#927782';ctx.fillText(Math.round(bpm),pad.l-10,yy);}
  ctx.setLineDash([]);ctx.textAlign='center';ctx.textBaseline='top';const ticks=w<280?2:4;for(let i=0;i<=ticks;i++){const t=end*i/ticks;ctx.textAlign=i===ticks?'right':'center';ctx.fillStyle='#927782';ctx.fillText(C.format(t,false),x(t),height-pad.b+12);ctx.fillStyle='#745d68';ctx.fillText(record?new Date(Date.parse(record.startedAt)+t).toLocaleTimeString('zh-CN',{hour12:false}):'—',x(t),height-pad.b+29);}
  laps.forEach((t,i)=>{ctx.strokeStyle='#916071';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(x(t),pad.t);ctx.lineTo(x(t),height-pad.b);ctx.stroke();ctx.fillStyle='#d193a7';ctx.textAlign='center';if(i===0||x(t)-x(laps[i-1])>45){ctx.fillText(String(i+1),x(t),pad.t);ctx.save();ctx.translate(x(t)+3,height-pad.b-5);ctx.rotate(-Math.PI/2);ctx.textAlign='left';ctx.fillText(C.format(t),0,0);ctx.restore();}});ctx.setLineDash([]);
  if(samples.length){const segments=[];let seg=[];for(const p of samples){if(seg.length&&p.t-seg.at(-1).t>15000){segments.push(seg);seg=[];}seg.push(p);}if(seg.length)segments.push(seg);
    for(const s of segments){ctx.beginPath();ctx.moveTo(x(s[0].t),y(s[0].bpm));s.slice(1).forEach(p=>ctx.lineTo(x(p.t),y(p.bpm)));ctx.lineTo(x(s.at(-1).t),height-pad.b);ctx.lineTo(x(s[0].t),height-pad.b);ctx.closePath();const gradient=ctx.createLinearGradient(0,pad.t,0,height-pad.b);gradient.addColorStop(0,'#ff486c30');gradient.addColorStop(1,'#ff486c00');ctx.fillStyle=gradient;ctx.fill();ctx.beginPath();ctx.moveTo(x(s[0].t),y(s[0].bpm));s.slice(1).forEach(p=>ctx.lineTo(x(p.t),y(p.bpm)));ctx.strokeStyle='#ff486c';ctx.lineWidth=2;ctx.stroke();if(s.length===1){ctx.beginPath();ctx.arc(x(s[0].t),y(s[0].bpm),3,0,2*Math.PI);ctx.fillStyle='#ff486c';ctx.fill();}}
    const p=samples.at(-1);ctx.beginPath();ctx.arc(x(p.t),y(p.bpm),3,0,Math.PI*2);ctx.fillStyle='#ff819d';ctx.fill();
  }
}
function drawChart(){const canvas=$('chart'),rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);drawPlot(ctx,rect.width,rect.height,current,elapsed());$('chartEmpty').hidden=!!current?.samples.length;if(!current?.samples.length){$('chartEmpty').firstChild.textContent=current&&!running?'本次未记录心率':'等待心跳';}}
const DEVICE_KEY='mengnan-timer:bluetooth-device:v1';
let reconnectTimer=null,reconnectAttempts=0,autoReconnect=true,waitingTimer=null;
function bluetoothStatus(message){$('bluetoothStatus').textContent=message;}
function bluetoothButtons(){
  $('connectBtn').disabled=connecting;
  $('authorizeBluetoothBtn').disabled=connecting;
  $('connectionLabel').textContent=connecting?'正在连接…':characteristic?(device?.name||'心率设备'):'连接心率设备';
  $('connectBtn').classList.toggle('connected',!!characteristic);
  $('connectBtn').title=characteristic?'点击断开连接':'选择手环并读取心率';
}
function promptBluetooth(message){
  if(message)$('bluetoothPrompt').textContent=message;
  if(!$('bluetoothDialog').open&&!document.querySelector('dialog[open]'))$('bluetoothDialog').showModal();
}
function clearHeartConnection(){
  clearTimeout(waitingTimer);
  if(characteristic)characteristic.removeEventListener('characteristicvaluechanged',receiveHeart);
  characteristic=null;latestHR=null;lastHRAt=0;renderHeart();
}
function scheduleReconnect(reason=''){
  clearTimeout(reconnectTimer);
  if(!autoReconnect||!device||connecting)return;
  if(reconnectAttempts>=3){bluetoothStatus(reason+' 自动重连未成功，请开启心率广播后点击“连接心率设备”。');return;}
  const delay=[2000,5000,10000][reconnectAttempts++];
  bluetoothStatus(reason?reason+' 正在等待自动重连…':'设备已断开，正在等待自动重连…');
  reconnectTimer=setTimeout(()=>{if(autoReconnect&&!connecting)void openHeartDevice(device,true);},delay);
}
function disconnected(event){
  if(event?.target&&event.target!==device)return;
  clearHeartConnection();bluetoothButtons();
  bluetoothStatus('心率设备已断开');
  if(!connecting)scheduleReconnect();
}
async function openHeartDevice(candidate,automatic=false){
  if(connecting)return false;
  connecting=true;clearTimeout(reconnectTimer);clearHeartConnection();
  if(device)device.removeEventListener('gattserverdisconnected',disconnected);
  device=candidate;device.addEventListener('gattserverdisconnected',disconnected);
  bluetoothButtons();let stage='建立蓝牙连接';
  try{
    bluetoothStatus('正在连接 '+(device.name||'心率设备')+'…');
    const server=await device.gatt.connect();
    stage='获取心率服务 0x180D';const service=await server.getPrimaryService('heart_rate');
    stage='获取心率特征 0x2A37';characteristic=await service.getCharacteristic('heart_rate_measurement');
    characteristic.addEventListener('characteristicvaluechanged',receiveHeart);
    stage='订阅心率通知';await characteristic.startNotifications();
    if(!device.gatt.connected)throw Error('订阅期间设备断开');
    reconnectAttempts=0;autoReconnect=true;
    try{localStorage.setItem(DEVICE_KEY,device.id);}catch(e){}
    if(latestHR===null)bluetoothStatus('已连接 '+(device.name||'心率设备')+'，等待心率数据');
    waitingTimer=setTimeout(()=>{if(characteristic&&latestHR===null)bluetoothStatus('已订阅，尚未收到心率。请在手环开启心率测量或运动模式。');},15000);
    if($('bluetoothDialog').open)$('bluetoothDialog').close();
    return true;
  }catch(error){
    clearHeartConnection();if(device?.gatt.connected)device.gatt.disconnect();
    bluetoothStatus(stage+'失败：'+(error.message||error.name)+'。请开启心率广播，或暂时断开手机连接后重试。');
    if(!automatic)toast(stage+'失败，请检查手环广播及连接占用。');
    return false;
  }finally{connecting=false;bluetoothButtons();if(automatic&&!characteristic)scheduleReconnect($('bluetoothStatus').textContent);}
}
async function connect(){
  if(connecting)return;
  if(characteristic&&device?.gatt.connected){autoReconnect=false;clearTimeout(reconnectTimer);device.gatt.disconnect();disconnected();return;}
  if(!navigator.bluetooth||!window.isSecureContext){bluetoothStatus('当前浏览器不支持蓝牙，请用电脑 Chrome / Edge 或 Android Chrome，通过 HTTPS 打开。');toast('当前浏览器不支持蓝牙连接。');return;}
  clearTimeout(reconnectTimer);autoReconnect=false;connecting=true;bluetoothButtons();
  try{
    // Matches the demo's “显示全部设备”: bands may omit 0x180D from advertising.
    const candidate=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:['heart_rate']});
    connecting=false;autoReconnect=true;reconnectAttempts=0;
    await openHeartDevice(candidate);
  }catch(error){bluetoothStatus(error.name==='NotFoundError'?'未选择设备，点击“连接心率设备”可重试。':'选择设备失败：'+(error.message||error.name));}
  finally{connecting=false;bluetoothButtons();}
}
async function initializeBluetooth(){
  if(!navigator.bluetooth||!window.isSecureContext){bluetoothStatus('当前浏览器不支持蓝牙连接；可使用电脑 Chrome / Edge 或 Android Chrome。');return;}
  bluetoothStatus('正在检查已授权手环…');
  try{
    const granted=navigator.bluetooth.getDevices?await navigator.bluetooth.getDevices():[];
    if(connecting||characteristic)return;
    let preferred;try{preferred=localStorage.getItem(DEVICE_KEY);}catch(e){}
    const previous=granted.find(d=>d.id===preferred)||(granted.length===1?granted[0]:null);
    if(previous){await openHeartDevice(previous,true);return;}
    bluetoothStatus('首次连接需选择手环；连接后立即显示实时心率。');
    promptBluetooth('先开启手环的心率广播。首次访问需选择一次设备，下次进入会自动尝试连接。');
  }catch(error){bluetoothStatus('无法检查已授权设备，请点击“连接心率设备”重试。');promptBluetooth();}
}

function receiveHeart(event){let bpm;try{bpm=C.decodeHeartRate(event.target.value);}catch(e){return;}if(bpm===null)return;latestHR=bpm;lastHRAt=Date.now();clearTimeout(waitingTimer);bluetoothStatus('正在接收心率 · '+(device?.name||'心率设备')+' · '+new Date(lastHRAt).toLocaleTimeString('zh-CN',{hour12:false}));if(running){const t=elapsed();if(current.samples.length<100000){current.samples.push({t,bpm});current.maxHeartRate=Math.max(current.maxHeartRate,bpm);current.device=device?.name||'蓝牙心率设备';}else if(current.samples.length===100000){toast('心率采样已达上限，请结束本次计时。');toggleTimer();}drawChart();}renderHeart();}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function exportCSV(){if(!records.length){toast(running?'请先结束计时，再导出历史记录。':'还没有可导出的记录。');return;}download(new Blob([C.toCSV(records)],{type:'text/csv;charset=utf-8'}),'猛男计时器-'+new Date().toISOString().slice(0,10)+'.csv');toast('已导出 '+records.length+' 条历史记录');}
async function importCSV(event){const file=event.target.files[0];if(!file)return;try{if(file.size>30*1024*1024)throw Error('文件超过 30 MB');const incoming=C.fromCSV(await file.text()),ids=new Set(records.map(r=>r.id)),added=[];for(const r of incoming){if(!ids.has(r.id)){added.push(r);ids.add(r.id);}}if(!added.length){toast('没有新的记录可导入');return;}const next=[...records,...added].sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));if(!saveHistory(next))return;records=next;renderHistory();toast('已导入 '+added.length+' 条记录，重复记录已跳过');}catch(e){toast('导入失败：'+e.message);}finally{event.target.value='';}}
async function shareImage(){
  if(!current){toast('完成计时或选择一条历史记录，再生成图片。');return;}const r={...current,durationMs:elapsed(),laps:[...current.laps],samples:[...current.samples]},canvas=document.createElement('canvas'),width=1200,rows=Math.ceil(r.laps.length/4),noteLines=[];const ctx=canvas.getContext('2d');ctx.font='22px "Microsoft YaHei",sans-serif';if(r.note){let line='';for(const c of r.note){if(c==='\n'||ctx.measureText(line+c).width>1070){noteLines.push(line);line=c==='\n'?'':c;}else line+=c;}noteLines.push(line);}
  if(rows>200){toast('掐表次数过多，图片最多显示前 800 次；完整数据请导出 CSV。');}const visibleRows=Math.min(rows,200),height=840+visibleRows*43+(noteLines.length?55+noteLines.length*32:0);canvas.width=width;canvas.height=height;ctx.fillStyle='#140d12';ctx.fillRect(0,0,width,height);ctx.fillStyle='#ff486c';ctx.fillRect(55,55,58,58);ctx.fillStyle='#251018';ctx.fillRect(57,57,54,54);ctx.strokeStyle='#ff486c';ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(64,85);ctx.lineTo(74,85);ctx.lineTo(79,69);ctx.lineTo(88,101);ctx.lineTo(94,85);ctx.lineTo(104,85);ctx.stroke();ctx.font='bold 28px "Microsoft YaHei",sans-serif';ctx.fillStyle='#f5e9ee';ctx.fillText('猛男计时器',130,80);ctx.font='16px "Microsoft YaHei",sans-serif';ctx.fillStyle='#ad8999';ctx.fillText('看看你有多久',130,108);ctx.textAlign='right';ctx.fillText(dateText(r.startedAt),1145,82);ctx.textAlign='left';ctx.font='bold 88px Consolas,monospace';ctx.fillStyle='#fff0f5';ctx.fillText(C.format(r.durationMs),55,232);ctx.font='20px "Microsoft YaHei",sans-serif';ctx.fillStyle='#ff7594';ctx.fillText('最高心率 '+(r.maxHeartRate?r.maxHeartRate+' BPM':'—')+'     /     '+r.laps.length+' 次掐表',60,283);ctx.save();ctx.translate(20,320);ctx.scale(2,2);drawPlot(ctx,580,180,r,r.durationMs);ctx.restore();ctx.font='17px Consolas,monospace';r.laps.slice(0,800).forEach((t,i)=>{ctx.fillStyle='#c9a7b6';ctx.fillText(String(i+1).padStart(2,'0')+'  '+C.format(t-(r.laps[i-1]||0)),60+(i%4)*280,710+Math.floor(i/4)*43);});if(noteLines.length){ctx.font='20px "Microsoft YaHei",sans-serif';ctx.fillStyle='#bd9aa9';noteLines.forEach((s,i)=>ctx.fillText(s,60,735+visibleRows*43+i*32));}ctx.strokeStyle='#54303e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(60,height-75);ctx.lineTo(1140,height-75);ctx.stroke();ctx.font='20px Consolas,monospace';ctx.fillStyle='#ff829e';ctx.fillText(location.protocol==='https:'?location.origin+location.pathname.replace(/index\.html$/,''):'https://thrfox.github.io/mengnanjishiqi/',60,height-34);ctx.font='16px '+String.fromCharCode(34)+'Microsoft YaHei'+String.fromCharCode(34)+',sans-serif';ctx.textAlign='right';ctx.fillStyle='#aa8393';ctx.fillText('猛男计时器 · 看看你有多久',1140,height-34);canvas.toBlob(blob=>{if(blob){if(shareUrl)URL.revokeObjectURL(shareUrl);shareBlob=blob;shareName='猛男计时器-'+r.startedAt.slice(0,10)+'.png';shareUrl=URL.createObjectURL(blob);$('sharePreview').src=shareUrl;$('shareDialog').showModal();}else toast('图片生成失败，请导出 CSV 备份。');},'image/png');
}
$('closeShareBtn').onclick=()=>$('shareDialog').close();$('saveShareBtn').onclick=()=>{if(shareBlob)download(shareBlob,shareName);};
$('startBtn').onclick=toggleTimer;$('lapBtn').onclick=lap;$('connectBtn').onclick=connect;$('exportBtn').onclick=exportCSV;$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=importCSV;$('shareBtn').onclick=shareImage;$('newBtn').onclick=()=>{current=null;selectedId=null;renderAll();};
document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||e.target.closest('input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;if(e.code==='Enter'||e.code==='NumpadEnter'){e.preventDefault();toggleTimer();}else if(e.code==='Space'){e.preventDefault();lap();}});
$('noteDialog').addEventListener('close',()=>{if($('noteDialog').returnValue!=='save')return;const r=records.find(r=>r.id===noteId);if(r){r.note=$('noteInput').value;saveHistory();renderHistory();}});
$('deleteDialog').addEventListener('close',()=>{if($('deleteDialog').returnValue!=='delete')return;records=records.filter(r=>r.id!==deleteId);if(selectedId===deleteId){current=null;selectedId=null;}saveHistory();renderAll();});
$('chart').addEventListener('pointermove',e=>{if(!current?.samples.length)return;const rect=$('chart').getBoundingClientRect(),t=Math.max(0,Math.min(1,(e.clientX-rect.left-42)/(rect.width-60)))*Math.max(10000,elapsed());let low=0,high=current.samples.length-1;while(low<high){const mid=(low+high)>>1;if(current.samples[mid].t<t)low=mid+1;else high=mid;}let p=current.samples[low];if(low&&Math.abs(current.samples[low-1].t-t)<Math.abs(p.t-t))p=current.samples[low-1];$('tooltip').textContent=C.format(p.t)+' / '+new Date(Date.parse(current.startedAt)+p.t).toLocaleTimeString('zh-CN',{hour12:false})+' · '+p.bpm+' BPM';$('tooltip').hidden=false;});$('chart').addEventListener('pointerleave',()=>$('tooltip').hidden=true);
window.addEventListener('resize',drawChart);document.addEventListener('visibilitychange',()=>{checkpoint();if(!document.hidden){drawChart();renderHeart();}});window.addEventListener('pagehide',checkpoint);
window.addEventListener('storage',e=>{if(e.key===KEY&&!running)toast('另一个标签页修改了记录，请刷新页面以读取最新记录。');});
function load(){try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(!Array.isArray(parsed))throw Error('记录格式不正确');records=parsed.map(C.validateRecord).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));}const draft=localStorage.getItem(DRAFT);if(draft){const recovered=C.validateRecord(JSON.parse(draft));if(!records.some(r=>r.id===recovered.id)){records.unshift(recovered);if(saveHistory())removeDraft();current=recovered;selectedId=recovered.id;toast('已恢复上次中断的计时，时长截至最后一次自动保存。');}else removeDraft();}}catch(e){toast('本地记录未能读取，请保留浏览器数据并尝试导入备份。');}}
function frame(time){if(time-lastPaint>=40){if(running){renderTimer();if(elapsed()>=C.MAX_DURATION){toggleTimer();toast('已达到 7 天计时上限，记录已结束。');}}renderHeart();lastPaint=time;}if(running&&Date.now()-lastPersist>=1000){checkpoint();drawChart();lastPersist=Date.now();}requestAnimationFrame(frame);}
$('skipBluetoothBtn').onclick=()=>$('bluetoothDialog').close();
$('authorizeBluetoothBtn').onclick=()=>{$('bluetoothDialog').close();void connect();};
load();renderAll();requestAnimationFrame(frame);void initializeBluetooth();
