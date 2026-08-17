const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Seed Users
const users = [
  {
    id: 'user1',
    name: 'Alex Chen',
    email: 'alex@studysphere.com',
    password: 'demo123',
    course: 'Electrical Engineering',
    year: 2,
    xp: 1250,
    streak: 7,
    lastActiveDate: new Date().toISOString().split('T')[0],
    avatar: '🎓',
    badges: ['first-assignment', 'streak-3', 'streak-7', 'early-bird'],
    xpHistory: [
      { amount: 50, reason: 'Completed: Circuit Analysis Report', date: new Date(Date.now() - 86400000 * 6).toISOString() },
      { amount: 25, reason: 'Early submission bonus!', date: new Date(Date.now() - 86400000 * 6).toISOString() },
      { amount: 10, reason: 'Added new assignment', date: new Date(Date.now() - 86400000 * 5).toISOString() },
      { amount: 15, reason: 'Generated study plan', date: new Date(Date.now() - 86400000 * 4).toISOString() },
      { amount: 50, reason: 'Completed: Database Design Project', date: new Date(Date.now() - 86400000 * 3).toISOString() },
      { amount: 20, reason: 'Helped a peer', date: new Date(Date.now() - 86400000 * 2).toISOString() },
      { amount: 10, reason: 'Progress on: IoT Prototype', date: new Date(Date.now() - 86400000 * 1).toISOString() },
      { amount: 5, reason: 'Started a discussion', date: new Date().toISOString() }
    ],
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'user2',
    name: 'Sarah Lee',
    email: 'sarah@studysphere.com',
    password: 'demo123',
    course: 'Information Technology',
    year: 2,
    xp: 980,
    streak: 4,
    lastActiveDate: new Date().toISOString().split('T')[0],
    avatar: '💻',
    badges: ['first-assignment', 'streak-3', 'helper'],
    xpHistory: [],
    createdAt: new Date(Date.now() - 86400000 * 25).toISOString()
  },
  {
    id: 'user3',
    name: 'Marcus Tan',
    email: 'marcus@studysphere.com',
    password: 'demo123',
    course: 'Mechanical Engineering',
    year: 3,
    xp: 2100,
    streak: 12,
    lastActiveDate: new Date().toISOString().split('T')[0],
    avatar: '⚙️',
    badges: ['first-assignment', 'streak-3', 'streak-7', 'early-bird', 'helper', 'planner', 'level-5'],
    xpHistory: [],
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString()
  },
  {
    id: 'user4',
    name: 'Priya Sharma',
    email: 'priya@studysphere.com',
    password: 'demo123',
    course: 'Business Analytics',
    year: 1,
    xp: 450,
    streak: 2,
    lastActiveDate: new Date().toISOString().split('T')[0],
    avatar: '📊',
    badges: ['first-assignment'],
    xpHistory: [],
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString()
  },
  {
    id: 'user5',
    name: 'Jake Wong',
    email: 'jake@studysphere.com',
    password: 'demo123',
    course: 'Game Design',
    year: 2,
    xp: 1680,
    streak: 5,
    lastActiveDate: new Date().toISOString().split('T')[0],
    avatar: '🎮',
    badges: ['first-assignment', 'streak-3', 'streak-7', 'social', 'level-5'],
    xpHistory: [],
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString()
  }
];

// Seed Assignments
const today = new Date();
const dayMs = 86400000;

