'use strict';
// Somente dados necessários ao replay saem do PC. Não enviar JSON bruto, URLs,
// IDs de contas, anotações ou metadados livres junto com uma mão anonimizada.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const PPHand = require('./pphand');
const ORIGIN = 'https://www.chipeasy.com.br';
const DAYS = 30;
const CODE = /^[A-Z0-9]{8}$/;
function codeOf(value) {
  const s = String(value || '').trim().toUpperCase();
  if (!/^(?:[A-Z0-9]{8}|[A-Z0-9]{4}-[A-Z0-9]{4})$/.test(s)) return null;
  return s.replace('-', '');
}
function protocolCode(value) {
  if (typeof value !== 'string' || value.length > 150) return null;
  const m = /^chipeasy:\/\/importar\/([a-z0-9]{8}|[a-z0-9]{4}-[a-z0-9]{4})\/?$/i.exec(value);
  return m ? codeOf(m[1]) : null;
}
function number(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) throw new Error('Valores inválidos na mão.');
  return value;
}
function cleanRep(input, showNames = false) {
  if (!input || !Array.isArray(input.players) || input.players.length < 2 || input.players.length > 10 || !Array.isArray(input.streets) || input.streets.length > 4) throw new Error('Esta mão não possui um replay válido.');
  const seat = v => { if (!Number.isInteger(v) || v < 0 || v > 20) throw new Error('Assento inválido.'); return v; };
  const seats = input.players.map(p => seat(p.seat));
  if (new Set(seats).size !== seats.length) throw new Error('Assentos repetidos.');
  const knownSeat = v => { seat(v); if (!seats.includes(v)) throw new Error('Jogador inválido na mão.'); return v; };
  const cards = values => {
    if (!Array.isArray(values) || values.length > 5) throw new Error('Cartas inválidas.');
    return values.map(c => { if (c === -1 || c === null) return c; if (!Number.isInteger(c) || PPHand.cardRank(c) < 2 || PPHand.cardRank(c) > 14 || PPHand.cardSuit(c) < 1 || PPHand.cardSuit(c) > 4) throw new Error('Carta inválida.'); return c; });
  };
  const dealer = knownSeat(input.dealer);
  const positions = PPHand.positions([...seats].sort((a,b) => a-b), dealer);
  const safePos = p => /^(?:SB|BB|BTN|CO|HJ|MP|UTG(?:\+[1-6])?)$/.test(p.pos) ? p.pos : positions[p.seat];
  const hero = input.players.find(p => p.isHero) || input.players.find(p => p.seat === input.heroSeat);
  const src = ['pppoker','suprema'].includes(input.src) ? input.src : 'manual';
  const rep = { src, key: '', gameId: '', room: src === 'pppoker' ? 'PPPoker' : src === 'suprema' ? 'Suprema' : 'Mão', table: '',
    mtt: !!input.mtt, pko: !!input.pko, ft: !!input.ft, sb: number(input.sb), bb: number(input.bb), ante: number(input.ante || 0), dealer,
    heroSeat: hero ? hero.seat : null, time: null, previewResult: input.previewResult === true,
    players: input.players.map(p => ({ seat:p.seat, name: showNames ? String(p.name || safePos(p)).slice(0,60) : p === hero ? 'Herói' : 'Vilão ' + safePos(p),
      pos:safePos(p), stack:number(p.stack), isHero:p === hero, cards:p.cards ? cards(p.cards) : null, bounty:number(p.bounty || 0) })),
    streets: [], backs: [], winners: [] };
  if (rep.bb <= 0) throw new Error('Big blind inválido.');
  let count = 0;
  rep.streets = input.streets.map((s,i) => {
    if (s.k !== ['pre','flop','turn','river'][i] || !Array.isArray(s.actions) || (count += s.actions.length) > 1000) throw new Error('Ações inválidas na mão.');
    return { k:s.k, cards:cards(s.cards || []), actions:s.actions.map(a => {
      if (!Number.isInteger(a.t) || a.t < 0 || a.t > 100) throw new Error('Ação inválida.');
      return {seat:knownSeat(a.seat),t:a.t,amt:number(a.amt),after:number(a.after)};
    }) };
  });
  for (const b of input.backs || []) { if (rep.backs.length >= 30) throw new Error('Devoluções inválidas.'); rep.backs.push({seat:knownSeat(b.seat),amt:number(b.amt),street:['pre','flop','turn','river'].includes(b.street) ? b.street : 'river'}); }
  for (const w of input.winners || []) { if (rep.winners.length >= 10) throw new Error('Resultado inválido.'); rep.winners.push({seat:knownSeat(w.seat),amt:number(w.amt)}); }
  if (!rep.streets.length || !rep.winners.length) throw new Error('Replay incompleto.');
  rep.key='ce-'+crypto.createHash('sha256').update(JSON.stringify(rep)).digest('hex').slice(0,32);
  return rep;
}
function service({rpc, installation, dataDir, now = Date.now, verify = async()=>{}}) {
  const cacheFile = path.join(dataDir, 'replay-links.json'), pending = new Map();
  let cache = {};
  try { const v=JSON.parse(fs.readFileSync(cacheFile,'utf8')); if(v && !Array.isArray(v) && typeof v==='object') cache=v; } catch { /* primeira utilização */ }
  async function create(rep, showNames, showResult = false) {
    const safe = cleanRep({...rep,previewResult:showResult === true}, showNames === true);
    const hash = crypto.createHash('sha256').update(JSON.stringify(safe)).digest('hex');
    const cached=cache[hash];
    const result = entry => ({ok:true,code:entry.code.slice(0,4)+'-'+entry.code.slice(4),url:ORIGIN+'/m/'+entry.code,expiresAt:entry.expiresAt,anonymous:showNames !== true});
    if(cached && CODE.test(cached.code) && cached.expiresAt > now()+60000) {await verify(result(cached).url);return {...result(cached),reused:true};}
    if(pending.has(hash)) return pending.get(hash);
    const task=(async()=>{
      const start=now();
      const raw=await rpc('compartilhar_maos',{p_instalacao:installation(),p_de:'',p_maos:[{replay:safe}],p_uso_unico:false,p_validade_dias:DAYS});
      const code=codeOf(raw);if(!code)throw new Error('O servidor não devolveu o código. Confira se o SQL 1.10.63 foi aplicado.');
      await verify(ORIGIN+'/m/'+code);
      const entry={code,expiresAt:start+DAYS*86400000};cache[hash]=entry;
      const keep=Object.entries(cache).filter(([,v])=>v.expiresAt>now()).sort((a,b)=>b[1].expiresAt-a[1].expiresAt).slice(0,500);
      cache=Object.fromEntries(keep);
      try { fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(cacheFile+'.tmp',JSON.stringify(cache));fs.renameSync(cacheFile+'.tmp',cacheFile); } catch { /* link válido, cache local indisponível */ }
      return {...result(entry),reused:false};
    })();
    pending.set(hash,task);
    try{return await task;}finally{pending.delete(hash);}
  }
  return {create};
}
module.exports={ORIGIN,DAYS,codeOf,protocolCode,cleanRep,service};
