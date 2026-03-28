/**
 * Domi Demo Seed Script
 * ---------------------
 * Creates fake CMU users + realistic doum data for demo purposes.
 * Also adds ratings to ALL existing users already in the database.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your-service-role-key \
 *   node scripts/seed.js
 *
 * The service role key is in: Supabase dashboard → Settings → API → service_role secret
 * All new accounts get password: Domi2024!
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'Domi2024!'

// ── Fake users ────────────────────────────────────────────────────────────────
const USERS = [
  { email: 'alex.chen@andrew.cmu.edu',     name: 'Alex Chen',       year: 'Junior',    major: 'Computer Science',           tokens: 120 },
  { email: 'jamie.park@andrew.cmu.edu',    name: 'Jamie Park',      year: 'Sophomore', major: 'Electrical Engineering',     tokens: 85  },
  { email: 'priya.nair@andrew.cmu.edu',    name: 'Priya Nair',      year: 'Senior',    major: 'Information Systems',        tokens: 200 },
  { email: 'marcus.wu@andrew.cmu.edu',     name: 'Marcus Wu',       year: 'Freshman',  major: 'Mechanical Engineering',     tokens: 40  },
  { email: 'sofia.russo@andrew.cmu.edu',   name: 'Sofia Russo',     year: 'Junior',    major: 'Fine Arts',                  tokens: 65  },
  { email: 'daniel.kim@andrew.cmu.edu',    name: 'Daniel Kim',      year: 'Senior',    major: 'Statistics',                 tokens: 150 },
  { email: 'aisha.obi@andrew.cmu.edu',     name: 'Aisha Obi',       year: 'Sophomore', major: 'Business Administration',    tokens: 95  },
  { email: 'ryan.schmidt@andrew.cmu.edu',  name: 'Ryan Schmidt',    year: 'Junior',    major: 'Physics',                    tokens: 30  },
  { email: 'mei.liu@andrew.cmu.edu',       name: 'Mei Liu',         year: 'Senior',    major: 'Human-Computer Interaction', tokens: 110 },
  { email: 'jordan.brooks@andrew.cmu.edu', name: 'Jordan Brooks',   year: 'Sophomore', major: 'Psychology',                 tokens: 75  },
  { email: 'natalie.wong@andrew.cmu.edu',  name: 'Natalie Wong',    year: 'Junior',    major: 'Architecture',               tokens: 60  },
  { email: 'ethan.ford@andrew.cmu.edu',    name: 'Ethan Ford',      year: 'Senior',    major: 'Chemical Engineering',       tokens: 45  },
  { email: 'isabella.reyes@andrew.cmu.edu',name: 'Isabella Reyes',  year: 'Freshman',  major: 'Biology',                    tokens: 20  },
  { email: 'leo.zhang@andrew.cmu.edu',     name: 'Leo Zhang',       year: 'Junior',    major: 'Finance',                    tokens: 130 },
  { email: 'amara.diallo@andrew.cmu.edu',  name: 'Amara Diallo',    year: 'Sophomore', major: 'Public Policy',              tokens: 55  },
]

// ── Task templates ────────────────────────────────────────────────────────────
// [posterIdx, runnerIdx|null, status, category, title, description, tokens, location, estMinutes, boosted, deadlineOffsetHours]
const TASKS = [
  // ── Completed ──
  [0, 1, 'completed', 'Errands & Pickup',
    'Pick up Amazon package from Hunt Library',
    'Package at Hunt Library package room. Drop at Mudge House room 204, ring doorbell.',
    15, 'Hunt Library → Mudge House', 30, false, null],

  [2, 3, 'completed', 'Tutoring & Academic',
    '15.110 Statistics midterm prep — regression help',
    'Struggling with multiple regression and hypothesis testing for my stats midterm Thursday. Walk me through practice problems. I have textbook + old exams.',
    25, 'Wean Hall Study Room 4', 90, false, null],

  [4, 5, 'completed', 'Tech Help',
    'Help set up dual monitor on MacBook',
    'Got a Dell monitor from CMU equipment loan. Need someone to help get it working with M2 MacBook Pro. Probably need an adapter.',
    12, 'West Wing Dorms', 45, false, null],

  [6, 7, 'completed', 'Moving',
    'Move boxes from storage to new room — Resnik → Stever',
    '6 medium boxes and a mini-fridge. Need someone with a cart ideally. Should be under an hour.',
    30, 'Resnik → Stever', 60, false, null],

  [8, 9, 'completed', 'Fitness & Wellness',
    'Running buddy for morning 5K on track',
    'Training for the Color Run in November. Looking for someone to run with me Tuesday morning 7–8am. All paces welcome!',
    10, 'CMU Track & Field', 60, false, null],

  [1, 2, 'completed', 'Errands & Pickup',
    'Print and bind thesis draft — Cohon FedEx',
    '80-page document, double-sided, color cover, spiral bound. File sent over email. Will Venmo printing costs on top of tokens.',
    20, 'Cohon University Center FedEx', 40, false, null],

  [3, 4, 'completed', 'Tutoring & Academic',
    'Python debugging — 15-112 homework',
    'Recursion function keeps hitting max depth. Need someone with strong Python skills. I\'m in Gates 3rd floor study area.',
    18, 'Gates-Hillman Center', 60, false, null],

  [10, 11, 'completed', 'Tech Help',
    'Help configure LaTeX on Overleaf — custom template',
    'My department has a specific LaTeX template for reports and I can\'t get the bibliography and figure numbering right. Need help remotely.',
    14, 'Remote / Zoom', 45, false, null],

  [12, 13, 'completed', 'Errands & Pickup',
    'Grocery run to Trader Joe\'s on Craig St',
    'List of 15 items, nothing perishable. I\'ll reimburse for groceries + Uber. Keep receipts.',
    22, 'Trader Joe\'s Craig St', 50, false, null],

  [14, 0, 'completed', 'Moving',
    'Help assemble IKEA Kallax shelf unit',
    'Got it from the CMU free pile. Need one more set of hands to hold it steady while I bolt it. Takes about 30 min.',
    12, 'Morewood Gardens', 30, false, null],

  // ── Accepted (in progress) ──
  [5, 6, 'accepted', 'Errands & Pickup',
    'Grab lunch from Entropy+ — bring to Doherty',
    'Stuck in lab. Order and bring: 1x spicy chicken sandwich + chips from Entropy. Will pay cash on delivery + tokens.',
    12, 'Entropy+ → Doherty Hall', 25, false, null],

  [7, 8, 'accepted', 'Tech Help',
    'Fix VS Code Python environment — keeps crashing',
    'Broken after conda update. Getting import errors on every file. Need someone to troubleshoot in-person or remote.',
    20, 'Newell-Simon Hall', 45, false, null],

  [9, 10, 'accepted', 'Moving',
    'Carry furniture to 3rd floor Roselawn',
    'IKEA desk + bookshelf arrived. Need help carrying up 3 flights. One other person confirmed. Saturday 2pm.',
    35, 'Roselawn Apartments', 90, false, null],

  [11, 12, 'accepted', 'Tutoring & Academic',
    'Mock interview prep — PM internship',
    'Have a PM interview at Google next week. Need someone to do 2 mock product design questions with me. MBA/CS students preferred.',
    30, 'Tepper Building', 60, false, null],

  // ── Open — will show in lanes ──
  [0, null, 'open', 'Errands & Pickup',
    'Return library books + pick up holds',
    '4 overdue books back to Hunt. While there pick up 2 holds under "Chen". Books left at dorm door.',
    10, 'Mudge House → Hunt Library', 35, false, 72],

  [1, null, 'open', 'Tutoring & Academic',
    '18-213 cache lab help',
    'Completely lost on the cache simulator. Looking for someone who\'s already done 213 to explain memory hierarchy. Gates or Zoom.',
    22, 'Gates-Hillman Center', 75, false, 96],

  [2, null, 'open', 'Tech Help',
    'SSH keys + WSL2 setup on new Windows laptop',
    'New laptop, can\'t figure out SSH key setup for GitHub and WSL2. Quick for someone who knows what they\'re doing.',
    12, 'Anywhere on campus', 20, false, 120],

  [3, null, 'open', 'Moving',
    'Help transport 65" TV from Best Buy to dorm',
    'Bought a TV on Forbes. Need someone with a car or help on the 61C bus. Split Uber cost + tokens.',
    40, 'Best Buy Forbes → East Campus', 60, false, 48],

  [4, null, 'open', 'Errands & Pickup',
    'Pick up prescription from CVS Craig St',
    'Can\'t leave campus today. Need prescription from CVS Craig St. Will text them your name. URGENT — need by 5pm.',
    15, 'CVS Craig St', 30, false, 8],

  [5, null, 'open', 'Tutoring & Academic',
    'Proofread grad school Statement of Purpose',
    '1,200-word SOP for PhD applications. Need someone with strong writing skills for feedback. PhD students preferred!',
    30, 'Remote / anywhere', 60, false, 168],

  [6, null, 'open', 'Fitness & Wellness',
    'Climbing partner at CMU Climbing Wall',
    'Want to try the climbing wall but need a belay partner. Beginner. If experienced and willing to teach, I\'ll bring the tokens.',
    15, 'Cohon University Center', 90, false, 48],

  [7, null, 'open', 'Tech Help',
    'Recover files from old hard drive',
    'Laptop died. Have the old SATA drive. Need someone with an enclosure or USB adapter to copy files off.',
    25, 'Any CMU dorm or lab', 60, false, 200],

  [8, null, 'open', 'Errands & Pickup',
    'Laundry pickup + fold while I\'m away',
    'Leaving campus Friday noon. Put laundry in dryer (washer 3, Morewood basement) and fold it. Leave at my door.',
    20, 'Morewood Gardens', 45, false, 36],

  [9, null, 'open', 'Other',
    'Film a 2-min intro video for club presentation',
    'Need someone to film me talking for ~2 min in a nice outdoor spot. Just a phone with a steady hand. Monday evening.',
    12, 'CMU Campus outdoor', 30, false, 72],

  [10, null, 'open', 'Tutoring & Academic',
    'Help with 76-101 paper outline — argument structure',
    'Writing about AI policy for Interpretation & Argument. Need help structuring my argument and finding counterarguments. Coffee on me.',
    16, 'Hunt Library', 60, false, 100],

  [11, null, 'open', 'Tech Help',
    'Fix broken Figma auto-layout — UI project',
    'My Figma frames are all messed up after a restructure. Need someone who knows Figma well to help untangle it. 30 min max.',
    10, 'Remote / Zoom', 20, false, 48],

  [12, null, 'open', 'Errands & Pickup',
    'Pick up textbook on reserve — Tepper Library',
    'Need someone to check out the reserve copy of "Thinking Fast and Slow" from Tepper Library and bring it to CUC.',
    8, 'Tepper Library → Cohon UC', 25, false, 24],

  [13, null, 'open', 'Fitness & Wellness',
    'Yoga partner — morning flow, 30 min',
    'Looking for a calm yoga partner for morning sessions before class. Any level. I have a mat and will share a sequence.',
    8, 'Resnik Lawn or indoor', 30, false, 40],

  [14, null, 'open', 'Moving',
    'Help carry bike up to 4th floor dorm room',
    'Heavy e-bike, elevator is broken. Need 1–2 strong people to carry it up. 10 minutes max.',
    15, 'Stever House', 15, false, 12],

  // ── Boosted + urgent (show up in Boosted + Closing soon lanes) ──
  [2, null, 'open', 'Moving',
    'URGENT: Help move out of dorm today by 6pm',
    'Extension from housing but moving today. Lots of stuff. Cash + tokens. Need at least 1 more person. Respond fast!',
    50, 'Mudge House → U-Haul Forbes', 120, true, 6],

  [0, null, 'open', 'Errands & Pickup',
    'Last-minute birthday cake pickup — Dozen Bake Shop',
    'Friend\'s surprise party tonight at 7pm. Need someone to pick up a cake from Dozen on Centre Ave by 6:30pm. Will reimburse.',
    20, 'Dozen Bake Shop → Gates', 25, true, 4],

  // ── Quick wins (est ≤ 30 min) ──
  [1, null, 'open', 'Errands & Pickup',
    'Grab oat milk from 7-Eleven — 5 min walk',
    'Stuck in a meeting. 1 carton of oat milk from the 7-Eleven on Forbes. I\'ll Venmo you back.',
    6, '7-Eleven Forbes Ave', 15, false, 48],

  [3, null, 'open', 'Tech Help',
    'Reset my iPhone — forgot passcode',
    'Locked out of my old iPhone 12. Need someone with a Mac and iTunes to help restore it. 20 minutes.',
    8, 'Anywhere convenient', 20, false, 72],

  [5, null, 'open', 'Other',
    'Take headshot photo of me — nice background',
    'Need a LinkedIn headshot. You bring your phone + steady hands, I\'ll bring a nice outfit. 10 minutes outside Gates.',
    10, 'Gates-Hillman Exterior', 15, false, 96],
]

// ── Rating texts ──────────────────────────────────────────────────────────────
const POSTER_REVIEWS = [
  'Super clear instructions, easy to work with.',
  'Friendly and paid tokens instantly. Great experience!',
  'Very communicative and patient. Would post again.',
  'Quick to respond, knew exactly what they needed.',
  'Hassle-free, exactly as described. Recommend!',
  'Left everything ready for me, made the task easy.',
  'Great poster — very organized and appreciative.',
  'Straightforward task, no surprises. Thanks!',
]

const RUNNER_REVIEWS = [
  'Super reliable and fast! Would definitely use again.',
  'Great communication, showed up exactly on time.',
  'Really helpful, explained everything clearly.',
  'Got the job done efficiently, no complaints.',
  'Friendly and professional. Highly recommend!',
  'Went above and beyond. Stellar domi!',
  'Quick response, handled everything smoothly.',
  'Exactly what I needed. Thank you!',
]

// ── Message threads ───────────────────────────────────────────────────────────
const THREADS = [
  ['Hey! I can help with this — when works for you?', 'How about tomorrow at 3pm?', 'Perfect, see you then!'],
  ['I\'m on my way now, should be there in 10', 'Great, I\'ll leave the door unlocked', 'Got it, heading up now'],
  ['Just confirming — is this still needed?', 'Yes! Available right now if you are', 'On my way!'],
  ['Done! Left it at your door', 'Thank you so much!', 'No problem, anytime 🙂'],
  ['Quick q — which building entrance should I use?', 'The back entrance on Margaret Morrison St', 'Got it, heading there now'],
  ['Can you send me the file now so I can review before we meet?', 'Sure, sent to your CMU email', 'Got it, looks good — see you at 4'],
  ['Just finished, all set. Check your door!', 'Perfect timing, thanks a ton', 'Glad I could help!'],
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randStars(min = 4) { return Math.floor(Math.random() * (5 - min + 1)) + min }

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Starting seed...\n')

  // 1. Create / find auth users
  const userIds = []
  for (const u of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: u.name, year: u.year, major: u.major },
    })
    if (error) {
      if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
        const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 })
        const existing = list?.users?.find(x => x.email === u.email)
        if (existing) { userIds.push(existing.id); console.log(`  ↩ ${u.email} already exists`); continue }
      }
      console.error(`  ✗ ${u.email}:`, error.message)
      userIds.push(null); continue
    }
    userIds.push(data.user.id)
    console.log(`  ✓ Created: ${u.email}`)
  }

  // 2. Upsert profiles
  for (let i = 0; i < USERS.length; i++) {
    const uid = userIds[i]
    if (!uid) continue
    await supabase.from('profiles').upsert({
      id: uid,
      email: USERS[i].email,
      name: USERS[i].name,
      year: USERS[i].year,
      major: USERS[i].major,
      token_balance: USERS[i].tokens,
    }, { onConflict: 'id' })
  }
  console.log(`\n  ✓ Profiles upserted`)

  // 3. Create tasks
  const taskRecords = [] // { posterId, runnerId, taskId, status, tokens }
  for (const t of TASKS) {
    const [pIdx, rIdx, status, category, title, description, tokenOffer, locationPickup, estMinutes, boosted, deadlineHours] = t
    const posterId = userIds[pIdx]
    const runnerId = rIdx !== null ? userIds[rIdx] : null
    if (!posterId) continue

    const deadline = deadlineHours
      ? new Date(Date.now() + deadlineHours * 3600 * 1000).toISOString()
      : null

    const { data: task, error } = await supabase.from('tasks').insert({
      poster_id: posterId,
      runner_id: runnerId,
      title,
      description,
      category,
      status,
      token_offer: tokenOffer,
      location_pickup: locationPickup,
      est_minutes: estMinutes,
      boosted: boosted ?? false,
      moderation_status: 'approved',
      flagged: false,
      delivery_type: 'in_person',
      deadline_at: deadline,
      ...(status === 'completed' ? {
        marked_done_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
      } : {}),
    }).select().single()

    if (error) { console.error(`  ✗ "${title.slice(0,40)}":`, error.message); continue }
    taskRecords.push({ posterId, runnerId, taskId: task.id, status, tokens: tokenOffer })
    process.stdout.write('.')
  }
  console.log(`\n  ✓ ${taskRecords.length} tasks created`)

  // 4. Messages on accepted + completed tasks
  let msgCount = 0
  for (const tr of taskRecords) {
    if (tr.status !== 'accepted' && tr.status !== 'completed') continue
    if (!tr.runnerId) continue
    const thread = pick(THREADS)
    const senders = [tr.runnerId, tr.posterId, tr.runnerId]
    for (let j = 0; j < thread.length; j++) {
      await supabase.from('messages').insert({ task_id: tr.taskId, sender_id: senders[j], body: thread[j] })
      msgCount++
    }
  }
  console.log(`  ✓ ${msgCount} messages created`)

  // 5. Ratings on completed tasks
  let ratingCount = 0
  for (const tr of taskRecords) {
    if (tr.status !== 'completed' || !tr.runnerId) continue

    await supabase.from('ratings').upsert({
      task_id: tr.taskId, rater_id: tr.posterId, ratee_id: tr.runnerId,
      stars: randStars(4), note: pick(RUNNER_REVIEWS),
    }, { onConflict: 'task_id,rater_id', ignoreDuplicates: true })

    await supabase.from('ratings').upsert({
      task_id: tr.taskId, rater_id: tr.runnerId, ratee_id: tr.posterId,
      stars: randStars(4), note: pick(POSTER_REVIEWS),
    }, { onConflict: 'task_id,rater_id', ignoreDuplicates: true })

    ratingCount += 2
  }
  console.log(`  ✓ ${ratingCount} task ratings created`)

  // 6. Token ledger for completed tasks
  let ledgerCount = 0
  for (const tr of taskRecords) {
    if (tr.status !== 'completed' || !tr.runnerId) continue
    const short = (s) => s.length > 40 ? s.slice(0, 37) + '…' : s
    const title = TASKS.find(t => userIds[t[0]] === tr.posterId)?.[ 4] ?? 'doum'
    await supabase.from('token_ledger').insert([
      { user_id: tr.posterId, amount: -tr.tokens, reason: `Posted doum "${short(title)}"`, task_id: tr.taskId },
      { user_id: tr.runnerId, amount:  tr.tokens, reason: `Completed doum "${short(title)}"`, task_id: tr.taskId },
    ])
    ledgerCount += 2
  }
  console.log(`  ✓ ${ledgerCount} ledger entries created`)

  // ── 7. Add ratings to ALL existing users in the DB ─────────────────────────
  console.log('\n  Adding ratings to existing users...')
  const { data: allProfiles } = await supabase.from('profiles').select('id, name')
  if (allProfiles && allProfiles.length >= 2) {
    // For each user, add 2–4 incoming ratings from random other users
    // using synthetic task_ids so we don't need real tasks
    // We need real task_ids for the FK — pick completed tasks we just created
    const completedTaskIds = taskRecords.filter(t => t.status === 'completed').map(t => t.taskId)
    if (completedTaskIds.length === 0) {
      console.log('  ↩ No completed tasks to attach ratings to, skipping.')
    } else {
      let extraRatings = 0
      for (const profile of allProfiles) {
        // Skip if they were already rated via task loop
        const others = allProfiles.filter(p => p.id !== profile.id)
        const numRatings = 2 + Math.floor(Math.random() * 3) // 2–4
        for (let i = 0; i < numRatings && i < others.length; i++) {
          const rater = others[Math.floor(Math.random() * others.length)]
          const taskId = completedTaskIds[Math.floor(Math.random() * completedTaskIds.length)]
          // Use upsert with ignoreDuplicates — skip if that rater already rated on that task
          const { error } = await supabase.from('ratings').insert({
            task_id: taskId,
            rater_id: rater.id,
            ratee_id: profile.id,
            stars: randStars(3),
            note: pick([...RUNNER_REVIEWS, ...POSTER_REVIEWS]),
          })
          if (!error) extraRatings++
        }
      }
      console.log(`  ✓ ${extraRatings} extra ratings added to existing users`)
    }
  }

  // 8. Recompute reputation scores for all profiles
  const { data: finalProfiles } = await supabase.from('profiles').select('id')
  for (const p of finalProfiles || []) {
    const { data: rows } = await supabase.from('ratings').select('stars').eq('ratee_id', p.id)
    if (rows?.length) {
      const avg = rows.reduce((s, r) => s + r.stars, 0) / rows.length
      await supabase.from('profiles').update({ reputation_score: avg.toFixed(2) }).eq('id', p.id)
    }
  }
  console.log('  ✓ Reputation scores updated for all users')

  console.log('\n✅ Seed complete!')
  console.log(`\n📋 Accounts (password: ${PASSWORD}):`)
  USERS.forEach(u => console.log(`   ${u.email}`))
}

seed().catch(console.error)