const assignments = [
  {
    id: 'asgn1',
    title: 'IoT Smart Home Prototype',
    module: 'EE4301 - IoT Systems',
    type: 'Project',
    deadline: new Date(today.getTime() + dayMs * 2).toISOString().split('T')[0],
    weightage: 40,
    confidence: 35,
    progress: 45,
    status: 'pending',
    description: 'Design and build a smart home IoT prototype using Arduino and sensors. Must include temperature monitoring, light control, and mobile app integration.',
    userId: 'user1',
    createdAt: new Date(today.getTime() - dayMs * 14).toISOString()
  },
  {
    id: 'asgn2',
    title: 'Digital Signal Processing Lab Report',
    module: 'EE3205 - DSP',
    type: 'Lab Report',
    deadline: new Date(today.getTime() + dayMs * 5).toISOString().split('T')[0],
    weightage: 15,
    confidence: 60,
    progress: 20,
    status: 'pending',
    description: 'Write lab report on FFT analysis and signal filtering experiments conducted in Week 8.',
    userId: 'user1',
    createdAt: new Date(today.getTime() - dayMs * 7).toISOString()
  },
  {
    id: 'asgn3',
    title: 'Machine Learning Classification Model',
    module: 'IT3402 - AI & ML',
    type: 'Programming',
    deadline: new Date(today.getTime() + dayMs * 8).toISOString().split('T')[0],
    weightage: 30,
    confidence: 45,
    progress: 10,
    status: 'pending',
    description: 'Build a classification model using Python scikit-learn. Dataset provided. Must achieve >85% accuracy.',
    userId: 'user1',
    createdAt: new Date(today.getTime() - dayMs * 5).toISOString()
  },
  {
    id: 'asgn4',
    title: 'Technical Writing Essay',
    module: 'GE2101 - Communication',
    type: 'Essay',
    deadline: new Date(today.getTime() + dayMs * 12).toISOString().split('T')[0],
    weightage: 20,
    confidence: 75,
    progress: 0,
    status: 'pending',
    description: '2000-word essay on the impact of AI in engineering. APA format required.',
    userId: 'user1',
    createdAt: new Date(today.getTime() - dayMs * 3).toISOString()
  },
  {
    id: 'asgn5',
    title: 'Group Presentation: Renewable Energy',
    module: 'EE3101 - Power Systems',
    type: 'Presentation',
    deadline: new Date(today.getTime() + dayMs * 18).toISOString().split('T')[0],
    weightage: 25,
    confidence: 55,
    progress: 30,
    status: 'pending',
    description: '15-minute group presentation on renewable energy integration. Slides + demo required.',
    userId: 'user1',
    createdAt: new Date(today.getTime() - dayMs * 10).toISOString()
  },
  {
    id: 'asgn6',
    title: 'Database Normalization Exercise',
    module: 'IT2205 - Databases',
    type: 'Programming',
    deadline: new Date(today.getTime() + dayMs * 1).toISOString().split('T')[0],
    weightage: 10,
    confidence: 80,
    progress: 90,
    status: 'pending',
    description: 'Normalize given schema to 3NF. Submit SQL scripts and ER diagram.',
    userId: 'user1',
    createdAt: new Date(today.getTime() - dayMs * 5).toISOString()
  },
  {
    id: 'asgn7',
    title: 'Web Application Project',
    module: 'IT3305 - Web Dev',
    type: 'Project',
    deadline: new Date(today.getTime() + dayMs * 25).toISOString().split('T')[0],
    weightage: 45,
    confidence: 50,
    progress: 15,
    status: 'pending',
    description: 'Full-stack web application with React frontend and Node.js backend. Must include authentication and CRUD operations.',
    userId: 'user2',
    createdAt: new Date(today.getTime() - dayMs * 20).toISOString()
  },
  {
    id: 'asgn8',
    title: 'CAD Assembly Drawing',
    module: 'ME2401 - CAD/CAM',
    type: 'Project',
    deadline: new Date(today.getTime() + dayMs * 4).toISOString().split('T')[0],
    weightage: 20,
    confidence: 40,
    progress: 55,
    status: 'pending',
    description: 'Complete assembly drawing of gearbox mechanism in SolidWorks. Submit .SLDASM and .PDF files.',
    userId: 'user3',
    createdAt: new Date(today.getTime() - dayMs * 10).toISOString()
  }
];

// Seed Help Requests
const helpRequests = [
  {
    id: 'help1',
    title: 'Need help with Arduino sensor calibration',
    description: 'My DHT22 temperature sensor is giving inaccurate readings. Already tried changing the pull-up resistor. Anyone experienced with IoT sensors?',
    category: 'Practical',
    module: 'EE4301 - IoT Systems',
    urgency: 'high',
    userId: 'user1',
    userName: 'Alex Chen',
    status: 'open',
    responses: [
      {
        userId: 'user3',
        userName: 'Marcus Tan',
        message: 'Try adding a 100nF capacitor across the power pins. Also make sure you\'re waiting at least 2 seconds between readings. I had the same issue last semester.',
        date: new Date(today.getTime() - dayMs * 1).toISOString()
      }
    ],
    createdAt: new Date(today.getTime() - dayMs * 2).toISOString()
  },
  {
    id: 'help2',
    title: 'SolidWorks assembly constraints help',
    description: 'Struggling with mate constraints in my gearbox assembly. The gears keep moving incorrectly when I add the gear mate.',
    category: 'Practical',
    module: 'ME2401 - CAD/CAM',
    urgency: 'medium',
    userId: 'user3',
    userName: 'Marcus Tan',
    status: 'open',
    responses: [],
    createdAt: new Date(today.getTime() - dayMs * 1).toISOString()
  },
  {
    id: 'help3',
    title: 'Python scikit-learn: Feature selection for classification',
    description: 'Working on ML assignment. Dataset has 50+ features. What\'s the best approach for feature selection before building a RandomForest classifier?',
    category: 'Academic',
    module: 'IT3402 - AI & ML',
    urgency: 'medium',
    userId: 'user1',
    userName: 'Alex Chen',
    status: 'open',
    responses: [
      {
        userId: 'user2',
        userName: 'Sarah Lee',
        message: 'Start with correlation matrix to remove highly correlated features. Then try SelectKBest or use feature_importances_ from a preliminary Random Forest. Also consider PCA if features are numerical.',
        date: new Date(today.getTime() - dayMs * 0.5).toISOString()
      }
    ],
    createdAt: new Date(today.getTime() - dayMs * 1).toISOString()
  },
  {
    id: 'help4',
    title: 'Need 3D printer access for prototype',
    description: 'Looking for someone who has access to a 3D printer or knows the FabLab booking process. Need to print a custom enclosure for my IoT project by Friday.',
    category: 'Practical',
    module: '',
    urgency: 'high',
    userId: 'user1',
    userName: 'Alex Chen',
    status: 'open',
    responses: [],
    createdAt: new Date().toISOString()
  }
];

