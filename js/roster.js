// Team lineups: which kid plays which spot number in each rotation.
// Spot numbers are the playbook's (#1 Center ... #7 Inside Receiver Left).
// Rotation 2 was written with "Everette"; it is the same player as Everett.
(function (root) {
  const ROTATIONS = [
    { id: 1, spots: { 1: 'Jamison', 2: 'Sebastian', 3: 'Cruz', 4: 'Ellis', 5: 'Mia', 6: 'Everett', 7: 'Adrian' } },
    { id: 2, spots: { 1: 'Everett', 2: 'Mia', 3: 'Ellis', 4: 'Jamison', 5: 'Sebastian', 6: 'Adrian', 7: 'Cruz' } },
    { id: 3, spots: { 1: 'Jamison', 2: 'Everett', 3: 'Mia', 4: 'Ellis', 5: 'Sebastian', 6: 'Adrian', 7: 'Cruz' } },
  ];

  const KIDS = [...new Set(ROTATIONS.flatMap((r) => Object.values(r.spots)))].sort();

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

  const api = { ROTATIONS, KIDS, kidAt, spotsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Roster = api;
})(typeof window !== 'undefined' ? window : globalThis);
