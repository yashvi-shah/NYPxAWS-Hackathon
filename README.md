# 🎓 StudySphere - Academic Workload Management

An academic workload platform for polytechnic students. StudySphere does not just list what
is due — it works out **what to do next and whether the week can actually take it**, by
measuring the work a student has left against the hours they really have free.

## ✨ Features

### Today (dashboard)
- **Next best action** — one commitment, with the reasoning shown ("due tomorrow", "90%
  done, finishing it clears a deadline", "confidence 35%, likely to run long")
- **Today's capacity** — hours available, work to fit in, what's left over, and tonight's
  study steps laid out on a clock
- **Workload verdict** — a single honest sentence: manageable, full but achievable, stacked
  on one day, or genuinely short by *N* hours
- **Week pressure** — seven columns of required work against available time, with deadline
  markers and overload shown above the line
- **What's coming** — the next deadlines, each with work left and progress

### Commitments (assignments)
- Full CRUD, built for scanning: title, module, type, deadline, weightage, progress,
  priority and work left all readable without opening a row
- Search, filter (open / needs attention / this week / not started / completed) and sort
  by priority, deadline, work left, progress or weightage
- Detail drawer with the reasoning behind its priority, a progress stepper, the linked
  study plan, and every action in one place
- Assignment types: Essay, Programming, Report, Presentation, Lab Report, Project

### Workload
- "Can I realistically handle this?" — required hours vs available hours over 7, 14 or 21 days
- **Pressure points**: which days are overloaded, what is driving each one, and the
  cheapest thing to move
- **At risk of not fitting**: work whose deadline arrives before the free time it needs
- Where remaining time goes by module, plus completion progress and recent activity

### Calendar
- Month grid where every day carries both its deadlines and its workload bar
- Overloaded days are visually distinct; any day opens a panel with its work and deadlines
- Month navigation, month-at-a-glance totals, and grade at stake

### Study plans
- Auto-generated task breakdowns based on assignment type
- Tonight's steps on a real clock, built from the student's available hours
- Carried-over steps flagged, tasks completable, reopenable, snoozable or rebuildable
- Task completion tracking with XP rewards

### 🏆 Gamification (kept secondary)
- **XP & Levels**: Earn XP for completing assignments, helping peers, and being productive
- **Streaks**: Daily activity tracking with streak bonuses
- **Badges**: 10 achievement badges to unlock
- **Leaderboard**: Compete with fellow students
- **Early/Late Bonuses**: +25 XP for early submissions, -15 for late ones

### 👥 Community & Peer Help
- **Help Requests**: Ask for academic or practical help (soldering, CAD, 3D printing)
- **Discussions**: Share tips, resources, and form study groups
- **Responses**: Help peers and earn reputation + XP
- **Categories**: Academic, Practical, Project, Career
- Answered requests are marked as such, so nothing sits unanswered unnoticed

### Everywhere
- Light and dark themes, both tuned; keyboard shortcuts (`Ctrl/⌘ 1–7`, `/` to filter)
- Purposeful empty states, skeleton loading, and failures that explain themselves and
  offer a retry — a dead panel never blanks a page
- Responsive from desktop to phone: the sidebar becomes an icon rail, then a bottom tab bar

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (no other dependencies needed!)

### Installation & Running

```bash
# 1. Seed the database with demo data
node seed.js

# 2. Start the server
node server.js

# 3. Open in browser
# http://localhost:3000
```

### Demo Login
- **Email**: alex@studysphere.com
- **Password**: demo123

Other demo accounts: sarah@studysphere.com, marcus@studysphere.com, priya@studysphere.com, jake@studysphere.com (all use password: demo123)

## 🏗️ Architecture

```
studysphere/
├── server.js          # Node.js HTTP server + REST API + AI engines
├── seed.js            # Database seeder with demo data
├── package.json       # Project metadata
├── data/              # JSON file database (auto-created)
│   ├── users.json
│   ├── assignments.json
│   ├── study-plans.json
│   ├── help-requests.json
│   ├── discussions.json
│   └── badges.json
├── public/            # Frontend (SPA, zero build step)
│   ├── index.html     # Shell: sign-in mount, app mount, overlay + toast roots
│   ├── css/
│   │   ├── tokens.css      # Design tokens (colour, type, space, radius, motion)
│   │   ├── base.css        # Reset, typography, focus, text roles
│   │   ├── components.css  # Buttons, inputs, cards, badges, meters, modals…
│   │   ├── layout.css      # App shell, navigation, page frame, responsive
│   │   └── pages.css       # Per-screen composition
│   └── js/
│       ├── app.js          # Entry: routes, boot, session gate
│       ├── lib/            # dom (escaping templates), format, icons
│       ├── services/       # api.js (only network layer), store.js (session/prefs/cache)
│       ├── core/           # router, actions (event delegation), workload, priority
│       ├── ui/             # shell, overlay, toast, states, bits (shared fragments)
│       ├── features/       # assignment form/detail/actions, plans, availability, mutate
│       └── pages/          # dashboard, assignments, workload, plans, calendar,
│                           #   community, leaderboard
└── README.md
```

### Tech Stack
- **Backend**: Node.js (built-in `http` module - zero dependencies!)
- **Database**: JSON files (no database setup needed)
- **Frontend**: Vanilla ES-module SPA, no build step, no dependencies
- **AI Engine**: Rule-based priority scoring algorithm
- **Auth**: Simple session-based with localStorage

## 🎨 Frontend architecture

The frontend is layered, and the layers only ever point downwards:

```
pages  →  features  →  ui  →  core  →  services  →  backend API
```

- **`services/api.js` is the only place `fetch` is called.** Every endpoint in the
  table below is preserved exactly; errors surface as `ApiError` for the UI to handle.
- **`services/store.js`** holds the session, local preferences and a 12-second read
  cache that every write invalidates, so navigation is instant but never stale.
- **`core/workload.js`** is the product's differentiator: it derives hours of work
  from fields the API already returns (type, weightage, confidence, progress — or real
  task durations when a study plan exists) and lays them across the hours the student
  says they have free. That produces the capacity meters, pressure columns, overloaded
  days and "this won't fit" warnings.
- **`core/priority.js`** never re-ranks anything. Ordering stays with the backend
  (`/api/recommendations`, `priorityScore`); this module only turns that signal into
  plain-language reasons, so students see *why* instead of a score out of 100.
- **`core/actions.js`** gives the app one delegated listener. Markup declares
  `data-act="…"` and pages register handlers on mount — no inline `onclick`, and all
  interpolated content is escaped by `lib/dom.js` (`html` tagged template).

### Design system
Restrained warm-neutral surfaces with a single "harbour" accent; colour is reserved for
meaning (green healthy, amber attention, red urgent) rather than decoration. Status is
carried by a 3px rail on cards and rows, hours are set in tabular figures, and one inline
SVG icon family replaces the emoji UI. Light and dark themes are both tuned, and every
text/background pair meets WCAG AA.

### Frontend requirements (need backend support, not implemented here)
These two features are frontend-local today. They are deliberately *not* backed by new
endpoints, because the API contract is owned elsewhere:

1. **Per-student availability.** Available study hours per weekday live in
   `localStorage`. A field on the user record (or a small preferences endpoint) would let
   availability follow the student between devices and let the server reason about
   realistic scheduling.
2. **Rescheduling a study-plan task.** "Not today" is remembered locally for the current
   day only. Accepting `{ scheduledDate }` on
   `PUT /api/study-plans/:planId/tasks/:taskId` would make a moved step persist.

### AI Priority Engine Algorithm
The priority score (0-100) is calculated using:
- **Deadline urgency** (0-40 pts): Closer deadlines score higher
- **Weightage** (0-25 pts): Higher-weight assignments prioritized
- **Confidence** (0-20 pts): Lower confidence = higher priority (you need more time)
- **Progress** (0-15 pts): Less progress = higher priority

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| POST | /api/auth/register | User registration |
| GET | /api/assignments | Get all assignments (sorted by priority) |
| POST | /api/assignments | Create assignment |
| PUT | /api/assignments/:id | Update assignment |
| DELETE | /api/assignments/:id | Delete assignment |
| GET | /api/recommendations?userId= | AI priority recommendations |
| GET | /api/analytics?userId= | Analytics dashboard data |
| POST | /api/study-plans/generate | Generate AI study plan |
| GET | /api/study-plans | Get all study plans |
| GET | /api/leaderboard | Get XP leaderboard |
| GET | /api/badges | Get all available badges |
| GET | /api/help-requests | Get community help requests |
| POST | /api/help-requests | Create help request |
| POST | /api/help-requests/:id/respond | Respond to help request |
| GET | /api/discussions | Get discussions |
| POST | /api/discussions | Create discussion |
| POST | /api/discussions/:id/reply | Reply to discussion |

## 🎯 Hackathon Vision

StudySphere aims to become an **all-in-one academic operating system** that helps students:
1. **Manage workload** intelligently with AI prioritization
2. **Stay motivated** through gamification and streaks
3. **Collaborate** with peers for mutual academic support
4. **Build habits** with study plans and analytics

## 🔮 Future Enhancements
- PDF/document upload with AI deadline extraction
- Push notifications and email reminders
- Mobile app (React Native / PWA)
- Integration with LMS platforms (Canvas, Moodle)
- Real AI/LLM integration for smarter study plans
- Sponsored voucher rewards system
- Group project progress tracking
- Real-time chat for peer tutoring

---

Built with ❤️ for the Hackathon by the StudySphere Team
