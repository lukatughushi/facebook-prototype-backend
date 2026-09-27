/**
 * Mock-data seed: 200+ users with friendships, groups, pages, 500+ posts
 * (timelines, groups, pages) with reactions/comments/replies, a few live
 * stories, 20 Watch reels, 50 Marketplace listings and ~70 shares (posts
 * that re-share a post or reel). Built with @faker-js/faker using a fixed seed, so the same
 * data comes out every run.
 *
 * Safe to re-run against a shared database: every document it creates is
 * tagged `seeded: true`, and each run first removes exactly those (plus any
 * references real accounts hold to seeded users) before inserting fresh data.
 * Real accounts only gain pending friend requests from seeded people and
 * memberships in seeded groups/pages - all undone by the next cleanup.
 *
 *   npm run seed:mock                     # default sizes
 *   npm run seed:mock -- --users=300 --posts=900
 *   npm run seed:mock -- --clean          # remove mock data only
 *
 * Every seeded account's password is Password123!
 */
import '../dns-fix';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Post, PostDocument, ReactionType } from '../posts/schemas/post.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Page, PageDocument } from '../pages/schemas/page.schema';
import { Story, StoryDocument } from '../stories/schemas/story.schema';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
import { Notification, NotificationDocument } from '../notifications/schemas/notification.schema';
import { Reel, ReelDocument } from '../reels/schemas/reel.schema';
import { MarketplaceItem, MarketplaceItemDocument, Condition } from '../marketplace/schemas/marketplace-item.schema';
import { PRODUCT_CATALOG } from './data/marketplace-catalog';
import { MUSIC_TRACKS, PROPERTY_LISTINGS, REEL_CLIPS } from './data/reels-and-property';

