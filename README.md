# 🎓 StudySphere - AI-Powered Academic Companion

An intelligent academic management platform designed for polytechnic students. StudySphere helps students stay organised, motivated, and connected through AI-powered priority management, gamification, and peer collaboration.

## ✨ Features

### 📊 Smart Dashboard
- AI-powered priority recommendations (tells you what to work on first)
- XP progress bar with level tracking
- Workload heatmap showing busy weeks ahead
- Quick stats overview (pending, completed, streaks)

### 📝 Assignment Management
- Full CRUD for assignments with rich details
- AI Priority Engine scoring (based on deadline, confidence, workload, progress, weightage)
- Progress tracking with visual progress bars
- Assignment types: Essay, Programming, Report, Presentation, Lab Report, Project

### 📅 Smart Calendar
- Monthly calendar view with deadline indicators
- Visual deadline markers and countdowns
- This month's deadlines summary

### 📋 AI Study Plans
- Auto-generated task breakdowns based on assignment type
- Customized scheduling across available days
- Task completion tracking with XP rewards
- Time estimates for each task

### 🏆 Gamification System
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

### 📈 Analytics Dashboard
- Completion rate tracking
- Weekly workload bar chart
- Module-by-module progress breakdown
- XP activity history
- 56-day deadline heatmap

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
├── public/            # Frontend (SPA)
│   ├── index.html     # Main HTML shell
│   ├── css/
│   │   └── styles.css # Full custom CSS (dark theme)
│   └── js/
│       ├── app.js     # Core app logic, auth, navigation
│       ├── pages.js   # All page renderers
│       └── components.js # Reusable components & utilities
└── README.md
```

### Tech Stack
- **Backend**: Node.js (built-in `http` module - zero dependencies!)
- **Database**: JSON files (no database setup needed)
- **Frontend**: Vanilla JS SPA with custom CSS
- **AI Engine**: Rule-based priority scoring algorithm
- **Auth**: Simple session-based with localStorage

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
