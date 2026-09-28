// Playbook data for the Vista Chargers. Everything the page shows comes from here.
//
// Sources:
//   - Wristband cards: assets/img/card-*.png (copies of Frame 6/7/8.png)
//   - Coach sheet: "Vista Chargers.xlsx", Sheet1 (alignment, assignment, technique)
// "coach" strings quote the sheet (typos fixed). "kid" strings are the same
// ideas rewritten for 6 and 7 year olds.
//
// Coordinates are yards: x left/right of the ball (right is +), y from the
// line of scrimmage (downfield is +). See js/engine.js.
(function (root) {
  const ORDER = ['ORL', 'IRL', 'C', 'IRR', 'ORR', 'QB', 'RB'];

  const POSITIONS = {
    ORL: { num: 5, short: 'OR', name: 'Outside Receiver', side: 'Left', group: 'receiver', start: [-6, 0] },
    IRL: { num: 7, short: 'IR', name: 'Inside Receiver', side: 'Left', group: 'receiver', start: [-3, 0] },
    C: { num: 1, short: 'C', name: 'Center', side: '', group: 'center', start: [0.7, -0.3] },
    IRR: { num: 6, short: 'IR', name: 'Inside Receiver', side: 'Right', group: 'receiver', start: [3, 0] },
    ORR: { num: 4, short: 'OR', name: 'Outside Receiver', side: 'Right', group: 'receiver', start: [6, 0] },
    QB: { num: 2, short: 'QB', name: 'Quarterback', side: '', group: 'qb', start: [0, -1.2], photo: 'assets/img/qb.jpg' },
    RB: { num: 3, short: 'RB', name: 'Running Back', side: '', group: 'rb', start: [0, -4.2], photo: 'assets/img/rb.jpg' },
  };

  const WR_STANCE = 'Toes on the line. Stand tall with knees bent. Put your inside foot (the one closer to the ball) in front.';
  const ONSIDE = "Don't step past the ball! Your front foot stays behind it.";

  // Where to line up. Same for every play in this playbook.
  const ALIGNMENT = {
    ORL: {
      kid: ['Line up way out on the LEFT, about 6 big steps from the ball.', WR_STANCE, ONSIDE],
      coach: 'Wide LEFT (6yd split), on LOS. 2-Pt WR stance, inside foot forward.',
    },
    IRL: {
      kid: ['Line up on the LEFT, 3 big steps from the ball.', WR_STANCE, ONSIDE],
      coach: 'Inside LEFT (3yd split), on LOS. 2-Pt WR stance, inside foot forward.',
    },
    C: {
      kid: [
        'Stand on the RIGHT side of the ball, facing down the field.',
        'Right foot on the line. Left foot one big step back. Knees bent.',
        'Snap the ball with your right hand.',
        'Lefty? Flip it: stand on the left side and snap with your left hand.',
      ],
      coach:
        'Right side of football, 2-Pt, 90 degrees to LOS (right foot on LOS, left foot 1yd off). Snap ball with right hand, from 2pt stance. Flip the setup if the Center is left-handed.',
    },
    IRR: {
      kid: ['Line up on the RIGHT, 3 big steps from the ball.', WR_STANCE, ONSIDE],
      coach: 'Inside RIGHT (3yd split), on LOS. 2-Pt WR stance, inside foot forward.',
    },
    ORR: {
      kid: ['Line up way out on the RIGHT, about 6 big steps from the ball.', WR_STANCE, ONSIDE],
      coach: 'Wide RIGHT (6yd split), on LOS. 2-Pt WR stance, inside foot forward.',
    },
    QB: {
      kid: ['Stand 1 big step behind the Center and the ball.', 'Feet and shoulders point straight down the field.'],
      coach: '2-Pt stance, feet & shoulders square to LOS, 1yd behind ball & Center.',
    },
    RB: {
      kid: ['Stand 3 big steps straight behind the QB.', 'Feet and shoulders point straight down the field.'],
      coach: '3yd directly behind QB, 2-pt, feet & shoulders square to LOS.',
    },
  };

  // Five-minute backyard drills for parents, by position group.
  const PRACTICE = {
    receiver: {
      title: 'See it, catch it, tuck it',
      steps: [
        'Stand 5 steps apart and toss the ball softly.',
        'Your player says "See it!" when the ball leaves your hand, and watches it all the way into their hands.',
        'Catch with the hands, not the belly. Then tuck it under the arm.',
        'Add the route: they run it, look back at you, and you throw when their eyes find you.',
      ],
    },
    center: {
      title: 'Snap and see',
      steps: [
        'Put the ball on the ground. You are the QB, one big step behind it.',
        'Your player stands on the right of the ball and snaps it back to you with the right hand.',
        'Say "Watch it in!" They keep their eyes on the ball until it is in your hands.',
        'Then they run 5 steps, spin around, and show you their hands. Throw them an easy one.',
      ],
    },
    qb: {
      title: 'Loud voice, soft hands',
      steps: [
        'Practice calling the cadence LOUD, like the whole park needs to hear it: "Ready, Down, Set, Hut-1" (add "Hut-2" when the call is on two).',
        'Handoff: you jog past as the RB. Your player puts the ball right in your tummy and watches it go in.',
        'Throwing: set feet, point the front shoulder at a target (a bucket works), and throw.',
        'Say "Point, step, throw!" out loud together.',
      ],
    },
    rb: {
      title: 'Elbow up, clamp down',
      steps: [
        'Make a pocket: inside elbow up high, other arm low across the belly.',
        'You place the ball in the pocket. Your player clamps down with both arms.',
        'Give the ball a gentle tug. They squeeze so you can\'t pull it out.',
        'Finish every rep with "Eyes up!" and a run of 5 big steps.',
      ],
    },
  };

  // Shared kid steps.
  const CATCH = '\u{1F3C8} Catch it, tuck it, run!';
  const HANDS = '✋ Hands up and ready. Watch the ball all the way into your hands.';
  const GO_HOW = [
    '\u{1F440} Watch the ball. Go when it is snapped!',
    '\u{1F4A8} Run as fast as you can, straight down the field.',
    '\u{1F440} After 3 hard steps, look back at the QB over your inside shoulder.',
    '↔️ Stay out wide. Don\'t drift to the middle.',
    HANDS,
    CATCH,
  ];
  const GO_COACH = [
    'Assignment: 15+ yard Go route.',
    "Technique: See that your upfield foot is behind the ball. SEE the snap. Explode 15 yds upfield. Find QB with your eyes over inside shoulder after 3 hard steps. Stay wide, don't drift to center. Keep eyes on QB, hands ready. See the ball all the way into your hands. Catch, tuck, get upfield.",
  ];
  const IN_HOW = [
    '\u{1F440} Watch the ball. Go when it is snapped!',
    '\u{1F4A8} Run fast for 5 steps.',
    '\u{1F6D1} Stop quick. Push off your outside foot and cut straight toward the middle.',
    '\u{1F440} Find the QB with your eyes. Keep your head moving.',
    HANDS,
    CATCH,
  ];
  // Boom Pass: the diagram shows the In route (like the wristband). When the play
  // runs, #4 and #5 settle on the In (1st read), then keep going across to the
  // far flat (2nd read). #5 crosses underneath, #4 over the top, so they never
  // run into each other or the Center's hook.
  const crossHow = (lane, side) => [
    '\u{1F440} Watch the ball. Go when it is snapped!',
    '\u{1F4A8} Run fast for 5 steps.',
    '\u{1F6D1} Stop quick. Push off your outside foot and cut toward the middle.',
    '\u270B Settle and show your hands. You might get the ball right here!',
    `\u2194\uFE0F No ball yet? Keep running ACROSS the field. ${lane}`,
    `\u{1F6D1} Settle in the open grass on the ${side} side, facing the QB.`,
    HANDS,
    CATCH,
  ];
  const CROSS_UNDER = 'You go UNDER #4: stay closer to the line.';
  const CROSS_OVER = 'You go OVER the top of #5: run a little deeper.';
  const SETTLE = { 2: 0.6 };
  const inCoach = (flat) => [
    'Assignment: 5-yard In route.',
    `Technique: See that your upfield foot is behind the ball. SEE the snap. Explode 5 yds upfield, break down, drop hips, push off outside foot, cut straight down line at 90 degrees. Find QB with your eyes. Head on swivel across middle. Settle in ${flat} flat. Keep eyes on QB, hands ready. See the ball all the way into your hands. Catch, tuck, get upfield.`,
  ];
  const CADENCE_STEP = '\u{1F5E3}\uFE0F The cadence always starts: Ready, Down, Set, Hut-1. Add Hut-2 only when the call is "on two".';
  const QB_START = [
    '\u{1F4E3} Get everyone lined up. Call the cadence LOUD and clear.',
    CADENCE_STEP,
    '\u{1F3C8} Catch the snap with two hands.',
  ];
  const QB_ALL_COACH = 'All plays: Bring team to line & get them set. Run cadence loudly, clearly. Take snap securely. Take appropriate drop.';
  const QB_HANDOFF_COACH =
    'Drop-step (reverse pivot) opening up to the play-side, take additional step toward RB, see your hand place ball in their belly with your upfield hand.';
  const RB_HANDOFF_HOW = (aim) => [
    '➡️ First step goes toward the side Coach calls.',
    `\u{1F3AF} ${aim}`,
    '\u{1F4AA} Inside elbow up. Make a pocket for the ball.',
    '\u{1F917} Clamp down on the ball with both arms.',
    '\u{1F440} Eyes up! Run hard up the field.',
  ];
  const RUN_TIP = 'It is a run play, but run your route HARD anyway. Defenders follow you, and that opens space for the runner.';

  const SWING_PATH = [[0, -4.2], [2, -4.7], [4, -4], [5, -3]];
  const go = (x) => ({ path: [[x, 0], [x, 15]], speed: 5 });
  const QB_SPOT = POSITIONS.QB.start;

  // Receivers and Center run the same routes on every Boom play.
  const BOOM_ROUTES = {
    ORL: { path: [[-6, 0], [-6, 5], [-2.5, 5]], speed: 4.5 },
    IRL: go(-3),
    C: { path: [[0.7, -0.3], [0.7, 5], [0.2, 4.2]], speed: 3.5, delay: 0.4 },
    IRR: go(3),
    ORR: { path: [[6, 0], [6, 5], [2.5, 5]], speed: 4.5 },
  };
  // Same In route as BOOM_ROUTES for the first 3 points (all the diagram draws).
  const BOOM_CROSSERS = {
    ORL: { path: [[-6, 0], [-6, 5], [-2.5, 5], [-1.5, 7], [5.5, 7]], speed: 4.5, drawn: 3, holds: SETTLE },
    ORR: { path: [[6, 0], [6, 5], [2.5, 5], [1.5, 9.5], [-5.5, 9.5]], speed: 4.5, drawn: 3, holds: SETTLE },
  };

  const boom = {
    id: 'boom',
    name: 'Boom',
    icon: '\u{1F4A5}',
    card: 'assets/img/card-boom-pass.png',
    tagline: 'Same formation every time. The QB and RB change what happens to the ball.',
    roles: {
      ORL: { job: 'Run 5 steps, then turn IN toward the middle (an In route).', how: IN_HOW, coach: inCoach('RIGHT') },
      IRL: { job: 'Run a GO route: straight down the field, super far.', how: GO_HOW, coach: GO_COACH },
      C: {
        job: 'First SNAP the ball. Then run 5 steps and turn around to face the QB (a Hook).',
        how: [
          '\u{1F3C8} Snap the ball back to the QB on the cadence.',
          '\u{1F440} Watch the ball go all the way into the QB\'s hands.',
          '\u{1F4A8} Turn and run straight up the field 5 steps.',
          '\u{1F6D1} Stop. Snap your head and hips back around to the QB.',
          '✋ Show your hands and take a step toward the QB.',
          CATCH,
        ],
        coach: [
          'Assignment: 1) Snap ball on cadence, 2) then run 5 yd hook.',
          'Technique: Balanced 2pt stance, standing 90 degrees to LOS, bent knees. 1) See ball all the way into hands of QB with your eyes. 2) After successful snap, turn straight upfield, explode 5 yds, break down, snap head & hips back around toward QB, show hands, settle toward QB. See the ball all the way into your hands. Catch, tuck, get upfield.',
        ],
      },
      IRR: { job: 'Run a GO route: straight down the field, super far.', how: GO_HOW, coach: GO_COACH },
      ORR: { job: 'Run 5 steps, then turn IN toward the middle (an In route).', how: IN_HOW, coach: inCoach('LEFT') },
    },
    // Boom is picked in two steps: Pass or Handoff, then who gets the ball.
    groups: [
      { id: 'pass', name: 'Pass' },
      { id: 'handoff', name: 'Handoff' },
    ],
    variations: [
      {
        id: 'pass',
        group: 'pass',
        name: 'Boom Pass',
        kind: 'pass',
        card: 'assets/img/card-boom-pass.png',
        summary: 'The QB drops back and throws to whoever is open. Everybody is a target!',
        flipActors: ['QB', 'RB'],
        targets: ['ORR', 'ORL', 'C', 'RB', 'IRR', 'IRL'],
        defaultTarget: 'ORL',
        // Throwing to #4 or #5 has two timings: 1st read on the In, 2nd read in the far flat.
        lateReads: {
          ORL: { first: 'on the In', second: 'right flat' },
          ORR: { first: 'on the In', second: 'left flat' },
        },
        actors: {
          ...BOOM_ROUTES,
          ...BOOM_CROSSERS,
          QB: { path: [QB_SPOT, [0, -3]], speed: 2.5, delay: 0.3 },
          RB: { path: SWING_PATH, speed: 4.5 },
        },
        events: [{ type: 'throw', to: '$target' }],
        roles: {
          ORL: {
            job: 'Run 5 steps, turn IN, and settle. No ball yet? Keep going ACROSS to the RIGHT flat, under #4.',
            how: crossHow(CROSS_UNDER, 'RIGHT'),
            coach: inCoach('RIGHT'),
          },
          ORR: {
            job: 'Run 5 steps, turn IN, and settle. No ball yet? Keep going ACROSS to the LEFT flat, over the top of #5.',
            how: crossHow(CROSS_OVER, 'LEFT'),
            coach: inCoach('LEFT'),
          },
          QB: {
            job: 'Take the snap, drop back, and throw to an open friend.',
            how: [
              ...QB_START,
              '⬇️ Take steps straight back.',
              '\u{1F440} Look down the field. Who is open?',
              '1\uFE0F\u20E3 First look: #4 or #5 settling on the In.',
              '2\uFE0F\u20E3 Not open? Wait for them to cross to the other side, then throw to the flat.',
              '\u{1F449} Set your feet. Point your front shoulder at your friend.',
              '\u{1F4AA} Throw it with confidence!',
            ],
            coach: [
              'Assignment: Get team set. Call out cadence loudly. Run the play. Coach directs which variation play by play.',
              QB_ALL_COACH,
              'Any pass: Straight drop, look downfield, find open receiver, set feet & point shoulder, throw with confidence toward your target.',
              'Swing pass: Straight drop, look downfield, set feet & point shoulder, throw with confidence (banana 5 wide, 3 deep).',
            ],
          },
          RB: {
            job: 'Run a banana out to the side and look for the ball (a Swing).',
            how: [
              '➡️ First step goes sideways, toward the side Coach calls.',
              '\u{1F34C} Curve out like a banana: about 5 steps wide and 3 steps back.',
              '\u{1F440} Turn your head early and find the QB.',
              '\u{1F6D1} Stop out by the sideline with your hands ready.',
              CATCH,
            ],
            coach: [
              'Assignment: Coach directs (R or L) swing pass.',
              'Technique: First step lateral to play-side, banana route, get 5 yds wide and 3 yds depth. Head on swivel with eyes to QB early. Settle in the flat.',
            ],
          },
        },
      },
      {
        id: 'outside',
        group: 'handoff',
        short: 'Outside',
        name: 'Boom Handoff Outside',
        kind: 'run',
        card: 'assets/img/card-boom-run.png',
        cardNote: 'No wristband picture for this one yet. It is the Boom handoff card, but the RB runs OUTSIDE, just past the Inside Receiver.',
        summary: 'The QB hands the ball to the RB, who runs OUTSIDE, just past where the Inside Receiver lined up.',
        flipActors: ['QB', 'RB'],
        actors: {
          ...BOOM_ROUTES,
          QB: { path: [QB_SPOT, [-0.3, -1.8], [0.6, -2.3]], speed: 2.5, delay: 0.3 },
          RB: { path: [[0, -4.2], [1.3, -2.5], [3.7, 0], [4, 8]], speed: 4, delay: 0.25 },
        },
        events: [{ type: 'hand', to: 'RB', waypoint: 1 }],
        roles: {
          QB: {
            job: 'Take the snap and hand the ball to the Running Back.',
            how: [
              ...QB_START,
              '\u{1F504} Drop-step: spin back, opening toward the side Coach called.',
              '\u{1F463} Take one more step toward the RB.',
              '\u{1F440} Watch your hand put the ball right in the RB\'s tummy.',
            ],
            coach: [QB_ALL_COACH, `Outside handoff (Power): ${QB_HANDOFF_COACH}`],
          },
          RB: {
            job: 'Take the handoff and run OUTSIDE.',
            how: RB_HANDOFF_HOW('Aim 3 or 4 big steps wide, just OUTSIDE the Inside Receiver\'s spot (3 big steps from the ball).'),
            coach: [
              'Assignment: Coach directs (R or L) outside handoff.',
              'Outside handoff (Power): First step is to the play-side, aim for 3-4 yds wide (run just outside where inside receiver lines up), inside elbow up, clamp down on football, eyes up.',
            ],
          },
        },
      },
      {
        id: 'inside',
        group: 'handoff',
        short: 'Inside',
        name: 'Boom Handoff Inside',
        kind: 'run',
        card: 'assets/img/card-boom-run.png',
        summary: 'The QB hands the ball to the RB, who runs through the INSIDE hole, between the Center and the Inside Receiver.',
        flipActors: ['QB', 'RB'],
        actors: {
          ...BOOM_ROUTES,
          QB: { path: [QB_SPOT, [-0.3, -1.8], [0.4, -2.3]], speed: 2.5, delay: 0.3 },
          RB: { path: [[0, -4.2], [1.1, -2.4], [1.6, 0], [1.6, 8]], speed: 4, delay: 0.25 },
        },
        events: [{ type: 'hand', to: 'RB', waypoint: 1 }],
        roles: {
          QB: {
            job: 'Take the snap and hand the ball to the Running Back.',
            how: [
              ...QB_START,
              '\u{1F504} Drop-step: spin back, opening toward the side Coach called.',
              '\u{1F463} Take one more step toward the RB.',
              '\u{1F440} Watch your hand put the ball right in the RB\'s tummy.',
            ],
            coach: [QB_ALL_COACH, `Inside handoff (Dive): ${QB_HANDOFF_COACH}`],
          },
          RB: {
            job: 'Take the handoff and run through the INSIDE hole.',
            how: RB_HANDOFF_HOW('Aim 1 or 2 big steps wide, just INSIDE the Inside Receiver\'s spot (3 big steps from the ball).'),
            coach: [
              'Assignment: Coach directs (R or L) inside handoff.',
              'Inside handoff (Dive): First step is to the play-side, aim for 1-2 yds wide (run inside the inside receiver), inside elbow up, clamp down on football, eyes up.',
            ],
          },
        },
      },
      {
        id: 'toss',
        group: 'handoff',
        short: 'Toss',
        name: 'Boom Toss',
        kind: 'run',
        card: 'assets/img/card-boom-run.png',
        cardNote: 'No wristband picture for this one yet. It is the Boom handoff card, but the QB tosses the ball and the RB runs wide toward the sideline.',
        summary: 'The QB tosses the ball to the RB, who runs around the outside toward the sideline.',
        flipActors: ['QB', 'RB'],
        actors: {
          ...BOOM_ROUTES,
          QB: { path: [QB_SPOT, [0.8, -1.5]], speed: 2.5, delay: 0.3 },
          RB: { path: [[0, -4.2], [2, -3.1], [5, -1], [6.5, 1], [6.8, 8]], speed: 4, delay: 0.25 },
        },
        events: [{ type: 'toss', to: 'RB', waypoint: 1 }],
        roles: {
          QB: {
            job: 'Take the snap and toss the ball to the Running Back.',
            how: [
              ...QB_START,
              '➡️ First step goes toward the side Coach called.',
              '\u{1F3C8} Softly toss the ball to the RB\'s hands.',
            ],
            coach: [
              QB_ALL_COACH,
              'Toss-sweep: First step is to the play-side, toss to running back working at 45 degrees with shoulders open, eyes on QB, hands ready.',
            ],
          },
          RB: {
            job: 'Run on a slant toward the sideline and catch the toss.',
            how: [
              '➡️ First step goes toward the side Coach calls.',
              '↗️ Run on a slant, like the corner of a square cut in half.',
              '\u{1F440} Shoulders open, eyes on the QB, hands ready.',
              CATCH,
            ],
            coach: [
              'Assignment: Coach directs (R or L) toss-sweep.',
              'Toss-sweep: First step is to the play-side, working at 45 degrees with shoulders open, eyes on QB, hands ready, catch, tuck, get upfield.',
            ],
          },
        },
      },
    ],
  };

  // Sonic Run Left follows the wristband card (Frame 7): #4 (right outside
  // receiver) motions across and runs LEFT. Sonic Run Right is the mirror:
  // #5 motions across and runs RIGHT (this is the version the coach sheet describes).
  const SONIC_LEFT = {
    ORL: go(-6),
    IRL: go(-3),
    C: { path: [[0.7, -0.3], [0.7, 15]], speed: 3.5, delay: 0.4 },
    IRR: go(3),
    // Sonic starts on "Down" in the cadence (delay is the fallback with no cadence).
    ORR: { path: [[6, 0], [5, -1.8], [1, -2.3], [-1.5, -2.3], [-3.8, -0.8], [-4.5, 2], [-4.5, 10]], speed: 5, delay: -0.6, startOn: 'Down' },
    QB: { path: [QB_SPOT, [0.4, -1.8]], speed: 2, delay: 0.35 },
    RB: { path: SWING_PATH, speed: 4.5 },
  };
  const MIRROR_ID = { ORL: 'ORR', ORR: 'ORL', IRL: 'IRR', IRR: 'IRL' };

  // Flip a play left-for-right. The Center keeps their spot on the right of the ball.
  function mirrorActors(actors) {
    const out = {};
    for (const [id, actor] of Object.entries(actors)) {
      out[MIRROR_ID[id] || id] = id === 'C' ? actor : { ...actor, path: actor.path.map(([x, y]) => [0 - x, y]) };
    }
    return out;
  }

  const SONIC_MOTION_COACH = [
    'Assignment: Speed motion, receive handoff.',
    'Technique: See that your upfield foot is behind the ball. SEE QB start your motion at "Down" in the cadence. SEE the snap. RECEIVE HANDOFF. See the ball all the way into your hands. Catch, tuck, EXPLODE upfield, gain yards.',
  ];
  const GO_ROLE = { job: 'Run a GO route: straight down the field, super far.', how: GO_HOW, coach: GO_COACH };

  function sonicVariation(dir) {
    const left = dir === 'left';
    const runner = left ? 'ORR' : 'ORL';
    const other = left ? 'ORL' : 'ORR';
    const DIR = left ? 'LEFT' : 'RIGHT';
    const AWAY = left ? 'RIGHT' : 'LEFT';
    const num = POSITIONS[runner].num;
    return {
      id: dir,
      group: 'handoff',
      direction: dir,
      name: `Sonic Run ${left ? 'Left' : 'Right'}`,
      kind: 'run',
      sonic: runner,
      card: 'assets/img/card-sonic-run.png',
      cardNote: left
        ? 'This is the picture on the wristband. The field above moves the same way.'
        : 'The wristband shows Sonic Run Left. Run Right is the mirror image: #5 zooms across and the play goes RIGHT.',
      summary: `#${num} is Sonic. They zoom across on "Down", take the handoff from the QB, and run up the ${DIR} side.`,
      snapAt: 0.9,
      actors: left ? SONIC_LEFT : mirrorActors(SONIC_LEFT),
      events: [{ type: 'hand', to: runner, waypoint: 2 }],
      captions: [{ actor: runner, waypoint: 0, offset: 0.15, text: 'Go, Sonic!' }],
      roles: {
        [runner]: {
          job: `You are SONIC! Zoom across behind the QB, take the handoff, and run up the ${DIR} side.`,
          how: [
            '\u{1F4E3} When the QB says "Down", start running toward the QB.',
            '\u{1F4A8} Zoom across, behind the QB and in front of the RB.',
            '\u{1F440} Watch the ball all the way into your hands.',
            '\u{1F917} Catch it and tuck it.',
            `⬆️ EXPLODE up the field on the ${DIR} side!`,
          ],
          coach: SONIC_MOTION_COACH,
        },
        [other]: GO_ROLE,
        RB: {
          job: `Run your banana (Swing) to the ${AWAY} and pretend you have the ball!`,
          how: [
            `➡️ First step goes sideways to the ${AWAY}.`,
            '\u{1F34C} Curve out like a banana.',
            '\u{1F3AD} Act like you have the ball so the defense chases YOU.',
            '\u{1F440} Look at the QB. Hands ready, just in case.',
          ],
          coach: [`Assignment (from the wristband card): Swing ${AWAY.toLowerCase()}, away from Sonic. Fake it so the defense follows you.`],
        },
      },
    };
  }

  const sonic = {
    id: 'sonic',
    name: 'Sonic',
    icon: '⚡',
    card: 'assets/img/card-sonic-run.png',
    tagline: 'A running play. An Outside Receiver is "Sonic": they zoom across behind the QB and take the ball the other way. Coach calls Left (#4 is Sonic) or Right (#5 is Sonic).',
    roles: {
      IRL: GO_ROLE,
      IRR: GO_ROLE,
      C: {
        job: 'First SNAP the ball. Then run straight down the field (a GO route).',
        how: [
          '\u{1F3C8} Snap the ball back to the QB on the cadence.',
          '\u{1F440} Watch the ball go all the way into the QB\'s hands.',
          '\u{1F4A8} Turn and run straight up the field as fast as you can.',
          HANDS,
          CATCH,
        ],
        coach: ['Assignment (from the wristband card): Snap ball on cadence, then run a Go route.'],
      },
      QB: {
        job: 'Take the snap and hand the ball to Sonic as they zoom by.',
        how: [
          '\u{1F4E3} Call the cadence LOUD. Sonic starts running when you say "Down".',
          CADENCE_STEP,
          '\u{1F3C8} Catch the snap with two hands.',
          '\u{1F504} Turn toward Sonic.',
          '\u{1F440} Watch your hand put the ball right in Sonic\'s tummy as they zoom by.',
        ],
        coach: [QB_ALL_COACH, `Handoff: ${QB_HANDOFF_COACH}`],
      },
    },
    groups: [{ id: 'handoff', name: 'Handoff' }],
    variations: [sonicVariation('left'), sonicVariation('right')],
  };

  const GLOSSARY = [
    ['Line of scrimmage (LOS)', 'The line where the ball sits before the play. Receivers stand on it.'],
    ['Snap', 'The Center hands or tosses the ball back to the QB to start the play.'],
    ['Cadence', 'The words the QB yells at the line: always Ready, Down, Set, Hut-1, plus Hut-2 when the call is "on two". The ball is snapped on the called word.'],
    ['Route', 'The path a receiver runs.'],
    ['Flat', 'The open grass out near the sideline, not far past the line.'],
    ['Go route', 'Run straight down the field, far and fast.'],
    ['In route', 'Run 5 steps, then cut toward the middle. On Boom Pass, settle, then keep going across to the other side.'],
    ['Hook', 'Run 5 steps, then turn around to face the QB.'],
    ['Swing (banana)', 'The RB curves out to the side, like a banana, to catch a short pass.'],
    ['Handoff', 'The QB puts the ball right into a teammate\'s tummy.'],
    ['Toss', 'The QB gently pitches the ball to the RB.'],
    ['Motion', 'A player runs sideways before the snap. Sonic does this.'],
    ['Spot number', 'Every spot has a number that never changes. With fewer players, the highest numbers sit out.'],
    ['Play side', 'The side of the field the play is going to. Coach calls Right or Left.'],
    ['Tuck', 'Squeeze the ball tight against your body after the catch.'],
  ];

  // Snap counts. The QB calls "on one" (etc.) twice in the huddle. At the line
  // the cadence is always Ready, Down, Set, Hut-1, and Hut-2 only on two.
  // The ball is snapped on the called word.
  const CADENCES = [
    { id: 'set', label: 'Set', call: 'on set', preSnap: ['Ready...', 'Down...'], snapWord: 'SET!' },
    { id: 'one', label: 'One', call: 'on one', preSnap: ['Ready...', 'Down...', 'Set...'], snapWord: 'HUT-1!' },
    { id: 'two', label: 'Two', call: 'on two', preSnap: ['Ready...', 'Down...', 'Set...', 'Hut-1...'], snapWord: 'HUT-2!' },
  ];
  const DEFAULT_CADENCE = 'one';

  // Team size rule: with fewer players, the highest spot numbers sit out.
  // 7 v 7 everyone plays, 6 v 6 #7 sits, 5 v 5 #6 and #7 sit. Nobody's job changes.
  const TEAM_SIZES = [7, 6, 5];

  function sitsOut(posId, teamSize) {
    return POSITIONS[posId].num > teamSize;
  }

  function getRole(play, variation, posId) {
    const base = play.roles[posId] || {};
    const over = (variation.roles || {})[posId] || {};
    return { ...base, ...over };
  }

  const api = { ORDER, POSITIONS, ALIGNMENT, PRACTICE, GLOSSARY, PLAYS: [boom, sonic], RUN_TIP, TEAM_SIZES, sitsOut, getRole, CADENCES, DEFAULT_CADENCE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Playbook = api;
})(typeof window !== 'undefined' ? window : globalThis);