// ---------------------------------------------------------------- options

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}`));
const num = (name: string, fallback: number) => Number(arg(name)?.split('=')[1]) || fallback;

const USER_COUNT = num('users', 220);
const POST_COUNT = num('posts', 600);
const STORY_COUNT = num('stories', 12);
const REEL_COUNT = Math.min(num('reels', 20), REEL_CLIPS.length);
const SHARE_COUNT = num('shares', 70);
const CLEAN_ONLY = !!arg('clean');
const PASSWORD = 'Password123!';
const DAY = 24 * 60 * 60 * 1000;

faker.seed(num('seed', 2026));

// ---------------------------------------------------------------- helpers

const oid = () => new Types.ObjectId();
const pick = <T>(xs: readonly T[]) => xs[faker.number.int({ min: 0, max: xs.length - 1 })];
const sample = <T>(xs: readonly T[], n: number) => faker.helpers.arrayElements(xs as T[], Math.min(n, xs.length));
const chance = (p: number) => faker.number.float({ min: 0, max: 1 }) < p;
const between = (from: Date, to: Date) => faker.date.between({ from, to });
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
const picsum = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

// Skews toward recent: most posts land in the last week or two.
const recentDate = (maxDaysAgo: number) =>
  new Date(Date.now() - Math.pow(faker.number.float({ min: 0, max: 1 }), 2) * maxDaysAgo * DAY - faker.number.int({ min: 1, max: 55 }) * 60000);

const REACTION_WEIGHTS: { weight: number; value: ReactionType }[] = [
  { weight: 46, value: 'like' },
  { weight: 22, value: 'love' },
  { weight: 8, value: 'care' },
  { weight: 12, value: 'haha' },
  { weight: 7, value: 'wow' },
  { weight: 3, value: 'sad' },
  { weight: 2, value: 'angry' },
];

// ---------------------------------------------------------------- content

const GROUPS = [
  { name: 'Frontend Developers Hub', category: 'Tech', privacy: 'public', description: 'React, Vue, CSS tricks and everything that renders in a browser. Share what you are building and get feedback.' },
  { name: 'Backend & Cloud Engineers', category: 'Tech', privacy: 'public', description: 'APIs, databases, queues and the occasional 3 a.m. incident post-mortem.' },
  { name: 'AI Builders Circle', category: 'Tech', privacy: 'private', description: 'A focused group for people shipping ML and LLM features in production.' },
  { name: 'Weekend Trail Runners', category: 'Sports', privacy: 'public', description: 'Long runs, easy pace, coffee after. All speeds welcome - nobody gets left behind.' },
  { name: 'Sunday League Football', category: 'Sports', privacy: 'public', description: 'Fixtures, lineups, highlights and banter for our amateur league.' },
  { name: 'Home Gym Heroes', category: 'Sports', privacy: 'public', description: 'Garage setups, programming tips and progress check-ins.' },
  { name: 'Retro Gaming Collectors', category: 'Gaming', privacy: 'public', description: 'Cartridges, CRTs and the hunt for complete-in-box classics.' },
  { name: 'Indie Game Devs', category: 'Gaming', privacy: 'public', description: 'Devlogs, playtests and launch-day nerves from small studios and solo devs.' },
  { name: 'Board Game Night', category: 'Gaming', privacy: 'private', description: 'Organizing weekly game nights. Bring snacks, leave your competitive streak at the door.' },
  { name: 'Film Photography Club', category: 'Photography', privacy: 'public', description: 'Rolls, scans and darkroom experiments. Post your favorite frame of the week.' },
  { name: 'Street Photography Collective', category: 'Photography', privacy: 'public', description: 'Candid moments, city light and the stories in between.' },
  { name: 'Northside Makers', category: 'DIY', privacy: 'public', description: 'Woodworking, electronics and 3D printing. Show your builds, share your jigs.' },
  { name: 'Riverside Book Circle', category: 'Books', privacy: 'private', description: 'One book a month, one long conversation about it.' },
  { name: 'Plant Parents Anonymous', category: 'Home & Garden', privacy: 'public', description: 'Repotting advice, pest emergencies and new-leaf celebrations.' },
  { name: 'Home Cooks Kitchen', category: 'Food', privacy: 'public', description: 'Weeknight dinners, weekend projects and honest recipe reviews.' },
  { name: 'Budget Travelers Club', category: 'Travel', privacy: 'public', description: 'Cheap flights, hidden gems and packing lists that actually work.' },
  { name: 'New Parents Support', category: 'Family', privacy: 'private', description: 'A kind place for sleep-deprived questions at any hour.' },
  { name: 'Local Musicians Network', category: 'Music', privacy: 'public', description: 'Find bandmates, share gigs and swap gear.' },
] as const;

// Fictional brands, communities and public figures - no real entities.
const PAGES = [
  { name: 'Kiln & Co. Ceramics', category: 'Brand', description: 'Handmade ceramics for everyday tables. Small batches, fired in our own studio.' },
  { name: 'Ridgeline Running Co.', category: 'Brand', description: 'Trail shoes built for long, wet miles.' },
  { name: 'Northwind Coffee Roasters', category: 'Brand', description: 'Single-origin beans, roasted on Tuesdays, shipped on Wednesdays.' },
  { name: 'Pixel Forge Studio', category: 'Brand', description: 'Independent game studio making cozy puzzle games.' },
  { name: 'Brightside Bikes', category: 'Brand', description: 'Commuter bikes and repair workshops for everyone.' },
  { name: 'Lumen Camera Supply', category: 'Brand', description: 'Film, lenses and repairs for analog photographers.' },
  { name: 'Green Thumb Nursery', category: 'Brand', description: 'Rare houseplants and good advice.' },
  { name: 'City Food Bank Volunteers', category: 'Community', description: 'Sorting, packing and delivering meals across the city every weekend.' },
  { name: 'Open Source Saturdays', category: 'Community', description: 'Monthly meetup helping first-time contributors land their first pull request.' },
  { name: 'Riverfront Cleanup Crew', category: 'Community', description: 'Gloves, bags and good company. Join a cleanup near you.' },
  { name: 'Downtown Farmers Market', category: 'Community', description: 'Local growers, bakers and makers every Saturday morning.' },
  { name: 'Neighborhood Chess Club', category: 'Community', description: 'Casual games, weekly blitz and beginner lessons.' },
  { name: 'Dr. Maya Okonkwo', category: 'Public figure', description: 'Astrophysicist and science communicator. Talking about the universe, one question at a time.' },
  { name: 'Chef Luca Bellandi', category: 'Public figure', description: 'Chef, cookbook author and pasta evangelist.' },
  { name: 'Ava Lindqvist Music', category: 'Public figure', description: 'Singer-songwriter. New album out this fall.' },
  { name: 'Coach Daniel Reyes', category: 'Public figure', description: 'Marathon coach helping first-timers reach the finish line.' },
  { name: 'Sofia Marin Photography', category: 'Public figure', description: 'Travel and documentary photographer.' },
  { name: 'The Daily Byte Podcast', category: 'Media', description: 'A 15-minute tech news podcast for busy developers.' },
] as const;

const TOPIC_POSTS: Record<string, (() => string)[]> = {
  Tech: [
    () => `Finally migrated our ${pick(['monolith', 'API', 'frontend', 'build pipeline'])} to ${pick(['TypeScript', 'Vite', 'NestJS', 'a monorepo', 'serverless'])}. Build times went from ${faker.number.int({ min: 6, max: 20 })} minutes to ${faker.number.int({ min: 1, max: 4 })}. Worth every painful PR.`,
    () => `Hot take: ${faker.hacker.phrase()} Change my mind.`,
    () => `What is everyone using for ${pick(['state management', 'end-to-end tests', 'feature flags', 'observability', 'auth'])} these days? Starting a new project and want to avoid regrets.`,
    () => `Spent the whole afternoon chasing a bug that turned out to be a missing ${pick(['await', 'semicolon', 'environment variable', 'index', 'dependency in a useEffect'])}. Classic.`,
    () => `Wrote up how we cut our ${pick(['bundle size', 'API latency', 'cloud bill', 'CI time'])} by ${faker.number.int({ min: 20, max: 70 })}%. Happy to share the notes if anyone is interested.`,
  ],
  Sports: [
    () => `${faker.number.int({ min: 8, max: 30 })} km this morning at an easy pace. Legs are tired, heart is full.`,
    () => `New personal best on ${pick(['deadlift', 'squat', 'the 5K', 'the 10K', 'the half marathon'])} today! Consistency really does pay off.`,
    () => `Match report: we won ${faker.number.int({ min: 1, max: 5 })}-${faker.number.int({ min: 0, max: 3 })}. Great team effort, and the keeper was unreal in the second half.`,
    () => `Anyone up for a ${pick(['Saturday', 'Sunday', 'Wednesday evening'])} session at ${faker.location.street()}? Meeting at ${pick(['7:00', '7:30', '8:00', '18:30'])}.`,
    () => `Rest day reminder: recovery is training too. Stretch, hydrate, sleep.`,
  ],
  Gaming: [
    () => `Just finished ${faker.commerce.productAdjective()} ${pick(['Quest', 'Legends', 'Odyssey', 'Tactics', 'Chronicles'])} after ${faker.number.int({ min: 20, max: 120 })} hours. That ending!`,
    () => `Found a complete-in-box copy at a garage sale for ${faker.number.int({ min: 2, max: 15 })} bucks. Best Sunday ever.`,
    () => `Devlog #${faker.number.int({ min: 3, max: 60 })}: added ${pick(['a new boss fight', 'controller support', 'a day/night cycle', 'co-op mode', 'save slots'])}. Feedback welcome!`,
    () => `Game night this week - who's bringing what? We have ${faker.number.int({ min: 4, max: 9 })} people confirmed.`,
  ],
  Photography: [
    () => `Golden hour at ${faker.location.city()} did not disappoint. Shot on ${pick(['35mm', '50mm', 'medium format', 'my phone, honestly'])}.`,
    () => `First roll through the new camera came back from the lab. ${faker.number.int({ min: 20, max: 36 })} frames, ${faker.number.int({ min: 3, max: 12 })} keepers. I'll take it.`,
    () => `Tried a new ${pick(['developer', 'film stock', 'editing preset', 'lens'])} this week. The colors are something else.`,
    () => `Photo walk this weekend around ${faker.location.street()}. Everyone welcome, bring whatever camera you have.`,
  ],
  DIY: [
    () => `Built a ${pick(['workbench', 'bookshelf', 'bird feeder', 'standing desk', 'plant stand'])} this weekend. Three trips to the hardware store, one blister.`,
    () => `Printed a replacement ${pick(['knob', 'bracket', 'clip', 'hinge'])} instead of buying a whole new part. 3D printers pay for themselves eventually, right?`,
    () => `Soldering tip that saved me today: ${pick(['clean your tip often', 'use more flux', 'tin both surfaces first'])}.`,
  ],
  Books: [
    () => `This month's pick: "${faker.book.title()}" by ${faker.book.author()}. Halfway through and already have opinions.`,
    () => `Finished "${faker.book.title()}" last night. Could not put it down for the last hundred pages.`,
  ],
  'Home & Garden': [
    () => `New leaf alert on my ${pick(['monstera', 'fiddle leaf fig', 'calathea', 'pothos', 'string of pearls'])}! Took ${faker.number.int({ min: 2, max: 8 })} months of patience.`,
    () => `Repotting day. The roots had completely taken over the pot.`,
  ],
  Food: [
    () => `Made ${faker.food.dish()} tonight and honestly it turned out better than the restaurant version.`,
    () => `Weeknight dinner in ${faker.number.int({ min: 15, max: 35 })} minutes: ${faker.food.dish()}. Recipe in the comments if anyone wants it.`,
    () => `Trying to use up a mountain of ${faker.food.vegetable().toLowerCase()} from the market. Ideas?`,
  ],
  Travel: [
    () => `Just landed in ${faker.location.city()}, ${faker.location.country()}. Any must-see spots for a ${faker.number.int({ min: 2, max: 6 })}-day trip?`,
    () => `Found flights for ${faker.number.int({ min: 40, max: 180 })} return by flying mid-week. Flexibility is everything.`,
  ],
  Family: [
    () => `We got ${faker.number.int({ min: 3, max: 6 })} hours of sleep in a row last night. Celebrating like it's a holiday.`,
    () => `Any tips for ${pick(['starting solids', 'daycare transitions', 'the 4-month sleep regression', 'road trips with a toddler'])}?`,
  ],
  Music: [
    () => `Looking for a ${pick(['drummer', 'bassist', 'keyboard player', 'vocalist'])} for weekend rehearsals. Mostly ${faker.music.genre().toLowerCase()} covers plus some originals.`,
    () => `Playing a small gig at ${faker.company.name()} this ${pick(['Friday', 'Saturday'])}. Come say hi!`,
  ],
};

