'use strict';
const {load,siteUrl}=require('../lib/data'),{page}=require('../lib/page'),{codeOf}=require('../shared/replay-link');
function handler({env=process.env,fetcher=fetch}={}) {return async(req,res)=>{
 res.setHeader('Cache-Control','private,no-store,max-age=0');res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex,nofollow,noarchive');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.setHeader('Allow','GET, HEAD');return res.end();}
 const code=codeOf(req.query.code)||'INVALIDO',kind=req.query.kind||'html';
 if(!['html','og','data'].includes(kind)){res.statusCode=404;return res.end();}
 let site;try{site=siteUrl(env);}catch{res.statusCode=503;return res.end('Configuração do replay indisponível.');}
 let result;try{result=codeOf(req.query.code)?await load(code,{env,fetcher}):{status:'expired',rep:null};}catch{result={status:'unavailable',rep:null};}
 const cache=status=>{
  const value=status==='unavailable'?'no-store':status==='ok'?'public, s-maxage=86400, stale-while-revalidate=604800':'public, s-maxage=300';
  res.setHeader('Cache-Control',value);res.setHeader('CDN-Cache-Control',value);res.setHeader('Vercel-CDN-Cache-Control',value);
 };
 cache(result.status);
 if(kind==='data'){
  res.statusCode=result.status==='unavailable'?503:result.rep?200:404;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.end(req.method==='HEAD'?undefined:JSON.stringify(result.rep?{rep:result.rep}:{error:result.status}));
 }
 if(kind==='og'){
  try{const image=await require('../lib/og').render(result.rep);res.statusCode=result.status==='unavailable'?503:result.rep?200:404;res.setHeader('Content-Type','image/png');return res.end(req.method==='HEAD'?undefined:Buffer.from(await image.arrayBuffer()));}
  catch{cache('unavailable');res.statusCode=503;return res.end();}
 }
 res.statusCode=result.status==='unavailable'?503:result.rep?200:404;
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 return res.end(req.method==='HEAD'?undefined:page({...result,code,site}));
};}
module.exports=handler();module.exports.handler=handler;
