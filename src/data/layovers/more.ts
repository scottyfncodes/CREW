import type { LayoverGuide } from '../../core/types';
import { michelinSearchUrl, place } from './build';

const mk = (city: string) => (i: Parameters<typeof place>[1]) => place(city, i);

const noMichelin = (city: string, extra = ''): LayoverGuide['michelinCoverage'] => ({
  covered: false,
  note:
    `${city} is not part of an established MICHELIN Guide city selection. ` +
    `${extra}The picks here rest on James Beard recognition and local consensus — verify at the guide before assuming a rating.`.trim(),
  url: michelinSearchUrl(city),
});

const O = mk('Norfolk');
export const ORF: LayoverGuide = {
  key: 'orf',
  city: 'Norfolk',
  airports: ['KORF'],
  intro:
    'Norfolk is a working navy town on the water, with the largest naval base in the world across the river and a walkable downtown arts district. The botanical garden is effectively on the airport property.',
  michelinCoverage: noMichelin('Norfolk'),
  transitNote: 'The Tide light rail runs through downtown. The airport is about 15 minutes from the waterfront.',
  places: [
    O({ id: 'orf-nauticus', name: 'Nauticus & Battleship Wisconsin', category: 'museum',
        why: 'You can walk the deck of an Iowa-class battleship on the downtown waterfront. Hard to beat for scale.',
        dwellMinutes: 150, site: 'https://nauticus.org/', tags: ['rainy-day', 'must'] }),
    O({ id: 'orf-chrysler', name: 'Chrysler Museum of Art', category: 'museum',
        why: 'Free, serious collection, and a working glass studio with live glassblowing demonstrations.',
        dwellMinutes: 120, site: 'https://chrysler.org/', tags: ['free', 'rainy-day'] }),
    O({ id: 'orf-doumars', name: "Doumar's Cones & Barbecue", category: 'restaurant',
        why: 'The family invented the machine that rolls waffle ice cream cones, and still uses the original. Curb service, pulled pork, and a James Beard America’s Classic.',
        cuisine: 'Barbecue', price: 1, dwellMinutes: 40, tags: ['lunch', 'cheap', 'must'] }),
    O({ id: 'orf-botanical', name: 'Norfolk Botanical Garden', category: 'park',
        why: 'Wraps around the airport property — approach traffic passes directly overhead. A rare spotting-and-gardens combination.',
        dwellMinutes: 90, site: 'https://norfolkbotanicalgarden.org/', tags: ['near-airport', 'outdoors', 'run'] }),
    O({ id: 'orf-smartmouth', name: 'Smartmouth Brewing Company', category: 'brewery',
        why: 'Chelsea district taproom, easy walk-in, and the local default.',
        price: 1, dwellMinutes: 75, tags: ['group'] }),
    O({ id: 'orf-neon', name: 'NEON District', category: 'walk',
        why: 'Norfolk’s arts district — murals, galleries and a short self-guided walk between downtown and the Chrysler.',
        dwellMinutes: 60, tags: ['walkable', 'free', 'outdoors'] }),
  ],
  sources: [{ name: 'Visit Norfolk', url: 'https://www.visitnorfolk.com/', kind: 'reference' }],
};

const K = mk('Knoxville');
export const TYS: LayoverGuide = {
  key: 'tys',
  city: 'Knoxville',
  airports: ['KTYS'],
  intro:
    'Knoxville is a compact downtown built around Market Square, with the Tennessee River on one side and the Great Smoky Mountains an hour away. A long layover here can legitimately include a national park.',
  michelinCoverage: noMichelin('Knoxville'),
  transitNote: 'TYS is about 20 minutes south of downtown. Everything downtown is walkable once you are there.',
  places: [
    K({ id: 'tys-market-square', name: 'Market Square', category: 'walk',
        why: 'A pedestrian square that is the actual centre of Knoxville social life — restaurants, a farmers market in season, and the easiest orientation point in the city.',
        dwellMinutes: 60, tags: ['walkable', 'free'] }),
    K({ id: 'tys-jc-holdway', name: 'JC Holdway', category: 'restaurant',
        why: 'James Beard Award-winning chef Joseph Lenn cooking Appalachian ingredients over wood. The best meal in the city.',
        cuisine: 'Appalachian / American', price: 3, reservationRequired: true, dwellMinutes: 120, tags: ['dinner', 'special'] }),
    K({ id: 'tys-kbrew', name: 'K Brew', category: 'coffee',
        why: 'Local roaster with several locations; the reliable Knoxville coffee answer.',
        price: 1, dwellMinutes: 20, tags: ['coffee', 'quick', 'early'] }),
    K({ id: 'tys-sunsphere', name: 'Sunsphere', category: 'landmark',
        why: 'The gold glass ball left over from the 1982 World’s Fair, with an observation deck. Twenty minutes and a good view of the valley.',
        dwellMinutes: 30, tags: ['quick', 'walkable'] }),
    K({ id: 'tys-ijams', name: 'Ijams Nature Center', category: 'run',
        why: 'Trails, quarry swimming and river access ten minutes from downtown. The outdoor option that does not need a whole day.',
        dwellMinutes: 120, site: 'https://ijams.org/', tags: ['outdoors', 'run', 'free'] }),
    K({ id: 'tys-smokies', name: 'Great Smoky Mountains National Park', category: 'park',
        why: 'The most visited national park in the United States, roughly an hour from the airport. Only sensible on a long layover, but then it is the obvious choice.',
        dwellMinutes: 300, site: 'https://www.nps.gov/grsm/', tags: ['long-layover', 'outdoors', 'free'] }),
  ],
  sources: [{ name: 'Visit Knoxville', url: 'https://www.visitknoxville.com/', kind: 'reference' }],
};