const LIFE_POSTS: (() => string)[] = [
  () => `Weekend in ${faker.location.city()} with the best people. Already planning the next one.`,
  () => `Started a new job at ${faker.company.name()} today! Nervous and excited in equal measure.`,
  () => `Coffee, a good book and zero plans. Perfect Sunday.`,
  () => `Can't believe it's been ${faker.number.int({ min: 2, max: 10 })} years since ${pick(['graduation', 'we moved here', 'I started running', 'we adopted this goofball'])}.`,
  () => `Adopted a ${faker.animal.type()} named ${faker.person.firstName()}. Our home is officially chaos now.`,
  () => `Currently listening to "${faker.music.songName()}" on repeat. No regrets.`,
  () => `Tried ${faker.food.dish()} for the first time and I have questions about why nobody told me sooner.`,
  () => `Small win of the day: finally ${pick(['fixed the leaky tap', 'cleared my inbox', 'finished that puzzle', 'booked the dentist', 'ran without stopping'])}.`,
  () => `Sunset from the balcony tonight. Sometimes you just have to stop and look.`,
  () => `Happy birthday to my favorite person, ${faker.person.firstName()}! Here's to another year of adventures.`,
  () => `${faker.word.adjective({ length: { min: 4, max: 9 } }).replace(/^./, (c) => c.toUpperCase())} morning. Grateful for the little things.`,
  () => `Anyone have recommendations for a good ${pick(['dentist', 'mechanic', 'barber', 'yoga studio', 'bakery'])} near ${faker.location.street()}?`,
];

