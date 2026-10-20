'use strict';
const {codeOf,cleanRep}=require('../shared/replay-link');
function siteUrl(env){const value=new URL(env.SITE_URL||'https://www.chipeasy.com.br');if(value.protocol!=='https:'||value.username||value.password||value.pathname!=='/'||value.search||value.hash)throw new Error('SITE_URL deve ser uma origem HTTPS.');return value.origin;}
function publicKey(key){
 if(!key||/^sb_secret_/i.test(key))return false;
 if(/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key))return true;
 try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{return false;}
}
// Sem variáveis na Vercel, usa o mesmo servidor público que o app (URL + chave publishable; nunca a secreta).
let PUBLIC_SERVER={};try{PUBLIC_SERVER=require('../shared/servidor.json');}catch{}
async function load(code,{env=process.env,fetcher=fetch}={}){
 if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY)env={...env,SUPABASE_URL:env.SUPABASE_URL||PUBLIC_SERVER.url,SUPABASE_ANON_KEY:env.SUPABASE_ANON_KEY||PUBLIC_SERVER.anon};
 const normalized=codeOf(code);if(!normalized)return {status:'expired',rep:null};
 if(!publicKey(env.SUPABASE_ANON_KEY))throw new Error('Configure somente a chave anon/publishable.');
 const url=new URL(env.SUPABASE_URL);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('SUPABASE_URL inválida.');
 const response=await fetcher(url.origin+'/rest/v1/rpc/ver_replay',{method:'POST',headers:{apikey:env.SUPABASE_ANON_KEY,...(env.SUPABASE_ANON_KEY.startsWith('eyJ')?{Authorization:'Bearer '+env.SUPABASE_ANON_KEY}:{}),'Content-Type':'application/json'},body:JSON.stringify({p_codigo:normalized}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('Replay temporariamente indisponível.');
 const raw=await response.text();if(Buffer.byteLength(raw)>262144)throw new Error('Replay inválido.');
 const rep=JSON.parse(raw);if(!rep)return {status:'expired',rep:null};
 return {status:'ok',rep:cleanRep(rep,true)};
}
module.exports={load,siteUrl,publicKey};
