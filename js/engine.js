// Play animation math. Pure functions, no DOM, so the same file runs in the
// browser (window.PlayEngine) and in Node tests (module.exports).
//
// Coordinates are in yards: x is left/right from the ball (right is +),
// y is distance from the line of scrimmage (downfield is +).
(function (root) {
  const SNAP_FLIGHT = 0.3;
  const HAND_FLIGHT = 0.15;
  const TOSS_FLIGHT = 0.45;
  const THROW_SPEED = 14; // yards per second
  const THROW_BASE = 0.25; // seconds added to every throw
  const CARRY_OFFSET = [0.4, -0.15];

  function dist(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  function lerp(a, b, f) {
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  const holdAt = (actor, i) => (actor.holds && actor.holds[i]) || 0;

  // Arrival time at each waypoint of an actor that runs at constant speed.
  // `holds` ({waypoint: seconds}) makes the runner stop and settle there first.
  function waypointTimes(actor) {
    const times = [actor.start];
    for (let i = 1; i < actor.path.length; i++) {
      times.push(times[i - 1] + holdAt(actor, i - 1) + dist(actor.path[i - 1], actor.path[i]) / actor.speed);
    }
    return times;
  }

  function positionAt(actor, t) {
    const pts = actor.path;
    const times = waypointTimes(actor);
    if (t <= times[0]) return pts[0].slice();
    for (let i = 1; i < pts.length; i++) {
      const leave = times[i - 1] + holdAt(actor, i - 1);
      if (t <= leave) return pts[i - 1].slice();
      if (t <= times[i]) {
        const span = times[i] - leave;
        return lerp(pts[i - 1], pts[i], span > 0 ? (t - leave) / span : 1);
      }
    }
    return pts[pts.length - 1].slice();
  }

  function endTime(actor) {
    const times = waypointTimes(actor);
    return times[times.length - 1];
  }

  function carryPosition(actor, t) {
    const p = positionAt(actor, t);
    return [p[0] + CARRY_OFFSET[0], p[1] + CARRY_OFFSET[1]];
  }

  // When a word of the cadence is said: words before the snap are spread evenly from 0 to the snap.
  function wordTime(cadence, word, snapAt) {
    const i = cadence ? cadence.preSnap.findIndex((w) => w.toLowerCase().startsWith(word.toLowerCase())) : -1;
    return i >= 0 ? (snapAt * i) / cadence.preSnap.length : null;
  }

  function resolveActors(variation, opts, snapAt) {
    const flipSet = new Set(opts.flip ? variation.flipActors || [] : []);
    const drop = new Set(opts.drop || []);
    const actors = {};
    for (const [id, spec] of Object.entries(variation.actors)) {
      if (drop.has(id)) continue;
      actors[id] = {
        id,
        speed: spec.speed,
        start: (spec.startOn && wordTime(opts.cadence, spec.startOn, snapAt)) ?? snapAt + (spec.delay || 0),
        holds: spec.holds,
        // How many waypoints the diagram draws. The runner may keep going past the drawn arrow.
        drawn: spec.drawn || spec.path.length,
        path: spec.path.map(([x, y]) => (flipSet.has(id) ? [-x, y] : [x, y])),
      };
    }
    return actors;
  }

  // Late read: throw so the ball arrives as the receiver reaches the end of their run.
  function planLateThrow(actors, from, to, ready) {
    const end = endTime(actors[to]);
    const endSpot = carryPosition(actors[to], end);
    let t0 = end - THROW_BASE;
    for (let i = 0; i < 4; i++) t0 = end - THROW_BASE - dist(carryPosition(actors[from], t0), endSpot) / THROW_SPEED;
    return Math.max(t0, ready);
  }

  // Lead the receiver: aim where they will be when the ball gets there.
  function planThrow(actors, from, to, t0) {
    const origin = carryPosition(actors[from], t0);
    let t1 = t0 + 0.8;
    for (let i = 0; i < 4; i++) {
      t1 = t0 + THROW_BASE + dist(origin, carryPosition(actors[to], t1)) / THROW_SPEED;
    }
    return t1;
  }

  function resolveTarget(variation, opts, to) {
    if (to !== '$target') return to;
    const target = opts.target || variation.defaultTarget;
    if (!(variation.targets || []).includes(target) || (opts.drop || []).includes(target)) {
      throw new Error(`Unknown pass target "${target}" for ${variation.id}`);
    }
    return target;
  }

  function resolveCaptionTime(caption, actors) {
    if (caption.t !== undefined) return caption.t;
    return waypointTimes(actors[caption.actor])[caption.waypoint] + (caption.offset || 0);
  }

  // Turn a variation's data into a timeline: actor paths, ball segments, captions.
  // opts: { flip, target, drop: [ids of players sitting out], late: throw on the 2nd read,
  //         cadence: { preSnap: ['Down...', 'Set...'], snapWord: 'HUT!' } }
  function buildScene(variation, opts = {}) {
    const snapAt = variation.snapAt ?? 1.2;
    const actors = resolveActors(variation, opts, snapAt);
    const warnings = [];
    const segments = [{ kind: 'held', point: [0, 0], t0: 0, t1: snapAt }];
    const cadence = opts.cadence || { preSnap: ['Ready...'], snapWord: 'HIKE!' };
    // Spread the words before the snap evenly from the start of the play.
    const captions = cadence.preSnap.map((text, i) => ({ t: (snapAt * i) / cadence.preSnap.length, text }));

    segments.push({ kind: 'flight', fromPoint: [0, 0], to: 'QB', t0: snapAt, t1: snapAt + SNAP_FLIGHT, arc: 0.2 });
    captions.push({ t: snapAt, text: cadence.snapWord });
    let holder = 'QB';
    let last = snapAt + SNAP_FLIGHT;
    let passTo = null;

    for (const ev of variation.events || []) {
      const to = resolveTarget(variation, opts, ev.to);
      if (!actors[to]) throw new Error(`Event target "${to}" is not on the field in ${variation.id}`);
      let t0;
      let t1;
      let arc = 0;
      if (ev.type === 'hand' || ev.type === 'toss') {
        t1 = waypointTimes(actors[to])[ev.waypoint];
        t0 = t1 - (ev.type === 'toss' ? TOSS_FLIGHT : HAND_FLIGHT);
        arc = ev.type === 'toss' ? 0.8 : 0;
      } else if (ev.type === 'throw') {
        t0 = Math.max(endTime(actors[holder]) + (ev.delay ?? 0.4), last);
        if (opts.late && (variation.lateReads || {})[to]) t0 = planLateThrow(actors, holder, to, t0);
        t1 = planThrow(actors, holder, to, t0);
        arc = 2.2;
        passTo = to;
      } else {
        throw new Error(`Unknown ball event "${ev.type}" in ${variation.id}`);
      }
      if (t0 < last - 1e-9) {
        warnings.push(`${ev.type} to ${to} starts at ${t0.toFixed(2)}s before ${holder} has the ball (${last.toFixed(2)}s)`);
      }
      segments.push({ kind: 'held', actor: holder, t0: last, t1: t0 });
      segments.push({ kind: 'flight', from: holder, to, t0, t1, arc });
      captions.push({ t: t0, text: ev.label || defaultLabel(ev.type) });
      if (ev.type === 'throw') captions.push({ t: t1, text: 'Catch!' });
      holder = to;
      last = t1;
    }
    segments.push({ kind: 'held', actor: holder, t0: last, t1: Infinity });

    for (const c of variation.captions || []) {
      captions.push({ t: resolveCaptionTime(c, actors), text: c.text });
    }
    captions.sort((a, b) => a.t - b.t);

    const actorsEnd = Math.max(...Object.values(actors).map(endTime));
    return {
      actors,
      segments,
      captions,
      warnings,
      snapAt,
      carrier: holder,
      passTo,
      duration: Math.max(actorsEnd, last) + 0.8,
    };
  }

  function defaultLabel(type) {
    return { hand: 'Handoff!', toss: 'Toss!', throw: 'Throw!' }[type];
  }

  // Where the ball is at time t. `height` is 0 on the ground or in hands.
  function ballAt(scene, t) {
    const seg = scene.segments.find((s) => t >= s.t0 && t < s.t1) || scene.segments[scene.segments.length - 1];
    if (seg.kind === 'held') {
      return { pos: seg.point ? seg.point.slice() : carryPosition(scene.actors[seg.actor], t), height: 0, holder: seg.actor || null };
    }
    const f = (t - seg.t0) / (seg.t1 - seg.t0);
    const from = seg.fromPoint || carryPosition(scene.actors[seg.from], seg.t0);
    const to = carryPosition(scene.actors[seg.to], seg.t1);
    return { pos: lerp(from, to, f), height: seg.arc * Math.sin(Math.PI * f), holder: null };
  }

  function captionAt(scene, t) {
    let text = '';
    for (const c of scene.captions) if (c.t <= t) text = c.text;
    return text;
  }

  const api = { dist, waypointTimes, positionAt, endTime, buildScene, ballAt, captionAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlayEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