const PAGE_POSTS: Record<string, (() => string)[]> = {
  Brand: [
    () => `New drop this ${pick(['Friday', 'weekend', 'month'])}: ${faker.commerce.productName()}. Limited quantities!`,
    () => `Thank you for ${faker.number.int({ min: 2, max: 20 })}K followers! Use code THANKYOU for ${faker.number.int({ min: 10, max: 25 })}% off this week.`,
    () => `Behind the scenes: here's how our ${faker.commerce.product().toLowerCase()} gets made, start to finish.`,
  ],
  Community: [
    () => `Volunteers needed this ${pick(['Saturday', 'Sunday'])} from ${pick(['9', '10'])} a.m. Sign up in the comments - every pair of hands helps.`,
    () => `What a turnout! ${faker.number.int({ min: 20, max: 200 })} people showed up last weekend. Thank you all.`,
    () => `Our next meetup is at ${faker.location.streetAddress()}. Beginners especially welcome.`,
  ],
  'Public figure': [
    () => `Grateful for everyone who came out in ${faker.location.city()} last night. You made it unforgettable.`,
    () => `Answering your questions live this ${pick(['Thursday', 'Friday', 'Sunday'])}. Drop them below!`,
    () => `Something I wish I'd known earlier: ${faker.company.catchPhrase().toLowerCase()} matters more than you think.`,
  ],
  Media: [
    () => `New episode: ${faker.hacker.phrase()} Listen now wherever you get your podcasts.`,
    () => `This week on the show: ${faker.company.buzzPhrase()}. 15 minutes, no fluff.`,
  ],
};

const COMMENTS: (() => string)[] = [
  () => 'This is amazing!',
  () => 'Love this so much.',
  () => 'Where was this taken?',
  () => 'Congrats, well deserved!',
  () => 'Count me in!',
  () => 'Haha, this made my day.',
  () => 'Great tip, thanks for sharing.',
  () => 'Saving this for later.',
  () => 'I had the exact same experience last week.',
  () => 'How long did this take you?',
  () => 'Looks incredible 😍',
  () => 'So proud of you!',
  () => `Totally agree with ${faker.person.firstName()} on this one.`,
  () => `Have you tried ${faker.commerce.productName().toLowerCase()}? Changed everything for me.`,
  () => `Next time in ${faker.location.city()} we should meet up!`,
  () => 'Need the recipe for this ASAP.',
  () => 'Following for updates 👀',
];

const REPLIES: (() => string)[] = [
  () => 'Thank you!',
  () => 'Haha exactly!',
  () => 'Yes, definitely!',
  () => 'Will send you the details.',
  () => 'Right?! 😂',
  () => 'Appreciate it!',
  () => 'Good question - more soon.',
];

// ---------------------------------------------------------------- builders

type Id = Types.ObjectId;

