/** Schematic muscle emphasis, not an exhaustive list of muscles involved. */
const regions = {
  upperChest: ['Upper chest', 'front', 'M35 39 Q45 34 49 39 L49 45 L35 44Z'],
  chest: ['Chest', 'front', 'M35 39 Q43 35 49 39 L49 51 Q40 55 35 48Z'],
  lowerChest: ['Lower chest', 'front', 'M35 46 L49 47 L49 53 Q40 56 35 50Z'],
  frontDelts: ['Front delts', 'front', 'M34 36 Q25 36 25 49 L32 50 L36 41Z'],
  sideDelts: ['Side delts', 'front', 'M28 36 Q20 39 21 52 L27 54 L30 43Z'],
  rearDelts: ['Rear delts', 'back', 'M34 36 Q24 35 23 49 L31 51 L36 41Z'],
  lats: ['Lats', 'back', 'M34 48 L45 53 L47 77 L40 72 L34 58Z'],
  upperBack: ['Upper back', 'back', 'M47 30 L34 40 L37 52 L48 61Z'],
  lowerBack: ['Lower back', 'back', 'M44 61 L48 60 L48 81 L42 79Z'],
  biceps: ['Biceps', 'front', 'M25 51 Q32 50 30 61 L26 68 L21 66Z'],
  brachialis: ['Brachialis', 'front', 'M22 54 L25 55 L24 67 L20 68Z'],
  forearms: ['Forearms', 'front', 'M20 68 L26 70 L20 86 L15 85Z'],
  triceps: ['Triceps', 'back', 'M24 51 Q33 50 30 62 L25 69 L20 65Z'],
  glutes: ['Glutes', 'back', 'M38 80 Q45 77 49 83 L49 94 Q40 99 35 91Z'],
  quads: ['Quads', 'front', 'M36 88 L48 88 L46 115 L40 121 L35 110Z'],
  hamstrings: ['Hamstrings', 'back', 'M36 96 L48 97 L45 119 L38 121 L35 111Z'],
  calves: ['Calves', 'back', 'M38 124 L45 124 L44 140 L39 148 L35 137Z'],
  abs: ['Abs', 'front', 'M43 55 L49 55 L49 62 L43 62Z M43 64 L49 64 L49 71 L43 71Z M43 73 L49 73 L49 82 L44 79Z'],
  obliques: ['Obliques', 'front', 'M35 55 L41 59 L41 79 L36 83 L33 70Z'],
} as const;
type Region = keyof typeof regions;
type Target = { primary: Region[]; secondary: Region[] };
const targets: Record<string, Target> = {};
function add(names: string[], primary: Region[], secondary: Region[] = []) {
  for (const name of names) targets[name] = { primary, secondary };
}
add(['bench press', 'dumbbell press', 'push up'], ['chest'], ['frontDelts', 'triceps']);
add(['incline bench press', 'incline dumbbell press'], ['upperChest'], ['frontDelts', 'triceps']);
add(['decline bench press', 'chest dips'], ['lowerChest'], ['triceps']);
add(['cable fly', 'pec deck'], ['chest']);
add(['lat pulldown', 'pull up', 'chin up'], ['lats'], ['biceps']);
add(['barbell row', 'seated cable row'], ['upperBack', 'lats'], ['rearDelts']);
add(['dumbbell row'], ['lats'], ['upperBack']);
add(['deadlift'], ['lowerBack', 'glutes', 'hamstrings'], ['upperBack']);
add(['overhead press', 'dumbbell shoulder press'], ['frontDelts', 'sideDelts'], ['triceps']);
add(['lateral raise'], ['sideDelts']);
add(['front raise'], ['frontDelts']);
add(['reverse fly', 'face pull'], ['rearDelts'], ['upperBack']);
add(['barbell curl', 'dumbbell curl', 'preacher curl', 'cable curl'], ['biceps']);
add(['hammer curl'], ['brachialis', 'forearms'], ['biceps']);
add(['tricep pushdown', 'skull crushers', 'overhead tricep extension', 'close grip bench press', 'bench dips'], ['triceps']);
add(['barbell squat', 'bodyweight squat', 'leg press'], ['quads', 'glutes']);
add(['leg extension', 'wall sit'], ['quads']);
add(['leg curl'], ['hamstrings']);
add(['romanian deadlift'], ['hamstrings', 'glutes'], ['lowerBack']);
add(['calf raise'], ['calves']);
add(['crunch', 'hanging leg raise', 'cable crunch', 'plank', 'hollow hold'], ['abs']);
add(['bicycle crunch'], ['abs', 'obliques']);
add(['side plank'], ['obliques']);

const normalize = (name: string) => name.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
const cache = new Map<string, { uri: string; label: string }>();

/** Inline SVG is bundled with the app and requires no network or native dependency. */
export function exerciseTargetArt(name: string) {
  const key = normalize(name);
  const existing = cache.get(key);
  if (existing) return existing;
  const target = targets[key];
  if (!target) return undefined;
  const back = target.primary.some((region) => regions[region][1] === 'back');
  const side = back ? 'back' : 'front';
  const paths = Object.entries(regions).filter(([, region]) => region[1] === side).map(([id, region]) => {
    const fill = target.primary.includes(id as Region) ? '#b8f35b' : target.secondary.includes(id as Region) ? '#699a44' : '#303a40';
    return `<g fill="${fill}" stroke="#11191e" stroke-width="0.7"><path d="${region[2]}"/><path d="${region[2]}" transform="translate(100 0) scale(-1 1)"/></g>`;
  }).join('');
  const label = target.primary.map((region) => regions[region][0]).join(' + ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="180" viewBox="0 0 100 180"><rect width="100" height="180" rx="12" fill="#10171c"/><g fill="#242e35" stroke="#53616b" stroke-width="0.8"><ellipse cx="50" cy="18" rx="9" ry="11"/><path d="M44 28 L44 32 L30 36 Q21 38 20 50 L17 67 L10 87 Q10 93 15 91 L22 76 L29 60 L33 52 L35 76 L32 89 L34 116 L35 126 L33 150 L30 156 Q36 160 41 155 L46 132 L50 106 L54 132 L59 155 Q64 160 70 156 L67 150 L65 126 L66 116 L68 89 L65 76 L67 52 L71 60 L78 76 L85 91 Q90 93 90 87 L83 67 L80 50 Q79 38 70 36 L56 32 L56 28Z"/></g>${paths}<text x="50" y="171" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#a6b3bb">${back ? 'BACK' : 'FRONT'}</text></svg>`;
  const result = { uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, label };
  cache.set(key, result);
  return result;
}
