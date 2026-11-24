const C='bpfuel-v1',T='bpfuel-tiles';
const SHELL=['./','index.html','manifest.webmanifest','precos-anp.json','logo.png','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C&&k!==T).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const put=(n,r,res)=>{const cp=res.clone();caches.open(n).then(c=>c.put(r,cp).then(()=>{if(n===T)c.keys().then(ks=>{if(ks.length>800)c.delete(ks[0])})}));return res};
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(u.origin===location.origin){e.respondWith(fetch(r).then(res=>res.ok?put(C,r,res):res).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));return}
 if(/(^|\.)unpkg\.com$|fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>put(C,r,res))));return}
 if(/tile\.openstreetmap\.org$/.test(u.hostname)){e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>put(T,r,res))));return}
});
