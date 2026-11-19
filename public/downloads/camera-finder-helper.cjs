// ptzIP local companion. Requires Node.js 20+. No dependencies.
// Run: node ptzip-helper.cjs https://YOUR-PUBLISHED-APP.lovable.app
const http = require('node:http');
const net = require('node:net');
const dgram = require('node:dgram');
const crypto = require('node:crypto');
const os = require('node:os');
const allowedOrigin = process.argv[2];
if (require.main === module && (!allowedOrigin || !/^https?:\/\/[^/]+$/.test(allowedOrigin))) { console.error('Supply the exact app origin: node ptzip-helper.cjs https://your-app.lovable.app'); process.exit(1); }
const token = process.env.PTZIP_TOKEN || crypto.randomBytes(24).toString('hex');
const ipOK = x => typeof x === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(x) && x.split('.').every(v => +v < 256) && (/^192\.168\./.test(x) || /^10\./.test(x) || /^172\.(1[6-9]|2\d|3[01])\./.test(x));
function ping(ip, port) { return new Promise(resolve => { const started = performance.now(); const s = net.createConnection({host:ip,port}); s.setTimeout(650); let done = false; const end = open => { if(done)return; done=true; s.destroy(); resolve({open,latency: +(performance.now()-started).toFixed(1)}); }; s.on('connect',()=>end(true)); s.on('timeout',()=>end(false)); s.on('error',()=>end(false)); }); }
async function get(url){try{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});return (r.headers.get('server')||'')+' '+(await r.text()).slice(0,500000);}catch{return '';}}
async function inspect(ip, port, hint='', direct=false) {
 const result = await ping(ip,port); if(!result.open&&!hint)return null;
 let text = hint; if(result.open){ text += ' '+await get(`http://${ip}:${port}/`); const q=await get(`http://${ip}:${port}/cgi-bin/aw_cam?cmd=QID&res=1`); const m=q.match(/OID:\s*(AW-[\w-]+)/i); if(m)text+=' Panasonic '+m[1]; }
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
 return {mac:[...buf.subarray(6,12)].map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join(':'),ip,cidr:Math.min(30,Math.max(1,cidr)),gateway:ip4(f[0x22]||f[0xa2])||'0.0.0.0',dns1:dns?ip4(dns):'0.0.0.0',dns2:dns&&dns.length>=8?ip4(dns.subarray(4)):'0.0.0.0',port:port>0?port:80,name:str(f[0xa7]).slice(0,60),model:str(f[0xa8]).replace(/^CAM:/,'AW-').slice(0,100)};
}
function panasonic() { return new Promise(resolve => {
 const found=new Map(); const s=dgram.createSocket({type:'udp4',reuseAddr:true});
 const finish=()=>{try{s.close();}catch{}resolve([...found.values()]);};
 s.on('error',finish); s.on('message',b=>{const c=parsePanasonic(b);if(c)found.set(c.mac,c);});
 s.bind(10669,()=>{try{s.setBroadcast(true);}catch{}
  for(const rows of Object.values(os.networkInterfaces()))for(const r of rows||[]){if(r.internal||(r.family!=='IPv4'&&r.family!==4))continue;
   const mac=(r.mac||'00:00:00:00:00:00').split(':').map(x=>parseInt(x,16)||0),ip=r.address.split('.').map(Number),m=(r.netmask||'255.255.255.0').split('.').map(Number);
   const pkt=panasonicRequest(mac,ip); const bcast=ip.map((x,i)=>(x|(~m[i]&255))).join('.');
   for(const dest of [bcast,'255.255.255.255'])try{s.send(pkt,10670,dest);}catch{}}
 }); setTimeout(finish,2500);
}); }
async function panasonicCamera(p) {
 const r=await ping(p.ip,p.port);
 return {id:`local-${p.ip}`,type:'PTZ',brand:'Panasonic',model:p.model||'Panasonic camera',name:p.name||p.model||'Panasonic camera',ip:p.ip,port:p.port,securePort:443,mac:p.mac,serial:'Not reported',firmware:'Not reported',protocol:'Panasonic EasyIP',latency:r.latency,status:r.open?'Online':'Subnet Mismatch',source:'local',cidr:p.cidr,gateway:p.gateway,dns1:p.dns1,dns2:p.dns2};
}
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
if(require.main!==module){module.exports={panasonicRequest,parsePanasonic};}else http.createServer(async(req,res)=>{
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
 busy=true;try{const [announced,pana]=await Promise.all([onvif(),panasonic()]);const ips=target?targets:[...new Set([...targets,...announced.keys()])];const devices=[];let index=0;await Promise.all(Array.from({length:24},async()=>{while(index<ips.length){const ip=ips[index++];for(const p of ports){const c=await inspect(ip,p,announced.get(ip)||'');if(c){devices.push(c);break;}}}}));const panaRows=await Promise.all(pana.filter(p=>!target||targets.includes(p.ip)).map(panasonicCamera));for(const c of panaRows){const i=devices.findIndex(d=>d.ip===c.ip);if(i>=0)devices[i]={...devices[i],...c,latency:devices[i].latency,status:devices[i].status};else devices.push(c);}reply({devices,networks});}finally{busy=false;}return;}
 if(req.url==='/add'){if(!ipOK(data.ip)||!Number.isInteger(data.port)||data.port<1||data.port>65535)throw Error('Enter a private IPv4 address and valid port.');let c=await inspect(data.ip,data.port,'',true);if(!c){const p=(await panasonic()).find(x=>x.ip===data.ip);if(p)c=await panasonicCamera(p);}reply({devices:c?[c]:[]});return;}
 throw Error('Unsupported action. Vendor network rewriting is intentionally not implemented.');
 }catch(e){reply({error:e.message});}
}).listen(3344,'127.0.0.1',()=>console.log(`ptzIP companion listening on 127.0.0.1:3344\nApp origin: ${allowedOrigin}\nPairing token (paste into ptzIP): ${token}\nRead-only discovery and TCP checks. No camera settings will be modified.`));
