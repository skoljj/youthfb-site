// Game plan: series by series, Offense then Defense, and who is on break.
//
// A plan is { series: [...] } where each series is one of:
//   { side: 'O', o: [...] }  o: kid at spot #1..#7 (o[0] is #1 Center). With a
//                            team size of n, spots #1..#n play and the rest rest.
//   { side: 'D', d: {...} }  d: defensive spot (CBL, MLB, ...) to kid. Everyone
//                            not in d is on break.
// Breaks happen between series: a kid who sits an offensive series comes back
// in on defense, so nobody sits two series in a row.
// Pure functions, no DOM, so it runs in the browser (window.GamePlan) and in Node tests.
(function (root) {
  const SPOTS = 7;
  const DEFAULT_SERIES = 16; // 8 on offense, 8 on defense

  const other = (side) => (side === 'O' ? 'D' : 'O');

  function onField(series, size) {
    return series.side === 'O' ? series.o.slice(0, size) : Object.values(series.d);
  }

  function breaks(series, size, kids) {
    if (series.side === 'O') return series.o.slice(size);
    const playing = new Set(Object.values(series.d));
    return kids.filter((k) => !playing.has(k));
  }

  function permutations(list) {
    if (list.length <= 1) return [list];
    return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest]));
  }

  // Best defense from these players: highest total of Coach's preferences, every
  // kid at a spot they play. null if no such lineup exists.
  // opts: { defOrder: ['CBL', ...], groupOf: { CBL: 'CB', ... }, prefs: { kid: { CB: 3 } } }
  function bestDefense(players, opts) {
    let best = null;
    let bestScore = -1;
    for (const order of permutations(players)) {
      let score = 0;
      for (let i = 0; i < order.length && score >= 0; i++) {
        const fit = (opts.prefs[order[i]] || {})[opts.groupOf[opts.defOrder[i]]] || 0;
        score = fit ? score + fit : -1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = order;
      }
    }
    if (!best) return null;
    return { d: Object.fromEntries(opts.defOrder.map((pos, i) => [pos, best[i]])), score: bestScore };
  }

  // Offense from Coach's rotation: kids keep their rotation spot; open spots
  // (someone on break) go to the playing kids whose spot is past the team size.
  function offenseFrom(rotation, playing, resting, size) {
    const o = Array(SPOTS).fill(null);
    const home = (k) => Number(Object.keys(rotation.spots).find((n) => rotation.spots[n] === k));
    const spare = [];
    for (const k of [...playing].sort((a, b) => home(a) - home(b))) {
      const n = home(k);
      if (n <= size && !o[n - 1]) o[n - 1] = k;
      else spare.push(k);
    }
    for (let i = 0; i < size; i++) if (!o[i]) o[i] = spare.shift();
    return [...o.slice(0, size), ...spare, ...resting];
  }

  function sitting(side, kids, size, defOrder) {
    return Math.max(kids.length - (side === 'O' ? size : defOrder.length), 0);
  }

  function combinations(list, m) {
    if (m === 0) return [[]];
    return list.flatMap((x, i) => combinations(list.slice(i + 1), m - 1).map((rest) => [x, ...rest]));
  }

  // Fair rotation, searched series by series:
  //   - nobody sits two series in a row (sit on offense, back in on defense),
  //   - break counts never differ by more than one,
  //   - every defense puts kids only at spots they play,
  // then, of those, everyone also rests on defense (when there are enough
  // defensive breaks) and the defenses fit Coach's preferences best.
  // opts: { size, defOrder, groupOf, prefs, rotations, count, start: 'O' | 'D' }
  function autoPlan(kids, opts) {
    const count = opts.count || DEFAULT_SERIES;
    const sides = Array.from({ length: count }, (_, i) => (i % 2 === 0 ? opts.start || 'O' : other(opts.start || 'O')));
    const cache = new Map();
    const defenseFor = (players) => {
      const key = [...players].sort().join('|');
      if (!cache.has(key)) cache.set(key, bestDefense(players, opts));
      return cache.get(key);
    };
    const defBreakSlots = sides.filter((x) => x === 'D').length * sitting('D', kids, opts.size, opts.defOrder);
    const wantRestedOnD = Math.min(kids.length, defBreakSlots);
    // Memoized search. A state is: which series, who sat last, everyone's break
    // count, and who has rested on defense. Each state is solved once.
    const memo = new Map();
    function solve(i, prev, rests, restedOnD) {
      if (i === sides.length) {
        const rested = restedOnD.filter(Boolean).length;
        return { score: -100 * Math.max(0, wantRestedOnD - rested), picks: [] };
      }
      const key = `${i}|${prev.join(',')}|${rests.join(',')}|${restedOnD.map(Number).join('')}`;
      if (memo.has(key)) return memo.get(key);
      const side = sides[i];
      let best = null;
      const free = kids.map((k, j) => j).filter((j) => !prev.includes(j));
      for (const rest of combinations(free, sitting(side, kids, opts.size, opts.defOrder))) {
        const next = rests.slice();
        for (const j of rest) next[j]++;
        if (Math.max(...next) - Math.min(...next) > 1) continue;
        let gain = 0;
        let nextD = restedOnD;
        if (side === 'D') {
          const def = defenseFor(kids.filter((_, j) => !rest.includes(j)));
          if (!def) continue;
          gain = def.score;
          nextD = restedOnD.slice();
          for (const j of rest) nextD[j] = true;
        }
        const after = solve(i + 1, rest, next, nextD);
        if (!after) continue;
        if (!best || gain + after.score > best.score) best = { score: gain + after.score, picks: [rest.map((j) => kids[j]), ...after.picks] };
      }
      memo.set(key, best);
      return best;
    }
    const best = solve(0, [], kids.map(() => 0), kids.map(() => false));
    if (!best) throw new Error('No fair rotation fits the defensive spots. Check DEFENSE_PREFS.');
    let oCount = 0;
    return {
      series: sides.map((side, i) => {
        const rest = best.picks[i];
        const playing = kids.filter((k) => !rest.includes(k));
        if (side === 'D') return { side, d: defenseFor(playing).d };
        const rotation = opts.rotations[oCount++ % opts.rotations.length];
        return { side, o: offenseFrom(rotation, playing, rest, opts.size) };
      }),
    };
  }

  // Put `kid` at spot `num` (1-based) on an offensive series. Whoever was there
  // takes the kid's old spot (which may be a break).
  function setOffense(series, num, kid) {
    const from = series.o.indexOf(kid);
    const to = num - 1;
    if (from < 0 || from === to) return series;
    const o = series.o.slice();
    [o[to], o[from]] = [kid, o[to]];
    return { side: 'O', o };
  }

  // Put `kid` at defensive spot `pos`. If they had another spot, the two trade;
  // if they were on break, the kid they replace goes on break.
  function setDefense(series, pos, kid) {
    const d = { ...series.d };
    const had = Object.keys(d).find((p) => d[p] === kid);
    if (had) d[had] = d[pos];
    d[pos] = kid;
    return { side: 'D', d };
  }

  // Fill the plan out to `count` series by repeating it from the top.
  function repeatPattern(plan, count) {
    const base = plan.series;
    return { series: Array.from({ length: count }, (_, i) => JSON.parse(JSON.stringify(base[i % base.length]))) };
  }

  // Kids who sit two series in a row: [{ at: index of the second series, kids }].
  function backToBack(plan, size, kids) {
    const out = [];
    for (let i = 1; i < plan.series.length; i++) {
      const before = breaks(plan.series[i - 1], size, kids);
      const both = breaks(plan.series[i], size, kids).filter((k) => before.includes(k));
      if (both.length) out.push({ at: i, kids: both });
    }
    return out;
  }

  // A plan saved on a device remembers which built-in plan it started from, so a
  // change to the built-in plan replaces older saved copies.
  function fingerprint(plan) {
    return plan ? JSON.stringify(plan.series) : '';
  }

  function isValid(plan, kids, defOrder) {
    if (!plan || !Array.isArray(plan.series) || !plan.series.length) return false;
    const team = [...kids].sort().join('|');
    return plan.series.every((s) => {
      if (s.side === 'O') return Array.isArray(s.o) && [...s.o].sort().join('|') === team;
      if (s.side !== 'D' || !s.d) return false;
      const players = defOrder.map((pos) => s.d[pos]);
      return players.every((k) => kids.includes(k)) && new Set(players).size === defOrder.length;
    });
  }

  // Share links carry the plan as base64url JSON (names are already on the page).
  function encode(plan) {
    const json = JSON.stringify({ v: 2, s: plan.series.map((x) => (x.side === 'O' ? ['O', x.o] : ['D', x.d])) });
    const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(text) {
    try {
      const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
      const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, 'base64').toString('utf8');
      const raw = JSON.parse(json);
      if (raw.v !== 2) return null;
      return { series: raw.s.map(([side, x]) => (side === 'O' ? { side, o: x } : { side, d: x })) };
    } catch (err) {
      return null;
    }
  }

  const api = { SPOTS, DEFAULT_SERIES, onField, breaks, bestDefense, offenseFrom, autoPlan, setOffense, setDefense, repeatPattern, backToBack, fingerprint, isValid, encode, decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GamePlan = api;
})(typeof window !== 'undefined' ? window : globalThis);