// Seed Discussions
const discussions = [
  {
    id: 'disc1',
    title: 'Tips for DSP lab report writing',
    content: 'Just finished my DSP lab report. Here are some tips: 1) Always include your MATLAB code in the appendix, 2) Label all axes on your plots, 3) Discuss signal-to-noise ratio in your analysis section. The lecturer is strict about proper FFT windowing explanations.',
    module: 'EE3205 - DSP',
    tags: ['tips', 'lab-report', 'dsp'],
    userId: 'user3',
    userName: 'Marcus Tan',
    replies: [
      {
        userId: 'user1',
        userName: 'Alex Chen',
        content: 'Thanks! Do we need to include the theoretical derivation of the DFT or just explain the concept?',
        date: new Date(today.getTime() - dayMs * 2).toISOString()
      },
      {
        userId: 'user3',
        userName: 'Marcus Tan',
        content: 'Just explain the concept and reference the textbook for the full derivation. Focus more on your experimental results and analysis.',
        date: new Date(today.getTime() - dayMs * 1.5).toISOString()
      }
    ],
    upvotes: 12,
    createdAt: new Date(today.getTime() - dayMs * 3).toISOString()
  },
  {
    id: 'disc2',
    title: 'Best ML libraries for the classification assignment?',
    content: 'For the IT3402 ML assignment, should we stick with scikit-learn or can we use TensorFlow/Keras? Also, is data augmentation allowed since the dataset is small?',
    module: 'IT3402 - AI & ML',
    tags: ['machine-learning', 'python', 'assignment'],
    userId: 'user2',
    userName: 'Sarah Lee',
    replies: [
      {
        userId: 'user5',
        userName: 'Jake Wong',
        content: 'Prof said scikit-learn is preferred but TensorFlow is allowed. Data augmentation is fine as long as you document your approach.',
        date: new Date(today.getTime() - dayMs * 1).toISOString()
      }
    ],
    upvotes: 8,
    createdAt: new Date(today.getTime() - dayMs * 4).toISOString()
  },
  {
    id: 'disc3',
    title: 'Study group for Power Systems exam',
    content: 'Anyone want to form a study group for the EE3101 midterm? Planning to meet at the library on Saturday 2pm. Will be covering load flow analysis and fault calculations.',
    module: 'EE3101 - Power Systems',
    tags: ['study-group', 'exam-prep'],
    userId: 'user1',
    userName: 'Alex Chen',
    replies: [
      {
        userId: 'user3',
        userName: 'Marcus Tan',
        content: 'Count me in! I can bring my notes on symmetrical components.',
        date: new Date(today.getTime() - dayMs * 0.5).toISOString()
      }
    ],
    upvotes: 5,
    createdAt: new Date(today.getTime() - dayMs * 1).toISOString()
  }
];

// Seed Study Plans
const studyPlans = [
  {
    id: 'plan1',
    assignmentId: 'asgn1',
    assignmentTitle: 'IoT Smart Home Prototype',
    module: 'EE4301 - IoT Systems',
    totalDays: 2,
    tasks: [
      { id: 'task-0', title: 'Define scope & objectives', scheduledDate: today.toISOString().split('T')[0], duration: 30, completed: true, order: 1 },
      { id: 'task-1', title: 'Research & planning', scheduledDate: today.toISOString().split('T')[0], duration: 60, completed: true, order: 2 },
      { id: 'task-2', title: 'Initial development', scheduledDate: today.toISOString().split('T')[0], duration: 90, completed: false, order: 3 },
      { id: 'task-3', title: 'Core implementation', scheduledDate: new Date(today.getTime() + dayMs).toISOString().split('T')[0], duration: 120, completed: false, order: 4 },
      { id: 'task-4', title: 'Testing & iteration', scheduledDate: new Date(today.getTime() + dayMs).toISOString().split('T')[0], duration: 60, completed: false, order: 5 },
      { id: 'task-5', title: 'Final submission prep', scheduledDate: new Date(today.getTime() + dayMs * 2).toISOString().split('T')[0], duration: 45, completed: false, order: 6 }
    ],
    estimatedHours: 6.75,
    userId: 'user1',
    createdAt: new Date(today.getTime() - dayMs * 1).toISOString()
  }
];

// Write all data
fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'assignments.json'), JSON.stringify(assignments, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'help-requests.json'), JSON.stringify(helpRequests, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'discussions.json'), JSON.stringify(discussions, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'study-plans.json'), JSON.stringify(studyPlans, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'activities.json'), JSON.stringify([], null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'badges.json'), JSON.stringify([], null, 2));

console.log('✅ Database seeded successfully!');
console.log(`   - ${users.length} users`);
console.log(`   - ${assignments.length} assignments`);
console.log(`   - ${helpRequests.length} help requests`);
console.log(`   - ${discussions.length} discussions`);
console.log(`   - ${studyPlans.length} study plans`);
console.log('\n🔑 Demo login: alex@studysphere.com / demo123');
