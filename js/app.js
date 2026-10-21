// Page wiring: reads Playbook data, draws the field, runs the animation.
(function () {
  const { PLAYS, ORDER, POSITIONS, ALIGNMENT, PRACTICE, GLOSSARY, RUN_TIP, TEAM_SIZES, DEFAULT_SIZE, sitsOut, getRole, CADENCES, DEFAULT_CADENCE, DEFENSE } = window.Playbook;
  const Engine = window.PlayEngine;
  const Roster = window.Roster;
  const GamePlan = window.GamePlan;
  const PLAN_KEY = 'chargers-game-plan-v1';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Field drawing scale: yards to SVG units. Matches viewBox 440 x 322.
  const SX = 20;
  const SY = 14;
  const X = (x) => (x + 11) * SX;
  const Y = (y) => (16.5 - y) * SY;

  const SLOW = 0.55;
  const $ = (id) => document.getElementById(id);

  const state = {
    side: 'offense', // or 'defense'
    play: PLAYS[0],
    variation: PLAYS[0].variations[0],
    pos: null,
    left: true, // Direction defaults to Left
    size: DEFAULT_SIZE,
    plan: null, // see js/gameplan.js
    series: 0, // index of the current series in the plan
    kid: null,
    cadence: DEFAULT_CADENCE,
    target: null,
    late: false,
    t: 0,
    playing: false,
    speed: SLOW,
    scene: null,
    lastFrame: 0,
  };
  let els = { actors: {}, routes: {} };

  // ---------- URL state: #play/variation/POS?side=left&to=IRR&late=1&n=6, or #defense/POS ----------

  function readHash() {
    const [route, query = ''] = location.hash.replace(/^#/, '').split('?');
    const [playId, varId, pos] = route.split('/');
    const params = new URLSearchParams(query);
    state.side = playId === 'defense' ? 'defense' : 'offense';
    const play = PLAYS.find((p) => p.id === playId) || PLAYS[0];
    const variation = play.variations.find((v) => v.id === varId) || play.variations[0];
    state.play = play;
    state.variation = variation;
    if (isDefense()) state.pos = DEFENSE.order.includes(varId) ? varId : null;
    else state.pos = ORDER.includes(pos) ? pos : null;
    state.left = variation.direction ? variation.direction === 'left' : params.get('side') !== 'right';
    state.cadence = CADENCES.some((c) => c.id === params.get('c')) ? params.get('c') : DEFAULT_CADENCE;
    importSharedPlan(params.get('plan'));
    const series = Number(params.get('s')) - 1;
    state.series = series >= 0 && series < state.plan.series.length ? series : Math.min(state.series, state.plan.series.length - 1);
    state.kid = Roster.KIDS.includes(params.get('kid')) ? params.get('kid') : null;
    const size = Number(params.get('n'));
    state.size = TEAM_SIZES.includes(size) ? size : DEFAULT_SIZE;
    if (!isDefense() && state.pos && sitsOut(state.pos, state.size)) state.pos = null;
    const to = params.get('to');
    const validTarget = (variation.targets || []).includes(to) ? !sitsOut(to, state.size) : to === ANY && variation.qbChoice;
    state.target = variation.targets ? (validTarget ? to : variation.defaultTarget) : null;
    state.late = params.get('late') === '1' && !!lateRead();
  }

  // The 1st/2nd read labels for the current pass target, if it has two timings.
  function lateRead() {
    return state.target && (state.variation.lateReads || {})[state.target];
  }

  function writeHash() {
    const parts = isDefense() ? ['defense'] : [state.play.id, state.variation.id];
    if (state.pos) parts.push(state.pos);
    const params = new URLSearchParams();
    if (!isDefense() && !state.left && state.variation.flipActors) params.set('side', 'right');
    if (!isDefense() && state.late) params.set('late', '1');
    if (state.size !== DEFAULT_SIZE) params.set('n', String(state.size));
    if (state.series !== 0) params.set('s', String(state.series + 1));
    if (state.cadence !== DEFAULT_CADENCE) params.set('c', state.cadence);
    if (state.kid) params.set('kid', state.kid);
    if (!isDefense() && state.target && state.target !== state.variation.defaultTarget) params.set('to', state.target);
    const query = params.toString();
    try {
      history.replaceState(null, '', `#${parts.join('/')}${query ? `?${query}` : ''}`);
    } catch (err) {
      // Some browsers refuse replaceState on file:// pages. The page still works; the link just is not saved.
      console.warn('Could not save the selection in the link:', err.message);
    }
  }

  // ---------- helpers ----------

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) node.append(c);
    return node;
  }

  function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  // Pass target meaning "QB's choice": the animation throws to the default read.
  const ANY = 'any';

  // Boom is drawn to the Right and flipped for Left. Sonic has a version per side.
  function isFlipped() {
    return state.left && !!state.variation.flipActors;
  }

  function isDefense() {
    return state.side === 'defense';
  }

  // Offensive spots (ORL, QB, ...) and defensive spots (CBL, MLB, ...) share these helpers.
  function posInfo(id) {
    return POSITIONS[id] || DEFENSE.positions[id];
  }

  function posLabel(id) {
    const p = posInfo(id);
    const name = p.side ? `${p.short} (${p.side})` : p.short;
    return p.num ? `#${p.num} ${name}` : name;
  }

  function posName(id) {
    const p = posInfo(id);
    return p.side ? `${p.name} (${p.side})` : p.name;
  }

  function currentSeries() {
    return state.plan.series[state.series];
  }

  // Kid playing this spot in the current series (offense by number, defense by spot).
  // Kid at a spot. On a defensive series the offense shows the next offensive
  // series (and the other way round), so both sides always have names.
  function kidFor(id) {
    if (POSITIONS[id]) return seriesFor('O').o[POSITIONS[id].num - 1];
    return seriesFor('D').d[id] || null;
  }

  function seriesFor(side, from = state.series) {
    const list = state.plan.series;
    if (list[from].side === side) return list[from];
    return list.slice(from + 1).find((x) => x.side === side) || [...list.slice(0, from)].reverse().find((x) => x.side === side) || emptySeries(side);
  }

  function emptySeries(side) {
    return side === 'O' ? { side, o: Roster.KIDS.slice() } : { side, d: {} };
  }


  // Series are counted per side, the way Coach talks: Offense 1, Defense 1, Offense 2...
  function seriesLabel(i = state.series) {
    const list = state.plan.series;
    const n = list.slice(0, i + 1).filter((x) => x.side === list[i].side).length;
    return `${list[i].side === 'O' ? 'Offense' : 'Defense'} ${n}`;
  }

  function idForNum(num) {
    return ORDER.find((id) => POSITIONS[id].num === num);
  }

  function isSonicRunner(id) {
    return state.variation.sonic === id;
  }

  // Left-to-right across the field, the way the players line up.
  function byFieldX(a, b) {
    return POSITIONS[a].start[0] - POSITIONS[b].start[0];
  }

  // Players on the field for the current team size, in formation order.
  function onField() {
    return ORDER.filter((id) => !sitsOut(id, state.size));
  }

  function sitOutNote() {
    const out = ORDER.filter((id) => sitsOut(id, state.size)).map((id) => POSITIONS[id].num).sort().map((n) => `#${n}`);
    return out.length ? `${state.size} v ${state.size}: ${out.join(' and ')} sit${out.length === 1 ? 's' : ''} out. Everyone else does the same job.` : 'All 7 spots play.';
  }

  // ---------- Coach calls panel: Play / Type / Variation / Direction ----------

  function sideRow() {
    return callRow('Side', [
      { label: 'Offense', active: !isDefense(), onclick: () => setSideOfBall('offense') },
      { label: 'Defense', active: isDefense(), onclick: () => setSideOfBall('defense') },
    ], { hideLabel: true });
  }

  function renderCall() {
    if (isDefense()) {
      $('call').replaceChildren(sideRow(), callRow('Coverage', [{ label: DEFENSE.name, active: true, onclick: () => {} }]));
      $('tagline').textContent = DEFENSE.tagline;
      return;
    }
    const play = state.play;
    const v = state.variation;
    const rows = [sideRow(), playRow(), playCallRow()];
    if (v.targets) {
      const targets = v.targets.filter((id) => !sitsOut(id, state.size)).sort(byFieldX).map((id) => ({
        label: targetLabel(id),
        active: state.target === id,
        onclick: () => setTarget(id),
      }));
      if (v.qbChoice) targets.push({ label: "QB's choice", active: state.target === ANY, onclick: () => setTarget(ANY) });
      rows.push(callRow('Target', targets, { look: 'rail' }));
      const read = lateRead();
      if (read) {
        rows.push(callRow('Read', [
          { label: `1st: ${read.first}`, active: !state.late, onclick: () => setLate(false) },
          { label: `2nd: ${read.second}`, active: state.late, onclick: () => setLate(true) },
        ]));
      }
    }
    const directions = directionButtons();
    if (directions) rows.push(callRow('Direction', directions, { hideLabel: true }));
    rows.push(callRow('Cadence', CADENCES.map((c) => ({ label: c.label, active: state.cadence === c.id, onclick: () => setCadence(c.id) }))));
    $('call').replaceChildren(...rows);
    $('tagline').textContent = play.tagline;
  }

  // Every version of the play in one row, grouped Pass / Handoff. One chip per
  // kind: Sonic has a Left and a Right version of each, picked by Direction.
  function playCallRow() {
    const v = state.variation;
    const groups = state.play.groups.map((g) => {
      const kinds = state.play.variations.filter((x) => x.group === g.id && (!x.direction || x.direction === (v.direction || (state.left ? 'left' : 'right'))));
      return el('div', { class: 'call-group' }, [
        el('span', { class: 'call-group-label', text: g.name }),
        ...kinds.map((x) => {
          const on = x === v;
          return el('button', { type: 'button', class: `chip${on ? ' active' : ''}`, 'aria-pressed': String(on), onclick: () => selectVariation(x), text: x.short || g.name });
        }),
      ]);
    });
    return el('div', { class: 'call-row call-row-rail', 'data-row': 'call' }, [
      el('span', { class: 'call-label', text: 'Call' }),
      el('div', { class: 'call-chips rail call-groups', role: 'group', 'aria-label': 'Call' }, groups),
    ]);
  }

  // Sonic picks its Left or Right version; Boom mirrors the QB and RB.
  function directionButtons() {
    const v = state.variation;
    const LEFT = '\u2190 Left';
    const RIGHT = 'Right \u2192';
    if (v.direction) {
      const pick = (dir) => state.play.variations.find((x) => x.group === v.group && x.short === v.short && x.direction === dir);
      return [
        { label: LEFT, active: v.direction === 'left', onclick: () => selectVariation(pick('left')) },
        { label: RIGHT, active: v.direction === 'right', onclick: () => selectVariation(pick('right')) },
      ];
    }
    if (!v.flipActors) return null;
    return [
      { label: LEFT, active: state.left, onclick: () => setSide(true) },
      { label: RIGHT, active: !state.left, onclick: () => setSide(false) },
    ];
  }

  // Boom and Sonic get big branded buttons; the other rows use plain chips.
  function playRow() {
    return el('div', { class: 'call-row call-row-seg call-row-play', 'data-row': 'play' }, [
      el('span', { class: 'call-label sr-only', text: 'Play' }),
      el('div', { class: 'call-chips seg play-tabs', role: 'group', 'aria-label': 'Play' }, PLAYS.map((p) =>
        el('button', {
          type: 'button',
          class: `chip play-tab${p === state.play ? ' active' : ''}`,
          'aria-pressed': String(p === state.play),
          'aria-label': p.name,
          onclick: () => selectPlay(p),
        }, [el('span', { class: 'tab-icon', 'aria-hidden': 'true', text: p.icon }), el('span', { class: 'tab-name', text: p.name })]),
      )),
    ]);
  }

  // Two looks: 'seg' is a segmented control for either/or picks (Side, Direction,
  // Snap); 'rail' is a one-line row of pills that scrolls sideways (Target).
  // `hideLabel` keeps the label for screen readers only.
  function callRow(label, buttons, { look = 'seg', hideLabel = false } = {}) {
    return el('div', { class: `call-row call-row-${look}`, 'data-row': label.toLowerCase() }, [
      el('span', { class: `call-label${hideLabel ? ' sr-only' : ''}`, text: label }),
      el('div', { class: `call-chips ${look}`, role: 'group', 'aria-label': label }, buttons.map((b) =>
        el('button', { type: 'button', class: `chip${b.active ? ' active' : ''}`, 'aria-pressed': String(b.active), onclick: b.onclick, text: b.label }),
      )),
    ]);
  }

  // Pass targets read like the coach says them: OR-5, IR-7, RB-3, C-1, IR-6, OR-4.
  function targetLabel(id) {
    return `${POSITIONS[id].short}-${POSITIONS[id].num}`;
  }

  function renderTeamSize() {
    $('team-size').replaceChildren(
      optionGroup('Players:', TEAM_SIZES.map((n) => ({
        label: `${n} v ${n}`,
        active: state.size === n,
        onclick: () => setSize(n),
      }))),
      el('p', { class: 'size-note', text: sitOutNote() }),
    );
  }

  function optionGroup(label, buttons) {
    return el('div', { class: 'option-group' }, [
      el('span', { class: 'option-label', text: label }),
      ...buttons.map((b) =>
        el('button', { type: 'button', class: `chip chip-sm${b.active ? ' active' : ''}`, 'aria-pressed': String(b.active), onclick: b.onclick, text: b.label }),
      ),
    ]);
  }

  function renderSummary() {
    const node = $('summary');
    if (isDefense()) {
      node.replaceChildren(el('b', { text: `${DEFENSE.name}: ` }), document.createTextNode(DEFENSE.summary));
      if (!DEFENSE.sizes.includes(state.size)) node.append(el('span', { class: 'draft-note', text: ` Drawn for ${DEFENSE.sizes[0]} v ${DEFENSE.sizes[0]}. The ${state.size} v ${state.size} defense is coming.` }));
      if (DEFENSE.draft) node.append(el('span', { class: 'draft-note', text: ' \u{1F6A7} Coach is still building the jobs. The alignment is set.' }));
      return;
    }
    const v = state.variation;
    node.replaceChildren(el('b', { text: `${v.name}: ` }), document.createTextNode(v.summary));
    if (v.draft) node.append(el('span', { class: 'draft-note', text: ' \u{1F6A7} Coach is still building this one. Check with Coach before practicing it.' }));
  }

  // ---------- field ----------

  function drawField() {
    const field = $('field');
    field.replaceChildren();
    const defs = svg('defs');
    for (const [id, color] of [['arrow', '#1f5fd6'], ['arrow-me', '#e0301e'], ['arrow-ball', '#8a4b1f']]) {
      const marker = svg('marker', { id, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
      marker.append(svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }));
      defs.append(marker);
    }
    field.append(defs, svg('rect', { x: 0, y: 0, width: 440, height: 322, class: 'turf' }));

    for (const yd of [5, 10, 15]) {
      field.append(svg('line', { x1: 0, x2: 440, y1: Y(yd), y2: Y(yd), class: 'yard-line' }));
      for (const x of [8, 420]) {
        const label = svg('text', { x, y: Y(yd) - 3, class: 'yard-label' });
        label.textContent = yd;
        field.append(label);
      }
    }
    field.append(svg('line', { x1: 0, x2: 440, y1: Y(0), y2: Y(0), class: 'los' }));
    for (const x of [6, 414]) {
      const los = svg('text', { x, y: Y(0) + 12, class: 'yard-label' });
      los.textContent = 'LOS';
      field.append(los);
    }
    if (isDefense()) {
      drawDefense(field);
      return;
    }

    const scene = state.scene;
    els = { actors: {}, routes: {} };
    const routeLayer = svg('g', { class: 'routes' });
    for (const id of onField()) {
      const pts = scene.actors[id].path.slice(0, scene.actors[id].drawn);
      if (pts.length < 2) continue;
      const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
      const route = svg('path', { d, class: 'route', 'marker-end': 'url(#arrow)' });
      els.routes[id] = route;
      routeLayer.append(route);
    }
    const pass = scene.segments.find((s) => s.kind === 'flight' && s.arc > 1);
    if (pass) {
      const a = Engine.positionAt(scene.actors[pass.from], pass.t0);
      const b = Engine.positionAt(scene.actors[pass.to], pass.t1);
      routeLayer.append(svg('path', { d: `M${X(a[0])},${Y(a[1])} L${X(b[0])},${Y(b[1])}`, class: 'pass-line', 'marker-end': 'url(#arrow-ball)' }));
    }
    field.append(routeLayer);

    const actorLayer = svg('g', { class: 'actors' });
    for (const id of onField()) {
      const g = svg('g', { class: 'actor', tabindex: 0, role: 'button', 'aria-label': `Number ${POSITIONS[id].num}, ${posName(id)}` });
      g.append(svg('circle', { r: 17, class: 'actor-ring' }), svg('circle', { r: 12, class: 'actor-dot' }));
      const label = svg('text', { class: 'actor-label', 'text-anchor': 'middle', dy: '0.35em' });
      label.textContent = POSITIONS[id].short;
      const badge = svg('circle', { cx: 11, cy: -11, r: 7, class: 'actor-num-bg' });
      const num = svg('text', { x: 11, y: -11, class: 'actor-num', 'text-anchor': 'middle', dy: '0.35em' });
      num.textContent = POSITIONS[id].num;
      g.append(label, badge, num);
      g.addEventListener('click', () => selectPos(id));
      g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && selectPos(id));
      els.actors[id] = g;
      actorLayer.append(g);
    }
    els.shadow = svg('ellipse', { rx: 5, ry: 2.5, class: 'ball-shadow' });
    els.ball = svg('g', { class: 'ball' });
    els.ball.append(svg('ellipse', { rx: 6.5, ry: 4.2, class: 'ball-body' }), svg('line', { x1: -2.5, x2: 2.5, y1: 0, y2: 0, class: 'ball-lace' }));
    field.append(actorLayer, els.shadow, els.ball);
    highlight();
    update();
  }

  // Cover 2 against our own 5 v 5 formation: offense faded, defenders tappable.
  function drawDefense(field) {
    els = { actors: {}, routes: {} };
    const ghosts = svg('g', { class: 'ghosts', 'aria-hidden': 'true' });
    for (const id of onField()) {
      const [x, y] = POSITIONS[id].start;
      const g = svg('g', { class: 'ghost', transform: `translate(${X(x).toFixed(1)},${Y(y).toFixed(1)})` });
      const label = svg('text', { class: 'actor-label', 'text-anchor': 'middle', dy: '0.35em' });
      label.textContent = POSITIONS[id].short;
      g.append(svg('circle', { r: 12, class: 'actor-dot' }), label);
      ghosts.append(g);
    }
    const ball = svg('g', { class: 'ball', transform: `translate(${X(0)},${Y(0)}) rotate(-25)` });
    ball.append(svg('ellipse', { rx: 6.5, ry: 4.2, class: 'ball-body' }), svg('line', { x1: -2.5, x2: 2.5, y1: 0, y2: 0, class: 'ball-lace' }));
    const actorLayer = svg('g', { class: 'actors defense' });
    for (const id of DEFENSE.order) {
      const [x, y] = DEFENSE.positions[id].start;
      const g = svg('g', { class: 'actor defender', tabindex: 0, role: 'button', 'aria-label': posName(id), transform: `translate(${X(x).toFixed(1)},${Y(y).toFixed(1)})` });
      const label = svg('text', { class: 'actor-label', 'text-anchor': 'middle', dy: '0.35em' });
      label.textContent = DEFENSE.positions[id].short;
      g.append(svg('circle', { r: 17, class: 'actor-ring' }), svg('circle', { r: 13, class: 'actor-dot' }), label);
      g.addEventListener('click', () => selectPos(id));
      g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && selectPos(id));
      els.actors[id] = g;
      actorLayer.append(g);
    }
    field.append(ghosts, ball, actorLayer);
    $('caption').textContent = '';
    highlight();
  }

  function highlight() {
    const field = $('field');
    field.classList.toggle('has-me', !!state.pos);
    for (const id of Object.keys(els.actors)) {
      els.actors[id].classList.toggle('me', id === state.pos);
      els.actors[id].classList.toggle('sonic', isSonicRunner(id));
      const route = els.routes[id];
      if (!route) continue;
      route.classList.toggle('me', id === state.pos);
      route.setAttribute('marker-end', id === state.pos ? 'url(#arrow-me)' : 'url(#arrow)');
    }
  }

  function update() {
    if (isDefense()) return;
    const scene = state.scene;
    for (const id of onField()) {
      const [x, y] = Engine.positionAt(scene.actors[id], state.t);
      els.actors[id].setAttribute('transform', `translate(${X(x).toFixed(1)},${Y(y).toFixed(1)})`);
    }
    const ball = Engine.ballAt(scene, state.t);
    const bx = X(ball.pos[0]);
    const by = Y(ball.pos[1]);
    const lift = ball.height * SY;
    els.shadow.setAttribute('transform', `translate(${bx.toFixed(1)},${(by + 2).toFixed(1)})`);
    els.shadow.style.opacity = ball.height > 0.05 ? 0.35 : 0;
    const scale = 1 + ball.height * 0.12;
    els.ball.setAttribute('transform', `translate(${bx.toFixed(1)},${(by - lift).toFixed(1)}) rotate(-25) scale(${scale.toFixed(2)})`);
    $('caption').textContent = state.t > 0 ? Engine.captionAt(scene, state.t) : '';
  }

  // ---------- animation ----------

  function tick(now) {
    if (!state.playing) return;
    const dt = Math.min((now - state.lastFrame) / 1000, 0.1);
    state.lastFrame = now;
    state.t = Math.min(state.t + dt * state.speed, state.scene.duration);
    update();
    if (state.t >= state.scene.duration) {
      setPlaying(false);
      return;
    }
    requestAnimationFrame(tick);
  }

  function setPlaying(on) {
    if (on && state.t >= state.scene.duration) state.t = 0;
    state.playing = on;
    $('btn-play').innerHTML = on ? '&#x23F8; Pause' : state.t > 0 && state.t < state.scene.duration ? '&#x25B6; Keep going' : '&#x25B6; Play';
    if (on) {
      state.lastFrame = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function resetAnimation() {
    setPlaying(false);
    state.t = 0;
    update();
    setPlaying(false); // again, so the button reads "Play" now that t is 0
  }

  // ---------- positions ----------

  function renderPicker() {
    if (isDefense()) {
      renderDefensePicker();
      return;
    }
    const button = (id) => {
      const p = POSITIONS[id];
      const out = sitsOut(id, state.size);
      return el('button', {
        type: 'button',
        class: `spot${id === state.pos ? ' active' : ''}${isSonicRunner(id) ? ' sonic' : ''}${out ? ' out' : ''}`,
        'aria-pressed': String(id === state.pos),
        'aria-label': `Number ${p.num}, ${posName(id)}, ${kidFor(id)}${out ? ', sits out' : ''}`,
        disabled: out ? 'disabled' : null,
        onclick: () => selectPos(id),
      }, [
        el('span', { class: 'spot-dot', text: String(p.num) }),
        el('span', { class: 'spot-kid', text: kidFor(id) }),
        el('span', { class: 'spot-name', text: out ? 'on break' : p.side ? `${p.short} ${p.side}` : p.short }),
      ]);
    };
    $('picker').replaceChildren(
      el('div', { class: 'picker-row' }, ['ORL', 'IRL', 'C', 'IRR', 'ORR'].map(button)),
      el('div', { class: 'picker-row' }, [button('QB')]),
      el('div', { class: 'picker-row' }, [button('RB')]),
    );
  }

  function renderDefensePicker() {
    const button = (id) => {
      const p = DEFENSE.positions[id];
      const kid = kidFor(id);
      return el('button', {
        type: 'button',
        class: `spot defender${id === state.pos ? ' active' : ''}`,
        'aria-pressed': String(id === state.pos),
        'aria-label': `${posName(id)}${kid ? `, ${kid}` : ''}`,
        onclick: () => selectPos(id),
      }, [
        el('span', { class: 'spot-dot', text: p.short }),
        el('span', { class: 'spot-kid', text: kid || '' }),
        el('span', { class: 'spot-name', text: p.side ? `${p.name} ${p.side}` : p.name }),
      ]);
    };
    // Safeties deep on top, the three up front below, like looking down the field.
    $('picker').replaceChildren(
      el('div', { class: 'picker-row' }, ['SL', 'SR'].map(button)),
      el('div', { class: 'picker-row' }, ['CBL', 'MLB', 'CBR'].map(button)),
    );
  }

  function renderDefenseCard(card) {
    const id = state.pos;
    const p = DEFENSE.positions[id];
    const role = DEFENSE.roles[id];
    const kid = kidFor(id);
    card.replaceChildren(
      el('div', { class: 'role-head' }, [
        el('span', { class: 'role-dot defender', text: p.short }),
        el('div', {}, [
          el('h3', { text: posName(id) }),
          el('p', { class: 'spot-line', text: kid ? `${kid} plays ${posName(id)} on defense in ${seriesLabel()}.` : `${DEFENSE.name} defense.` }),
        ]),
      ]),
      el('button', { type: 'button', class: 'btn btn-read', onclick: () => speakRole(id, role, role.align), text: '\u{1F50A} Read it to me' }),
      step(1, 'Where do I stand?', el('ul', {}, role.align.kid.map((t) => el('li', { text: t })))),
      step(2, 'What is my job?', el('p', { class: 'job', text: role.job })),
      step(3, 'How do I do it?', el('ol', { class: 'how' }, role.how.map((t) => el('li', { text: t })))),
      DEFENSE.draft ? el('p', { class: 'tip', text: '\u{1F6A7} Coach is still building the defensive jobs. The alignment is set.' }) : null,
      el('details', { class: 'more' }, [
        el('summary', { text: "\u{1F4CB} For parents: Coach's exact words" }),
        el('p', { text: `Alignment: ${role.align.coach}` }),
      ]),
    );
  }

  function renderRoleCard() {
    const card = $('role-card');
    if (!state.pos) {
      card.replaceChildren(el('p', { class: 'role-empty', text: '\u{1F446} Tap a spot above (or a player on the field) to see where to stand, what to do, and how to do it.' }));
      return;
    }
    if (isDefense()) {
      renderDefenseCard(card);
      return;
    }
    const id = state.pos;
    const pos = POSITIONS[id];
    const role = getRole(state.play, state.variation, id, isFlipped());
    const align = ALIGNMENT[id];
    const drill = PRACTICE[pos.group];
    const isRunPlay = state.variation.kind === 'run';
    const showRunTip = isRunPlay && (pos.group === 'receiver' || pos.group === 'center') && !isSonicRunner(id);

    const header = el('div', { class: 'role-head' }, [
      el('span', { class: `role-dot${isSonicRunner(id) ? ' sonic' : ''}`, text: `#${pos.num}` }),
      el('div', {}, [
        el('h3', { text: `${posName(id)}` }),
        el('p', { class: 'spot-line', text: `${kidFor(id)} is #${pos.num} in ${seriesLabel()}. The number is the same on every play.` }),
        isSonicRunner(id) ? el('p', { class: 'sonic-tag', text: '⚡ You are SONIC on this play!' }) : el('p', { class: 'muted', text: state.variation.name }),
      ]),
      pos.photo ? el('img', { class: 'role-photo', src: pos.photo, alt: `A Chargers ${pos.name}` }) : null,
    ]);

    const readBtn = el('button', { type: 'button', class: 'btn btn-read', onclick: () => speakRole(id, role, align), text: '\u{1F50A} Read it to me' });

    card.replaceChildren(
      header,
      readBtn,
      step(1, 'Where do I stand?', el('ul', {}, align.kid.map((t) => el('li', { text: t })))),
      step(2, 'What is my job?', el('p', { class: 'job', text: role.job })),
      step(3, 'How do I do it?', el('ol', { class: 'how' }, role.how.map((t) => el('li', { text: t })))),
      showRunTip ? el('p', { class: 'tip', text: `\u{1F4A1} ${RUN_TIP}` }) : null,
      el('details', { class: 'more' }, [
        el('summary', { text: `\u{1F3E1} Practice at home: ${drill.title}` }),
        el('ol', {}, drill.steps.map((t) => el('li', { text: t }))),
      ]),
      el('details', { class: 'more' }, [
        el('summary', { text: "\u{1F4CB} For parents: Coach's exact words" }),
        el('p', { text: `Alignment: ${align.coach}` }),
        ...role.coach.map((t) => el('p', { text: t })),
      ]),
    );
  }

  function step(n, title, body) {
    return el('section', { class: 'step' }, [el('h4', {}, [el('span', { class: 'step-n', text: String(n) }), el('span', { text: title })]), body]);
  }

  // ---------- Play call scribe: the huddle call, word for word ----------

  // Play name as the QB says it. Runs add the direction unless the name has it (Sonic Run Left).
  function playCallName() {
    const v = state.variation;
    if (v.callName) return v.callName(state.left);
    if (v.kind === 'pass' || v.direction) return v.name;
    return `${v.name} ${state.left ? 'Left' : 'Right'}`;
  }

  // The three huddle lines: play x2, cadence x2, then the break.
  function huddleLines() {
    const play = state.target === ANY ? `${playCallName()}, QB's choice.` : `${playCallName()} ${kidFor(state.scene.carrier)}.`;
    const count = CADENCES.find((c) => c.id === state.cadence).call;
    const cadence = `${count.charAt(0).toUpperCase()}${count.slice(1)}.`;
    return [
      { label: 'Play x2', words: `${play} ${play}` },
      { label: 'Cadence x2', words: `${cadence} ${cadence}` },
      { label: 'Break', words: 'Ready, break!' },
    ];
  }

  function renderScribe() {
    $('scribe').hidden = isDefense();
    if (isDefense()) return;
    const lines = huddleLines();
    $('scribe').replaceChildren(
      el('p', { class: 'scribe-label', text: 'Huddle Call (What the QB Says)' }),
      el('ol', { class: 'scribe-lines' }, lines.map((line, i) =>
        el('li', {}, [
          el('span', { class: 'scribe-tag', text: line.label }),
          el('span', { class: 'scribe-call', text: `“${line.words}”` }),
          i === lines.length - 1 ? el('span', { class: 'scribe-clap', text: ' \u{1F44F} clap' }) : null,
        ]),
      )),
      el('button', { type: 'button', class: 'btn btn-say', onclick: () => sayCall(lines.map((l) => l.words).join(' ')), text: '\u{1F50A} Say it' }),
    );
  }

  function sayCall(call) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(call);
    utter.rate = 0.95;
    speechSynthesis.speak(utter);
  }

  // ---------- Find your player: one kid across every series ----------

  // Where a kid is in each series: break, offense spot number, or defense spot.
  function kidSeries(kid) {
    return state.plan.series.map((series, index) => {
      const onBreak = GamePlan.breaks(series, state.size, Roster.KIDS).includes(kid);
      if (series.side === 'D') {
        return { index, side: 'D', onBreak, def: onBreak ? null : Object.keys(series.d).find((p) => series.d[p] === kid) };
      }
      const num = series.o.indexOf(kid) + 1;
      return { index, side: 'O', onBreak, num, id: idForNum(num) };
    });
  }

  function spotShort(x) {
    if (x.onBreak) return 'break';
    return x.side === 'O' ? `#${x.num} ${POSITIONS[x.id].short}` : posLabel(x.def);
  }

  function renderKids() {
    $('kid-picker').replaceChildren(...Roster.KIDS.map((kid) =>
      el('button', {
        type: 'button',
        class: `chip kid-chip${kid === state.kid ? ' active' : ''}`,
        'aria-pressed': String(kid === state.kid),
        onclick: () => selectKid(kid),
        text: kid,
      }),
    ));
    const card = $('kid-card');
    if (!state.kid) {
      card.replaceChildren(el('p', { class: 'muted', text: "Tap your player's name to see their spot in each series and what to practice." }));
      return;
    }
    const spots = kidSeries(state.kid);
    const current = spots[state.series];
    const offense = spots.find((x) => x.side === 'O' && !x.onBreak);
    const drill = PRACTICE[POSITIONS[offense ? offense.id : 'QB'].group];
    card.replaceChildren(
      seriesCard(current),
      el('div', { class: 'kid-other' }, [
        el('span', { class: 'kid-other-label', text: 'Every series:' }),
        ...spots.filter((x) => x !== current).map((x) => el('button', {
          type: 'button',
          class: 'chip chip-sm',
          onclick: () => setSeries(x.index),
          text: `${seriesLabel(x.index)}: ${spotShort(x)}`,
        })),
      ]),
      el('h3', { class: 'kid-practice-title', text: `What ${state.kid} should practice` }),
      el('div', { class: 'kid-practice' }, [
        el('h4', { text: `\u{1F3E1} ${drill.title}` }),
        el('ol', {}, drill.steps.map((t) => el('li', { text: t }))),
      ]),
    );
  }

  function seriesCard(x) {
    const label = `This game: ${seriesLabel(x.index)}`;
    if (x.onBreak) {
      return el('article', { class: 'kid-rotation' }, [
        el('div', { class: 'kid-rotation-head' }, [
          el('span', { class: 'role-dot break-dot', text: '\u{1F964}' }),
          el('div', {}, [el('p', { class: 'kid-rotation-label', text: label }), el('h4', { text: 'On break. Get a drink and cheer!' })]),
        ]),
      ]);
    }
    if (x.side === 'D') {
      return el('article', { class: 'kid-rotation' }, [
        el('div', { class: 'kid-rotation-head' }, [
          el('span', { class: 'role-dot defender', text: DEFENSE.positions[x.def].short }),
          el('div', {}, [el('p', { class: 'kid-rotation-label', text: label }), el('h4', { text: posName(x.def) })]),
        ]),
        el('ul', { class: 'kid-jobs' }, [el('li', {}, [el('b', { text: `${DEFENSE.name}: ` }), document.createTextNode(DEFENSE.roles[x.def].job)])]),
        el('button', { type: 'button', class: 'btn', onclick: () => showOnField(x.index, x.def), text: '\u{1F3C8} Show me on the field' }),
      ]);
    }
    const boom = PLAYS.find((p) => p.id === 'boom');
    const sonic = PLAYS.find((p) => p.id === 'sonic');
    const jobs = [
      ['Boom Pass', getRole(boom, boom.variations.find((v) => v.kind === 'pass'), x.id).job],
      ['Boom Handoff', getRole(boom, boom.variations.find((v) => v.group === 'handoff'), x.id).job],
      ['Sonic', getRole(sonic, sonic.variations[0], x.id).job],
    ];
    return el('article', { class: 'kid-rotation' }, [
      el('div', { class: 'kid-rotation-head' }, [
        el('span', { class: 'role-dot', text: `#${x.num}` }),
        el('div', {}, [el('p', { class: 'kid-rotation-label', text: label }), el('h4', { text: posName(x.id) })]),
      ]),
      el('ul', { class: 'kid-jobs' }, jobs.map(([play, job]) => el('li', {}, [el('b', { text: `${play}: ` }), document.createTextNode(job)]))),
      el('button', { type: 'button', class: 'btn', onclick: () => showOnField(x.index, x.id), text: '\u{1F3C8} Show me on the field' }),
    ]);
  }

  function renderTeam() {
    if (isDefense()) {
      $('team-list').replaceChildren(...DEFENSE.order.map((id) => {
        const kid = kidFor(id);
        return el('li', { class: id === state.pos ? 'active' : '' }, [
          el('button', { type: 'button', class: 'team-btn', onclick: () => selectPos(id) }, [
            el('span', { class: 'team-dot defender', text: DEFENSE.positions[id].short }),
            el('span', {}, [el('b', { text: `${posName(id)}${kid ? ` ${kid}` : ''}: ` }), document.createTextNode(DEFENSE.roles[id].job)]),
          ]),
        ]);
      }));
      return;
    }
    $('team-list').replaceChildren(
      ...ORDER.map((id) => {
        const role = getRole(state.play, state.variation, id, isFlipped());
        const out = sitsOut(id, state.size);
        const job = out ? `Sits out in ${state.size} v ${state.size}.` : role.job;
        return el('li', { class: `${id === state.pos ? 'active' : ''}${out ? ' out' : ''}` }, [
          el('button', { type: 'button', class: 'team-btn', disabled: out ? 'disabled' : null, onclick: () => selectPos(id) }, [
            el('span', { class: `team-dot${isSonicRunner(id) ? ' sonic' : ''}`, text: String(POSITIONS[id].num) }),
            el('span', {}, [el('b', { text: `${posLabel(id)} ${kidFor(id)}: ` }), document.createTextNode(job)]),
          ]),
        ]);
      }),
    );
  }

  function renderWristband() {
    document.querySelector('.wristband').hidden = isDefense();
    const v = state.variation;
    $('card-img').src = v.card;
    $('card-img').alt = `Wristband card for ${v.name}`;
    $('card-note').textContent = v.cardNote || 'This is the picture on the wristband. The field above moves the same way.';
  }

  function renderGlossary() {
    $('glossary').replaceChildren(...GLOSSARY.flatMap(([term, def]) => [el('dt', { text: term }), el('dd', { text: def })]));
  }

  // ---------- read aloud ----------

  function speakRole(id, role, align) {
    if (!('speechSynthesis' in window)) {
      alert('Sorry, this browser cannot read out loud.');
      return;
    }
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      return;
    }
    const clean = (t) => t.replace(/[\p{Extended_Pictographic}️↔-➿⬅-⬇]/gu, '').trim();
    const kid = kidFor(id);
    const who = POSITIONS[id] ? `${kid}, number ${POSITIONS[id].num}.` : kid ? `${kid}.` : '';
    const lines = [
      `${who} ${posName(id)}.`,
      'Where do I stand?', ...align.kid,
      'What is my job?', role.job,
      'How do I do it?', ...role.how,
    ].map(clean);
    const utter = new SpeechSynthesisUtterance(lines.join(' '));
    utter.rate = 0.9;
    speechSynthesis.speak(utter);
  }

  // ---------- Game plan sidebar: series, breaks, lineups ----------

  const planOpts = () => ({
    size: state.size,
    defOrder: DEFENSE.order,
    groupOf: Object.fromEntries(DEFENSE.order.map((id) => [id, DEFENSE.positions[id].group])),
    prefs: Roster.DEFENSE_PREFS,
    rotations: Roster.ROTATIONS,
  });

  function defaultPlan() {
    if (GamePlan.isValid(Roster.GAME_PLAN, Roster.KIDS, DEFENSE.order)) {
      return GamePlan.repeatPattern(Roster.GAME_PLAN, Math.max(GamePlan.DEFAULT_SERIES, Roster.GAME_PLAN.series.length));
    }
    return GamePlan.autoPlan(Roster.KIDS, planOpts());
  }

  function loadPlan() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(PLAN_KEY));
    } catch (err) {
      console.warn('Could not read the saved game plan on this device:', err.message);
    }
    const current = saved && saved.base === GamePlan.fingerprint(Roster.GAME_PLAN);
    state.plan = current && GamePlan.isValid(saved, Roster.KIDS, DEFENSE.order) ? { series: saved.series } : defaultPlan();
  }

  function savePlan() {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify({ series: state.plan.series, base: GamePlan.fingerprint(Roster.GAME_PLAN) }));
    } catch (err) {
      console.warn('Could not save the game plan on this device:', err.message);
    }
  }

  // A shared link (?plan=...) replaces this device's plan.
  function importSharedPlan(text) {
    if (!text) return;
    const plan = GamePlan.decode(text);
    if (!GamePlan.isValid(plan, Roster.KIDS, DEFENSE.order)) {
      console.warn('The shared game plan link is not valid. Keeping the plan on this device.');
      return;
    }
    state.plan = plan;
    savePlan();
  }

  function changePlan(next) {
    state.plan = next;
    state.series = Math.min(state.series, state.plan.series.length - 1);
    savePlan();
    renderAll();
  }

  function changeSeries(i, fn) {
    changePlan({ series: state.plan.series.map((x, j) => (j === i ? fn(x) : x)) });
  }

  function lineupList(rows) {
    return el('ul', { class: 'gp-lineup' }, rows.map(([label, kid]) =>
      el('li', {}, [el('span', { class: 'gp-pos', text: label }), el('span', { class: 'gp-kid', text: kid })]),
    ));
  }

  function breaksAt(i) {
    return GamePlan.breaks(state.plan.series[i], state.size, Roster.KIDS);
  }

  function breakNames(i) {
    const names = breaksAt(i);
    return names.length ? names.join(', ') : 'Nobody';
  }

  function lineupRows(series) {
    if (series.side === 'D') return DEFENSE.order.map((id) => [posLabel(id), series.d[id]]);
    return onField().map((id) => [posLabel(id), series.o[POSITIONS[id].num - 1]]);
  }

  function renderGamePlan() {
    const total = state.plan.series.length;
    const series = currentSeries();
    const next = state.series + 1 < total ? state.series + 1 : null;
    const backIn = next === null ? [] : breaksAt(state.series).filter((k) => !breaksAt(next).includes(k));
    $('gp-toggle').textContent = `\u{1F4CB} ${seriesLabel()} \u00B7 Break: ${breakNames(state.series)}`;
    $('gp-now').replaceChildren(
      el('div', { class: 'gp-nav' }, [
        el('button', { type: 'button', class: 'btn gp-step', 'aria-label': 'Previous series', disabled: state.series === 0 ? 'disabled' : null, onclick: () => setSeries(state.series - 1), text: '\u25C0' }),
        el('div', { class: 'gp-title' }, [
          el('b', { class: `gp-side-text gp-side-text-${series.side}`, text: seriesLabel() }),
          el('span', { class: 'muted gp-count', text: `Series ${state.series + 1} of ${total}` }),
        ]),
        el('button', { type: 'button', class: 'btn gp-step', 'aria-label': 'Next series', disabled: next === null ? 'disabled' : null, onclick: () => setSeries(state.series + 1), text: '\u25B6' }),
      ]),
      optionGroup('Players:', TEAM_SIZES.map((n) => ({ label: `${n} v ${n}`, active: state.size === n, onclick: () => setSize(n) }))),
      el('p', { class: 'gp-break' }, [el('b', { text: '\u{1F964} On break: ' }), document.createTextNode(breakNames(state.series))]),
      el('h3', { class: 'gp-sub', text: series.side === 'O' ? 'Offense' : `Defense (${DEFENSE.name})` }),
      lineupList(lineupRows(series)),
      el('p', { class: 'muted gp-next', text: next === null
        ? 'Last series in the plan. Add more in Edit the plan.'
        : `Next: ${seriesLabel(next)}. Break: ${breakNames(next)}.${backIn.length ? ` Back in: ${backIn.join(', ')}.` : ''}` }),
    );
    renderPlanEditor();
  }

  // Option labels show Coach's defensive spots: a star is where the kid mostly plays.
  function kidSelect(label, value, options, onchange) {
    return el('label', { class: 'gp-field' }, [
      el('span', { class: 'gp-pos', text: label }),
      el('select', { onchange: (e) => onchange(e.target.value) }, options.map(([k, text]) => el('option', { value: k, selected: k === value ? 'selected' : null, text }))),
    ]);
  }

  function defenseOptions(pos) {
    const group = DEFENSE.positions[pos].group;
    return Roster.KIDS.map((k) => {
      const fit = (Roster.DEFENSE_PREFS[k] || {})[group] || 0;
      return [k, `${k}${fit === 3 ? ' \u2605' : fit ? '' : ' (not usual)'}`];
    });
  }

  function renderPlanEditor() {
    const total = state.plan.series.length;
    const plain = Roster.KIDS.map((k) => [k, k]);
    const cards = state.plan.series.map((series, i) => {
      const fields = series.side === 'O'
        ? Array.from({ length: GamePlan.SPOTS }, (_, n) => n + 1).map((num) =>
          kidSelect(num <= state.size ? posLabel(idForNum(num)) : 'Break', series.o[num - 1], plain, (kid) => changeSeries(i, (x) => GamePlan.setOffense(x, num, kid))))
        : DEFENSE.order.map((pos) =>
          kidSelect(posLabel(pos), series.d[pos], defenseOptions(pos), (kid) => changeSeries(i, (x) => GamePlan.setDefense(x, pos, kid))));
      return el('details', { class: 'gp-series', open: i === state.series ? 'open' : null }, [
        el('summary', { text: `${seriesLabel(i)} \u00B7 Break: ${breakNames(i)}` }),
        el('p', { class: 'gp-sub', text: series.side === 'O' ? 'Picking a kid swaps them' : 'Picking a kid swaps them. \u2605 = where they mostly play' }),
        ...fields,
      ]);
    });
    $('gp-editor').replaceChildren(
      el('div', { class: 'gp-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: autoFillPlan, text: '\u{1F504} Auto-fill fair breaks' }),
        el('button', { type: 'button', class: 'btn', onclick: flipStart, text: `\u21C5 Start on ${state.plan.series[0].side === 'O' ? 'defense' : 'offense'}` }),
        el('button', { type: 'button', class: 'btn', onclick: repeatToFull, text: `\u{1F501} Repeat pattern to ${GamePlan.DEFAULT_SERIES}` }),
        el('button', { type: 'button', class: 'btn', onclick: addSeries, text: '\u2795 Add series' }),
        el('button', { type: 'button', class: 'btn', disabled: total <= 1 ? 'disabled' : null, onclick: removeLastSeries, text: '\u2796 Remove last' }),
        el('button', { type: 'button', class: 'btn', onclick: sharePlan, text: '\u{1F517} Share plan link' }),
        el('a', { class: 'btn', href: 'summary.html', text: '\u{1F4C4} Summary' }),
        el('div', { class: 'gp-share', id: 'gp-share' }),
      ]),
      ...backToBackWarnings(),
      ...cards,
    );
  }

  // Someone sitting two series in a row (often where a repeated pattern starts over).
  function backToBackWarnings() {
    return GamePlan.backToBack(state.plan, state.size, Roster.KIDS).map(({ at, kids }) =>
      el('p', { class: 'gp-warn', text: `\u26A0\uFE0F ${kids.join(' and ')} sit${kids.length === 1 ? 's' : ''} ${seriesLabel(at - 1)} and ${seriesLabel(at)} in a row.` }));
  }

  // Coach's first series, repeated to fill 8 offense and 8 defense series.
  function repeatToFull() {
    changePlan(GamePlan.repeatPattern(state.plan, GamePlan.DEFAULT_SERIES));
  }

  function autoFillPlan() {
    if (!confirm('Replace every series with a fair rotation? Breaks go between series, nobody sits twice in a row, and defense follows the spots each kid plays.')) return;
    changePlan(GamePlan.autoPlan(Roster.KIDS, { ...planOpts(), count: Math.max(state.plan.series.length, 2), start: state.plan.series[0].side }));
  }

  // Coin toss went the other way: rebuild the plan starting on the other side.
  function flipStart() {
    const start = state.plan.series[0].side === 'O' ? 'D' : 'O';
    changePlan(GamePlan.autoPlan(Roster.KIDS, { ...planOpts(), count: state.plan.series.length, start }));
    setSeries(0);
  }

  // The new series is the other side, with the kids from the previous break back in.
  function addSeries() {
    const list = state.plan.series;
    const auto = GamePlan.autoPlan(Roster.KIDS, { ...planOpts(), count: list.length + 1, start: list[0].side });
    changePlan({ series: [...list, auto.series[list.length]] });
  }

  function removeLastSeries() {
    if (state.plan.series.length <= 1) return;
    changePlan({ series: state.plan.series.slice(0, -1) });
  }

  function sharePlan() {
    const link = `${location.href.split('#')[0]}#${state.play.id}/${state.variation.id}?plan=${GamePlan.encode(state.plan)}`;
    const input = el('input', { type: 'text', readonly: 'readonly', value: link, 'aria-label': 'Game plan link' });
    const note = el('p', { class: 'muted', text: 'Copy this link and text it to parents or coaches. Opening it loads this plan.' });
    $('gp-share').replaceChildren(input, note);
    input.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        () => { note.textContent = 'Link copied. Text it to parents or coaches. Opening it loads this plan.'; },
        (err) => console.warn('Could not copy the link automatically:', err.message),
      );
    }
  }

  function setGamePlanOpen(open) {
    document.body.classList.toggle('gp-open', open);
    $('gp-toggle').setAttribute('aria-expanded', String(open));
  }

  // ---------- selection ----------

  function rebuildScene() {
    const drop = ORDER.filter((id) => sitsOut(id, state.size));
    const cadence = CADENCES.find((c) => c.id === state.cadence);
    const target = state.target && state.target !== ANY ? state.target : undefined;
    state.scene = Engine.buildScene(state.variation, { flip: isFlipped(), target, drop, late: state.late, cadence });
    if (state.scene.warnings.length) console.warn('Play timing:', state.scene.warnings);
    drawField();
    resetAnimation();
    document.querySelector('.controls').hidden = isDefense();
    document.querySelector('.hint').textContent = isDefense()
      ? '\u{1F446} Tap a defender to see where they line up.'
      : '\u{1F446} Tap any player to highlight them.';
  }

  function renderAll() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    renderCall();
    renderSummary();
    renderKids();
    renderTeamSize();
    renderPicker();
    renderRoleCard();
    renderTeam();
    renderWristband();
    renderGamePlan();
    rebuildScene();
    renderScribe();
    writeHash();
  }

  // The version of these that matches the called direction (Sonic), or the first.
  function sameSide(list) {
    const dir = state.left ? 'left' : 'right';
    return list.find((x) => !x.direction || x.direction === dir) || list[0];
  }

  // Keep the called direction when switching plays (Sonic opens Run Left if Left is called).
  function selectPlay(play) {
    state.play = play;
    const dir = state.left ? 'left' : 'right';
    selectVariation(play.variations.find((v) => v.direction === dir) || play.variations[0]);
  }

  function selectVariation(v) {
    state.variation = v;
    state.target = v.targets ? v.defaultTarget : null;
    state.late = false;
    if (v.direction) state.left = v.direction === 'left';
    renderAll();
  }

  function setSide(left) {
    state.left = left;
    renderAll();
  }

  function setSize(n) {
    state.size = n;
    if (!isDefense() && state.pos && sitsOut(state.pos, n)) state.pos = null;
    if (state.target && state.target !== ANY && sitsOut(state.target, n)) {
      state.target = state.variation.defaultTarget;
      state.late = false;
    }
    renderAll();
  }

  function setLate(late) {
    state.late = late;
    renderAll();
  }

  function setTarget(id) {
    state.target = id;
    state.late = false;
    renderAll();
  }

  function setCadence(id) {
    state.cadence = id;
    renderAll();
  }

  // Rolling to the next series also switches Coach calls to that side of the ball.
  function setSeries(i) {
    state.series = Math.max(0, Math.min(i, state.plan.series.length - 1));
    const side = currentSeries().side === 'D' ? 'defense' : 'offense';
    if (side !== state.side) {
      state.side = side;
      state.pos = null;
    }
    renderAll();
  }

  function selectKid(kid) {
    state.kid = state.kid === kid ? null : kid;
    $('find-player').open = true;
    renderKids();
    writeHash();
  }

  // Jump from a kid's series card to that spot on the field.
  function showOnField(series, id) {
    state.side = POSITIONS[id] ? 'offense' : 'defense';
    state.pos = null;
    state.series = series;
    renderAll();
    if (state.pos !== id) selectPos(id);
    const call = $('call');
    if (call.scrollIntoView) call.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setSideOfBall(side) {
    state.side = side;
    state.pos = null;
    renderAll();
  }

  function selectPos(id) {
    if (!isDefense() && sitsOut(id, state.size)) return;
    state.pos = state.pos === id ? null : id;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    renderPicker();
    renderRoleCard();
    renderTeam();
    highlight();
    writeHash();
  }

  // ---------- boot ----------

  $('btn-play').addEventListener('click', () => setPlaying(!state.playing));
  $('btn-reset').addEventListener('click', resetAnimation);
  $('btn-speed').addEventListener('click', (e) => {
    const slow = state.speed !== SLOW;
    state.speed = slow ? SLOW : 1;
    e.currentTarget.setAttribute('aria-pressed', String(slow));
    e.currentTarget.innerHTML = slow ? '&#x1F422; Slow' : '&#x1F407; Fast';
    e.currentTarget.title = slow ? 'Slow motion is on' : 'Full speed';
  });
  window.addEventListener('hashchange', () => {
    readHash();
    renderAll();
  });

  $('gp-toggle').addEventListener('click', () => setGamePlanOpen(!document.body.classList.contains('gp-open')));
  $('gp-close').addEventListener('click', () => setGamePlanOpen(false));

  loadPlan();
  readHash();
  if (state.kid) $('find-player').open = true;
  renderGlossary();
  renderAll();
})();
