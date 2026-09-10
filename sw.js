const CACHE='cism-practice-v8.3';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-180.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const isPage=req.mode==='navigate'||req.destination==='document'||new URL(req.url).pathname.endsWith('/index.html');
  if(isPage){ e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp));return r;}).catch(()=>caches.match('./index.html'))); return; }
  e.respondWith(caches.match(req).then(c=>c||fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(cc=>cc.put(req,cp));return r;})));
});
