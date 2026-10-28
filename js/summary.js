// Summary: one printable sheet of positions and breaks for the first 10 series
// (5 offense, 5 defense), with the formations on the back.
// Uses Coach's plan from js/roster.js, the same plan the playbook page shows.
(function () {
  const { POSITIONS, ORDER, DEFENSE, DEFAULT_SIZE } = window.Playbook;
  const Roster = window.Roster;
  const GamePlan = window.GamePlan;
  const SERIES = 10;
  const $ = (id) => document.getElementById(id);

  const COLUMN_TOOLTIPS = {
    player: 'The player. Rows are in name order.',
    series: (label, side) => `${label}: where each player lines up on ${side === 'O' ? 'offense' : 'defense'}, or Break if they rest.`,
    breaks: `How many of these ${SERIES} series the player rests.`,
    spot: 'The spot on the field. Offense spots keep their number on every play.',
    count: (label, side, n) => `How many of the ${n} ${side === 'O' ? 'offensive' : 'defensive'} series each player lines up at ${label}.`,
    restCount: (side, n) => `How many of the ${n} ${side === 'O' ? 'offensive' : 'defensive'} series each player rests.`,
  };

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) node.append(c);
    return node;
  }

  // Header cell with a tooltip and a small info mark.
  function th(text, tip, cls = '') {
    return el('th', { scope: 'col', title: tip, class: cls }, [document.createTextNode(text), el('span', { class: 'info', 'aria-hidden': 'true', text: ' ⓘ' })]);
  }

  // Coach's plan as written in js/roster.js (what everyone sees on the site).
  function loadPlan() {
    return { plan: { series: Roster.GAME_PLAN.series }, source: "Coach's plan" };
  }

  function seriesLabels(series) {
    const count = { O: 0, D: 0 };
    return series.map((s) => `${s.side === 'O' ? 'Offense' : 'Defense'} ${++count[s.side]}`);
  }

  const offenseSpot = (num) => {
    const id = ORDER.find((x) => POSITIONS[x].num === num);
    return `#${num} ${POSITIONS[id].short}`;
  };
  const defenseSpot = (pos) => {
    const p = DEFENSE.positions[pos];
    return p.side ? `${p.short} ${p.side[0]}` : p.short;
  };

  // Where a kid is in one series: their spot, or null on a break.
  function spotOf(series, kid, size) {
    if (series.side === 'O') {
      const i = series.o.indexOf(kid);
      return i < size ? offenseSpot(i + 1) : null;
    }
    const pos = DEFENSE.order.find((p) => series.d[p] === kid);
    return pos ? defenseSpot(pos) : null;
  }

  function byPlayer(series, labels, size) {
    const head = el('tr', {}, [
      th('Player', COLUMN_TOOLTIPS.player, 'name'),
      ...series.map((s, i) => th(labels[i], COLUMN_TOOLTIPS.series(labels[i], s.side), `side-${s.side}`)),
      th('Breaks', COLUMN_TOOLTIPS.breaks, 'num'),
    ]);
    const rows = Roster.KIDS.map((kid) => {
      const spots = series.map((s) => spotOf(s, kid, size));
      return el('tr', {}, [
        el('th', { scope: 'row', class: 'name', text: kid }),
        ...spots.map((spot, i) => el('td', { class: spot ? `side-${series[i].side}` : 'rest', text: spot || 'Break' })),
        el('td', { class: 'num', text: String(spots.filter((x) => !x).length) }),
      ]);
    });
    return el('table', { class: 'grid' }, [el('thead', {}, head), el('tbody', {}, rows)]);
  }

  // One side's spots down the side, that side's series across.
  function bySpot(series, labels, side, size) {
    const cols = series.map((s, i) => ({ s, label: labels[i] })).filter((c) => c.s.side === side);
    const spots = side === 'O'
      ? Array.from({ length: size }, (_, n) => ({ label: offenseSpot(n + 1), kid: (s) => s.o[n] }))
      : DEFENSE.order.map((pos) => ({ label: defenseSpot(pos), kid: (s) => s.d[pos] }));
    const head = el('tr', {}, [th('Spot', COLUMN_TOOLTIPS.spot, 'name'), ...cols.map((c) => th(c.label, COLUMN_TOOLTIPS.series(c.label, side), `side-${side}`))]);
    const rows = spots.map((spot) => el('tr', {}, [
      el('th', { scope: 'row', class: 'name', text: spot.label }),
      ...cols.map((c) => el('td', { text: spot.kid(c.s) })),
    ]));
    rows.push(el('tr', { class: 'rest-row' }, [
      el('th', { scope: 'row', class: 'name', text: 'Break' }),
      ...cols.map((c) => el('td', { class: 'rest', text: GamePlan.breaks(c.s, size, Roster.KIDS).join(', ') })),
    ]));
    return el('table', { class: 'grid' }, [el('thead', {}, head), el('tbody', {}, rows)]);
  }

  // How many times each player lines up at each spot, one side at a time.
  // Defense groups by spot type (CB, MLB, S), the way Coach places kids.
  function countChart(series, side, size) {
    const list = series.filter((s) => s.side === side);
    const spots = side === 'O'
      ? Array.from({ length: size }, (_, n) => ({ label: offenseSpot(n + 1), at: (s, kid) => s.o[n] === kid }))
      : ['CB', 'MLB', 'S'].map((g) => ({ label: g, at: (s, kid) => DEFENSE.order.some((p) => DEFENSE.positions[p].group === g && s.d[p] === kid) }));
    const n = list.length;
    const head = el('tr', {}, [
      th('Player', COLUMN_TOOLTIPS.player, 'name'),
      ...spots.map((sp) => th(sp.label, COLUMN_TOOLTIPS.count(sp.label, side, n))),
      th('Break', COLUMN_TOOLTIPS.restCount(side, n)),
    ]);
    const rows = Roster.KIDS.map((kid) => {
      const counts = spots.map((sp) => list.filter((s) => sp.at(s, kid)).length);
      const rests = list.filter((s) => GamePlan.breaks(s, size, Roster.KIDS).includes(kid)).length;
      return el('tr', {}, [
        el('th', { scope: 'row', class: 'name', text: kid }),
        ...counts.map((c, i) => el('td', { class: `heat heat-${Math.min(c, 4)}`, title: `${kid}: ${spots[i].label}, ${c} of ${n}`, text: c ? String(c) : '' })),
        el('td', { class: 'rest-count', title: `${kid}: rests ${rests} of ${n}`, text: rests ? String(rests) : '' }),
      ]);
    });
    return el('table', { class: 'grid heatmap' }, [el('thead', {}, head), el('tbody', {}, rows)]);
  }

  // ---------- Back page: every series as a small formation with names ----------

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const W = 320;
  const H = 96;
  const fx = (x) => 14 + ((x + 7.6) / 15.2) * (W - 28);

  function svg(tag, attrs = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Offense: each spot is a waist-up player in Chargers colors (powder blue,
  // gold, navy) with the position big on the jersey and the spot number under
  // it, and the name underneath. No team logo, just the colors.
  const OW = W;
  const OFF_H = 184;
  const OFF_ROW = { line: 40, QB: 96, RB: 150 };
  const JERSEY = { C: 'C', QB: 'QB', RB: 'RB' }; // receivers wear WR
  const ox = fx;

  // Drawn around the middle of the chest; about 32 wide and 40 tall.
  function playerIcon(x, y, position, num) {
    const g = svg('g', { class: 'player-icon', transform: `translate(${x} ${y})` });
    g.append(
      svg('path', { d: 'M-16 17 L-16 4 Q-16 -4 -8 -6 L8 -6 Q16 -4 16 4 L16 17 Z', class: 'jersey' }),
      svg('path', { d: 'M-15 2 Q-13 -3.5 -8 -5', class: 'trim' }),
      svg('path', { d: 'M15 2 Q13 -3.5 8 -5', class: 'trim' }),
      svg('path', { d: 'M-5 -6 L0 -1.5 L5 -6', class: 'collar' }),
      svg('text', { x: 0, y: 4, class: 'jersey-pos' }, position),
      svg('text', { x: 0, y: 13, class: 'jersey-num' }, String(num)),
      svg('circle', { cx: 0, cy: -14, r: 9, class: 'helmet' }),
      svg('path', { d: 'M0 -23 L0 -15', class: 'stripe' }),
      svg('rect', { x: -6, y: -14, width: 12, height: 8, rx: 3, class: 'face' }),
      svg('line', { x1: -6, x2: 6, y1: -11.5, y2: -11.5, class: 'mask' }),
      svg('line', { x1: -6, x2: 6, y1: -8.5, y2: -8.5, class: 'mask' }),
    );
    return g;
  }

  function offenseField(series, size) {
    const field = svg('svg', { viewBox: `0 0 ${OW} ${OFF_H}`, role: 'img', class: 'card-field' });
    field.append(svg('line', { x1: 0, x2: OW, y1: 14, y2: 14, class: 'los-line' }), svg('text', { x: 3, y: 11, class: 'yard-label' }, 'LOS'));
    field.append(svg('ellipse', { cx: ox(0), cy: 14, rx: 4.5, ry: 3, class: 'ball', transform: `rotate(-60 ${ox(0)} 14)` }));
    const players = ORDER.filter((id) => POSITIONS[id].num <= size);
    for (const id of players) {
      const p = POSITIONS[id];
      const x = ox(p.start[0]);
      const y = OFF_ROW[id] || OFF_ROW.line;
      const g = svg('g', { class: 'player' });
      g.append(playerIcon(x, y, JERSEY[id] || 'WR', p.num));
      g.append(svg('text', { x, y: y + 29, class: 'name', 'text-anchor': 'middle' }, series.o[p.num - 1]));
      field.append(g);
    }
    field.setAttribute('aria-label', `Offense: ${players.map((id) => `#${POSITIONS[id].num} ${JERSEY[id] || 'WR'} ${series.o[POSITIONS[id].num - 1]}`).join(', ')}`);
    return field;
  }

  // Defense, drawn like Coach's 7 v 7 wristband card: yard lines, the offense as
  // X's, yellow defenders (safeties as squares), each one's area as a light-blue
  // zone with a dotted edge, and the front three's read marks: a short stem to
  // the line ending in a hook (corners, bending inside) or an arch (MLB).
  const DEF_H = 180;
  const LOS_Y = 132;
  const yd = (y) => LOS_Y - y * 10;

  // The area each spot covers, shaped like the card: tilted ovals for the
  // corners, a triangle from the MLB over the backfield, a circle per safety.
  function zoneShape(p) {
    const x = fx(p.start[0]);
    if (p.zone === 'Flat') {
      const dir = p.start[0] < 0 ? 1 : -1; // toward the ball
      return svg('ellipse', { cx: x + dir * 10, cy: yd(1.6), rx: 44, ry: 20, transform: `rotate(${dir * 15} ${x + dir * 10} ${yd(1.6)})`, class: 'zone' });
    }
    if (p.zone === 'Middle') {
      return svg('polygon', { points: `${x},${yd(2.8)} ${x - 62},${yd(-1)} ${x + 62},${yd(-1)}`, class: 'zone' });
    }
    return svg('circle', { cx: x, cy: yd(p.start[1]), r: 29, class: 'zone' });
  }

  // Read marks: a stem down from the player, then the hook or arch. Corners hook
  // inside; the MLB arches over the ball; safeties come up for the run on a
  // longer stem with a narrower hook.
  function readMark(p, x, y) {
    const g = svg('g', { class: 'read' });
    if (p.zone === 'Deep half') {
      const dir = p.start[0] < 0 ? 1 : -1;
      const end = y + 34;
      g.append(svg('path', { d: `M${x} ${y + 10} L${x} ${end}` }), svg('path', { d: `M${x + dir * 8} ${end - 5} Q${x - dir} ${end + 2} ${x - dir * 1.5} ${end + 9}` }));
    } else if (p.zone === 'Middle') {
      g.append(svg('path', { d: `M${x} ${y + 10} L${x} ${y + 12.5}` }), svg('path', { d: `M${x - 24} ${LOS_Y + 1} Q${x} ${y + 4} ${x + 24} ${LOS_Y + 1}` }));
    } else {
      const dir = p.start[0] < 0 ? 1 : -1;
      g.append(svg('path', { d: `M${x} ${y + 10} L${x} ${y + 15}` }), svg('path', { d: `M${x + dir * 13} ${y + 7} Q${x - dir} ${y + 15} ${x - dir * 2} ${LOS_Y - 1}` }));
    }
    return g;
  }

  function defenseField(series) {
    const field = svg('svg', { viewBox: `0 0 ${W} ${DEF_H}`, role: 'img', class: 'card-field' });
    for (const [yard, label] of [[10, '10'], [5, '5'], [0, 'LOS']]) {
      field.append(svg('line', { x1: 0, x2: W, y1: yd(yard), y2: yd(yard), class: yard ? 'yard' : 'los-line' }));
      field.append(svg('text', { x: 3, y: yd(yard) + (yard ? -2 : 9), class: 'yard-label' }, label));
    }
    // Zones first, so everything else sits on top.
    for (const pos of DEFENSE.order) field.append(zoneShape(DEFENSE.positions[pos]));
    // Our 5 v 5 offense as X's, and the ball.
    field.append(svg('ellipse', { cx: fx(0), cy: LOS_Y + 5, rx: 4.5, ry: 3, class: 'ball', transform: `rotate(-60 ${fx(0)} ${LOS_Y + 5})` }));
    for (const id of ORDER.filter((x) => POSITIONS[x].num <= 5)) {
      const at = { QB: 160, RB: 170 }[id] || 149;
      field.append(svg('text', { x: fx(POSITIONS[id].start[0]), y: at, class: 'x-mark' }, 'X'));
    }
    for (const pos of DEFENSE.order) {
      const p = DEFENSE.positions[pos];
      const x = fx(p.start[0]);
      const deep = p.start[1] > 5;
      const y = yd(p.start[1]);
      const g = svg('g', { class: 'defender' });
      g.append(readMark(p, x, y));
      g.append(deep
        ? svg('rect', { x: x - 10, y: y - 10, width: 20, height: 20, class: 'mark' })
        : svg('circle', { cx: x, cy: y, r: 10, class: 'mark' }));
      g.append(svg('text', { x, y: y + 0.5, class: 'pos' }, p.short));
      g.append(svg('text', { x, y: y - 14, class: 'name' }, series.d[pos]));
      field.append(g);
    }
    field.setAttribute('aria-label', `Defense: ${DEFENSE.order.map((pos) => `${defenseSpot(pos)} ${series.d[pos]} (${DEFENSE.positions[pos].zone})`).join(', ')}`);
    return field;
  }

  // Who rests, as a small gold tag in a corner of the card (SVG units).
  function breakTag(field, s, size, corner, w, h) {
    const names = GamePlan.breaks(s, size, Roster.KIDS).join(', ') || 'Nobody';
    const tw = Math.max(34, names.length * 5.7 + 12);
    const x = corner === 'left' ? 4 : w - tw - 4;
    const y = h - 26;
    const g = svg('g', { class: 'break-tag' });
    g.append(
      svg('rect', { x, y, width: tw, height: 22, rx: 6 }),
      svg('text', { x: x + 6, y: y + 8, class: 'break-label' }, 'BREAK'),
      svg('text', { x: x + 6, y: y + 18, class: 'break-names' }, names),
    );
    field.append(g);
  }

  function lineupCard(s, size, side) {
    let body = el('p', { class: 'muted', text: 'Not planned' });
    if (s) {
      body = side === 'O' ? offenseField(s, size) : defenseField(s);
      const [, , w, h] = body.getAttribute('viewBox').split(' ').map(Number);
      breakTag(body, s, size, side === 'O' ? 'left' : 'right', w, h);
    }
    return el('article', { class: `formation side-${side}` }, [el('header', {}, [el('b', { text: side === 'O' ? 'Offense' : 'Defense' })]), body]);
  }

  // One row per Series: a header that stands on its own, then Offense k and Defense k.
  // Coach mode (coach=1 in the link): each Series also shows Coach's calls.
  const COACH = /[?&#]coach=1(&|$)/.test(`${location.search}&${location.hash}`);

  function callsCard(plan) {
    const list = (items) => el('ol', { class: 'calls-list' }, (items || []).map((t) => el('li', { text: t })));
    return el('article', { class: 'calls-card' }, [
      el('div', { class: 'calls-col' }, [el('b', { class: 'calls-tag', text: 'Plays' }), list(plan.plays)]),
      el('div', { class: 'calls-col' }, [el('b', { class: 'calls-tag calls-2pt', text: '2-pt' }), list(plan.twoPt)]),
    ]);
  }

  function seriesRows(series, size) {
    const offense = series.filter((s) => s.side === 'O');
    const defense = series.filter((s) => s.side === 'D');
    const script = Roster.COACH_SCRIPT || [];
    return Array.from({ length: Math.max(offense.length, defense.length) }, (_, k) => el('section', { class: 'series-row' }, [
      el('h3', { class: 'series-head' }, [el('span', { class: 'series-name', text: `Series ${k + 1}` })]),
      COACH && script[k] ? callsCard(script[k]) : null,
      lineupCard(offense[k], size, 'O'),
      lineupCard(defense[k], size, 'D'),
    ].filter(Boolean)));
  }

  // ---------- Bottom strip: every player, and what they play this game ----------

  const OFFENSE_LABEL = { 1: 'C', 2: 'QB', 3: 'RB', 4: 'WR', 5: 'WR' };

  function playerStrip(series, size) {
    return Roster.KIDS.map((kid) => {
      const spots = { O: [], D: [] };
      for (const s of series) {
        const resting = GamePlan.breaks(s, size, Roster.KIDS).includes(kid);
        const spot = s.side === 'O' ? OFFENSE_LABEL[s.o.indexOf(kid) + 1] : (DEFENSE.positions[DEFENSE.order.find((p) => s.d[p] === kid)] || {}).group;
        spots[s.side].push(resting ? null : spot);
      }
      const avatar = svg('svg', { viewBox: '-20 -26 40 46', class: 'card-field strip-avatar', 'aria-hidden': 'true' });
      avatar.append(playerIcon(0, 0, kid[0], ''));
      return el('article', { class: 'strip-player' }, [
        avatar,
        el('b', { text: kid }),
        window.Badges.seriesGrid(document, spots),
      ]);
    });
  }

  // Swipe row: dots and arrows follow the scroll; a one-time nudge shows it moves.
  function wireStrip() {
    const strip = $('strip');
    const cards = [...strip.children];
    $('strip-dots').replaceChildren(...cards.map(() => document.createElement('i')));
    const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : strip.clientWidth) || 220;
    const update = () => {
      const index = Math.round(strip.scrollLeft / step());
      [...$('strip-dots').children].forEach((dot, i) => dot.classList.toggle('on', i === Math.min(index, cards.length - 1)));
      const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
      strip.classList.toggle('at-end', atEnd);
      $('strip-prev').disabled = strip.scrollLeft <= 4;
      $('strip-next').disabled = atEnd;
    };
    strip.addEventListener('scroll', update, { passive: true });
    $('strip-prev').onclick = () => strip.scrollBy({ left: -step(), behavior: 'smooth' });
    $('strip-next').onclick = () => strip.scrollBy({ left: step(), behavior: 'smooth' });
    update();
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still && typeof strip.scrollTo === 'function' && strip.scrollWidth > strip.clientWidth) {
      setTimeout(() => strip.scrollTo({ left: 56, behavior: 'smooth' }), 500);
      setTimeout(() => strip.scrollTo({ left: 0, behavior: 'smooth' }), 1100);
    }
  }

  function render() {
    const { plan, source } = loadPlan();
    const size = DEFAULT_SIZE;
    const series = plan.series.slice(0, SERIES);
    const labels = seriesLabels(series);
    $('source').textContent = `${size} v ${size}. From ${source}. Series 1 to ${series.length}.`;
    $('by-player').replaceChildren(byPlayer(series, labels, size));
    $('by-offense').replaceChildren(bySpot(series, labels, 'O', size));
    $('by-defense').replaceChildren(bySpot(series, labels, 'D', size));
    $('count-offense').replaceChildren(countChart(series, 'O', size));
    $('count-defense').replaceChildren(countChart(series, 'D', size));
    $('formations').replaceChildren(...seriesRows(series, size));
    if (COACH) {
      document.title = "Coach's Game Plan";
      $('page-title').textContent = "Coach's Game Plan";
      $('back-link').href = 'index.html?coach=1';
    }
    $('strip').replaceChildren(...playerStrip(series, size));
    $('strip-title').textContent = `Players \u00B7 Series 1 to ${series.filter((x) => x.side === 'O').length}`;
    wireStrip();
  }

  $('print').addEventListener('click', () => window.print());
  render();
})();