const C = mk('Charleston');
export const CHS: LayoverGuide = {
  key: 'chs',
  city: 'Charleston',
  airports: ['KCHS'],
  intro:
    'Charleston is one of the great American food cities and a peninsula you can cross on foot. If you get an overnight here, do not spend it at the hotel.',
  michelinCoverage: noMichelin('Charleston SC', 'Charleston has more James Beard recognition than almost any city its size. '),
  transitNote: 'CHS is about 20 minutes from the historic peninsula. Once downtown, walk.',
  places: [
    C({ id: 'chs-fig', name: 'FIG', category: 'restaurant',
        why: 'Food Is Good — a James Beard Outstanding Restaurant winner and still the benchmark for Charleston dining. Book ahead.',
        cuisine: 'Lowcountry / American', price: 3, reservationRequired: true, dwellMinutes: 120, tags: ['dinner', 'special'] }),
    C({ id: 'chs-rodney-scott', name: "Rodney Scott's Whole Hog BBQ", category: 'restaurant',
        why: 'James Beard Best Chef Southeast for whole-hog barbecue cooked over coals. No reservation, no fuss.',
        cuisine: 'Barbecue', price: 1, dwellMinutes: 45, site: 'https://rodneyscottsbbq.com/', tags: ['lunch', 'cheap', 'must'] }),
    C({ id: 'chs-callies', name: "Callie's Hot Little Biscuit", category: 'bakery',
        why: 'A counter, a biscuit, ten minutes. The correct Charleston breakfast when you have an afternoon show.',
        price: 1, dwellMinutes: 20, tags: ['early', 'quick', 'cheap'] }),
    C({ id: 'chs-ordinary', name: 'The Ordinary', category: 'restaurant',
        why: 'An oyster hall in a former bank building. Sit at the bar, order the shellfish tower, do not overthink it.',
        cuisine: 'Seafood / oysters', price: 3, dwellMinutes: 105, tags: ['dinner'] }),
    C({ id: 'chs-battery', name: 'The Battery & Rainbow Row', category: 'walk',
        why: 'The waterfront promenade and the pastel Georgian houses on East Bay. A one-hour loop that covers most of what people come here for.',
        dwellMinutes: 60, tags: ['walkable', 'free', 'outdoors'] }),
    C({ id: 'chs-fort-sumter', name: 'Fort Sumter National Historical Park', category: 'landmark',
        why: 'Reachable only by boat, which makes it a committed half-day — but it is where the Civil War started.',
        dwellMinutes: 180, site: 'https://www.nps.gov/fosu/', tags: ['long-layover'] }),
  ],
  sources: [{ name: 'Explore Charleston', url: 'https://www.charlestoncvb.com/', kind: 'reference' }],
};

