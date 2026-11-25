async function bpAtualizar(){
 // Atualizador do BP FUEL: roda numa aba aberta em https://www.gov.br/anp/... (mesma origem dos arquivos da ANP).
 // Gera precos-anp.json (médias por estado e cidade) e precos-postos.json (preço por posto, ligado aos postos do mapa).
 const APP='https://gstfv.github.io/BP-FUEL/';
 const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const UF={'ACRE':'AC','ALAGOAS':'AL','AMAPA':'AP','AMAZONAS':'AM','BAHIA':'BA','CEARA':'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES','GOIAS':'GO','MARANHAO':'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG','PARA':'PA','PARAIBA':'PB','PARANA':'PR','PERNAMBUCO':'PE','PIAUI':'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS','RONDONIA':'RO','RORAIMA':'RR','SANTA CATARINA':'SC','SAO PAULO':'SP','SERGIPE':'SE','TOCANTINS':'TO'};
 const r2=v=>Math.round(+v*100)/100;
 async function xlsx(url){
  const buf=new Uint8Array(await (await fetch(url)).arrayBuffer());const dv=new DataView(buf.buffer);let eocd=-1;
  for(let i=buf.length-22;i>=0;i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}
  const n=dv.getUint16(eocd+10,true);let p=dv.getUint32(eocd+16,true);const files={};
  for(let k=0;k<n;k++){const m=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);files[new TextDecoder().decode(buf.slice(p+46,p+46+nl))]={m,cs,off};p+=46+nl+el+cl}
  const X=async name=>{const f=files[name];if(!f)return'';const ln=dv.getUint16(f.off+26,true),le=dv.getUint16(f.off+28,true);const data=buf.slice(f.off+30+ln+le,f.off+30+ln+le+f.cs);if(f.m===0)return new TextDecoder().decode(data);return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()};
  const ss=[...(await X('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'"));
  const wb=await X('xl/workbook.xml');const rels=await X('xl/_rels/workbook.xml.rels');
  const sheets={};for(const m of wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)){const t=(rels.match(new RegExp('Id="'+m[2]+'"[^>]*Target="([^"]+)"'))||rels.match(new RegExp('Target="([^"]+)"[^>]*Id="'+m[2]+'"'))||[])[1];if(t)sheets[m[1]]='xl/'+t.replace(/^\/?xl\//,'')}
  const rows=async name=>{const x=await X(sheets[name]||name);return[...x.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r=>{const o={};for(const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const v=(c[3]||'').match(/<v>([\s\S]*?)<\/v>/);let val=v?v[1]:'';if(/t="s"/.test(c[2]))val=ss[+val];o[c[1]]=val}return o})};
  return{sheets,rows};
 }
 // 1) links da semana mais recente
 const html=await (await fetch('/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas')).text();
 const hrefs=[...new DOMParser().parseFromString(html,'text/html').querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
 const uRes=hrefs.find(h=>/resumo_semanal_lpc.*\.xlsx$/i.test(h)),uRev=hrefs.find(h=>/revendas_lpc.*\.xlsx$/i.test(h));
 if(!uRes)throw new Error('Não achei a planilha resumo_semanal_lpc');
 // 2) médias por estado e cidade
 const R=await xlsx(uRes);const MUN=await R.rows('MUNICIPIOS'),EST=await R.rows('ESTADOS');
 const P={'GASOLINA COMUM':'g','ETANOL HIDRATADO':'e','ETANOL':'e','OLEO DIESEL S10':'d','DIESEL S10':'d'};
 const mun={},est={};let d0,d1;
 for(const r of MUN){const f=P[r.E],uf=UF[r.C];if(!f||!uf||!r.H||isNaN(+r.H))continue;if(!d0){d0=r.A;d1=r.B}const k=r.D+'|'+uf;(mun[k]=mun[k]||{})[f]=r2(r.H)}
 for(const r of EST){const f=P[r.E],uf=UF[r.D];if(!f||!uf||!r.H||isNaN(+r.H))continue;(est[uf]=est[uf]||{})[f]=r2(r.H)}
 const fmt=v=>new Date(Date.UTC(1899,11,30)+(+v)*864e5).toISOString().slice(0,10);
 const semana=[fmt(d0),fmt(d1)];
 const anp={semana,fonte:'ANP - Levantamento de Preços de Combustíveis',estados:est,municipios:mun};
 const info={semana,municipios:Object.keys(mun).length,estados:Object.keys(est).length};
 // 3) preço por posto
 let pp=null;
 if(uRev){
  const V=await xlsx(uRev);const rv=await V.rows(Object.keys(V.sheets)[0]);
  const st={};const P2={'GASOLINA COMUM':'g','ETANOL':'e','ETANOL HIDRATADO':'e','DIESEL S10':'d'};
  for(const r of rv){const f=P2[r.L],uf=UF[r.J];if(!f||!uf||!r.N||isNaN(+r.N))continue;const s=st[r.A]||(st[r.A]={f:r.C||'',r:r.B||'',a:r.D||'',n:r.E||'',cep:String(r.H||'').replace(/\D/g,''),m:norm(r.I),u:uf,band:r.K||'',p:{}});s.p[f]=r2(r.N)}
  const anpSt=Object.values(st);
  const STOP=new Set('POSTO POSTOS AUTO AUTOPOSTO COMBUSTIVEIS COMBUSTIVEL COMERCIO COMERCIAL DERIVADOS PETROLEO LTDA ME EPP EIRELI SA S A DE DO DA DOS DAS E E CIA SERVICOS SERVICO REVENDEDOR REDE ABASTECIMENTO DISTRIBUIDORA LUBRIFICANTES GAS SAO SANTA SANTO NOSSA SENHORA BOM BOA NOVO NOVA'.split(' '));
  const tok=s=>new Set(norm(s).split(' ').filter(w=>w.length>1&&!STOP.has(w)));
  const jac=(a,b)=>{if(!a.size||!b.size)return 0;let i=0;for(const x of a)if(b.has(x))i++;return i/Math.min(a.size,b.size)};
  const band=s=>{const x=norm(s);if(/PETROBRAS|VIBRA|^BR\b/.test(x))return'PETROBRAS';if(/IPIRANGA/.test(x))return'IPIRANGA';if(/RAIZEN|SHELL/.test(x))return'SHELL';if(/^ALE\b/.test(x))return'ALE';if(/BRANCA/.test(x))return'BRANCA';return x};
  const byUF={};for(const a of anpSt)(byUF[a.u]=byUF[a.u]||[]).push(a);
  const p={};let matched=0;
  for(const uf of Object.keys(byUF)){
   let os=[];try{os=await (await fetch(APP+'postos/'+uf+'.json',{cache:'no-cache'})).json()}catch(e){}
   const byTown={};for(const o of os){if(o[6])continue;(byTown[norm(o[5])]=byTown[norm(o[5])]||[]).push(o)}
   const pairs=[];
   for(const a of byUF[uf]){const cands=byTown[a.m]||[];const ta=tok(a.f),tr=tok(a.r),tst=tok(a.a),ba=band(a.band);
    for(const o of cands){let sc=0;const tn=tok(o[3]);const ns=Math.max(jac(tn,ta),jac(tn,tr)*.8);const cepOk=!!(o[9]&&a.cep&&o[9]===a.cep),hnOk=!!(o[8]&&a.n&&norm(o[8])===norm(a.n));if(!(ns>=0.5||(cepOk&&hnOk)))continue;sc+=3*ns;
     const bo=band(o[4]);if(bo&&ba&&ba!=='BRANCA'){if(bo===ba)sc+=1;else sc-=1}
     if(o[7])sc+=1.5*jac(tok(o[7]),tst);
     if(o[8]&&a.n&&norm(o[8])===norm(a.n))sc+=1.5;
     if(o[9]&&a.cep&&o[9]===a.cep)sc+=2;
     if(sc>=2)pairs.push([sc,a,o])}}
   pairs.sort((x,y)=>y[0]-x[0]);const usedA=new Set(),usedO=new Set();
   for(const [sc,a,o] of pairs){if(usedA.has(a)||usedO.has(o[0]))continue;usedA.add(a);usedO.add(o[0]);p[o[0]]=[a.p.g||0,a.p.e||0,a.p.d||0,(a.f||a.r).slice(0,40),a.band.slice(0,20)];matched++}
  }
  pp={semana,fonte:'ANP - Levantamento de Preços de Combustíveis (preço por posto)',p};
  info.postosANP=anpSt.length;info.ligados=matched;
 }
 return{anp,pp,info};
}
