// Reel clips are free Mixkit stock videos (mixkit.co license); captions were
// written for what each clip actually shows. Music tracks are fictional.
const mixkit = (id: number) => ({
  videoUrl: `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`,
  posterUrl: `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`,
});

export const REEL_CLIPS = [
  { ...mixkit(4050), caption: 'Up, up and away at sunrise 🎈 bucket list: checked' },
  { ...mixkit(10150), caption: 'Window seat above the clouds never gets old ☁️' },
  { ...mixkit(1610), caption: 'Drove two hours from the city lights for this sky 🌌' },
  { ...mixkit(9540), caption: 'This year’s chili harvest is spicy 🌶️ hot sauce season incoming' },
  { ...mixkit(8930), caption: 'Coffee first, everything else later ☕' },
  { ...mixkit(15640), caption: 'Tiny coastal town, huge views. Would you live here?' },
  { ...mixkit(27840), caption: 'Night walk past the palace gates ✨ the lights are unreal' },
  { ...mixkit(29060), caption: 'Good vibes only today 😊' },
  { ...mixkit(38820), caption: 'Pool day > every other day 🌊' },
  { ...mixkit(39430), caption: 'City lights after dark. This place never sleeps.' },
  { ...mixkit(40040), caption: 'Road trip to the coast with zero plans 🚙' },
  { ...mixkit(42480), caption: 'Wood-fired pizza night 🍕 90 seconds in the oven' },
  { ...mixkit(43090), caption: 'Nothing but dust and open road 🏍️' },
  { ...mixkit(44920), caption: 'Imagine this being your office view 🚀🌍' },
  { ...mixkit(46140), caption: 'Desert hike before the heat kicked in 🏜️' },
  { ...mixkit(26620), caption: 'Charcuterie board for game night — rate it 1-10 🧀' },
  { ...mixkit(34550), caption: 'Early morning session in the park before work' },
  { ...mixkit(41260), caption: 'Wine tasting evening with the best company 🍷' },
  { ...mixkit(13810), caption: 'Reading the fine print of this month’s book club pick 📖' },
  { ...mixkit(45530), caption: 'First snow of the season ❄️ hot cocoa weather' },
];

export const MUSIC_TRACKS = [
  { title: 'Golden Hour Drive', artist: 'Neon Harbor' },
  { title: 'Paper Planes at Dawn', artist: 'The Quiet Coast' },
  { title: 'Slow Motion Summer', artist: 'Lumen & Vale' },
  { title: 'Midnight Transit', artist: 'Arcadia Lights' },
  { title: 'Wildflower Static', artist: 'Juniper Row' },
  { title: 'Weekend Frequencies', artist: 'Low Tide Club' },
  { title: 'Kites Over the City', artist: 'Mira Solen' },
  { title: 'Warm Static', artist: 'Cassette Hearts' },
];

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

export const PROPERTY_LISTINGS = [
  {
    title: 'Bright 2BR apartment near downtown (for rent)',
    price: 1850,
    description: 'Sunny corner unit with big windows, open living room and updated kitchen. Walking distance to shops and transit. Price is per month; 12-month lease, pets considered.',
    images: [unsplash('1560448204-e02f11c3d0e2'), unsplash('1484154218962-a197022b5858'), unsplash('1522708323590-d24dbb6b0267')],
  },
  {
    title: 'Modern 4BR villa with pool',
    price: 1250000,
    description: 'Architect-designed home with floor-to-ceiling glass, heated pool and landscaped garden. 4 bedrooms, 3.5 baths, two-car garage.',
    images: [unsplash('1580587771525-78b9dba3b914'), unsplash('1600596542815-ffad4c1539a9'), unsplash('1600607687939-ce8a6c25118c')],
  },
  {
    title: 'Cozy studio with plants and balcony (for rent)',
    price: 1100,
    description: 'Charming studio with high ceilings and lots of natural light. Laundry in building. Price is per month, utilities included.',
    images: [unsplash('1502672260266-1c1ef2d93688'), unsplash('1586023492125-27b2c045efd7')],
  },
  {
    title: 'Family home with double garage',
    price: 489000,
    description: '3 bedrooms, 2 baths on a quiet cul-de-sac. New roof in 2024, fenced backyard, close to schools and parks.',
    images: [unsplash('1605276374104-dee2a0ed3cd6'), unsplash('1493809842364-78817add7ffb')],
  },
  {
    title: 'Contemporary 3BR house with garden',
    price: 729000,
    description: 'Warm wood-and-glass design with an open-plan kitchen, big deck and mature trees. Move-in ready.',
    images: [unsplash('1600585154340-be6161a56a0c'), unsplash('1568605114967-8130f3a36994')],
  },
  {
    title: 'Cabin in the woods on 2 acres',
    price: 265000,
    description: 'Peaceful 2-bedroom cabin surrounded by pines. Wood stove, wraparound porch and a creek at the back of the lot.',
    images: [unsplash('1449844908441-8829872d2607')],
  },
];