function buildReactions(pool: Id[], max: number, min = 0) {
  const users = sample([...new Set(pool.map(String))].map((id) => new Types.ObjectId(id)), faker.number.int({ min, max }));
  return users.map((user) => ({ user, type: faker.helpers.weightedArrayElement(REACTION_WEIGHTS) }));
}

function buildComments(pool: Id[], postDate: Date) {
  const count = faker.helpers.weightedArrayElement([
    { weight: 30, value: 0 },
    { weight: 30, value: faker.number.int({ min: 1, max: 2 }) },
    { weight: 30, value: faker.number.int({ min: 3, max: 5 }) },
    { weight: 10, value: faker.number.int({ min: 6, max: 9 }) },
  ]);
  const now = new Date();
  return sample(pool, count)
    .map((author) => {
      const createdAt = between(postDate, now);
      const replies = chance(0.3)
        ? sample(pool, faker.number.int({ min: 1, max: 2 })).map((replier) => ({
            _id: oid(),
            author: replier,
            content: pick(REPLIES)(),
            reactions: buildReactions(pool, 3),
            createdAt: between(createdAt, now),
          }))
        : [];
      return {
        _id: oid(),
        author,
        content: pick(COMMENTS)(),
        reactions: buildReactions(pool, 6),
        replies: replies.sort((a, b) => +a.createdAt - +b.createdAt),
        createdAt,
      };
    })
    .sort((a, b) => +a.createdAt - +b.createdAt);
}

