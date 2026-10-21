// Team lineups: which kid plays which spot number in each rotation.
// The game plan (js/gameplan.js) uses each rotation's spots as the offense on
// offensive series, and DEFENSE_PREFS to place kids on defensive series.
// Spot numbers are the playbook's (#1 Center ... #7 Inside Receiver Left).
// Rotation 2 was written with "Everette"; it is the same player as Everett.
(function (root) {
  const ROTATIONS = [
    { id: 1, spots: { 1: 'Jamison', 2: 'Sebastian', 3: 'Cruz', 4: 'Ellis', 5: 'Mia', 6: 'Everett', 7: 'Adrian' } },
    { id: 2, spots: { 1: 'Everett', 2: 'Mia', 3: 'Ellis', 4: 'Jamison', 5: 'Sebastian', 6: 'Adrian', 7: 'Cruz' } },
    { id: 3, spots: { 1: 'Jamison', 2: 'Everett', 3: 'Mia', 4: 'Ellis', 5: 'Sebastian', 6: 'Adrian', 7: 'Cruz' } },
  ];

  const KIDS = [...new Set(ROTATIONS.flatMap((r) => Object.values(r.spots)))].sort();

  // Defense, from Coach: where each kid plays when they are in.
  // 3 = primarily, 2 = also (secondarily, or "can play" any of them), 1 = can fill in.
  // A spot not listed is one the kid does not play right now.
  const DEFENSE_PREFS = {
    Everett: { MLB: 3, CB: 1 },
    Sebastian: { CB: 3, MLB: 2 },
    Cruz: { S: 3, MLB: 3 },
    Mia: { S: 3, CB: 1 },
    Adrian: { CB: 3 },
    Ellis: { CB: 2, MLB: 2, S: 2 },
    Jamison: { CB: 2, MLB: 2, S: 2 },
  };

  function kidAt(rotationId, num) {
    const rotation = ROTATIONS.find((r) => r.id === rotationId);
    return rotation ? rotation.spots[num] || null : null;
  }

  // [{ rotation: 1, num: 5 }, ...] for one kid, in rotation order.
  function spotsFor(kid) {
    return ROTATIONS.map((r) => ({
      rotation: r.id,
      num: Number(Object.keys(r.spots).find((n) => r.spots[n] === kid)),
    }));
  }

  // Coach's game plan: the first 10 series (5 offense, 5 defense), repeated to
  // fill the game. Offense lists spots #1..#7 (#6 and #7 rest in 5 v 5).
  // Defense: everyone not listed rests. Every visitor starts with this plan, and
  // a device that saved an edited copy drops it when this plan changes.
  const O = (...kids) => ({ side: 'O', o: kids });
  const D = (CBL, MLB, CBR, SL, SR) => ({ side: 'D', d: { CBL, MLB, CBR, SL, SR } });
  const GAME_PLAN = {
    series: [
      O('Jamison', 'Everett', 'Ellis', 'Mia', 'Sebastian', 'Adrian', 'Cruz'),
      D('Adrian', 'Cruz', 'Sebastian', 'Jamison', 'Mia'),
      O('Adrian', 'Sebastian', 'Everett', 'Cruz', 'Ellis', 'Mia', 'Jamison'),
      D('Ellis', 'Everett', 'Jamison', 'Cruz', 'Mia'),
      O('Jamison', 'Everett', 'Cruz', 'Mia', 'Sebastian', 'Adrian', 'Ellis'),
      D('Adrian', 'Sebastian', 'Everett', 'Cruz', 'Ellis'),
      O('Jamison', 'Cruz', 'Ellis', 'Sebastian', 'Mia', 'Everett', 'Adrian'),
      D('Adrian', 'Everett', 'Sebastian', 'Jamison', 'Ellis'),
      O('Cruz', 'Jamison', 'Sebastian', 'Adrian', 'Mia', 'Ellis', 'Everett'),
      D('Adrian', 'Everett', 'Ellis', 'Cruz', 'Mia'),
    ],
  };

  const api = { ROTATIONS, KIDS, DEFENSE_PREFS, GAME_PLAN, kidAt, spotsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Roster = api;
})(typeof window !== 'undefined' ? window : globalThis);
