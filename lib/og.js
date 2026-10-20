'use strict';
const React=require('react'),PP=require('../shared/pphand'),V=require('../shared/view');
const fs=require('node:fs'),path=require('node:path');
const fonts=[400,700].map(weight=>({name:'DejaVu',weight,style:'normal',data:fs.readFileSync(path.join(__dirname,'../shared/fonts',weight===700?'DejaVuSans-Bold.ttf':'DejaVuSans.ttf'))}));
const h=(type,style,...children)=>React.createElement(type,{style:{display:'flex',...style}},...children);
const colors={bg:'#0d1014',panel:'#161b21',line:'#303844',text:'#e8ebef',muted:'#9aa3af',accent:'#d9aa45',green:'#33c48a'};
function scene(rep){
 const meta=V.metadata(rep),s=JSON.parse(JSON.stringify(meta.summary.S[meta.index]));
 if(!meta.reveal){s.board=[];s.show=false;s.showdown=false;s.final=false;s.folded={};s.tag={};s.won={};s.bets={};}
 for(const p of rep.players)s.stacks[p.seat]=p.stack;
 return {meta,s};
}
function card(c){
 if(c==null)return h('div',{width:34,height:46,borderRadius:6,background:'repeating-linear-gradient(45deg,#7a1d25 0px,#7a1d25 4px,#93252f 4px,#93252f 8px)',border:'2px solid #f2e7d0'});
 const text=PP.cardStr(c),color=['','#1f6fd1','#178a45','#d3312c','#111'][PP.cardSuit(c)];
 return h('div',{width:34,height:46,borderRadius:6,background:'#fbfbf7',color,flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:700},text.slice(0,-1),h('span',{fontSize:15},text.slice(-1)));
}
async function render(rep){
 const {ImageResponse}=await import('@vercel/og');let content;
 if(!rep)content=h('div',{flex:1,alignItems:'center',justifyContent:'center',flexDirection:'column',gap:20},h('div',{fontSize:60,color:colors.accent},'♠ ChipEasy'),h('div',{fontSize:30},'Este replay expirou'),h('div',{fontSize:19,color:colors.muted},'Peça um novo link a quem compartilhou a mão.'));
 else{
  const {meta,s}=scene(rep),seats=V.ring(rep).map(({p,x,y})=>{
   const show=p.isHero||(meta.reveal&&s.showdown),cards=show&&p.cards?p.cards:[null,null];
   return h('div',{position:'absolute',left:x-59,top:y-47,width:118,flexDirection:'column',alignItems:'center',opacity:s.folded[p.seat]?.45:1},
    h('div',{gap:2,height:46,marginBottom:-10},...cards.map((c,i)=>React.cloneElement(card(c),{style:{...card(c).props.style,marginLeft:i&&cards.length>2?-20:0}}))),
    h('div',{position:'relative',width:118,background:p.isHero?'#1c2814':'#0a120e',border:'1px solid '+(s.won[p.seat]?colors.green:colors.line),borderRadius:10,flexDirection:'column',alignItems:'center',padding:'12px 6px 5px'},h('div',{position:'absolute',top:-8,left:6,padding:'1px 6px',fontSize:10,background:'#33483e',borderRadius:6},p.pos),...(rep.dealer===p.seat?[h('div',{position:'absolute',top:-9,right:6,width:18,height:18,borderRadius:9,background:'#fff',color:'#111',fontSize:10,alignItems:'center',justifyContent:'center'},'D')]:[]),h('span',{fontSize:12,color:'#e8efe9'},p.isHero?'Herói':'Vilão '+p.pos),h('span',{fontSize:13,fontWeight:700,color:'#f3d27a'},PP.bbs(s.stacks[p.seat],rep)+' bb')));
  });
  const table=h('div',{position:'relative',width:640,height:400},h('div',{position:'absolute',left:64,top:44,width:512,height:312,borderRadius:180,background:'radial-gradient(ellipse at 50% 40%,#2c8c57 0%,#1d6a41 55%,#154f31 100%)',border:'10px solid #3b2a1b'}),...seats,h('div',{position:'absolute',left:226,top:160,width:188,flexDirection:'column',alignItems:'center',gap:12},h('span',{fontSize:9,letterSpacing:4,color:'#b6dbbb'},'CHIPEASY'),h('div',{gap:4},...(s.board.length?s.board.map(card):[h('div',{fontSize:17,color:'#dfe9e2',padding:'8px 14px',background:'#0d3823',borderRadius:20},meta.reveal?'Veja o desfecho':'Sua leitura. Sua decisão.')])),...(meta.reveal&&s.final?[h('span',{fontSize:14,color:'#6ff0a8'},rep.winners.map(w=>(rep.players.find(p=>p.seat===w.seat)?.isHero?'Herói':'Vilão')+' ganha '+PP.bbs(w.amt,rep)+' bb').join(' · '))]:[])));
  content=h('div',{flex:1,flexDirection:'column'},h('div',{justifyContent:'space-between',alignItems:'center',paddingBottom:24,borderBottom:'1px solid #242b34'},h('div',{fontSize:27,fontWeight:700,gap:12,alignItems:'center'},h('span',{color:colors.accent,fontSize:34},'♠'),'ChipEasy'),h('span',{fontSize:13,letterSpacing:3,color:colors.muted},'REPLAY COMPARTILHADO')),
   h('div',{flex:1,alignItems:'center',gap:22},table,h('div',{width:410,flexDirection:'column',gap:20},h('span',{fontSize:15,letterSpacing:2,color:colors.accent},meta.reveal?'REPLAY COM RESULTADO':'UMA MÃO. VÁRIAS DECISÕES.'),h('div',{fontSize:43,fontWeight:700,lineHeight:1.15},meta.reveal?'Veja o desfecho.':'Como você joga?'),h('div',{fontSize:24,fontWeight:700},PP.cardsStr(meta.hero?.cards||[],'')+' · '+(meta.hero?.pos||'')),h('div',{fontSize:19,color:colors.muted},meta.stack+' efetivos · '+meta.potType),...(meta.reveal?[h('div',{fontSize:20,color:colors.muted},meta.title)]:[]),h('div',{padding:'12px 18px',background:colors.accent,color:'#18130a',borderRadius:8,alignSelf:'flex-start',fontSize:16,fontWeight:700},'Assistir à mão →'))),h('div',{fontSize:12,color:colors.muted,justifyContent:'space-between',borderTop:'1px solid #242b34',paddingTop:18},h('span',{},'Uma decisão de cada vez.'),h('span',{},'chipeasy.vercel.app')));
 }
 return new ImageResponse(h('div',{width:1200,height:630,padding:'32px 36px',background:colors.bg,color:colors.text,fontFamily:'DejaVu'},content),{width:1200,height:630,fonts});
}
module.exports={render,scene};
