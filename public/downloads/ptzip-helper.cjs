// ptzIP local companion. Requires Node.js 20+. No dependencies.
// Run: node ptzip-helper.cjs https://YOUR-PUBLISHED-APP.lovable.app
const http = require('node:http');
const net = require('node:net');
const dgram = require('node:dgram');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const os = require('node:os');
const allowedOrigin = process.argv[2];
if (require.main === module && (!allowedOrigin || !/^https?:\/\/[^/]+$/.test(allowedOrigin))) { console.error('Supply the exact app origin: node ptzip-helper.cjs https://your-app.lovable.app'); process.exit(1); }
const token = process.env.PTZIP_TOKEN || crypto.randomBytes(24).toString('hex');
const ipOK = x => typeof x === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(x) && x.split('.').every(v => +v < 256) && (/^192\.168\./.test(x) || /^10\./.test(x) || /^172\.(1[6-9]|2\d|3[01])\./.test(x));
function ping(ip, port) { return new Promise(resolve => { const started = performance.now(); const s = net.createConnection({host:ip,port}); s.setTimeout(650); let done = false; const end = open => { if(done)return; done=true; s.destroy(); resolve({open,latency: +(performance.now()-started).toFixed(1)}); }; s.on('connect',()=>end(true)); s.on('timeout',()=>end(false)); s.on('error',()=>end(false)); }); }
async function get(url){try{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});return (r.headers.get('server')||'')+' '+(await r.text()).slice(0,500000);}catch{return '';}}
async function inspect(ip, port, hint='', direct=false) {
 const result = await ping(ip,port); if(!result.open&&!hint)return null;
 let text = hint; if(result.open){ text += ' '+await get(`http://${ip}:${port}/`); const q=await get(`http://${ip}:${port}/cgi-bin/aw_cam?cmd=QID&res=1`); const m=q.match(/OID:\s*(AW-[\w-]+)/i); if(m)text+=' Panasonic '+m[1]; if(!m){const cx=await get(`http://${ip}:${port}/-wvhttp-01-/info.cgi`);const cm=cx.match(/(?:c\.1\.type|s\.model|model)\s*[:=]\s*(CR-\w+|XF-?\d+\w*)/i)||cx.match(/\b(CR-[NX]\d+\w*)/);if(cm)text+=' Canon '+cm[1];} }
 const brand = ['Panasonic','Sony','ARRI','RED','Blackmagic','BirdDog','Canon','PTZOptics','Lumens','Marshall','AVer','JVC','Datavideo'].find(b=>new RegExp('\\b'+b+'\\b','i').test(text)) || (hint?'ONVIF device':direct&&result.open?'Unidentified':null);
 if(!brand)return null; // Never label arbitrary open hosts as cameras.
 const model = text.match(/(?:AW-[A-Z]{2}\d+\w*|BRC-\w+|SRG-\w+|Alexa\s*35|V-RAPTOR|CR-N\d+|URSA[^<\n]{0,25}|P[124]00|FX[369])/i)?.[0] || decodeURIComponent(text.match(/onvif:\/\/www\.onvif\.org\/hardware\/(\S+)/)?.[1]||'') || 'Detected camera';
 return {id:`local-${ip}`,type:/ARRI|RED|Blackmagic/.test(brand)||/^FX/.test(model)?'Cinema':'PTZ',brand,model,name:model,ip,port,securePort:443,mac:'Not reported',serial:'Not reported',firmware:'Not reported',protocol:hint?'ONVIF + HTTP':'HTTP discovery',latency:result.latency,status:result.open?'Online':'Subnet Mismatch',source:'local',cidr:24,gateway:ip.split('.').slice(0,3).join('.')+'.1',dns1:'0.0.0.0',dns2:'0.0.0.0'};
}
async function onvif() { return new Promise(resolve => { const s = dgram.createSocket('udp4'); const addresses = new Map(); s.on('error',()=>{try{s.close();}catch{}resolve(new Map());}); s.on('message',b=> { for(const m of b.toString().matchAll(/https?:\/\/(\d+\.\d+\.\d+\.\d+)(?::\d+)?/g)) if(ipOK(m[1]))addresses.set(m[1],(addresses.get(m[1])||'')+' '+b.toString().slice(0,4000)); }); s.bind(()=>{ const xml=`<?xml version="1.0"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:n="http://www.onvif.org/ver10/network/wsdl"><e:Header><a:MessageID>uuid:${crypto.randomUUID()}</a:MessageID><a:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To><a:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action></e:Header><e:Body><d:Probe><d:Types>n:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`; for(const iface of connectedNetworks()){try{s.setMulticastInterface(iface.address);s.send(Buffer.from(xml),3702,'239.255.255.250');}catch{}} }); setTimeout(()=>{try{s.close();}catch{}resolve(addresses);},2500); }); }
// Panasonic EasyIP-compatible discovery (read-only): broadcast a configuration request to UDP 10670, cameras answer on 10669 even from other subnets.
function panasonicRequest(mac, ip) {
 const b=[0,1,0,0x2a,0,0x0d,0,0,0,0,0,0,...mac,...ip,0,0,0x20,0x11,0x1e,0x11,0x23,0x1f,0x1e,0x19,0x13,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0xff,0xf0,0,0x26,0,0x20,0,0x21,0,0x22,0,0x23,0,0x25,0,0x28,0,0x40,0,0x41,0,0x42,0,0x44,0,0xa5,0,0xa6,0,0xa7,0,0xa8,0,0xad,0,0xb3,0,0xb4,0,0xb7,0,0xb8,0xff,0xff];
 const sum=(b.reduce((a,x)=>a+x,0)+1)&0xffff; return Buffer.from([...b,sum>>8,sum&255]);
}
function parsePanasonic(buf) {
 if(!Buffer.isBuffer(buf)||buf.length<62||buf[0]!==0||buf[1]!==1)return null;
 const f={};for(let c=58;c+4<=buf.length;){const id=buf.readUInt16BE(c),len=buf.readUInt16BE(c+2);if(id===0xffff||c+4+len>buf.length)break;f[id]=buf.subarray(c+4,c+4+len);c+=4+len;}
 const ip4=v=>v&&v.length>=4?[...v.subarray(0,4)].join('.'):null, str=v=>v?v.toString('latin1').split('\0')[0].trim():'';
 const ip=ip4(f[0x20]||f[0xa0]); if(!ip||!ipOK(ip))return null;
 const maskIp=ip4(f[0x21]||f[0xa1])||'255.255.255.0'; const cidr=maskIp.split('.').reduce((n,x)=>n+((+x).toString(2).match(/1/g)||[]).length,0);
 const dns=f[0x23]; const port=f[0x25]?.length>=2?f[0x25].readUInt16BE(0):80;
 return {brand:'Panasonic',protocol:'Panasonic EasyIP',mac:[...buf.subarray(6,12)].map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join(':'),ip,cidr:Math.min(30,Math.max(1,cidr)),gateway:ip4(f[0x22]||f[0xa2])||'0.0.0.0',dns1:dns?ip4(dns):'0.0.0.0',dns2:dns&&dns.length>=8?ip4(dns.subarray(4)):'0.0.0.0',port:port>0?port:80,name:str(f[0xa7]).slice(0,60),model:str(f[0xa8]).replace(/^CAM:/,'AW-').slice(0,100)};
}
function ifaceRows(){const out=[];for(const [name,rows] of Object.entries(os.networkInterfaces()))for(const r of rows||[]){if(r.internal||(r.family!=='IPv4'&&r.family!==4))continue;out.push({...r,name});}return out;}
// Desktop app on macOS: a tiny bundled sender pins the all-hosts broadcast to each adapter (IP_BOUND_IF),
// because macOS ignores the bound source address and sends 255.255.255.255 only via the default route.
function pinnedSend(bin,iface,sport,dport,packet){return new Promise(res=>{execFile(bin,[iface,String(sport),String(dport),packet.toString('hex')],{timeout:2000},(e,_o,err)=>res(e?(String(err||e.message).trim().slice(0,120)||'failed'):null));});}
function newDiag(){return {adapters:0,sent:0,pinned:0,replies:0,parsed:0,errors:[],sample:''};}
// Read-only broadcast search. Sends from a socket bound to each adapter's own address so the
// all-hosts broadcast (255.255.255.255) leaves through every adapter, not just the default route
// (macOS otherwise sends it only out the primary adapter, e.g. a Wi-Fi hotspot).
function udpSearch({listenPort,destPort,packet,parse,key,d,note}){return new Promise(resolve=>{
 const found=new Map(),socks=[];let closed=false;const rows=ifaceRows();d.adapters=rows.length;
 const err=(where,e)=>{const code=e&&(e.code||e.message)||String(e);d.errors.length<12&&d.errors.push(`${where}: ${code}${code==='EADDRINUSE'&&note?' ('+note+')':''}`);};
 const finish=()=>{closed=true;for(const x of socks)try{x.close();}catch{}resolve([...found.values()]);};
 const onMsg=(b,r)=>{d.replies++;const c=parse(b,r&&r.address);if(c){d.parsed++;found.set(key(c),c);}else if(!d.sample)d.sample=`${r&&r.address}: `+b.subarray(0,400).toString('hex');};
 const open=(port,addr,fallback,ready)=>{const x=dgram.createSocket({type:'udp4',reuseAddr:true});socks.push(x);let bound=false;
  x.on('error',e=>{if(!bound&&fallback){open(0,addr,false,ready);}else err(`${addr} port ${port}`,e);});
  x.on('message',onMsg);
  try{x.bind(port,addr,()=>{bound=true;try{x.setBroadcast(true);}catch{}if(ready&&!closed)ready(x);});}catch(e){err(addr,e);}};
 const bin=process.env.PTZIP_BCAST;
 open(listenPort,'0.0.0.0',false,bin?()=>{for(const r of rows)pinnedSend(bin,r.name,listenPort,destPort,packet(r)).then(e=>{if(e)err(`${r.name} pinned broadcast`,e);else{d.sent++;d.pinned++;}});}:null);
 if(!rows.length)d.errors.push('No IPv4 network adapters found.');
 for(const r of rows){const ip=r.address.split('.').map(Number),m=(r.netmask||'255.255.255.0').split('.').map(Number);const bcast=ip.map((x,i)=>(x|(~m[i]&255))).join('.');
  open(listenPort,r.address,true,x=>{for(const dest of new Set(['255.255.255.255',bcast]))try{x.send(packet(r),destPort,dest,e=>{if(e)err(`${r.address} → ${dest}`,e);else d.sent++;});}catch(e){err(`${r.address} → ${dest}`,e);}});}
 setTimeout(finish,2500);
});}
function panasonic(d=newDiag()){return udpSearch({listenPort:10669,destPort:10670,d,note:'quit Panasonic EasyIP while scanning',key:c=>c.mac,parse:b=>parsePanasonic(b),
 packet:r=>panasonicRequest((r.mac||'00:00:00:00:00:00').split(':').map(x=>parseInt(x,16)||0),r.address.split('.').map(Number))});}
