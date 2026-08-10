import type { Client, StoredShare } from "./database";
import type { ShareExport, SharedEvent, SharedLoudnessEntry } from "@/domain/share-types";

/**
 * Two example clients with realistic shared files, so the practice app can
 * be explored before any real file arrives. Dates are generated relative to
 * `now` so the examples always look current. Ids are stable: reloading the
 * examples overwrites them instead of duplicating.
 */

const DAY = 24 * 60 * 60 * 1000;

function day(now: Date, daysAgo: number): string {
  return new Date(now.getTime() - daysAgo * DAY).toISOString().slice(0, 10);
}

function at(now: Date, daysAgo: number, hour: number): string {
  const d = new Date(now.getTime() - daysAgo * DAY);
  d.setHours(hour, 12, 0, 0);
  return d.toISOString();
}

function loud(now: Date, entries: [number, number][]): SharedLoudnessEntry[] {
  return entries.map(([daysAgo, loudness]) => ({ at: at(now, daysAgo, 20), loudness }));
}

export function buildExampleData(now: Date): { clients: Client[]; shares: StoredShare[] } {
  const clients: Client[] = [
    {
      id: "client_example_maya",
      name: "Maya R.",
      notes: "Thursdays 16:00. Working on family boundaries.",
      createdAt: at(now, 90, 10),
    },
    {
      id: "client_example_jonas",
      name: "Jonas K.",
      notes: "Every other Monday. Grief and life transitions.",
      createdAt: at(now, 75, 10),
    },
  ];

  // --- Maya, recent share: last six weeks ---
  const mayaRecent: ShareExport = {
    app: "one-current-share",
    version: 1,
    exportedAt: at(now, 1, 18),
    from: day(now, 42),
    to: day(now, 1),
    threads: [
      {
        id: "thread_maya_sister",
        title: "The argument with my sister",
        description: "Since the blow-up about the inheritance we barely talk.",
        kind: "relationship",
        orientation: "relationship",
        status: "active",
        startedOn: day(now, 55),
        feelings: ["calm", "closeness"],
        anxieties: ["anger", "guilt"],
        needs: ["being heard", "fairness"],
        originalBelief: "If I push back, I lose her.",
        currentBelief: "We can disagree and still be sisters.",
        controllability: "influenceable",
        loudness: loud(now, [
          [50, 3], // baseline before the window
          [38, 3.8],
          [30, 4.2],
          [22, 3.6],
          [15, 2.9],
          [6, 2.4],
        ]),
        events: [
          {
            on: day(now, 38),
            kind: "moment",
            momentType: "trigger",
            title: "She brought up the inheritance again",
            description: "Same script as always — I went quiet, then furious afterwards.",
            impact: 4,
            effect: "stronger",
          },
          {
            on: day(now, 30),
            kind: "action-decided",
            title: "Write her a letter I don't send",
            durationMinutes: 30,
            instruction: "Sit down with paper, write everything unsaid, seal it away.",
            minimumVersion: "Three honest sentences.",
            completionDefinition: "The letter exists and stays in the drawer.",
            qualitiesCarried: ["honesty"],
            representedAs: "putting the anger into words",
          },
          { on: day(now, 29), kind: "action-done", title: "Write her a letter I don't send" },
          {
            on: day(now, 15),
            kind: "moment",
            momentType: "shift",
            title: "Coffee together, easier than expected",
            impact: 2,
            effect: "lighter",
            beliefAdded: "She misses me too.",
          },
        ] satisfies SharedEvent[],
      },
      {
        id: "thread_maya_sleep",
        title: "Sleep keeps breaking at 4am",
        description: "Waking with a racing mind most nights.",
        kind: "body",
        orientation: "body",
        status: "active",
        startedOn: day(now, 40),
        anxieties: ["restlessness"],
        needs: ["rest"],
        controllability: "changeable",
        loudness: loud(now, [
          [40, 3],
          [33, 3.5],
          [20, 4.1],
          [8, 3.2],
        ]),
        events: [
          { on: day(now, 40), kind: "started" },
          {
            on: day(now, 20),
            kind: "action-decided",
            title: "No screens after 22:00",
            instruction: "Phone charges in the kitchen; a paper book by the bed.",
            minimumVersion: "Phone out of the bedroom, even if I read nothing.",
            completionDefinition: "One full week without the phone in the bedroom.",
            representedAs: "protecting the night",
          },
          { on: day(now, 18), kind: "action-done", title: "No screens after 22:00" },
          {
            on: day(now, 8),
            kind: "moment",
            momentType: "shift",
            title: "First full night in weeks",
            impact: 3,
            effect: "lighter",
          },
        ],
      },
      {
        id: "thread_maya_interview",
        title: "Job interview dread",
        description: "The senior role I almost didn't apply for.",
        kind: "projection",
        orientation: "future",
        status: "merged",
        startedOn: day(now, 41),
        integratedOn: day(now, 12),
        feelings: ["confidence", "self-trust"],
        anxieties: ["dread"],
        originalBelief: "If they see me hesitate, it's over.",
        currentBelief: "Being seen thinking is not failing.",
        controllability: "changeable",
        qualitiesReclaimed: ["steadiness", "self-trust"],
        loudness: loud(now, [
          [41, 4],
          [35, 4.5],
          [20, 3.5],
          [12, 1.5],
        ]),
        events: [
          { on: day(now, 41), kind: "started" },
          {
            on: day(now, 33),
            kind: "moment",
            momentType: "insight",
            title: "Rehearsed answers out loud",
            description: "Hearing my own voice made the scenarios smaller.",
            impact: 2,
            effect: "lighter",
          },
          {
            on: day(now, 20),
            kind: "action-decided",
            title: "Mock interview with Sam",
            durationMinutes: 45,
            instruction: "Sam asks the five questions I fear most; I answer without notes.",
            minimumVersion: "Two questions, answered badly, out loud.",
            completionDefinition: "We got through all five.",
            qualitiesCarried: ["steadiness"],
            representedAs: "practising being seen",
          },
          { on: day(now, 19), kind: "action-done", title: "Mock interview with Sam" },
          {
            on: day(now, 12),
            kind: "integrated",
            result: "merged",
            resolution:
              "The interview happened and went fine. The dread was about being seen failing, not about the job.",
            contributionKind: "lesson",
            contribution: "Preparation shrinks dread; avoidance feeds it.",
            reclaimed: ["steadiness", "self-trust"],
            stillValid: ["This role matters to me."],
            outdatedBeliefs: ["If they see me hesitate, it's over."],
            released: ["Rehearsing catastrophes at night"],
          },
        ],
      },
    ],
  };

  // --- Maya, older share: the six weeks before that ---
  const mayaOlder: ShareExport = {
    app: "one-current-share",
    version: 1,
    exportedAt: at(now, 43, 18),
    from: day(now, 84),
    to: day(now, 43),
    threads: [
      {
        id: "thread_maya_sister",
        title: "The argument with my sister",
        description: "Since the blow-up about the inheritance we barely talk.",
        kind: "relationship",
        orientation: "relationship",
        status: "active",
        startedOn: day(now, 55),
        feelings: ["calm", "closeness"],
        anxieties: ["anger", "guilt"],
        needs: ["being heard", "fairness"],
        originalBelief: "If I push back, I lose her.",
        controllability: "influenceable",
        loudness: loud(now, [
          [55, 3.4],
          [50, 3],
        ]),
        events: [
          { on: day(now, 55), kind: "started" },
          {
            on: day(now, 48),
            kind: "moment",
            momentType: "trigger",
            title: "Phone call ended with her hanging up",
            impact: 5,
            effect: "stronger",
          },
        ],
      },
      {
        id: "thread_maya_money",
        title: "Money spreadsheet avoidance",
        description: "Three months of statements I refuse to open.",
        kind: "event",
        orientation: "past",
        status: "active",
        startedOn: day(now, 80),
        anxieties: ["overwhelm"],
        needs: ["control"],
        controllability: "changeable",
        returnedCount: 1,
        loudness: loud(now, [
          [80, 2.5],
          [66, 3.2],
          [52, 3.9],
          [45, 3.1],
        ]),
        events: [
          { on: day(now, 80), kind: "started" },
          {
            on: day(now, 60),
            kind: "action-decided",
            title: "Open the spreadsheet for ten minutes",
            durationMinutes: 10,
            instruction: "Timer on, spreadsheet open, no fixing — just look.",
            minimumVersion: "Open the file and read one row.",
            completionDefinition: "Ten minutes of looking, timer rang.",
            representedAs: "facing the numbers",
          },
          { on: day(now, 58), kind: "action-done", title: "Open the spreadsheet for ten minutes" },
          {
            on: day(now, 52),
            kind: "moment",
            momentType: "insight",
            title: "Found the forgotten subscription",
            impact: 2,
            effect: "lighter",
          },
        ],
      },
    ],
  };

  // --- Jonas, one share ---
  const jonasShare: ShareExport = {
    app: "one-current-share",
    version: 1,
    exportedAt: at(now, 3, 18),
    from: day(now, 45),
    to: day(now, 3),
    threads: [
      {
        id: "thread_jonas_father",
        title: "Father's diagnosis",
        description: "Waiting for the oncology results, nothing to do but wait.",
        kind: "waiting",
        orientation: "outside-control",
        status: "active",
        startedOn: day(now, 70),
        startedLabel: "early spring",
        feelings: ["calm", "sleep"],
        anxieties: ["dread", "helplessness"],
        needs: ["closeness with Dad"],
        controllability: "outside-control",
        waiting: {
          awaiting: "The second-opinion results from the clinic",
          actionTaken: "Scheduled the second opinion, drove him to the appointment",
          outsideControl: ["The results themselves", "How fast the lab works"],
          reviewDate: day(now, -4),
          reopenConditions: ["New symptoms", "The clinic calls early"],
          continueMeanwhile: ["Sunday calls", "My own work week"],
          reclaimedNow: ["evenings"],
        },
        loudness: loud(now, [
          [60, 3.5], // baseline before the window
          [40, 4.4],
          [31, 4.8],
          [24, 4],
          [10, 3.3],
        ]),
        events: [
          {
            on: day(now, 40),
            kind: "moment",
            momentType: "step",
            title: "Second opinion scheduled",
            impact: 3,
            effect: "different",
          },
          {
            on: day(now, 31),
            kind: "action-decided",
            title: "Call Dad every Sunday",
            instruction: "Every Sunday after lunch, no agenda, just talk.",
            minimumVersion: "A five-minute call.",
            completionDefinition: "Four Sundays in a row.",
            qualitiesCarried: ["tenderness"],
            representedAs: "being close without fixing",
          },
          { on: day(now, 24), kind: "action-done", title: "Call Dad every Sunday" },
          {
            on: day(now, 10),
            kind: "moment",
            momentType: "shift",
            title: "He laughed on the phone today",
            impact: 2,
            effect: "lighter",
            beliefAdded: "He is still himself, whatever the results say.",
          },
        ],
      },
      {
        id: "thread_jonas_band",
        title: "Quitting the band",
        description: "Fifteen years of Thursday rehearsals — who am I without them?",
        kind: "identity",
        orientation: "identity",
        status: "merged",
        startedOn: day(now, 44),
        integratedOn: day(now, 8),
        feelings: ["joy", "energy"],
        anxieties: ["sadness", "guilt"],
        originalBelief: "If I quit, I stop being a musician.",
        currentBelief: "The music is mine; the schedule was the band's.",
        controllability: "changeable",
        qualitiesReclaimed: ["evenings", "playfulness"],
        loudness: loud(now, [
          [44, 3],
          [36, 3.7],
          [25, 4.2],
          [14, 2.8],
          [8, 1.4],
        ]),
        events: [
          { on: day(now, 44), kind: "started" },
          {
            on: day(now, 36),
            kind: "moment",
            momentType: "insight",
            title: "Rehearsal felt like a chore again",
            description: "Third week running I dreaded going.",
            impact: 3,
            effect: "stronger",
          },
          {
            on: day(now, 25),
            kind: "action-decided",
            title: "Tell the others before Friday",
            durationMinutes: 20,
            instruction: "Say it plainly at the start of rehearsal, not the end.",
            minimumVersion: "Tell Erik alone if the room is too hard.",
            completionDefinition: "They all know, from me.",
            qualitiesCarried: ["honesty"],
            representedAs: "choosing my own shape",
          },
          { on: day(now, 22), kind: "action-done", title: "Tell the others before Friday" },
          {
            on: day(now, 8),
            kind: "integrated",
            result: "merged",
            resolution: "Music stays; the obligation goes. I can still sit in on sessions.",
            contributionKind: "decision",
            contribution: "Thursdays belong to me again.",
            reclaimed: ["evenings", "playfulness"],
            stillValid: ["Playing music matters to me."],
            outdatedBeliefs: ["If I quit, I stop being a musician."],
            released: ["Weekly rehearsal duty", "Guilt about the others"],
            conflicts: [
              {
                type: "connection-vs-independence",
                demandA: "Stay for the people",
                demandB: "Leave for myself",
                resolution: "Keep the friendships, drop the schedule.",
              },
            ],
          },
        ],
      },
      {
        id: "thread_jonas_deposit",
        title: "Old flat, unresolved deposit",
        description: "€900 the landlord has been sitting on for a year.",
        kind: "event",
        orientation: "past",
        status: "active",
        startedOn: day(now, 100),
        anxieties: ["anger"],
        controllability: "influenceable",
        // Created before loudness tracking existed — the log is empty.
        loudness: [],
        events: [
          {
            on: day(now, 20),
            kind: "action-decided",
            title: "Email the landlord",
            durationMinutes: 15,
            instruction: "One firm email with the dates and the legal deadline.",
            minimumVersion: "A two-line email asking for a date.",
            completionDefinition: "Sent, with the paper trail attached.",
            representedAs: "asking for what is mine",
          },
          { on: day(now, 12), kind: "action-done", title: "Email the landlord" },
        ],
      },
    ],
  };

  const shares: StoredShare[] = [
    {
      id: "share_example_maya_recent",
      clientId: "client_example_maya",
      importedAt: at(now, 1, 18),
      data: mayaRecent,
    },
    {
      id: "share_example_maya_older",
      clientId: "client_example_maya",
      importedAt: at(now, 43, 18),
      data: mayaOlder,
    },
    {
      id: "share_example_jonas",
      clientId: "client_example_jonas",
      importedAt: at(now, 3, 18),
      data: jonasShare,
    },
  ];

  return { clients, shares };
}
