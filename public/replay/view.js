 'use strict';
(function(root){
 const PP=typeof module==='object'&&module.exports?require('./pphand'):root.PPHand;
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function card(c){if(c==null||c<0)return '<span class="pc card back" aria-label="Carta fechada"></span>';const text=PP.cardStr(c);return `<span class="pc card s${PP.cardSuit(c)}" aria-label="${esc(text)}"><b>${esc(text.slice(0,-1))}</b><i>${esc(text.slice(-1))}</i></span>`;}
 function ring(rep){const p=rep.players,hero=Math.max(0,p.findIndex(p=>p.isHero)),n=p.length;return p.slice(hero).concat(p.slice(0,hero)).map((p,k)=>{const a=(90+k*360/n)*Math.PI/180;return {p,x:320+281.6*Math.cos(a),y:200+160*Math.sin(a),bx:320+172.8*Math.cos(a),by:200+100*Math.sin(a)};});}
 function amount(value,rep,bb){return bb?PP.bbs(value,rep)+' bb':PP.fmt(value);}
 function playerLabel(p){return !p?'Jogador':p.isHero?p.pos+' (Herói)':p.name==='Vilão '+p.pos?p.name:p.pos+' · '+p.name;}
 function table(rep,s,bb){
  const a=v=>amount(v,rep,bb),board=s.board.map(card).join('')+'<span class="pc card slot"></span>'.repeat(Math.max(0,5-s.board.length));
  let out='<div class="rp-felt felt"></div>';
  for(const {p,x,y,bx,by} of ring(rep)){
   const folded=s.folded[p.seat],show=p.isHero||s.showdown;
   out+=`<div data-seat="${p.seat}" class="rp-seat seat ${p.isHero?'hero':''} ${folded?'folded':''} ${s.active===p.seat?'active':''} ${s.won[p.seat]?'winner':''}" style="left:${x.toFixed(2)}px;top:${y.toFixed(2)}px">
    <div class="rp-cards hole ${p.cards&&p.cards.length>2?'many':''}">${folded?'':show&&p.cards?p.cards.map(card).join(''):card(null)+card(null)}</div>
    <div class="rp-plate plate">${s.tag[p.seat]?`<span class="rp-tag t-${s.tag[p.seat].toLowerCase().replace(/[^a-z]/g,'')}">${esc(s.tag[p.seat])}</span>`:''}<span class="rp-pos position">${esc(p.pos)}</span>${rep.dealer===p.seat?'<span class="rp-d dealer">D</span>':''}<strong class="rp-name">${esc(p.name)}</strong><span class="rp-stack">${a(s.stacks[p.seat])}</span></div>
    <div class="action-tag">${s.won[p.seat]?'+'+a(s.won[p.seat]):''}</div></div>`;
   if(s.bets[p.seat]>0)out+=`<span data-bet="${p.seat}" class="rp-bet bet" style="left:${bx.toFixed(2)}px;top:${by.toFixed(2)}px"><i class="rp-chip"></i>${a(s.bets[p.seat])}</span>`;
  }
  const pot=s.pot+Object.values(s.bets).reduce((a,b)=>a+b,0);
  out+=`<div class="rp-center center"><span class="table-brand">CHIPEASY</span><div class="rp-board board">${board}</div><div class="rp-pot pot">${s.final?'Mão concluída':'Pote '+a(pot)}</div></div>`;
  return out;
 }
 function description(rep,s,bb){
  if(s.final)return rep.winners.map(w=>playerLabel(rep.players.find(p=>p.seat===w.seat))+' ganha '+amount(w.amt,rep,bb)).join(' · ');
  if(s.showdown)return 'Showdown · hora de revelar as cartas';
  const pot=s.pot+Object.values(s.bets).reduce((a,b)=>a+b,0);
  if(!s.act)return (s.streetStart?PP.STREET_NAME[s.street]:'Blinds na mesa')+' · pote '+amount(pot,rep,bb);
  const p=rep.players.find(p=>p.seat===s.act.seat),a=s.act;
  return (p?p.pos:'Jogador')+' '+(a.allin?'all-in':a.word)+(a.amt?' '+amount(a.amt,rep,bb):'')+' · pote '+amount(pot,rep,bb);
 }
 function metadata(rep){
  const summary=PP.summary(rep),hero=summary.hero,vs=summary.vs;
  const hands=hero&&hero.cards?PP.cardsStr(hero.cards,''):'Replay de mão';
  const raises=summary.S.log.filter(a=>a.street==='pre'&&a.kind==='raise').length;
  const potType=raises>=3?'pote 4-bet+':raises===2?'pote 3-bet':raises===1?'pote com raise':'pote sem raise';
  const others=rep.players.filter(p=>!p.isHero),effective=hero?Math.min(hero.stack,Math.max(...others.map(p=>p.stack))):0;
  const stack=hero?PP.bbs(effective,rep)+' bb':rep.players.length+' jogadores';
  const reveal=rep.previewResult===true;
  const extra=reveal&&summary.showdown&&vs&&vs.cards?' vs '+PP.cardsStr(vs.cards,''):'';
  return {title:hands+extra+' · '+(hero?hero.pos+' · ':'')+stack+' · '+potType+' — '+(reveal?'Veja a mão':'Como você joga?'),description:reveal?'Reveja esta mão completa no ChipEasy.':'Uma decisão de cada vez. Abra o replay e descubra como a mão se desenrola.',index:reveal?summary.S.length-1:0,summary,hero,stack,potType,reveal};
 }
 const api={esc,card,ring,amount,table,description,metadata,playerLabel};if(typeof module==='object'&&module.exports)module.exports=api;root.ReplayView=api;
})(typeof window==='object'?window:globalThis);