async function announcedCamera(p) {
 const r=await ping(p.ip,p.port);
 return {id:`local-${p.ip}`,type:p.brand==='Blackmagic'&&!/studio/i.test(p.model)?'Cinema':'PTZ',brand:p.brand,model:p.model,name:p.name||p.model,ip:p.ip,port:p.port,securePort:443,mac:p.mac,serial:'Not reported',firmware:p.firmware||'Not reported',protocol:p.protocol,latency:r.latency,status:r.open?'Online':'Subnet Mismatch',source:'local',cidr:p.cidr,gateway:p.gateway,dns1:p.dns1,dns2:p.dns2};
}
// Sony VISCA-over-IP network search (read-only): broadcast ENQ:network to UDP 52380; cameras answer even from other subnets.
const SONY_ENQ=Buffer.from([0x02,...Buffer.from('ENQ:network'),0xff,0x03]);
function parseSony(buf){
 if(!Buffer.isBuffer(buf)||buf[0]!==0x02||!buf.includes('MAC:'))return null;
 const f={};for(const part of buf.subarray(1).toString('latin1').split('\xff')){const i=part.indexOf(':');if(i>0)f[part.slice(0,i).replace(/[\x00-\x1f]/g,'')]=part.slice(i+1).trim();}
 if(!ipOK(f.IPADR))return null;
 const cidr=(f.MASK||'255.255.255.0').split('.').reduce((n,x)=>n+((+x).toString(2).match(/1/g)||[]).length,0);
 return {brand:'Sony',protocol:'Sony VISCA over IP',mac:(f.MAC||'Not reported').toUpperCase().slice(0,60),ip:f.IPADR,cidr:Math.min(30,Math.max(1,cidr)),gateway:ipOK(f.GATEWAY)?f.GATEWAY:'0.0.0.0',dns1:'0.0.0.0',dns2:'0.0.0.0',port:80,name:(f.NAME||f.MODEL||'Sony camera').slice(0,60),model:(f.MODEL||'Sony camera').slice(0,100),firmware:(f.SOFTVERSION||'Not reported').slice(0,60)};
}
function sony(d=newDiag()){return udpSearch({listenPort:52380,destPort:52380,d,note:'quit other camera tools while scanning',key:c=>c.mac+c.ip,parse:b=>parseSony(b),packet:()=>SONY_ENQ});}
// Bonjour/mDNS search (read-only) for Blackmagic and Canon services; same network range only.
const MDNS_SERVICES=['_blackmagic._tcp.local','_bmd_streaming._tcp.local','_canon-ptz._tcp.local'];
function mdnsQuery(){const parts=[Buffer.from([0,0,0,0,0,MDNS_SERVICES.length,0,0,0,0,0,0])];for(const n of MDNS_SERVICES){for(const l of n.split('.'))parts.push(Buffer.from([l.length]),Buffer.from(l));parts.push(Buffer.from([0,0,12,0x80,1]));}return Buffer.concat(parts);}
function readName(b,o,depth=0){const labels=[];while(o<b.length&&depth<20){const len=b[o];if(len===0){o++;break;}if((len&0xc0)===0xc0){const [n]=readName(b,((len&0x3f)<<8)|b[o+1],depth+1);labels.push(n);o+=2;return [labels.join('.'),o];}labels.push(b.subarray(o+1,o+1+len).toString('utf8'));o+=1+len;}return [labels.join('.'),o];}
function parseMdns(b,from){
 try{if(b.length<12)return null;const count=b.readUInt16BE(4)+b.readUInt16BE(6)+b.readUInt16BE(8)+b.readUInt16BE(10);let o=12;const names=[];let ip=null;
  for(let i=0;i<b.readUInt16BE(4);i++){o=readName(b,o)[1]+4;}
  for(let i=b.readUInt16BE(4);i<count&&o<b.length;i++){const [name,n]=readName(b,o);o=n;const type=b.readUInt16BE(o),len=b.readUInt16BE(o+8);const data=o+10;names.push(name);if(type===12)names.push(readName(b,data)[0]);if(type===1&&len===4)ip=[...b.subarray(data,data+4)].join('.');o=data+len;}
  const text=names.join(' ');const brand=/blackmagic|bmd/i.test(text)?'Blackmagic':/canon/i.test(text)?'Canon':null;if(!brand)return null;
  ip=ipOK(ip)?ip:from;if(!ipOK(ip))return null;
  const inst=(names.find(n=>/\._(blackmagic|bmd_streaming|canon-ptz)\._tcp/.test(n)&&!n.startsWith('_'))||'').split('._')[0];
  return {brand,protocol:'Bonjour (mDNS)',mac:'Not reported',ip,cidr:24,gateway:ip.split('.').slice(0,3).join('.')+'.1',dns1:'0.0.0.0',dns2:'0.0.0.0',port:80,name:(inst||brand+' camera').slice(0,60),model:(inst||brand+' camera').slice(0,100)};
 }catch{return null;}
}
function mdns(){return new Promise(resolve=>{const found=new Map();const s=dgram.createSocket({type:'udp4',reuseAddr:true});const finish=()=>{try{s.close();}catch{}resolve([...found.values()]);};
 s.on('error',finish);s.on('message',(b,r)=>{const c=parseMdns(b,r.address);if(c)found.set(c.ip,c);});
 s.bind(()=>{const q=mdnsQuery();for(const n of connectedNetworks()){try{s.setMulticastInterface(n.address);s.send(q,5353,'224.0.0.251');}catch{}}});setTimeout(finish,2500);});}