const N = mk('Nashville');
export const BNA: LayoverGuide = {
  key: 'bna',
  city: 'Nashville',
  airports: ['KBNA'],
  intro:
    'Nashville is loud, and the loud part is easy to find. The quieter half — hot chicken, meat-and-three, the Ryman, Centennial Park — is what makes a layover here worth it.',
  michelinCoverage: noMichelin('Nashville'),
  transitNote: 'BNA is about 15 minutes from downtown, which is unusually close for a city this size.',
  places: [
    N({ id: 'bna-hattie-bs', name: "Hattie B's Hot Chicken", category: 'restaurant',
        why: 'The most accessible introduction to Nashville hot chicken. Start at medium; "Shut the Cluck Up" is not a dare you need to take before a duty day.',
        cuisine: 'Hot chicken', price: 1, dwellMinutes: 45, site: 'https://hattieb.com/', tags: ['lunch', 'cheap', 'must'] }),
    N({ id: 'bna-arnolds', name: "Arnold's Country Kitchen", category: 'restaurant',
        why: 'A James Beard America’s Classic meat-and-three. Lunch only, cafeteria line, and the roast beef is the move.',
        cuisine: 'Meat-and-three', price: 1, hours: 'Lunch only, weekdays', dwellMinutes: 45, tags: ['lunch', 'cheap', 'early'] }),
    N({ id: 'bna-husk', name: 'Husk Nashville', category: 'restaurant',
        why: 'Southern ingredients only, in a restored house on Rutledge Hill. The most serious sit-down meal within walking distance of downtown.',
        cuisine: 'Southern', price: 3, reservationRequired: true, dwellMinutes: 120, tags: ['dinner', 'special'] }),
    N({ id: 'bna-barista-parlor', name: 'Barista Parlor', category: 'coffee',
        why: 'The roaster that set the bar for Nashville coffee; the Germantown and East Nashville rooms are both worth the trip.',
        price: 1, dwellMinutes: 25, tags: ['coffee', 'early', 'quick'] }),
    N({ id: 'bna-ryman', name: 'Ryman Auditorium', category: 'landmark',
        why: 'The Mother Church of Country Music, and one of the best-sounding rooms in America. Daytime tours run even when there is no show.',
        dwellMinutes: 75, site: 'https://ryman.com/', tags: ['walkable', 'rainy-day', 'must'] }),
    N({ id: 'bna-parthenon', name: 'Centennial Park & the Parthenon', category: 'park',
        why: 'A full-scale concrete replica of the Parthenon, in a park, in Tennessee. Also the best running loop near downtown.',
        dwellMinutes: 60, tags: ['run', 'outdoors', 'free', 'weird'] }),
  ],
  sources: [{ name: 'Visit Music City', url: 'https://www.visitmusiccity.com/', kind: 'reference' }],
};

const T = mk('Pittsburgh');
export const PIT: LayoverGuide = {
  key: 'pit',
  city: 'Pittsburgh',
  airports: ['KPIT'],
  intro:
    'Three rivers, four hundred-odd bridges and a downtown wedged into a point. Pittsburgh is far more interesting than its reputation and the views are genuinely dramatic.',
  michelinCoverage: noMichelin('Pittsburgh'),
  transitNote: 'PIT is a solid 30 minutes from downtown. The 28X bus runs it cheaply if you have the time.',
  places: [
    T({ id: 'pit-incline', name: 'Duquesne Incline', category: 'landmark',
        why: 'An 1877 funicular up Mount Washington to the best city view in the eastern United States. Fifteen minutes and a few dollars.',
        dwellMinutes: 45, site: 'https://duquesneincline.org/', tags: ['quick', 'must', 'outdoors'] }),
    T({ id: 'pit-primanti', name: 'Primanti Brothers (Strip District)', category: 'restaurant',
        why: 'Fries and slaw inside the sandwich, originally so truckers could eat one-handed. The Strip District original is the one to go to.',
        cuisine: 'Sandwiches', price: 1, dwellMinutes: 40, tags: ['lunch', 'late', 'cheap'] }),
    T({ id: 'pit-apteka', name: 'Apteka', category: 'restaurant',
        why: 'Vegan Central and Eastern European cooking in Bloomfield that has drawn national attention. Nothing else like it.',
        cuisine: 'Central European / vegan', price: 2, dwellMinutes: 90, tags: ['dinner', 'vegetarian'] }),
    T({ id: 'pit-warhol', name: 'The Andy Warhol Museum', category: 'museum',
        why: 'The largest museum in North America dedicated to a single artist, in his home city. Seven floors, two hours.',
        dwellMinutes: 120, site: 'https://www.warhol.org/', tags: ['rainy-day'] }),
    T({ id: 'pit-strip', name: 'Strip District', category: 'market',
        why: 'A half-mile of produce houses, Italian delis, coffee roasters and fish markets. Morning is when it is alive.',
        price: 1, dwellMinutes: 90, tags: ['early', 'walkable', 'group'] }),
    T({ id: 'pit-point-state', name: 'Point State Park', category: 'run',
        why: 'Where the Allegheny and Monongahela become the Ohio, with riverfront trails running out from the fountain in both directions.',
        dwellMinutes: 60, tags: ['run', 'outdoors', 'free', 'walkable'] }),
  ],
  sources: [{ name: 'Visit Pittsburgh', url: 'https://www.visitpittsburgh.com/', kind: 'reference' }],
};
