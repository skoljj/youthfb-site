// Series badges shared by the playbook page (Find your player) and the Summary:
// a grid of Series 1..N across, offense on top and defense below, with a
// position badge per series or a water bottle for a break.
(function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function bottle(doc) {
    const icon = doc.createElementNS(SVG_NS, 'svg');
    icon.setAttribute('viewBox', '0 0 12 18');
    icon.setAttribute('class', 'bottle');
    icon.setAttribute('aria-hidden', 'true');
    for (const [tag, attrs] of [
      ['rect', { x: 4, y: 0.5, width: 4, height: 2.5, rx: 0.8, class: 'cap' }],
      ['path', { d: 'M3.5 3 H8.5 L9.5 5.5 Q10.5 6.5 10.5 8 V16 Q10.5 17.5 9 17.5 H3 Q1.5 17.5 1.5 16 V8 Q1.5 6.5 2.5 5.5 Z', class: 'body' }],
      ['rect', { x: 1.5, y: 9.5, width: 9, height: 3.5, class: 'label' }],
    ]) {
      const node = doc.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      icon.append(node);
    }
    return icon;
  }

  // spots: { O: [label or null for a break], D: [...] }.
  // opts.current: { side, k } to ring one block; opts.onPick(side, k) makes blocks buttons.
  function seriesGrid(doc, spots, opts = {}) {
    const grid = doc.createElement('div');
    grid.className = 'series-grid';
    grid.style.gridTemplateColumns = `auto repeat(${Math.max(spots.O.length, spots.D.length)}, 1fr)`;
    const cell = (tag, cls, text) => {
      const node = doc.createElement(tag);
      node.className = cls;
      if (text !== undefined) node.textContent = text;
      grid.append(node);
      return node;
    };
    cell('span', 'g-corner');
    for (let k = 1; k <= spots.O.length; k++) cell('span', 'g-head', String(k));
    for (const side of ['O', 'D']) {
      cell('span', 'g-side', side === 'O' ? 'Off' : 'Def');
      spots[side].forEach((spot, k) => {
        const current = opts.current && opts.current.side === side && opts.current.k === k;
        const node = cell(opts.onPick ? 'button' : 'span', `blk ${spot ? `blk-${side}` : 'blk-rest'}${current ? ' current' : ''}`, spot || undefined);
        const where = `${side === 'O' ? 'Offense' : 'Defense'} ${k + 1}`;
        node.title = `${where}: ${spot || 'break'}`;
        if (!spot) node.append(bottle(doc));
        if (opts.onPick) {
          node.type = 'button';
          node.setAttribute('aria-label', `${where}, ${spot || 'on break'}`);
          if (current) node.setAttribute('aria-current', 'true');
          node.addEventListener('click', () => opts.onPick(side, k));
        }
      });
    }
    return grid;
  }

  root.Badges = { bottle, seriesGrid };
})(typeof window !== 'undefined' ? window : globalThis);