function parseTarget(input) {
 const n=ip=>ip.split('.').reduce((v,x)=>v*256+Number(x),0);
 const format=value=>[24,16,8,0].map(s=>(value>>>s)&255).join('.');
 const target=String(input||'').trim();let first,last;
 if(target.includes('/')){const [ip,prefix]=target.split('/');const bits=Number(prefix);if(!ipOK(ip)||!/^\d+$/.test(prefix)||bits<24||bits>32||target.split('/').length!==2)throw Error('Enter a private IPv4 subnet from /24 to /32.');const size=2**(32-bits),base=Math.floor(n(ip)/size)*size;first=base+(bits<=30?1:0);last=base+size-1-(bits<=30?1:0);}
 else if(target.includes('-')){const [a,b]=target.split('-').map(v=>v.trim());if(!ipOK(a)||!ipOK(b)||target.split('-').length!==2)throw Error('Enter two private IPv4 addresses separated by a dash.');first=n(a);last=n(b);}
 else {if(!ipOK(target))throw Error('Enter a private IP, CIDR subnet, or full start IP - end IP range.');first=n(target);last=first;}
 if(last<first||last-first+1>256)throw Error('Choose an ascending range of at most 256 addresses.');
 const ips=Array.from({length:last-first+1},(_,i)=>format(first+i));if(ips.some(ip=>!ipOK(ip)))throw Error('Only private IPv4 addresses may be scanned.');return ips;
}
function connectedNetworks(interfaces = os.networkInterfaces()) {
 const networks=[];
 for(const [name, rows] of Object.entries(interfaces)) for(const row of rows||[]) {
  if(row.internal || (row.family!=='IPv4' && row.family!==4) || !ipOK(row.address))continue;
  const supplied=Number(String(row.cidr||'').split('/')[1]);
  const bits=Number.isInteger(supplied)&&supplied>=1&&supplied<=32?supplied:24;
  const prefix=Math.max(24,bits),size=2**(32-prefix);
  const value=row.address.split('.').reduce((n,x)=>n*256+Number(x),0);
  const base=Math.floor(value/size)*size;
  const ip=[24,16,8,0].map(s=>(base>>>s)&255).join('.');
  const target=`${ip}/${prefix}`;
  if(!networks.some(n=>n.target===target))networks.push({name,target,limited:bits<24,address:row.address});
 }
 if(networks.length>32)throw Error('Too many connected interfaces. Enter a specific subnet or range.');
 return networks;
}
let busy = false;
if(require.main!==module){module.exports={udpSearch,pinnedSend,newDiag,panasonicRequest,parsePanasonic,parseSony,SONY_ENQ,parseMdns,mdnsQuery};}else http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(req.headers.host!=='127.0.0.1:3344' || origin!==allowedOrigin) {res.writeHead(403);res.end();return;}
 const headers={'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'Content-Type, X-Camera-Token','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Private-Network':'true','Content-Type':'application/json','Cache-Control':'no-store'};
 if(req.method==='OPTIONS'){res.writeHead(204,headers);res.end();return;}
 res.writeHead(200,headers); const reply=x=>res.end(JSON.stringify(x));
 if(req.headers['x-camera-token']!==token){reply({error:'Invalid companion token.'});return;}
 if(req.method!=='POST'){reply({error:'POST required.'});return;}
 let raw=''; for await(const chunk of req){raw+=chunk;if(raw.length>4096){reply({error:'Request too large.'});return;}}
 let data;try{data=JSON.parse(raw);}catch{reply({error:'Invalid JSON.'});return;}
 try {
 if(req.url==='/health'){reply({connected:true});return;}
 if(req.url==='/ping'){if(!ipOK(data.ip)||!Number.isInteger(data.port)||data.port<1||data.port>65535)throw Error('Invalid private IPv4 address or port.');reply(await ping(data.ip,data.port));return;}
 if(req.url==='/scan'){
 if(busy)throw Error('A scan is already running.');
 const target=String(data.target||data.subnet||'').trim();
 const networks=target?[]:connectedNetworks();
 if(!target&&!networks.length)throw Error('No connected private IPv4 networks found. Connect Ethernet or Wi-Fi to your camera switch, or enter a private IP range.');
 const targets=target?parseTarget(target):[...new Set(networks.flatMap(n=>[n.address,...parseTarget(n.target)]))];
 const ports=data.ports||[80,443];if(!Array.isArray(ports)||ports.length<1||ports.length>16||ports.some(p=>!Number.isInteger(p)||p<1||p>65535))throw Error('Choose up to 16 valid ports.');
 busy=true;try{const diagnostics={panasonic:newDiag(),sony:newDiag()};const [announced,...lists]=await Promise.all([onvif(),panasonic(diagnostics.panasonic),sony(diagnostics.sony),mdns()]);const pana=lists.flat();const ips=target?targets:[...new Set([...targets,...announced.keys()])];const devices=[];let index=0;await Promise.all(Array.from({length:24},async()=>{while(index<ips.length){const ip=ips[index++];for(const p of ports){const c=await inspect(ip,p,announced.get(ip)||'');if(c){devices.push(c);break;}}}}));const panaRows=await Promise.all(pana.filter(p=>!target||targets.includes(p.ip)).map(announcedCamera));for(const c of panaRows){const i=devices.findIndex(d=>d.ip===c.ip);if(i>=0)devices[i]={...devices[i],...c,latency:devices[i].latency,status:devices[i].status};else devices.push(c);}reply({devices,networks,diagnostics});}finally{busy=false;}return;}
 if(req.url==='/add'){if(!ipOK(data.ip)||!Number.isInteger(data.port)||data.port<1||data.port>65535)throw Error('Enter a private IPv4 address and valid port.');let c=await inspect(data.ip,data.port,'',true);const diagnostics={panasonic:newDiag(),sony:newDiag()};if(!c){const p=(await Promise.all([panasonic(diagnostics.panasonic),sony(diagnostics.sony),mdns()])).flat().find(x=>x.ip===data.ip);if(p)c=await announcedCamera(p);}reply({devices:c?[c]:[],diagnostics});return;}
 throw Error('Unsupported action. Vendor network rewriting is intentionally not implemented.');
 }catch(e){reply({error:e.message});}
}).listen(3344,'127.0.0.1',()=>console.log(`ptzIP companion listening on 127.0.0.1:3344\nApp origin: ${allowedOrigin}\nPairing token (paste into ptzIP): ${token}\nRead-only discovery and TCP checks. No camera settings will be modified.`));
