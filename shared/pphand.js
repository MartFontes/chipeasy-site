'use strict';
// Leitura das mãos compartilhadas do PPPoker (JSON do replay) → formato próprio do app,
// passos para o replayer, avaliação de mão e texto para WhatsApp.
(function (root) {
  const SUITS = { 1: '♦', 2: '♣', 3: '♥', 4: '♠' };
  const RANKS = { 1: 'A', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const STREETS = [['pre_flop', 'pre', 'Pré-flop'], ['flop', 'flop', 'Flop'], ['turn', 'turn', 'Turn'], ['river', 'river', 'River']];
  const STREET_NAME = { pre: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' };
  const HAND_NAMES = ['Carta alta', 'Par', 'Dois pares', 'Trinca', 'Sequência', 'Flush', 'Full house', 'Quadra', 'Straight flush'];

  // ------------------------------------------------------------------ cartas
  function cardRank(c) { const r = c & 255; return r === 1 ? 14 : r; }
  function cardSuit(c) { return c >> 8; }
  function cardStr(c) { if (c == null || c < 0) return '??'; const r = c & 255; return (RANKS[r] || String(r)) + (SUITS[cardSuit(c)] || '?'); }
  function cardsStr(list, sep = ' ') { return (list || []).map(cardStr).join(sep); }
  function isRed(c) { const s = cardSuit(c); return s === 1 || s === 3; }

  // avaliação de 5 cartas → [categoria, desempates...]
  function eval5(cs) {
    const r = cs.map(cardRank).sort((a, b) => b - a), s = cs.map(cardSuit);
    const flush = s.every(x => x === s[0]);
    const uniq = [...new Set(r)];
    let straight = 0;
    if (uniq.length === 5) {
      if (r[0] - r[4] === 4) straight = r[0];
      else if (r[0] === 14 && r[1] === 5 && r[4] === 2) straight = 5;
    }
    const cnt = {}; r.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
    const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
    const shape = groups.map(g => cnt[g]).join('');
    if (straight && flush) return [8, straight];
    if (shape === '41') return [7, ...groups];
    if (shape === '32') return [6, ...groups];
    if (flush) return [5, ...r];
    if (straight) return [4, straight];
    if (shape === '311') return [3, ...groups];
    if (shape === '221') return [2, ...groups];
    if (shape === '2111') return [1, ...groups];
    return [0, ...r];
  }
  function cmp(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
  function combos(arr, k) {
    const out = [];
    (function rec(start, acc) { if (acc.length === k) { out.push(acc.slice()); return; } for (let i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); } })(0, []);
    return out;
  }
  // melhor mão (NLH usa quaisquer 5; Omaha usa exatamente 2 da mão)
  function bestHand(hole, board) {
    hole = (hole || []).filter(c => c > 0); board = (board || []).filter(c => c > 0);
    if (hole.length + board.length < 5) return null;
    let best = null;
    const tryC = (c) => { const v = eval5(c); if (!best || cmp(v, best) > 0) best = v; };
    if (hole.length > 2) { for (const h of combos(hole, 2)) for (const b of combos(board, 3)) tryC(h.concat(b)); }
    else for (const c of combos(hole.concat(board), 5)) tryC(c);
    return best;
  }
  function handShort(v) { return v ? (v[0] === 8 && v[1] === 14 ? 'Royal flush' : HAND_NAMES[v[0]]) : ''; }
  function handName(v) {
    if (!v) return '';
    const R = (x) => ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T' }[x] || String(x));
    const cat = v[0];
    if (cat === 8) return v[1] === 14 ? 'Royal flush' : 'Straight flush';
    if (cat === 7) return `Quadra de ${R(v[1])}`;
    if (cat === 6) return `Full house ${R(v[1])} com ${R(v[2])}`;
    if (cat === 5) return `Flush ${R(v[1])} alto`;
    if (cat === 4) return `Sequência até ${R(v[1])}`;
    if (cat === 3) return `Trinca de ${R(v[1])}`;
    if (cat === 2) return `Dois pares ${R(v[1])} e ${R(v[2])}`;
    if (cat === 1) return `Par de ${R(v[1])}`;
    return `Carta alta ${R(v[1])}`;
  }

  // ------------------------------------------------------------------ posições
  function positions(seats, dealer) {
    const n = seats.length, out = {};
    if (!n) return out;
    let di = seats.indexOf(dealer);
    if (di < 0) { di = seats.findIndex(s => s > dealer) - 1; if (di < 0) di = n - 1; }
    const order = seats.slice(di).concat(seats.slice(0, di)); // botão primeiro
    if (n === 2) { out[order[0]] = 'SB'; out[order[1]] = 'BB'; return out; }
    out[order[0]] = 'BTN'; out[order[1]] = 'SB'; out[order[2]] = 'BB';
    const rest = order.slice(3);
    const names = { 0: [], 1: ['UTG'], 2: ['UTG', 'CO'], 3: ['UTG', 'HJ', 'CO'], 4: ['UTG', 'MP', 'HJ', 'CO'], 5: ['UTG', 'UTG+1', 'MP', 'HJ', 'CO'], 6: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO'] }[rest.length]
      || rest.map((_, i) => i === rest.length - 1 ? 'CO' : i === rest.length - 2 ? 'HJ' : i === 0 ? 'UTG' : 'UTG+' + i);
    rest.forEach((s, i) => { out[s] = names[i]; });
    return out;
  }

  // corrige as posições quando o rótulo gravado não bate com quem pagou os blinds (botão morto em mesa curta).
  // Recalcula a partir de quem pagou o small blind (o botão é o assento antes dele). Devolve true se a mão ficou coerente.
  function fixPos(r) {
    if (!r || !Array.isArray(r.players) || r._posOk !== undefined) return r ? r._posOk !== false : false;
    const acts = ((r.streets || []).find(s => s.k === 'pre') || {}).actions || [];
    const sbA = acts.find(a => a.t === T.SB), bbA = acts.find(a => a.t === T.BB);
    const pos = {}; for (const p of r.players) pos[p.seat] = p.pos;
    const ok = () => (!bbA || pos[bbA.seat] === 'BB') && (!sbA || pos[sbA.seat] === 'SB');
    if (ok()) { r._posOk = true; return true; }
    const seats = r.players.map(p => p.seat).sort((a, b) => a - b);
    if (sbA && bbA) {
      const n = seats.length, i = seats.indexOf(sbA.seat);
      const calc = positions(seats, n === 2 ? sbA.seat : seats[(i - 1 + n) % n]);
      if (calc[bbA.seat] === 'BB' && calc[sbA.seat] === 'SB') { for (const p of r.players) p.pos = calc[p.seat]; r._posOk = true; r._posFixed = true; return true; }
    }
    r._posOk = false; return false;
  }

  // ------------------------------------------------------------------ JSON da Suprema Poker → formato do app
  // cartas da Suprema: 16*naipe + valor (naipe 1♦ 2♣ 3♥ 4♠, valor 2..14) → mesmo código do PPPoker (256*naipe + valor)
  function spCard(c) { return c == null ? null : ((c >> 4) * 256 + (c & 15)); }
  function parseSuprema(json) {
    const ge = json.gameExtra || [], gr = json.gameResult || {}, me = json.matchExtra || {};
    const info = ge.find(e => e.e === 'startinfo') || {};
    const P = json.players || {};
    const heroUid = json.playerID;
    const plist = Object.values(P).filter(p => p && p.seat != null);
    const stack = {}, posOf = {};
    for (const p of plist) stack[p.seat] = Number(p.coins) || 0;
    for (const a of ge) if (a.e === 'player_action' && a.pos && !(a.seat in posOf)) posOf[a.seat] = a.pos;
    const seats = plist.map(p => p.seat).sort((a, b) => a - b);
    let dealer = Object.keys(posOf).find(k => posOf[k] === 'BTN');
    dealer = dealer != null ? +dealer : seats[0];
    const calc = positions(seats, dealer);
    const shown = {}, prize = {}, profit = {};
    for (const pot of (gr.sidepotsdetail || [])) for (const d of pot) {
      if (d.cardsD && d.cardsD.length) shown[d.seat] = d.cardsD.map(spCard);
      if (Number(d.prize) > 0) prize[d.seat] = (prize[d.seat] || 0) + Number(d.prize);
      profit[d.seat] = Number(d.coins) || 0;
    }
    const players = plist.map(p => {
      const isHero = p.uid === heroUid;
      let cards = isHero && p.cardsD && p.cardsD.length ? p.cardsD.map(spCard) : (shown[p.seat] || null);
      if (cards) cards = cards.filter(c => c > 0).sort((a, b) => cardRank(b) - cardRank(a));
      return { seat: p.seat, name: p.displayID || String(p.uid), uid: p.uid != null ? p.uid : undefined, pos: posOf[p.seat] || calc[p.seat] || '', stack: Number(p.coins) || 0, isHero, cards: cards && cards.length ? cards : null, bounty: p.ko || 0 };
    }).sort((a, b) => a.seat - b.seat);
    const TY = { ante: 10, sb: 8, bb: 9, fold: 1, check: 2, call: 3, raise: 4, bet: 7, allin: 5 };
    const K = { 1: 'pre', 2: 'pre', 3: 'pre', 4: 'flop', 5: 'turn', 6: 'river' };
    const streets = [{ k: 'pre', cards: [], actions: [] }];
    const backs = [];
    let board = [];
    const cur = () => streets[streets.length - 1];
    for (const e of ge) {
      if (e.e === 'player_action') {
        const k = K[e.state] || cur().k;
        while (cur().k !== k && streets.length < 4) streets.push({ k: ['pre', 'flop', 'turn', 'river'][streets.length], cards: [], actions: [] });
        const before = stack[e.seat] || 0, after = Number(e.coins) || 0;
        const act = String(e.action || '').toLowerCase();
        if (act === 'return') { backs.push({ seat: e.seat, amt: after - before, street: cur().k }); stack[e.seat] = after; continue; }
        if (!(act in TY) && before === after) continue;   // eventos sem fichas (ex.: mostrar cartas)
        cur().actions.push({ seat: e.seat, t: TY[act] || (act === 'straddle' ? 11 : 6), amt: Math.max(0, before - after), after });
        stack[e.seat] = after;
      } else if (e.e === 'nextround') {
        const nb = (e.cardsD || []).map(spCard);
        const add = nb.slice(board.length);
        if (!add.length) continue;
        board = nb;
        const nk = ['pre', 'flop', 'turn', 'river'][Math.min(3, streets.length)];
        streets.push({ k: nk, cards: add, actions: [] });
      }
    }
    const winners = Object.keys(prize).map(sk => ({ seat: +sk, amt: prize[sk], profit: profit[sk] || 0 }));
    const hero = players.find(p => p.isHero);
    const mttStart = me.mtt_starttime ? Date.parse(me.mtt_starttime) : null;
    return {
      v: 1, src: 'suprema', key: '', gameId: String(json.replayGameID || info.id || ''), room: me.name || '',
      table: info.tableID ? String(info.tableID) : '', mtt: !!mttStart, pko: !!(me.isKO || me.progressiveKO || me.mysteryBounty), ft: false,
      sb: Number(info.smallblind) || 0, bb: Number(info.bigblind) || (Number(info.smallblind) || 0) * 2,
      ante: (() => { const a = ge.find(x => x.e === 'player_action' && String(x.action).toLowerCase() === 'ante'); return a ? Number(a.chips) || 0 : 0; })(),
      straddle: false, nextSb: 0, nextAnte: 0, dealer, heroSeat: hero ? hero.seat : null,
      time: info.starttime || gr.endtime || null, mttStart, level: me.mttCurBlindLevel || null, entrants: me.playerCount || null, paid: me.mttprizecount || null,
      players, streets, backs, winners, bonus: {},
    };
  }

  // ------------------------------------------------------------------ JSON do PPPoker → formato do app
  function parse(json) {
    if (json && Array.isArray(json.gameExtra)) return parseSuprema(json);
    if (!json || !json.info || !json.info.room || !json.flow) throw new Error('Formato de mão desconhecido');
    const room = json.info.room, flow = json.flow;
    const K = 100; // o PPPoker guarda fichas ×100
    const q = (x) => Math.round((Number(x) || 0)) / K;
    const plist = (json.info.players || []).filter(p => p && p.user_name != null);
    const seats = plist.map(p => p.seatid).sort((a, b) => a - b);
    const pos = positions(seats, room.dealer_seatid);
    // stack inicial = (stack depois da primeira ação) + (fichas colocadas nela)
    const first = {};
    for (const [fk] of STREETS) for (const a of ((flow[fk] || {}).actions || [])) if (!(a.seatid in first)) first[a.seatid] = a;
    const shows = {}; for (const s of (flow.show_hands || [])) shows[s.seatid] = s.code;
    const bonus = {}; for (const b of (flow.bonus_info || [])) bonus[b.seatid] = b.hunter_bonus;
    const heroP = plist.find(p => p.isSelf);
    const players = plist.map(p => {
      const f = first[p.seatid];
      const stack = f ? q(f.hand_chips + f.chips) : q((p.hand_chips || 0) + (p.desktop_chips || 0));
      const isHero = !!p.isSelf;
      let cards = isHero ? (json.info.cards || shows[p.seatid] || null) : (shows[p.seatid] || null);
      if (cards) cards = cards.filter(c => c > 0).sort((a, b) => cardRank(b) - cardRank(a));
      return { seat: p.seatid, name: p.user_name, uid: p.uid != null ? p.uid : undefined, pos: pos[p.seatid] || '', stack, isHero, cards: cards && cards.length ? cards.slice() : null, bounty: p.hunter_bonus || 0 };
    }).sort((a, b) => a.seat - b.seat);
    const streets = [];
    for (const [fk, k] of STREETS) {
      const f = flow[fk]; if (!f) continue;
      if (k !== 'pre' && !(f.cards || []).length && !(f.actions || []).length) continue;
      streets.push({ k, cards: (f.cards || []).slice(), actions: (f.actions || []).map(a => ({ seat: a.seatid, t: a.type, amt: q(a.chips), after: q(a.hand_chips) })) });
    }
    const backs = []; for (const [fk, k] of STREETS) for (const b of ((flow[fk] || {}).chips_back || [])) backs.push({ seat: b.seatid, amt: q(b.chips), street: k });
    const winners = (flow.winning_info || []).map(w => ({ seat: w.seatid, amt: q(w.chips), profit: q(w.profit) }));
    const mtt = room.mtt || null;
    const gid = String(room.gameid || '');
    let played = json.create_time ? json.create_time * 1000 : null;
    return {
      v: 1, src: 'pppoker', key: json.share_key || '', gameId: gid, room: room.room_name || '',
      table: mtt && mtt.table_num ? String(mtt.table_num) : '', mtt: !!mtt, pko: !!(mtt && mtt.is_hunter), ft: !!(mtt && mtt.is_ft),
      sb: q(room.small_blind), bb: q(room.small_blind) * 2, ante: q(room.ante), straddle: !!room.is_auto_straddle,
      nextSb: mtt && mtt.next_sb ? q(mtt.next_sb) : 0, nextAnte: mtt && mtt.next_ante ? q(mtt.next_ante) : 0,
      dealer: room.dealer_seatid, heroSeat: heroP ? heroP.seatid : null, time: played,
      players, streets, backs, winners, bonus,
    };
  }

  // ------------------------------------------------------------------ simulação (passos do replayer)
  // códigos de ação do PPPoker (ActionType do replayer oficial)
  const T = { FOLD: 1, CHECK: 2, CALL: 3, RAISE: 4, BET: 7, SB: 8, BB: 9, ANTE: 10, FORCE_BB: 11, SYSTEM_FOLD: 12, SYSTEM_CHECK: 13, STRADDLE: 14, POT: 15, FAST_FOLD: 16, POT_FOLD: 18 };
  const KNOWN = new Set([1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18]);
  function actLabel(a, ctx) {
    // ctx: { max (maior aposta da rua antes da ação), mine (quanto o jogador já tinha na rua), src }
    const total = ctx.mine + a.amt, allin = a.after <= 0 && a.amt > 0;
    const sup = ctx.src === 'suprema';   // na Suprema o nosso leitor grava straddle como 11
    let kind, word, show = a.amt;
    if (a.t === T.ANTE) { kind = 'ante'; word = 'ante'; }
    else if (a.t === T.SB) { kind = 'sb'; word = 'small blind'; }
    else if (a.t === T.BB) { kind = 'bb'; word = 'big blind'; }
    else if (a.t === T.FOLD || a.t === T.SYSTEM_FOLD || a.t === T.FAST_FOLD || a.t === T.POT_FOLD) { kind = 'fold'; word = 'fold'; }   // 12 = fold por tempo esgotado
    else if (a.t === T.SYSTEM_CHECK && a.amt <= 0) { kind = 'check'; word = 'check'; }   // 13 = check por tempo esgotado
    else if (a.amt > 0 && (a.t === T.STRADDLE || (sup && a.t === 11))) { kind = 'straddle'; word = 'straddle'; show = total; }
    else if (a.amt > 0 && a.t === T.FORCE_BB && !sup) { kind = 'post'; word = 'posta BB'; }
    else if (a.amt <= 0 && !KNOWN.has(a.t) && ctx.max > ctx.mine + 1e-9) { kind = 'fold'; word = 'fold'; }   // código desconhecido sem fichas diante de aposta: não pode ser check
    else if (a.amt <= 0) { kind = 'check'; word = 'check'; }
    else if (total <= ctx.max + 1e-9) { kind = 'call'; word = 'paga'; }
    else if (ctx.max > 0) { kind = 'raise'; word = 'raise p/'; show = total; }
    else { kind = 'bet'; word = 'aposta'; }
    return { kind, word, show, allin, total };
  }
  function steps(r) {
    const S = [];
    const st = { stacks: {}, bets: {}, pot: 0, board: [], folded: {}, tag: {}, street: 'pre', active: null, show: false, won: {} };
    for (const p of r.players) st.stacks[p.seat] = p.stack;
    const snap = (desc, extra) => S.push(Object.assign(JSON.parse(JSON.stringify(st)), { desc }, extra || {}));
    const pre = r.streets.find(s => s.k === 'pre') || { actions: [] };
    // antes e blinds de uma vez
    const forced = pre.actions.filter(a => [T.ANTE, T.SB, T.BB].includes(a.t));
    for (const a of forced) {
      st.stacks[a.seat] = a.after;
      if (a.t === T.ANTE) st.pot += a.amt; else { st.bets[a.seat] = (st.bets[a.seat] || 0) + a.amt; st.tag[a.seat] = a.t === T.SB ? 'SB' : 'BB'; }
    }
    snap('Início: antes e blinds', { street: 'pre' });
    let idx = 0;
    const log = [];
    const giveBacks = (k) => { for (const b of r.backs) if ((b.street || 'river') === k && !b.done) { st.bets[b.seat] = Math.max(0, (st.bets[b.seat] || 0) - b.amt); st.stacks[b.seat] += b.amt; b.done = true; } };
    let prevK = null;
    for (const s of r.streets) {
      if (prevK) giveBacks(prevK);
      prevK = s.k;
      if (s.k !== 'pre') {
        for (const k in st.bets) st.pot += st.bets[k];
        st.bets = {}; st.tag = {}; st.board = st.board.concat(s.cards); st.street = s.k; st.active = null;
        // all-in sem mais ações: as cartas viram
        const live = r.players.filter(p => !st.folded[p.seat]);
        if (live.length > 1 && live.filter(p => st.stacks[p.seat] > 0).length <= 1) st.show = true;
        snap(`${STREET_NAME[s.k]}: ${cardsStr(s.cards)}`, { streetStart: s.k });
      }
      for (const a of s.actions) {
        if (a.t === 100) continue;   // ACTION_RECORD_DELAY: só marcação de tempo do replay, não é ação
        if (s.k === 'pre' && [T.ANTE, T.SB, T.BB].includes(a.t)) continue;
        const max = Math.max(0, ...Object.values(st.bets));
        const L = actLabel(a, { max, mine: st.bets[a.seat] || 0, src: r.src });
        st.stacks[a.seat] = a.after;
        if (a.amt > 0) st.bets[a.seat] = (st.bets[a.seat] || 0) + a.amt;
        if (L.kind === 'fold') st.folded[a.seat] = true;
        st.tag = Object.assign({}, st.tag, { [a.seat]: L.allin ? 'All-in' : ({ fold: 'Fold', check: 'Check', call: 'Call', raise: 'Raise', bet: 'Bet', straddle: 'Straddle', post: 'BB' }[L.kind] || '') });
        st.active = a.seat;
        const limp = s.k === 'pre' && L.kind === 'call' && max <= r.bb + 1e-9;
        // aumento que cobre todos os que ainda estão na mão: para quem decide é um all-in (pagar = ir all-in), mesmo que quem
        // aumentou ainda tenha fichas. Evita tratar como "4-bet" um shove de quem tem stack maior.
        const others = (L.kind === 'raise' || L.kind === 'bet') && !L.allin ? r.players.filter(p => p.seat !== a.seat && !st.folded[p.seat]) : [];
        const cover = others.length > 0 && others.every(p => (st.bets[p.seat] || 0) + (st.stacks[p.seat] || 0) <= (st.bets[a.seat] || 0) + 1e-9);
        const item = { i: idx++, street: s.k, seat: a.seat, kind: L.kind, word: limp ? (max > (st.bets[a.seat] || 0) - a.amt && (st.bets[a.seat] - a.amt) > 0 ? 'completa' : 'limp') : L.word, amt: L.show, to: st.bets[a.seat] || 0, allin: L.allin, cover, limp };
        log.push(item);
        snap('', { act: item });
      }
    }
    // fichas devolvidas (aposta não paga), recolhe pote, showdown e prêmio
    for (const b of r.backs) if (!b.done) { st.bets[b.seat] = Math.max(0, (st.bets[b.seat] || 0) - b.amt); st.stacks[b.seat] += b.amt; b.done = true; }
    for (const b of r.backs) delete b.done;
    for (const k in st.bets) st.pot += st.bets[k];
    st.bets = {}; st.active = null; st.tag = {};
    const inHand = r.players.filter(p => !st.folded[p.seat]);
    const showdown = inHand.length > 1 && inHand.some(p => !p.isHero && p.cards);
    st.show = showdown;
    const ranks = {};
    if (st.board.length >= 3) for (const p of inHand) if (p.cards) ranks[p.seat] = bestHand(p.cards, st.board);
    if (showdown) snap('Showdown', { showdown: true, ranks });
    for (const w of r.winners) { st.stacks[w.seat] += w.amt; st.won[w.seat] = w.amt; }
    st.pot = 0;
    snap('Resultado', { final: true, ranks, showdown });
    S.log = log;
    return S;
  }

  // ------------------------------------------------------------------ resumo / campos do formulário
  function fmt(x) { return (Number(x) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }
  function bbs(x, r) { const v = (Number(x) || 0) / (r.bb || 1); return v.toLocaleString('pt-BR', { maximumFractionDigits: v >= 10 ? 1 : 1 }); }
  function playerOf(r, seat) { return r.players.find(p => p.seat === seat) || { seat, name: '?', pos: '' }; }
  function summary(r) {
    const S = steps(r), fin = S[S.length - 1];
    const hero = r.players.find(p => p.isHero) || null;
    const invested = {}; // fichas voluntárias por jogador
    for (const it of S.log) if (it.kind !== 'fold' && it.kind !== 'check') invested[it.seat] = (invested[it.seat] || 0) + 1;
    const alive = r.players.filter(p => !fin.folded[p.seat]);
    let vs = null, multi = false;
    if (hero) {
      const opp = alive.filter(p => !p.isHero);
      if (opp.length > 1) multi = true;
      else if (opp.length === 1) vs = opp[0];
      else {
        // todo mundo foldou: o último que colocou dinheiro contra mim
        const last = S.log.filter(it => it.seat !== hero.seat && it.kind !== 'check' && it.kind !== 'fold').pop();
        vs = last ? playerOf(r, last.seat) : null;
      }
    }
    const heroActs = hero ? S.log.filter(it => it.seat === hero.seat) : [];
    const lastStreet = heroActs.length ? heroActs[heroActs.length - 1].street : 'pre';
    const net = hero ? fin.stacks[hero.seat] - hero.stack : 0;
    const ranks = fin.ranks || {};
    return { S, hero, vs, multi, lastStreet, net, ranks, showdown: !!fin.showdown, winners: r.winners, busted: hero ? fin.stacks[hero.seat] <= 0 : false };
  }
  function heroLine(r, sm) {
    if (!sm.hero) return '';
    const words = { fold: 'fold', check: 'check', call: 'call', raise: 'raise', bet: 'bet', straddle: 'straddle', post: 'posta BB' };
    const parts = [];
    for (const k of ['pre', 'flop', 'turn', 'river']) {
      const acts = sm.S.log.filter(it => it.street === k && it.seat === sm.hero.seat);
      if (!acts.length) continue;
      const wd = (a) => a.limp ? 'limp' : a.allin ? (a.kind === 'call' ? 'call all-in' : 'all-in') : words[a.kind];
      const w = acts.map(wd).join('/');
      parts.push(`${w} ${k === 'pre' ? 'pré' : 'no ' + STREET_NAME[k].toLowerCase()}`);
    }
    let res = '';
    const hw = sm.winners.some(w => w.seat === sm.hero.seat);
    const hr = sm.ranks[sm.hero.seat], vr = sm.vs ? sm.ranks[sm.vs.seat] : null;
    if (sm.showdown && hr) res = `${hw ? 'ganhei' : 'perdi'} com ${handShort(hr)}${vr ? ' x ' + handShort(vr) : ''}`;
    else if (sm.S.log.some(it => it.seat === sm.hero.seat && it.kind === 'fold')) res = 'larguei';
    else if (hw) res = 'levei o pote';
    return parts.join(', ') + (res ? ' — ' + res : '') + (sm.busted ? ' (eliminada)' : '');
  }
  function fields(r) {
    const sm = summary(r);
    const hero = sm.hero;
    const vsCards = sm.vs && sm.vs.cards ? cardsStr(sm.vs.cards, '') : '';
    const title = hero && hero.cards ? cardsStr(hero.cards, '') + (vsCards ? ' x ' + vsCards : '') : '';
    return {
      title,
      stack: hero ? String(Math.round((hero.stack / (r.bb || 1)) * 10) / 10).replace('.', ',') : '',
      hero: hero ? hero.pos : '',
      vs: sm.multi ? 'Multiway' : (sm.vs ? sm.vs.pos : ''),
      street: STREET_NAME[sm.lastStreet] || '',
      note: heroLine(r, sm),
      kind: sm.showdown && sm.ranks[hero && hero.seat] && sm.ranks[hero.seat][0] >= 3 && !sm.winners.some(w => hero && w.seat === hero.seat) ? 'Cooler' : '',
    };
  }

  // ------------------------------------------------------------------ texto (WhatsApp)
  function text(r, opt) {
    opt = opt || {};
    const sm = summary(r), S = sm.S;
    const who = (seat) => { const p = playerOf(r, seat); return p.isHero ? `${p.pos} (eu)` : p.pos || p.name; };
    const amt = (x) => opt.bb ? bbs(x, r) + 'bb' : fmt(x);
    const L = [];
    L.push(`🃏 *${r.room || 'Mão'}*${r.table ? ' — Mesa ' + r.table : ''}${r.pko ? ' (PKO)' : ''}${r.ft ? ' • mesa final' : ''}`);
    L.push(`Blinds ${fmt(r.sb)}/${fmt(r.bb)}${r.ante ? ' • ante ' + fmt(r.ante) : ''} • ${r.players.length} jogadores`);
    if (sm.hero) L.push(`Eu: ${sm.hero.pos} • ${fmt(sm.hero.stack)} (${bbs(sm.hero.stack, r)}bb)${sm.hero.cards ? ' • ' + cardsStr(sm.hero.cards) : ''}`);
    if (sm.vs) L.push(`Vilão: ${sm.vs.pos} ${sm.vs.name} • ${fmt(sm.vs.stack)} (${bbs(sm.vs.stack, r)}bb)`);
    L.push('');
    let potAt = 0;
    for (const s of r.streets) {
      const st = S.find(x => (s.k === 'pre' ? x === S[0] : x.streetStart === s.k));
      potAt = st ? st.pot + Object.values(st.bets).reduce((a, b) => a + b, 0) : potAt;
      const acts = S.log.filter(it => it.street === s.k);
      const parts = []; let folds = [];
      const flush = (next) => {
        if (!folds.length) return;
        if (folds.length >= 2) parts.push(next != null ? `fold até ${who(next)}` : `${folds.length} folds`);
        else parts.push(`${who(folds[0])} fold`);
        folds = [];
      };
      acts.forEach((it) => {
        if (it.kind === 'fold' && !playerOf(r, it.seat).isHero) { folds.push(it.seat); return; }
        flush(it.seat);
        const p = playerOf(r, it.seat), me = p.isHero;
        let w;
        if (it.kind === 'fold') w = 'fold';
        else if (it.kind === 'check') w = 'check';
        else if (it.allin && it.kind === 'call') w = `paga ${amt(it.amt)} (all-in)`;
        else if (it.allin) w = `all-in ${amt(it.amt)}`;
        else if (it.limp) w = it.word === 'completa' ? 'completa' : 'limp';
        else w = `${it.word} ${amt(it.amt)}`;
        if (me) w = w.replace(/^aposta/, 'aposto').replace(/^paga/, 'pago').replace(/^completa/, 'completo');
        parts.push(me ? `eu ${w}` : `${who(it.seat)} ${w}`);
      });
      flush(null);
      const head = s.k === 'pre' ? '*Pré-flop*' : `*${STREET_NAME[s.k]}* ${cardsStr(s.cards)}`;
      L.push(`${head} (pote ${amt(potAt)})${parts.length ? ': ' + parts.join(' • ') : ''}`);
    }
    const fin = S[S.length - 1];
    if (sm.showdown) {
      const shown = r.players.filter(p => !fin.folded[p.seat] && p.cards);
      L.push(`*Showdown*: ${shown.map(p => `${p.isHero ? 'eu' : p.pos + ' ' + p.name} ${cardsStr(p.cards)}${sm.ranks[p.seat] ? ' (' + handName(sm.ranks[p.seat]) + ')' : ''}`).join(' x ')}`);
    }
    for (const w of r.winners) { const p = playerOf(r, w.seat); L.push(`🏆 ${p.isHero ? 'Eu ganho' : p.pos + ' ' + p.name + ' ganha'} o pote de ${amt(w.amt)}`); }
    if (sm.hero) {
      const sign = sm.net > 0 ? '+' : sm.net < 0 ? '−' : '';
      L.push(`Meu resultado: ${sign}${fmt(Math.abs(sm.net))} (${sign}${bbs(Math.abs(sm.net), r)}bb)${sm.busted ? ' — eliminada' : ''}`);
    }
    if (opt.url) L.push(opt.url);
    return L.join('\n');
  }

  const api = { parse, steps, summary, fields, text, cardStr, cardsStr, isRed, cardRank, cardSuit, bestHand, handName, positions, fmt, bbs, STREET_NAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  api.fixPos = fixPos;
  root.PPHand = api;
})(typeof window !== 'undefined' ? window : globalThis);
