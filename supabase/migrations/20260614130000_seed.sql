insert into public.classes (slug, name_no, name_en, age_min, age_max, capacity, description_no, description_en, curriculum_no, curriculum_en, sort_order, published)
values
  (
    'gule-fugler',
    'Gule fugler (6-7 år)',
    'Yellow Birds (ages 6-7)',
    6, 7, 10,
    'En kjærlig og leken introduksjon til islam for de minste. Vi lærer gjennom sanger, tegninger og enkle historier.',
    'A warm and playful introduction to Islam for our youngest students. We learn through songs, drawings and simple stories.',
    'Weekend Learning - modul 1',
    'Weekend Learning - module 1',
    10, true
  ),
  (
    'groenne-trær',
    'Grønne trær (8-9 år)',
    'Green Trees (ages 8-9)',
    8, 9, 12,
    'Vi bygger videre på grunnlaget fra Gule fugler og begynner å lære arabiske bokstaver og enkle bønner.',
    'Building on the foundation from Yellow Birds, we start learning Arabic letters and simple prayers.',
    'Weekend Learning - modul 2',
    'Weekend Learning - module 2',
    20, true
  ),
  (
    'blå-stjerner',
    'Blå stjerner (10-11 år)',
    'Blue Stars (ages 10-11)',
    10, 11, 12,
    'Elevene lærer å lese Koranen med tajwid og utforsker islams fem søyler mer i dybden.',
    'Students learn to read the Quran with tajwid and explore the five pillars of Islam in greater depth.',
    'Understand Quran - nivå 1',
    'Understand Quran - level 1',
    30, true
  ),
  (
    'hvite-ørner',
    'Hvite ørner (12-13 år)',
    'White Eagles (ages 12-13)',
    12, 13, 10,
    'Koranforståelse og islamsk etikk i fokus. Elevene begynner å forstå budskapet bak versene.',
    'Quranic understanding and Islamic ethics in focus. Students begin to grasp the message behind the verses.',
    'Understand Quran - nivå 2',
    'Understand Quran - level 2',
    40, true
  ),
  (
    'gylne-hånder',
    'Gylne hender (14-15 år)',
    'Golden Hands (ages 14-15)',
    14, 15, 10,
    'Arabisk grammatikk og Koranlæsing med forståelse. Vi bruker Madina-metoden for en solid base i klassisk arabisk.',
    'Arabic grammar and Quran reading with comprehension. We use the Madina method for a solid grounding in classical Arabic.',
    'Madina Arabic - bok 1',
    'Madina Arabic - book 1',
    50, true
  ),
  (
    'sølv-vinger',
    'Sølvvinger (16-18 år)',
    'Silver Wings (ages 16-18)',
    16, 18, 8,
    'For eldre ungdom som ønsker å fordype seg i arabisk og islamsk kunnskap på et høyere nivå.',
    'For older youth who want to deepen their knowledge of Arabic and Islamic studies at a higher level.',
    'Madina Arabic - bok 2 og 3',
    'Madina Arabic - books 2 and 3',
    60, true
  );

insert into public.events (slug, title_no, title_en, excerpt_no, excerpt_en, body_no, body_en, location, starts_at, ends_at, published)
values
  (
    'eid-feiring-2026',
    'Eid-feiring med Islamskole Bærum',
    'Eid Celebration with Islamskole Bærum',
    'Bli med oss for en minneverdig Eid-feiring fylt med mat, glede og samvær.',
    'Join us for a memorable Eid celebration filled with food, joy and togetherness.',
    'Vi inviterer alle elever, foreldre og søsken til vår store Eid-feiring. Det blir mat fra ulike kulturer, aktiviteter for barna og en felles bønn. Ta med hele familien!',
    'We invite all students, parents and siblings to our big Eid celebration. There will be food from various cultures, activities for the children and a communal prayer. Bring the whole family!',
    'Skuiveien 40, 1339 Vøyenenga',
    '2026-09-27 12:00:00+02',
    '2026-09-27 16:00:00+02',
    true
  ),
  (
    'foreldremoete-hoest-2026',
    'Foreldremøte - høst 2026',
    'Parent Meeting - autumn 2026',
    'Bli kjent med lærerne og finn ut hva barna dine lærer i år.',
    'Meet the teachers and find out what your children will be learning this year.',
    'Vi holder et åpent foreldremøte der lærerne presenterer årets pensum og forventninger. Det er god anledning til å stille spørsmål og bli kjent med de andre foreldrene.',
    'We are holding an open parent meeting where teachers will present the year''s curriculum and expectations. It is a great opportunity to ask questions and get to know the other parents.',
    'Skuiveien 40, 1339 Vøyenenga',
    '2026-08-30 13:00:00+02',
    '2026-08-30 15:00:00+02',
    true
  ),
  (
    'koran-konkurranse-2026',
    'Koran-konkurranse 2026',
    'Quran Competition 2026',
    'Vis frem det du har lært og konkurrér med elever fra andre klasser.',
    'Show off what you have learned and compete with students from other classes.',
    'Vår årlige Koran-konkurranse er åpen for alle elever. Det konkurreres i resitasjon med tajwid, memorering og oversettelse. Det deles ut diplomer og premier til alle deltakere.',
    'Our annual Quran competition is open to all students. Competition categories include recitation with tajwid, memorisation and translation. Diplomas and prizes are awarded to all participants.',
    'Skuiveien 40, 1339 Vøyenenga',
    '2026-11-22 11:00:00+01',
    '2026-11-22 15:00:00+01',
    true
  ),
  (
    'foerste-skoledag-2026',
    'Første skoledag 2026/2027',
    'First Day of School 2026/2027',
    'Et nytt skoleår starter - kom og møt lærerne og klassekameratene dine.',
    'A new school year begins - come and meet your teachers and classmates.',
    'Skoleåret 2026/2027 starter offisielt. Nye elever ønskes spesielt velkommen. Foreldre er velkomne til å bli med de første 30 minuttene. Det serveres te og kjeks.',
    'The 2026/2027 school year officially begins. New students are especially welcome. Parents are welcome to stay for the first 30 minutes. Tea and biscuits will be served.',
    'Skuiveien 40, 1339 Vøyenenga',
    '2026-08-23 10:00:00+02',
    '2026-08-23 12:00:00+02',
    true
  );

insert into public.info_blocks (key, title_no, title_en, body_no, body_en, sort_order)
values
  (
    'hero',
    'Islamskole Bærum',
    'Islamskole Bærum',
    'Vi er en søndagsskole for muslimske barn og unge i Bærum. Hvert søndag møtes vi for å lære om islam, arabisk og Koranen i et trygt og inkluderende miljø.',
    'We are a Sunday school for Muslim children and youth in Bærum. Every Sunday we gather to learn about Islam, Arabic and the Quran in a safe and inclusive environment.',
    10
  ),
  (
    'values',
    'Våre verdier',
    'Our values',
    'Vi tror på kunnskap, respekt og fellesskap. Undervisningen vår er tilpasset ulike aldersgrupper og tar utgangspunkt i barnas hverdag i Norge.',
    'We believe in knowledge, respect and community. Our teaching is adapted to different age groups and is rooted in the children''s everyday life in Norway.',
    20
  );