// ---------------------------------------------------------------- main

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const User_ = app.get<Model<UserDocument>>(getModelToken(User.name));
  const Post_ = app.get<Model<PostDocument>>(getModelToken(Post.name));
  const Group_ = app.get<Model<GroupDocument>>(getModelToken(Group.name));
  const Page_ = app.get<Model<PageDocument>>(getModelToken(Page.name));
  const Story_ = app.get<Model<StoryDocument>>(getModelToken(Story.name));
  const Message_ = app.get<Model<MessageDocument>>(getModelToken(Message.name));
  const Notification_ = app.get<Model<NotificationDocument>>(getModelToken(Notification.name));
  const Reel_ = app.get<Model<ReelDocument>>(getModelToken(Reel.name));
  const Item_ = app.get<Model<MarketplaceItemDocument>>(getModelToken(MarketplaceItem.name));

  // ---- cleanup: only what a previous run created
  const oldIds = await User_.find({ seeded: true }).distinct('_id');
  const [reelsGone, itemsGone] = await Promise.all([
    Reel_.deleteMany({ $or: [{ seeded: true }, { author: { $in: oldIds } }] }),
    Item_.deleteMany({ $or: [{ seeded: true }, { seller: { $in: oldIds } }] }),
  ]);
  const [posts, groups, pages, stories, users] = await Promise.all([
    Post_.deleteMany({ $or: [{ seeded: true }, { author: { $in: oldIds } }] }),
    Group_.deleteMany({ seeded: true }),
    Page_.deleteMany({ seeded: true }),
    Story_.collection.deleteMany({ $or: [{ seeded: true }, { author: { $in: oldIds } }] }),
    User_.deleteMany({ seeded: true }),
  ]);
  if (oldIds.length) {
    await Promise.all([
      User_.updateMany({}, { $pull: { friends: { $in: oldIds }, friendRequests: { from: { $in: oldIds } } } }),
      Message_.deleteMany({ $or: [{ sender: { $in: oldIds } }, { receiver: { $in: oldIds } }] }),
      Notification_.deleteMany({ $or: [{ sender: { $in: oldIds } }, { recipient: { $in: oldIds } }] }),
      // Seeded users' reactions/comments on real posts (none are created, but
      // a real user may have interacted after accepting a seeded friend).
      Post_.updateMany(
        {},
        {
          $pull: {
            likes: { $in: oldIds },
            shares: { $in: oldIds },
            reactions: { user: { $in: oldIds } },
            comments: { author: { $in: oldIds } },
          },
        },
      ),
    ]);
  }
  console.log(
    `Cleanup: removed ${users.deletedCount} users, ${posts.deletedCount} posts, ${groups.deletedCount} groups, ` +
      `${pages.deletedCount} pages, ${stories.deletedCount} stories, ${reelsGone.deletedCount} reels, ` +
      `${itemsGone.deletedCount} listings from previous mock runs.`,
  );
  if (CLEAN_ONLY) {
    await app.close();
    return;
  }

  const realUsers = await User_.find({ role: 'user', isActive: true }).select('_id name');
  const takenEmails = new Set(await User_.find().distinct('email'));
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  // ---- users
  const userDocs = Array.from({ length: USER_COUNT }, (_, i) => {
    const sex = faker.person.sexType();
    const first = faker.person.firstName(sex);
    const last = faker.person.lastName();
    let email = `${slug(first)}.${slug(last)}${i + 1}@example.com`;
    while (takenEmails.has(email)) email = `${slug(first)}.${slug(last)}${faker.number.int(99999)}@example.com`;
    takenEmails.add(email);
    const createdAt = faker.date.past({ years: 3, refDate: new Date(now.getTime() - 60 * DAY) });
    const city = `${faker.location.city()}, ${faker.location.state()}`;
    return {
      _id: oid(),
      name: `${first} ${last}`,
      email,
      password: passwordHash,
      role: 'user',
      avatar: chance(0.88)
        ? `https://randomuser.me/api/portraits/${sex === 'female' ? 'women' : 'men'}/${faker.number.int({ min: 0, max: 99 })}.jpg`
        : '',
      coverImage: chance(0.65) ? picsum(`hearth-cover-${i}`, 1200, 450) : '',
      bio: chance(0.85) ? faker.person.bio().slice(0, 101) : '',
      work: chance(0.75) ? faker.company.name().slice(0, 100) : '',
      education: chance(0.6) ? `${faker.location.city()} ${pick(['University', 'College', 'Institute of Technology', 'State University'])}` : '',
      city: chance(0.8) ? city : '',
      hometown: chance(0.55) ? `${faker.location.city()}, ${faker.location.country()}` : '',
      isActive: true,
      friends: [] as Id[],
      friendRequests: [] as { from: Id; createdAt: Date }[],
      seeded: true,
      createdAt,
      updatedAt: createdAt,
      __v: 0,
    };
  });
  const userIds = userDocs.map((u) => u._id);
  const byId = new Map(userDocs.map((u) => [u._id.toString(), u]));

  // Symmetric friendships: each user reaches out to a handful of others,
  // giving an average of ~15 friends with some very social outliers.
  const friendSets = new Map(userIds.map((id) => [id.toString(), new Set<string>()]));
  for (const u of userDocs) {
    const k = faker.helpers.weightedArrayElement([
      { weight: 60, value: faker.number.int({ min: 2, max: 8 }) },
      { weight: 30, value: faker.number.int({ min: 9, max: 15 }) },
      { weight: 10, value: faker.number.int({ min: 16, max: 30 }) },
    ]);
    for (const other of sample(userIds, k)) {
      if (other.equals(u._id)) continue;
      friendSets.get(u._id.toString())!.add(other.toString());
      friendSets.get(other.toString())!.add(u._id.toString());
    }
  }
  for (const u of userDocs) u.friends = [...friendSets.get(u._id.toString())!].map((s) => new Types.ObjectId(s));

  // Some pending requests between seeded users who aren't friends yet.
  for (const u of userDocs) {
    const mine = friendSets.get(u._id.toString())!;
    const candidates = userIds.filter((id) => !id.equals(u._id) && !mine.has(id.toString()));
    u.friendRequests = sample(candidates, faker.number.int({ min: 0, max: 3 })).map((from) => ({ from, createdAt: recentDate(10) }));
  }

  // ---- groups
  const groupDocs = GROUPS.map((g, i) => {
    const members = sample(userIds, faker.number.int({ min: 25, max: 140 }));
    const createdAt = faker.date.past({ years: 2, refDate: new Date(now.getTime() - 60 * DAY) });
    return {
      _id: oid(),
      ...g,
      coverImage: picsum(`hearth-group-${slug(g.name)}`, 1200, 450),
      members: [...members],
      admins: sample(members, faker.number.int({ min: 1, max: 3 })),
      seeded: true,
      createdAt,
      updatedAt: createdAt,
      __v: 0,
    };
  });

  // ---- pages
  const pageDocs = PAGES.map((p) => {
    const createdAt = faker.date.past({ years: 3, refDate: new Date(now.getTime() - 60 * DAY) });
    return {
      _id: oid(),
      ...p,
      avatar: picsum(`hearth-page-avatar-${slug(p.name)}`, 300, 300),
      coverImage: picsum(`hearth-page-cover-${slug(p.name)}`, 1200, 450),
      followers: sample(userIds, faker.number.int({ min: 30, max: 200 })),
      admins: sample(userIds, faker.number.int({ min: 1, max: 2 })),
      seeded: true,
      createdAt,
      updatedAt: createdAt,
      __v: 0,
    };
  });

  // Real accounts get a taste of everything: requests, groups, pages.
  for (const real of realUsers) {
    for (const g of sample(groupDocs.filter((x) => x.privacy === 'public'), 4)) g.members.push(real._id);
    for (const g of sample(groupDocs.filter((x) => x.privacy === 'private'), 1)) g.members.push(real._id);
    for (const p of sample(pageDocs, 4)) p.followers.push(real._id);
  }

  // ---- posts
  const postDocs = Array.from({ length: POST_COUNT }, (_, n) => {
    const kind = faker.helpers.weightedArrayElement([
      { weight: 55, value: 'user' },
      { weight: 27, value: 'group' },
      { weight: 18, value: 'page' },
    ]);
    const createdAt = recentDate(45);
    let author: Id;
    let content: string;
    let pool: Id[];
    let extra: Record<string, unknown> = {};
    let audience: 'Public' | 'Friends' = 'Public';

    if (kind === 'group') {
      const g = pick(groupDocs);
      const seededMembers = g.members.filter((m) => byId.has(m.toString()));
      author = pick(seededMembers);
      content = pick(TOPIC_POSTS[g.category] || LIFE_POSTS)();
      pool = seededMembers;
      extra = { group: g._id };
    } else if (kind === 'page') {
      const p = pick(pageDocs);
      author = pick(p.admins);
      content = pick(PAGE_POSTS[p.category] || PAGE_POSTS.Community)();
      pool = p.followers.filter((f) => byId.has(f.toString()));
      extra = { page: p._id };
    } else {
      const u = pick(userDocs);
      author = u._id;
      const topic = pick(Object.keys(TOPIC_POSTS));
      content = pick(chance(0.65) ? LIFE_POSTS : TOPIC_POSTS[topic])();
      // Friends react most; a few strangers too for public posts.
      pool = [...u.friends, ...sample(userIds, 10)];
      audience = chance(0.2) ? 'Friends' : 'Public';
      if (audience === 'Friends') pool = [...u.friends];
    }

    const reactions = buildReactions(pool, kind === 'page' ? 80 : 45);
    return {
      _id: oid(),
      author,
      content,
      image: chance(0.42) ? picsum(`hearth-post-${n}`, 1000, 750) : '',
      audience,
      ...extra,
      likes: reactions.map((r) => r.user),
      reactions,
      shares: [] as Id[], // filled in by the share posts below
      comments: buildComments(pool, createdAt),
      seeded: true,
      createdAt,
      updatedAt: createdAt,
      __v: 0,
    };
  });

  // Real accounts receive a few pending friend requests from seeded people.
  const requestOps = realUsers.map((real) => ({
    updateOne: {
      filter: { _id: real._id },
      update: {
        $push: {
          friendRequests: {
            $each: sample(userIds, 3).map((from) => ({ from, createdAt: recentDate(5) })),
          },
        },
      },
    },
  }));

  // ---- stories (live for the next 24h, like real ones)
  const storyDocs = sample(userDocs, STORY_COUNT).flatMap((u, i) =>
    Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, (_, j) => {
      const createdAt = new Date(now.getTime() - faker.number.int({ min: 5, max: 20 * 60 }) * 60000);
      return {
        _id: oid(),
        author: u._id,
        image: picsum(`hearth-story-${i}-${j}`, 540, 960),
        text: chance(0.5) ? pick(LIFE_POSTS)().slice(0, 120) : '',
        expiresAt: new Date(createdAt.getTime() + DAY),
        seeded: true,
        createdAt,
        __v: 0,
      };
    }),
  );

  // ---- reels (Watch)
  const reelDocs = REEL_CLIPS.slice(0, REEL_COUNT).map((clip) => {
    const createdAt = recentDate(20);
    const reactions = buildReactions(userIds, 190, 15);
    return {
      _id: oid(),
      ...clip,
      author: pick(userIds),
      reactions,
      likes: reactions.map((r) => r.user),
      shares: [] as Id[],
      comments: buildComments(userIds, createdAt),
      musicTrack: chance(0.75) ? pick(MUSIC_TRACKS) : { title: 'Original audio', artist: '' },
      views: reactions.length * faker.number.int({ min: 6, max: 25 }),
      seeded: true,
      createdAt,
      updatedAt: createdAt,
      __v: 0,
    };
  });

  // ---- marketplace: used goods priced off retail by condition, plus property
  const CONDITION_PRICING: { weight: number; value: [Condition, number, number] }[] = [
    { weight: 15, value: ['New', 0.8, 0.95] },
    { weight: 35, value: ['Used - Like new', 0.6, 0.8] },
    { weight: 35, value: ['Used - Good', 0.45, 0.65] },
    { weight: 15, value: ['Used - Fair', 0.25, 0.45] },
  ];
  const nicePrice = (n: number) => (n < 100 ? Math.max(1, Math.round(n)) : n < 1000 ? Math.round(n / 5) * 5 : Math.round(n / 50) * 50);
  const place = () => `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`;
  const pickup = () => pick(['Pickup only.', 'Can meet halfway.', 'Cash or bank transfer.', 'Serious buyers only, please.', 'Price is firm.', 'Open to reasonable offers.']);

  const itemDocs = [
    ...PRODUCT_CATALOG.map((c) => {
      const [condition, lo, hi] = faker.helpers.weightedArrayElement(CONDITION_PRICING);
      const vehicle = c.category === 'Vehicles';
      const details = vehicle
        ? `${faker.number.int({ min: 2014, max: 2023 })} model, ${faker.number.int({ min: 8, max: 140 }) * 1000} miles. Clean title, service records available.`
        : condition === 'New'
          ? 'Brand new, never used - still in the box.'
          : `${condition.replace('Used - ', '')} condition, ${pick(['barely used', 'lightly used', 'well looked after', 'minor signs of wear'])}.`;
      return { ...c, condition, price: nicePrice(c.retail * faker.number.float({ min: lo, max: hi })), description: `${c.description}\n\n${details} ${pickup()}` };
    }),
    ...PROPERTY_LISTINGS.map((p) => ({ ...p, category: 'Property' as const, condition: 'Used - Good' as Condition })),
  ].map((it) => {
    const createdAt = recentDate(30);
    return {
      _id: oid(),
      title: it.title,
      price: it.price,
      category: it.category,
      condition: it.condition,
      location: place(),
      description: it.description,
      imageUrls: it.images,
      seller: pick(userIds),
      status: chance(0.08) ? 'sold' : 'available',
      seeded: true,
      createdAt,
      updatedAt: createdAt,
      __v: 0,
    };
  });

  // ---- shares: new posts that re-share a public post or a reel
  const shareable = postDocs.filter((p) => p.audience === 'Public' && !('group' in p && groupDocs.find((g) => g._id.equals(p.group as Id))?.privacy === 'private'));
  const SHARE_CAPTIONS = [
    'This made my day 😂', 'Everyone needs to see this', 'So true!', 'Saving this one.', 'Wow 😮', 'Couldn\'t agree more.',
    'Look at this!', 'Adding this to the bucket list', 'Sharing for my friends who need it', '❤️',
  ];
  const sharePosts = Array.from({ length: SHARE_COUNT }, () => {
    const reel = chance(0.3);
    const original: any = reel ? pick(reelDocs) : pick(shareable);
    const sharer = pick(userIds.filter((id) => !id.equals(original.author)));
    original.shares.push(sharer);
    const createdAt = between(original.createdAt, now);
    const sharerDoc = byId.get(sharer.toString())!;
    const pool = [...sharerDoc.friends, ...sample(userIds, 5)];
    const reactions = buildReactions(pool, 25);
    return {
      _id: oid(),
      author: sharer,
      content: chance(0.6) ? pick(SHARE_CAPTIONS) : '',
      image: '',
      audience: 'Public',
      ...(reel ? { sharedReel: original._id } : { sharedPost: original._id }),
      likes: reactions.map((r) => r.user),
      reactions,
      shares: [] as Id[],
      comments: chance(0.4) ? buildComments(pool, createdAt) : [],
      seeded: true,
      createdAt,
      updatedAt: createdAt,
      __v: 0,
    };
  });
  postDocs.push(...(sharePosts as any));

  // ---- write (raw inserts keep our explicit timestamps; batches for Atlas)
  const insert = async (model: Model<any>, docs: object[], label: string) => {
    for (let i = 0; i < docs.length; i += 250) await model.collection.insertMany(docs.slice(i, i + 250), { ordered: false });
    console.log(`Inserted ${docs.length} ${label}`);
  };
  await insert(User_, userDocs, 'users');
  await insert(Group_, groupDocs, 'groups');
  await insert(Page_, pageDocs, 'pages');
  await insert(Post_, postDocs, 'posts');
  await insert(Story_, storyDocs, 'stories');
  await insert(Reel_, reelDocs, 'reels');
  await insert(Item_, itemDocs, 'marketplace listings');
  if (requestOps.length) await User_.bulkWrite(requestOps);

  const friendships = userDocs.reduce((n, u) => n + u.friends.length, 0) / 2;
  const comments = postDocs.reduce((n, p) => n + p.comments.length + p.comments.reduce((r, c) => r + c.replies.length, 0), 0);
  const reactions = postDocs.reduce((n, p) => n + p.reactions.length, 0);
  console.log(
    `\nMock data ready: ${USER_COUNT} users (${friendships} friendships), ${groupDocs.length} groups, ` +
      `${pageDocs.length} pages, ${POST_COUNT} posts + ${sharePosts.length} shares (${reactions} reactions, ${comments} comments/replies), ` +
      `${storyDocs.length} stories, ${reelDocs.length} reels, ${itemDocs.length} marketplace listings.` +
      `\n${realUsers.length} real account(s) got 3 friend requests each plus group/page memberships.` +
      `\nLog in as any seeded user, e.g. ${userDocs[0].email} / ${PASSWORD}`,
  );

  await app.close();
}

run().catch((err) => {
  console.error('Mock seed failed:', err);
  process.exit(1);
});
