// Page wiring: reads Playbook data, draws the field, runs the animation.
(function () {
  const { PLAYS, ORDER, POSITIONS, ALIGNMENT, PRACTICE, GLOSSARY, RUN_TIP, TEAM_SIZES, sitsOut, getRole, CADENCES, DEFAULT_CADENCE } = window.Playbook;
  const Engine = window.PlayEngine;
  const Roster = window.Roster;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Field drawing scale: yards to SVG units. Matches viewBox 440 x 322.
  const SX = 20;
  const SY = 14;
  const X = (x) => (x + 11) * SX;
  const Y = (y) => (16.5 - y) * SY;

  const SLOW = 0.55;
  const $ = (id) => document.getElementById(id);

  const state = {
    play: PLAYS[0],
    variation: PLAYS[0].variations[0],
    pos: null,
    left: true, // Direction defaults to Left
    size: 7,
    rotation: 1,
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

  // ---------- URL state: #play/variation/POS?side=left&to=IRR&late=1&n=6 ----------

  function readHash() {
    const [route, query = ''] = location.hash.replace(/^#/, '').split('?');
    const [playId, varId, pos] = route.split('/');
    const params = new URLSearchParams(query);
    const play = PLAYS.find((p) => p.id === playId) || PLAYS[0];
    const variation = play.variations.find((v) => v.id === varId) || play.variations[0];
    state.play = play;
    state.variation = variation;
    state.pos = ORDER.includes(pos) ? pos : null;
    state.left = variation.direction ? variation.direction === 'left' : params.get('side') !== 'right';
    state.cadence = CADENCES.some((c) => c.id === params.get('c')) ? params.get('c') : DEFAULT_CADENCE;
    const rotation = Number(params.get('r'));
    state.rotation = Roster.ROTATIONS.some((r) => r.id === rotation) ? rotation : 1;
    state.kid = Roster.KIDS.includes(params.get('kid')) ? params.get('kid') : null;
    const size = Number(params.get('n'));
    state.size = TEAM_SIZES.includes(size) ? size : 7;
    if (state.pos && sitsOut(state.pos, state.size)) state.pos = null;
    const to = params.get('to');
    state.target = variation.targets ? (variation.targets.includes(to) && !sitsOut(to, state.size) ? to : variation.defaultTarget) : null;
    state.late = params.get('late') === '1' && !!lateRead();
  }

  // The 1st/2nd read labels for the current pass target, if it has two timings.
  function lateRead() {
    return state.target && (state.variation.lateReads || {})[state.target];
  }

  function writeHash() {
    const parts = [state.play.id, state.variation.id];
    if (state.pos) parts.push(state.pos);
    const params = new URLSearchParams();
    if (!state.left && state.variation.flipActors) params.set('side', 'right');
    if (state.late) params.set('late', '1');
    if (state.size !== 7) params.set('n', String(state.size));
    if (state.rotation !== 1) params.set('r', String(state.rotation));
    if (state.cadence !== DEFAULT_CADENCE) params.set('c', state.cadence);
    if (state.kid) params.set('kid', state.kid);
    if (state.target && state.target !== state.variation.defaultTarget) params.set('to', state.target);
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

  function posLabel(id) {
    const p = POSITIONS[id];
    return `#${p.num} ${p.side ? `${p.short} (${p.side})` : p.short}`;
  }

  function posName(id) {
    const p = POSITIONS[id];
    return p.side ? `${p.name} (${p.side})` : p.name;
  }

  // Kid playing this spot in the selected rotation.
  function kidFor(id) {
    return Roster.kidAt(state.rotation, POSITIONS[id].num);
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

  function renderCall() {
    const play = state.play;
    const v = state.variation;
    const rows = [
      playRow(),
      callRow('Type', play.groups.map((g) => ({
        label: g.name,
        active: v.group === g.id,
        onclick: () => selectVariation(play.variations.find((x) => x.group === g.id)),
      }))),
    ];
    const kinds = play.variations.filter((x) => x.group === v.group && x.short);
    if (kinds.length > 1) {
      rows.push(callRow('Variation', kinds.map((x) => ({ label: x.short, active: x === v, onclick: () => selectVariation(x) }))));
    }
    if (v.targets) {
      rows.push(callRow('Variation', v.targets.filter((id) => !sitsOut(id, state.size)).sort(byFieldX).map((id) => ({
        label: targetLabel(id),
        active: state.target === id,
        onclick: () => setTarget(id),
      }))));
      const read = lateRead();
      if (read) {
        rows.push(callRow('Read', [
          { label: `1st: ${read.first}`, active: !state.late, onclick: () => setLate(false) },
          { label: `2nd: ${read.second}`, active: state.late, onclick: () => setLate(true) },
        ]));
      }
    }
    const directions = directionButtons();
    if (directions) rows.push(callRow('Direction', directions));
    rows.push(callRow('Cadence', CADENCES.map((c) => ({ label: c.label, active: state.cadence === c.id, onclick: () => setCadence(c.id) }))));
    rows.push(callRow('Game rotation', Roster.ROTATIONS.map((r) => ({ label: String(r.id), active: state.rotation === r.id, onclick: () => setRotation(r.id) }))));
    $('call').replaceChildren(...rows);
    $('tagline').textContent = play.tagline;
  }

  // Sonic picks its Left or Right version; Boom mirrors the QB and RB.
  function directionButtons() {
    const v = state.variation;
    const LEFT = '⬅️ Left';
    const RIGHT = 'Right ➡️';
    if (v.direction) {
      const pick = (dir) => state.play.variations.find((x) => x.group === v.group && x.direction === dir);
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
    return el('div', { class: 'call-row call-row-play', 'data-row': 'play' }, [
      el('span', { class: 'call-label', text: 'Play' }),
      el('div', { class: 'play-tabs', role: 'group', 'aria-label': 'Play' }, PLAYS.map((p) =>
        el('button', {
          type: 'button',
          class: `chip play-tab${p === state.play ? ' active' : ''}`,
          'aria-pressed': String(p === state.play),
          'aria-label': p.name,
          onclick: () => selectPlay(p),
        }, [el('span', { class: 'tab-icon', 'aria-hidden': 'true', text: p.icon }), el('span', { class: 'tab-name', text: p.name.toUpperCase() })]),
      )),
    ]);
  }

  function callRow(label, buttons) {
    return el('div', { class: 'call-row', 'data-row': label.toLowerCase() }, [
      el('span', { class: 'call-label', text: label }),
      el('div', { class: 'call-chips', role: 'group', 'aria-label': label }, buttons.map((b) =>
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
    const v = state.variation;
    const node = $('summary');
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

  function highlight() {
    const field = $('field');
    field.classList.toggle('has-me', !!state.pos);
    for (const id of onField()) {
      els.actors[id].classList.toggle('me', id === state.pos);
      els.actors[id].classList.toggle('sonic', isSonicRunner(id));
      const route = els.routes[id];
      if (!route) continue;
      route.classList.toggle('me', id === state.pos);
      route.setAttribute('marker-end', id === state.pos ? 'url(#arrow-me)' : 'url(#arrow)');
    }
  }

  function update() {
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
        el('span', { class: 'spot-name', text: out ? 'sits out' : p.side ? `${p.short} ${p.side}` : p.short }),
      ]);
    };
    $('picker').replaceChildren(
      el('div', { class: 'picker-row' }, ['ORL', 'IRL', 'C', 'IRR', 'ORR'].map(button)),
      el('div', { class: 'picker-row' }, [button('QB')]),
      el('div', { class: 'picker-row' }, [button('RB')]),
    );
  }

  function renderRoleCard() {
    const card = $('role-card');
    if (!state.pos) {
      card.replaceChildren(el('p', { class: 'role-empty', text: '\u{1F446} Tap a spot above (or a player on the field) to see where to stand, what to do, and how to do it.' }));
      return;
    }
    const id = state.pos;
    const pos = POSITIONS[id];
    const role = getRole(state.play, state.variation, id);
    const align = ALIGNMENT[id];
    const drill = PRACTICE[pos.group];
    const isRunPlay = state.variation.kind === 'run';
    const showRunTip = isRunPlay && (pos.group === 'receiver' || pos.group === 'center') && !isSonicRunner(id);

    const header = el('div', { class: 'role-head' }, [
      el('span', { class: `role-dot${isSonicRunner(id) ? ' sonic' : ''}`, text: `#${pos.num}` }),
      el('div', {}, [
        el('h3', { text: `${posName(id)}` }),
        el('p', { class: 'spot-line', text: `${kidFor(id)} is #${pos.num} in Rotation ${state.rotation}. The number is the same on every play.` }),
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
    if (v.kind === 'pass' || v.direction) return v.name;
    return `${v.name} ${state.left ? 'Left' : 'Right'}`;
  }

  // The three huddle lines: play x2, cadence x2, then the break.
  function huddleLines() {
    const play = `${playCallName()} ${kidFor(state.scene.carrier)}.`;
    const count = CADENCES.find((c) => c.id === state.cadence).call;
    const cadence = `${count.charAt(0).toUpperCase()}${count.slice(1)}.`;
    return [
      { label: 'Play x2', words: `${play} ${play}` },
      { label: 'Cadence x2', words: `${cadence} ${cadence}` },
      { label: 'Break', words: 'Ready, break!' },
    ];
  }

  function renderScribe() {
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

  // ---------- Find your player: one kid across every rotation ----------

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
      card.replaceChildren(el('p', { class: 'muted', text: "Tap your player's name to see their spot in each rotation and what to practice." }));
      return;
    }
    const spots = Roster.spotsFor(state.kid).map((s) => ({ ...s, id: idForNum(s.num) }));
    const current = spots.find((s) => s.rotation === state.rotation);
    const others = spots.filter((s) => s !== current);
    const drill = PRACTICE[POSITIONS[current.id].group];
    card.replaceChildren(
      rotationCard(current),
      el('div', { class: 'kid-other' }, [
        el('span', { class: 'kid-other-label', text: 'Other rotations:' }),
        ...others.map((s) => el('button', {
          type: 'button',
          class: 'chip chip-sm',
          onclick: () => setRotation(s.rotation),
          text: `Rotation ${s.rotation}: #${s.num} ${POSITIONS[s.id].short}`,
        })),
      ]),
      el('h3', { class: 'kid-practice-title', text: `What ${state.kid} should practice for Rotation ${state.rotation}` }),
      el('div', { class: 'kid-practice' }, [
        el('h4', { text: `\u{1F3E1} ${drill.title}` }),
        el('ol', {}, drill.steps.map((t) => el('li', { text: t }))),
      ]),
    );
  }

  function rotationCard({ rotation, num, id }) {
    const boom = PLAYS.find((p) => p.id === 'boom');
    const sonic = PLAYS.find((p) => p.id === 'sonic');
    const jobs = [
      ['Boom Pass', getRole(boom, boom.variations.find((v) => v.kind === 'pass'), id).job],
      ['Boom Handoff', getRole(boom, boom.variations.find((v) => v.group === 'handoff'), id).job],
      ['Sonic', getRole(sonic, sonic.variations[0], id).job],
    ];
    const sits = TEAM_SIZES.filter((n) => sitsOut(id, n)).map((n) => `${n} v ${n}`);
    return el('article', { class: 'kid-rotation' }, [
      el('div', { class: 'kid-rotation-head' }, [
        el('span', { class: 'role-dot', text: `#${num}` }),
        el('div', {}, [
          el('p', { class: 'kid-rotation-label', text: `This game: Rotation ${rotation}` }),
          el('h4', { text: posName(id) }),
        ]),
      ]),
      el('ul', { class: 'kid-jobs' }, jobs.map(([play, job]) => el('li', {}, [el('b', { text: `${play}: ` }), document.createTextNode(job)]))),
      sits.length ? el('p', { class: 'kid-sits', text: `Sits out in ${sits.join(' and ')}.` }) : null,
      el('button', { type: 'button', class: 'btn', onclick: () => showOnField(rotation, id), text: '\u{1F3C8} Show me on the field' }),
    ]);
  }

  function renderTeam() {
    $('team-list').replaceChildren(
      ...ORDER.map((id) => {
        const role = getRole(state.play, state.variation, id);
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
    const lines = [
      `${kidFor(id)}, number ${POSITIONS[id].num}. ${posName(id)}.`,
      'Where do I stand?', ...align.kid,
      'What is my job?', role.job,
      'How do I do it?', ...role.how,
    ].map(clean);
    const utter = new SpeechSynthesisUtterance(lines.join(' '));
    utter.rate = 0.9;
    speechSynthesis.speak(utter);
  }

  // ---------- selection ----------

  function rebuildScene() {
    const drop = ORDER.filter((id) => sitsOut(id, state.size));
    const cadence = CADENCES.find((c) => c.id === state.cadence);
    state.scene = Engine.buildScene(state.variation, { flip: state.left && !!state.variation.flipActors, target: state.target || undefined, drop, late: state.late, cadence });
    if (state.scene.warnings.length) console.warn('Play timing:', state.scene.warnings);
    drawField();
    resetAnimation();
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
    rebuildScene();
    renderScribe();
    writeHash();
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
    if (state.pos && sitsOut(state.pos, n)) state.pos = null;
    if (state.target && sitsOut(state.target, n)) {
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

  function setRotation(id) {
    state.rotation = id;
    renderAll();
  }

  function selectKid(kid) {
    state.kid = state.kid === kid ? null : kid;
    $('find-player').open = true;
    renderKids();
    writeHash();
  }

  // Jump from a kid's rotation card to that spot on the field.
  function showOnField(rotation, id) {
    state.rotation = rotation;
    if (sitsOut(id, state.size)) state.size = 7;
    renderAll();
    if (state.pos !== id) selectPos(id);
    const call = $('call');
    if (call.scrollIntoView) call.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectPos(id) {
    if (sitsOut(id, state.size)) return;
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
    e.currentTarget.innerHTML = slow ? '&#x1F422; Slow motion' : '&#x1F407; Full speed';
  });
  window.addEventListener('hashchange', () => {
    readHash();
    renderAll();
  });

  readHash();
  if (state.kid) $('find-player').open = true;
  renderGlossary();
  renderAll();
})();
