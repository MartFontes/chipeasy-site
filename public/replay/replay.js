'use strict';
(async function(){
 const data=document.getElementById('replayData');if(!data)return;
 const $=id=>document.getElementById(id),table=$('table'),wrap=$('tableWrap'),controls=document.querySelector('.controls');
 const windows=/Windows NT/i.test(navigator.userAgent)&&!/(Android|iPhone|iPad|Mobile)/i.test(navigator.userAgent);
 if(windows)document.querySelectorAll('.windows-only').forEach(a=>a.hidden=false);
 const resize=()=>table.style.setProperty('--scale',String(wrap.clientWidth/640));new ResizeObserver(resize).observe(wrap);resize();
 const buttons=()=>controls.querySelectorAll('button,input');buttons().forEach(b=>b.disabled=true);
 let rep;
 try{const {code}=JSON.parse(data.textContent);const r=await fetch('/m/'+encodeURIComponent(code)+'/data.json');if(!r.ok)throw new Error();rep=(await r.json()).rep;if(!rep)throw new Error();}
 catch{$('loadError').hidden=false;$('loadError').textContent='Não foi possível carregar as ações. Confira a conexão e recarregue a página.';return;}
 const steps=PPHand.steps(rep),V=ReplayView,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let index=0,bb=true,timer=null;
 buttons().forEach(b=>b.disabled=false);
 function stop(){clearInterval(timer);timer=null;}
 function animate(previous,current){
  if(!previous||reduced.matches)return;
  const center={x:320,y:188};
  for(const g of V.ring(rep)){
   const old=previous.bets[g.p.seat]||0,now=current.bets[g.p.seat]||0;
   if(old>0&&now===0){const chip=document.createElement('i');chip.className='rp-chip flying-chip';chip.style.cssText='position:absolute;left:'+g.bx+'px;top:'+g.by+'px;z-index:5';table.append(chip);const a=chip.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${center.x-g.bx}px,${center.y-g.by}px)`,opacity:0}],{duration:400,easing:'cubic-bezier(.2,.8,.2,1)'});a.onfinish=()=>chip.remove();}
  }
  if(current.act&&current.act.amt>0){const seat=table.querySelector(`[data-seat="${current.act.seat}"]`),bet=table.querySelector(`[data-bet="${current.act.seat}"]`);if(seat&&bet){const g=V.ring(rep).find(x=>x.p.seat===current.act.seat);bet.animate([{transform:`translate(calc(-50% + ${g.x-g.bx}px),calc(-50% + ${g.y-g.by}px))`,opacity:0},{transform:'translate(-50%,-50%)',opacity:1}],{duration:320,easing:'ease-out'});}}
  table.querySelectorAll('.board .pc:not(.slot)').forEach((c,i)=>{if(i>=previous.board.length)c.animate([{transform:'perspective(300px) rotateY(90deg)',opacity:.2},{transform:'perspective(300px) rotateY(0)',opacity:1}],{duration:360,delay:(i-previous.board.length)*65,easing:'ease-out'});});
 }
 function line(s){
  if(s.final||s.showdown)return PPHand.text(rep,{bb}).replace(/BB Vilão BB/g,'Vilão BB');
  return steps.slice(0,index+1).filter(x=>x.act||x.streetStart).map(x=>V.description(rep,x,bb)).join('\n')||'Blinds na mesa. Avance para acompanhar as ações.';
 }
 function draw(previous){
  const s=steps[index];table.innerHTML=V.table(rep,s,bb);table.setAttribute('aria-label',V.description(rep,s,bb));$('description').textContent=V.description(rep,s,bb);$('streetLabel').textContent=s.final?'RESULTADO':s.showdown?'SHOWDOWN':PPHand.STREET_NAME[s.street];$('handText').textContent=line(s);$('progress').value=index;$('counter').textContent=(index+1)+' / '+steps.length;$('previous').disabled=index===0;$('next').disabled=index===steps.length-1;$('play').textContent=timer?'Ⅱ Pausar':'▶ Reproduzir';$('play').setAttribute('aria-label',timer?'Pausar':'Reproduzir');$('play').setAttribute('aria-pressed',String(!!timer));
  document.querySelectorAll('[data-street]').forEach(b=>{b.disabled=b.dataset.street!=='pre'&&!steps.some(x=>x.streetStart===b.dataset.street);b.classList.toggle('on',b.dataset.street===s.street);b.setAttribute('aria-pressed',String(b.dataset.street===s.street));});animate(previous,s);
 }
 function go(value){const old=steps[index];index=Math.max(0,Math.min(steps.length-1,value));if(index===steps.length-1)stop();draw(old);}
 function move(delta){stop();go(index+delta);}
 $('previous').onclick=()=>move(-1);$('next').onclick=()=>move(1);
 $('play').onclick=()=>{if(timer){stop();draw();return;}if(index===steps.length-1)index=0;timer=setInterval(()=>go(index+1),1100);draw();};
 $('progress').oninput=e=>{stop();go(Number(e.target.value));};
 $('units').onclick=()=>{bb=!bb;$('units').textContent=bb?'bb ↔ fichas':'fichas ↔ bb';$('units').setAttribute('aria-pressed',String(bb));draw();};
 document.querySelectorAll('[data-street]').forEach(b=>b.onclick=()=>{stop();go(b.dataset.street==='pre'?0:steps.findIndex(s=>s.streetStart===b.dataset.street));});
 let pointer=null;wrap.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};});
 wrap.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.3)move(dx<0?1:-1);});wrap.addEventListener('pointercancel',()=>pointer=null);
 document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,button,a,summary'))return;if(e.key==='ArrowRight'){e.preventDefault();move(1);}if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key===' '){e.preventDefault();$('play').click();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();draw();}});window.addEventListener('pagehide',stop);draw();table.dataset.ready='true';
})();
