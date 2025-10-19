# Project Atlas

**Home improvement project management that actually works.**

A purpose-built platform for managing home renovation projects with the clarity and control you need—without the bloat of enterprise tools or the limitations of generic task apps.

## Live Demo

**https://lab-foster.github.io/ProjectAtlas/**

---

## Features

### Core Functionality

**Kanban Board** - Jira-style drag-and-drop task management across five workflow stages (Backlog → Ready → In Progress → Blocked → Done). Move tasks between columns, filter by project and priority, and add tasks directly from any column.

**Dashboard** - Real-time overview of all active projects with status tracking, recent activity feed, and quick access to tasks and milestones.

**Projects** - Organize work across multiple renovation projects. Each project tracks scope, timeline, budget allocation, and associated tasks with visual progress indicators.

**Calendar** - Month view of scheduled tasks and project milestones with filtering by project. Navigate between months and see deadlines at a glance.

**Budget Tracking** - Monitor project costs with expense categorization, actual vs. planned comparisons, and visual spending breakdowns.

**Documents** - Centralized storage and organization for contracts, permits, invoices, and project photos with search and category filtering.

### Interactive Features

- **Full drag-and-drop** task management with touch support
- **Real-time filtering** by project, priority, and status
- **Modal-based task editing** with inline validation
- **Cross-page data sync** using localStorage and pub/sub events
- **Responsive design** optimized for desktop, tablet, and mobile
- **Keyboard navigation** with accessibility support (ARIA labels, focus management)
- **Contact form** with validation and beta signup

### Data Persistence

All changes save automatically to browser localStorage and sync across tabs in real-time. No backend required—your data stays private and local.

---

## Tech Stack

- **HTML5/CSS3** - Semantic markup, CSS Grid, Flexbox, custom properties
- **Vanilla JavaScript (ES6+)** - No framework dependencies, ~1100 lines of interactive logic
- **localStorage API** - Client-side data persistence
- **Drag and Drop API** - Native browser drag-and-drop with custom styling
- **PHP** - Optional contact form processing (server-side)

---

## Philosophy

Project Atlas treats home improvement like the complex, interconnected system it is. The platform understands that you can't tile the bathroom until the plumbing rough-in passes inspection—and surfaces those blockers before you order materials.

Built for homeowners who understand good tooling but are frustrated with existing apps: too simplistic, too bloated, or clearly designed by people who've never installed subfloor.

---

## Development Status

🚀 **Active Development**

### Current (v1.8)
- ✅ Fully interactive Kanban board with drag-and-drop
- ✅ Task creation, editing, deletion across all views
- ✅ Multi-project management with filtering
- ✅ Calendar view with task scheduling
- ✅ Budget tracking with expense management
- ✅ Document organization system
- ✅ Real-time cross-tab synchronization
- ✅ Responsive mobile-first design
- ✅ Contact form with beta signup

### Roadmap
- Advanced dependency tracking (visual task chains)
- Permit and inspection workflow
- Contractor contact management
- File upload and cloud storage integration
- Multi-user collaboration
- Export/import project data
- Advanced reporting and analytics

---

## Contributing

Interested in contributing or beta testing? Use the [contact form](https://lab-foster.github.io/ProjectAtlas/contact.html) or reach out directly.

**Looking for:**
- Frontend developers (React/TypeScript experience helpful)
- UX designers familiar with project management workflows
- Home renovation enthusiasts who can provide domain expertise
- Beta testers willing to use the platform on real projects

---

## Author

Built by **Andrew Foster** - a developer who got tired of juggling spreadsheets, notes apps, and generic kanban boards for home projects.

**Contact:** andrew@projectatlas.dev  
**GitHub:** github.com/lab-foster/projectAtlas

---

## License

Currently in development. Planning to open source portions once core architecture stabilizes.

---

*"After years of trying overkill enterprise tools and cutesy apps built by people who've clearly never spent a weekend installing subfloor, I decided to create something that treats home improvement like the complex, interconnected system it actually is."*

Built with frustration and determination by Andrew Foster
