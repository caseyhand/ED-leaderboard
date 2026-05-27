// Seed data — canonical first week
export const SEED_WEEKS = [
  {
    id: "2025-W19",
    label: "Week of 5/3–5/9",
    dateRange: "May 3–9, 2025",
    physicians: [
      { letter: "H", pts: 48, pthr: 2.53, esi1: 0, esi2: 9,  esi3: 36, esi4: 2,  esi5: 0 },
      { letter: "I", pts: 45, pthr: 2.50, esi1: 0, esi2: 10, esi3: 30, esi4: 5,  esi5: 0 },
      { letter: "E", pts: 61, pthr: 2.35, esi1: 1, esi2: 17, esi3: 36, esi4: 6,  esi5: 1 },
      { letter: "J", pts: 39, pthr: 2.17, esi1: 1, esi2: 11, esi3: 22, esi4: 5,  esi5: 0 },
      { letter: "K", pts: 36, pthr: 2.12, esi1: 1, esi2: 10, esi3: 22, esi4: 1,  esi5: 1 },
      { letter: "C", pts: 57, pthr: 2.11, esi1: 0, esi2: 15, esi3: 30, esi4: 4,  esi5: 0 },
      { letter: "L", pts: 33, pthr: 2.06, esi1: 0, esi2: 6,  esi3: 24, esi4: 3,  esi5: 0 },
      { letter: "B", pts: 56, pthr: 2.00, esi1: 0, esi2: 8,  esi3: 33, esi4: 12, esi5: 2 },
      { letter: "G", pts: 47, pthr: 1.96, esi1: 0, esi2: 9,  esi3: 22, esi4: 15, esi5: 1 },
      { letter: "M", pts: 31, pthr: 1.94, esi1: 0, esi2: 5,  esi3: 16, esi4: 10, esi5: 0 },
      { letter: "A", pts: 59, pthr: 1.90, esi1: 1, esi2: 14, esi3: 37, esi4: 7,  esi5: 0 },
      { letter: "N", pts: 30, pthr: 1.88, esi1: 0, esi2: 8,  esi3: 20, esi4: 2,  esi5: 0 },
      { letter: "P", pts: 15, pthr: 1.88, esi1: 0, esi2: 5,  esi3: 8,  esi4: 2,  esi5: 0 },
      { letter: "O", pts: 26, pthr: 1.63, esi1: 1, esi2: 3,  esi3: 11, esi4: 11, esi5: 0 },
      { letter: "D", pts: 40, pthr: 1.48, esi1: 0, esi2: 8,  esi3: 29, esi4: 2,  esi5: 0 },
      { letter: "F", pts: 35, pthr: 1.40, esi1: 0, esi2: 7,  esi3: 21, esi4: 7,  esi5: 0 },
      { letter: "Q", pts: 11, pthr: 1.38, esi1: 0, esi2: 8,  esi3: 3,  esi4: 0,  esi5: 0 },
      { letter: "R", pts: 0,  pthr: null, esi1: 0, esi2: 1,  esi3: 0,  esi4: 0,  esi5: 0 },
      { letter: "S", pts: 0,  pthr: null, esi1: 0, esi2: 0,  esi3: 0,  esi4: 0,  esi5: 0 },
      { letter: "T", pts: 0,  pthr: null, esi1: 0, esi2: 0,  esi3: 0,  esi4: 0,  esi5: 0 },
    ]
  }
];

// Default name mappings — admin can update these
export const DEFAULT_NAMES = {
  "H": "Casey"
};

export const ADMIN_PASSWORD = "ed2025";
