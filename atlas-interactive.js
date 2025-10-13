/**
 * Project Atlas - Interactive Application Script (Enhanced)
 * Full feature layer for Kanban, Calendar, Documents, Budget stubs, and Dashboard
 * Author: Andrew Foster
 * Last Updated: 2025-10-12
 *
 * What changed (without removing functionality):
 * - Introduced a universal click-to-open mechanism for ANY element with [data-task-id] or .task-link.
 * - Backward-compat: elements that still pass a task *title* will resolve to the correct task via an index.
 * - Centralized “single source of truth” sync with a tiny pub/sub + storage events (all pages stay in sync).
 * - Modal hardened (focus trap, scroll lock, ESC/backdrop to close, ARIA roles).
 * - Safe persist helpers, ID utilities, and rendering helpers (task pills/lists) for other pages.
 * - Kept all existing methods and selectors; nothing removed, only added and hardened.
 */

(function () {
  'use strict';

  // ===== Utilities =====
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const LOG_ENABLED = true;
  const log = (...args) => { if (LOG_ENABLED) console.log('[Atlas]', ...args); };

  // Dates
  const today = new Date();
  function pad2(n) { return String(n).padStart(2, '0'); }
  function formatDateISO(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }
  function humanDate(d) {
    try {
      const date = (d instanceof Date) ? d : new Date(d);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return d; }
  }

  // Safe JSON
  const safeJSON = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch { return fallback; }
    },
    set(key, val) {
      localStorage.setItem(key, JSON.stringify(val));
    }
  };

  // ID + HTML helpers
  const uid = (pfx = 't') => pfx + Math.random().toString(36).slice(2, 9);
  const esc = (s) => (s ?? '').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  // ===== Cross-page Pub/Sub (keeps all pages in sync) =====
  const subscribers = new Set();
  function notify() {
    for (const fn of subscribers) { try { fn(); } catch (e) { console.error(e); } }
    // ping other tabs
    try { localStorage.setItem('__atlas_ping__', String(Date.now())); } catch {}
  }
  window.addEventListener('storage', (ev) => {
    if (['atlas_tasks','atlas_projects','atlas_documents','atlas_events','__atlas_ping__'].includes(ev.key)) {
      for (const fn of subscribers) { try { fn(); } catch (e) { console.error(e); } }
    }
  });

  // ===== Atlas App =====
  class AtlasApp {
    constructor() {
      // State
      this.tasks = [];
      this.projects = [];
      this.documents = [];
      this.events = [];

      // Derived
      this._taskIndexByTitle = new Map(); // allows legacy title-based opens
      this._focusTrap = null;

      // Filters
      this.currentFilter = 'all';
      this.currentPriorityFilter = 'all';
      this.calendarMonth = today.getMonth();
      this.calendarYear = today.getFullYear();
      this.calendarProjectFilter = 'all';

      // Init
      this.loadData();
      this.reindexTasks();
      this.setupGlobalListeners();
      this.enableUniversalTaskOpen();
      this.ensureModalRoots();
      this.routeInit();

      // Pub/Sub API
      this.onChange = (fn) => { if (typeof fn === 'function') subscribers.add(fn); return () => subscribers.delete(fn); };
    }

    // ===== Data Seed / Persistence =====
    loadData() {
      this.tasks     = safeJSON.get('atlas_tasks',     []);
      this.projects  = safeJSON.get('atlas_projects',  []);
      this.documents = safeJSON.get('atlas_documents', []);
      this.events    = safeJSON.get('atlas_events',    []);

      if (!this.projects.length) {
        this.projects = [
          { id: 'kitchen', name: 'Kitchen Renovation', status: 'active',   progress: 42, budget: 25000, spent: 11250, priority: 'high' },
          { id: 'basement',name: 'Basement Finishing', status: 'active',   progress: 65, budget: 18000, spent: 9000,  priority: 'medium' },
          { id: 'bathroom',name: 'Bathroom Update',    status: 'planning', progress: 20, budget: 8000,  spent: 1200,  priority: 'medium' }
        ];
      }

      if (!this.tasks.length) {
        this.tasks = [
          // Someday
          { id: 't1',  title: 'Replace attic insulation',       status: 'someday',     project: 'basement', priority: 'low',    labels: ['energy'],                          dueDate: null },
          { id: 't2',  title: 'Add greywater system',           status: 'someday',     project: 'bathroom', priority: 'low',    labels: ['plumbing'],                        dueDate: null },
          // Planning
          { id: 't3',  title: 'Order backsplash tiles',         status: 'planning',    project: 'kitchen',  priority: 'medium', labels: ['tiles','shopping'],                 dueDate: 'Next week' },
          { id: 't4',  title: 'Get quote: egress window',       status: 'planning',    project: 'basement', priority: 'medium', labels: ['contractor'],                       dueDate: null },
          // Ready
          { id: 't5',  title: 'Schedule tile install',          status: 'ready',       project: 'kitchen',  priority: 'high',   labels: ['tiling'],                           dueDate: 'Fri' },
          { id: 't6',  title: 'Purchase vanity hardware',       status: 'ready',       project: 'bathroom', priority: 'medium', labels: ['hardware'],                         dueDate: null },
          // In-Progress
          { id: 't7',  title: 'Paint cabinet doors',            status: 'in-progress', project: 'kitchen',  priority: 'medium', labels: ['painting','diy'],                    dueDate: '50% complete' },
          { id: 't8',  title: 'Install bathroom exhaust fan',   status: 'in-progress', project: 'bathroom', priority: 'medium', labels: ['electrical','contractor'],            dueDate: 'Electrician scheduled' },
          // Blocked
          { id: 't9',  title: 'Wait for electrical inspection', status: 'blocked',     project: 'bathroom', priority: 'high',   labels: ['inspection','blocked'],             dueDate: 'Delayed by inspector' },
          { id: 't10', title: 'Wait for custom cabinet delivery',status:'blocked',     project: 'kitchen',  priority: 'medium', labels: ['delivery','supplier'],                dueDate: 'Expected next Tuesday' },
          // Done
          { id: 't11', title: 'Install kitchen countertops',    status: 'done',        project: 'kitchen',  priority: 'high',   labels: ['countertops','completed'],           dueDate: 'Completed yesterday' },
          { id: 't12', title: 'Remove old bathroom fixtures',   status: 'done',        project: 'bathroom', priority: 'high',   labels: ['demolition','completed'],            dueDate: 'Completed last week' },
          { id: 't13', title: 'Paint basement ceiling',         status: 'done',        project: 'basement', priority: 'medium', labels: ['painting','completed'],              dueDate: 'Completed 2 weeks ago' }
        ];
      }

      if (!this.documents.length) {
        this.documents = [
          { id: 'doc-1', type: 'contract', project: 'kitchen',  title: 'Kitchen renovation contract', date: '2024-10-15', size: '2.4 MB' },
          { id: 'doc-2', type: 'photos',   project: 'kitchen',  title: 'Kitchen before photos',       date: '2024-10-12', size: '12 photos', photos: 12 },
          { id: 'doc-3', type: 'permit',   project: 'basement', title: 'Basement building permits',   date: '2024-11-01', size: '1.1 MB' },
          { id: 'doc-4', type: 'receipt',  project: 'kitchen',  title: 'Home Depot receipt',          date: '2024-11-18', size: '$342.19' }
        ];
      }

      if (!this.events.length) {
        this.events = [
          { id: 'e1', title: 'Electrical inspection', date: formatDateISO(new Date(this.calendarYear, this.calendarMonth, 7)),  project: 'bathroom', duration: 60, attendees: ['Inspector'], notes: 'AM window' },
          { id: 'e2', title: 'Tile delivery',         date: formatDateISO(new Date(this.calendarYear, this.calendarMonth, 12)), project: 'kitchen',  duration: 0,  attendees: [],             notes: 'Curbside' },
          { id: 'e3', title: 'Contractor meeting',    date: formatDateISO(new Date(this.calendarYear, this.calendarMonth, 12)), project: 'basement', duration: 30, attendees: ['GC'],        notes: 'Scope review' },
          { id: 'e4', title: 'Vanity install',        date: formatDateISO(new Date(this.calendarYear, this.calendarMonth, 19)), project: 'bathroom', duration: 120,attendees: ['Electrician'],notes: '' }
        ];
      }

      this.saveData(false);
    }

    saveData(emit = true) {
      safeJSON.set('atlas_tasks',     this.tasks);
      safeJSON.set('atlas_projects',  this.projects);
      safeJSON.set('atlas_documents', this.documents);
      safeJSON.set('atlas_events',    this.events);
      if (emit) notify();
    }

    reindexTasks() {
      this._taskIndexByTitle.clear();
      for (const t of this.tasks) {
        if (!this._taskIndexByTitle.has(t.title)) this._taskIndexByTitle.set(t.title, []);
        this._taskIndexByTitle.get(t.title).push(t.id);
      }
    }

    // ===== Routing =====
    getCurrentPage() {
      const path = (location.pathname || '').toLowerCase();
      if (path.includes('kanban'))    return 'kanban';
      if (path.includes('calendar'))  return 'calendar';
      if (path.includes('documents')) return 'documents';
      if (path.includes('projects'))  return 'projects';
      if (path.includes('budget'))    return 'budget';
      if (path.includes('dashboard')) return 'dashboard';
      return 'index';
    }

    routeInit() {
      const page = this.getCurrentPage();
      log('Init page:', page);
      switch (page) {
        case 'kanban':    this.initKanban();    break;
        case 'calendar':  this.initCalendar();  break;
        case 'documents': this.initDocuments(); break;
        case 'projects':  this.initProjects();  break;
        case 'budget':    this.initBudget();    break;
        case 'dashboard': this.initDashboard(); break;
        default: break;
      }
      // Keep pages live as data changes
      this.onChange(() => {
        this.reindexTasks();
        switch (this.getCurrentPage()) {
          case 'kanban':   this.renderKanban();   break;
          case 'calendar': this.renderCalendarGrid(); this.renderCalendarHeader(); break;
          // others read directly on interaction
        }
      });
    }

    // ===== Modal System (hardened) =====
    ensureModalRoots() {
      if (!$('#atlas-modal-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'atlas-modal-overlay';
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
      }
      if (!$('#atlas-modal-host')) {
        const host = document.createElement('div');
        host.id = 'atlas-modal-host';
        document.body.appendChild(host);
      }
    }

    createModal(title, content, options = {}) {
      this.closeModal();

      const overlay = $('#atlas-modal-overlay');
      const host = $('#atlas-modal-host');

      overlay.innerHTML = `
        <div class="modal-container" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-header">
            <h3>${esc(title)}</h3>
            <button class="modal-close" aria-label="Close" data-modal-close>&times;</button>
          </div>
          <div class="modal-body">${content}</div>
        </div>
      `;

      // Focus trap
      const focusables = () => Array.from(overlay.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el=>!el.hasAttribute('disabled'));
      const firstTick = () => {
        const el = focusables()[0];
        if (el) el.focus();
      };
      this._focusTrap = (e) => {
        if (e.key !== 'Tab') return;
        const items = focusables();
        if (!items.length) return;
        const first = items[0], last = items[items.length-1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      };

      host.classList.add('show');
      overlay.classList.add('show');
      document.body.classList.add('atlas-modal-open');

      overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeModal(); });
      overlay.addEventListener('keydown', this._focusTrap);
      overlay.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', ()=>this.closeModal()));

      setTimeout(firstTick, 10);
      return overlay;
    }

    closeModal() {
      const overlay = $('#atlas-modal-overlay');
      const host = $('#atlas-modal-host');
      if (!overlay || !host) return;
      overlay.classList.remove('show');
      host.classList.remove('show');
      overlay.innerHTML = '';
      document.body.classList.remove('atlas-modal-open');
      if (this._focusTrap) overlay.removeEventListener('keydown', this._focusTrap);
      this._focusTrap = null;
    }

    // ===== Global Listeners / Back-compat bridges =====
    setupGlobalListeners() {
      // Keep existing inline handlers working
      window.showNewTaskModal = () => this.showAddTaskModal();
      window.showTaskDetail = (taskName) => {
        // legacy: called with a title string
        const ids = this._taskIndexByTitle.get(taskName) || [];
        const id = ids[0];
        if (id) this.openTaskById(id);
        else this.toast(`Task titled <strong>${esc(taskName)}</strong> not found.`);
      };
      window.showNewProjectModal = () => this.showNewProjectModal();
      window.showUserMenu = () => this.showUserMenu();

      // Kanban filter bridges
      window.handleProjectFilter = (value) => this.filterByProject(value);
      window.handlePriorityFilter = (value) => this.filterByPriority(value);

      // Documents bridges
      window.selectFolder = (folderId) => this.filterByFolder(folderId);
      window.toggleListView = () => this.toggleDocumentsListView();
      window.showFileDetails = (docId) => this.showFileDetails(docId);
      window.showShareModal = (docId) => this.showShareModal(docId);
      window.handleTypeFilter = (value) => this.filterDocsByType(value);
      window.handleProjectFilterDocs = (value) => this.filterDocsByProject(value);

      // Calendar bridges
      window.showAddEventModal = () => this.showAddEventModal();
      window.showEventDetails = (id) => this.showEventDetails(id);
      window.previousMonth = () => this.changeMonth(-1);
      window.nextMonth = () => this.changeMonth(1);
      window.goToToday = () => this.goToToday();
      window.changeView = (v) => this.changeCalendarView(v);
      window.showComingSoonAlert = () => this.showComingSoonAlert();

      // Allow dashboard/projects/etc. to directly open by id
      window.openTask = (id) => this.openTaskById(id);
      window.atlasOpenTask = (id) => this.openTaskById(id);

      // ESC to close modal globally
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeModal();
      });
    }

    // ===== Universal “click to open task” across all pages =====
    enableUniversalTaskOpen() {
      // 1) Delegate clicks on any element with [data-task-id] or .task-link
      document.addEventListener('click', (e) => {
        const t = e.target.closest('[data-task-id], .task-link');
        if (!t) return;
        const id = t.getAttribute('data-task-id') || (t.getAttribute('href') || '').replace('#','');
        if (!id) return;
        if (t.tagName === 'A') e.preventDefault();
        this.openTaskById(id);
      }, true);

      // 2) Upgrade legacy elements that only carry a title
      //    Add [data-task-id] when we can resolve a unique match
      const upgrade = () => {
        $$('[data-task-title]').forEach(el => {
          if (el.hasAttribute('data-task-id')) return;
          const title = el.getAttribute('data-task-title');
          const ids = this._taskIndexByTitle.get(title) || [];
          if (ids.length === 1) el.setAttribute('data-task-id', ids[0]);
        });
      };
      upgrade();

      // 3) Mutation observer to catch late-rendered nodes
      const mo = new MutationObserver(() => upgrade());
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }

    // ===== User Menu =====
    showUserMenu() {
      return this.createModal('User Settings', `
        <div class="task-detail-modal">
          <h3>Andrew Foster</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Email:</strong> <span>andrew@projectatlas.dev</span></div>
            <div class="detail-row"><strong>Plan:</strong> <span>Pro (Beta)</span></div>
            <div class="detail-row"><strong>Data:</strong> <span>Stored locally (demo)</span></div>
          </div>
          <div class="form-actions">
            <button class="btn-secondary" data-modal-close>Close</button>
          </div>
        </div>
      `);
    }

    // ===== Projects Page =====
    initProjects() {
      // Keep static for now; modal works via showNewProjectModal.
    }
    showNewProjectModal() {
      const modal = this.createModal('Create New Project', `
        <form id="new-project-form" class="task-form">
          <div class="form-group">
            <label for="project-name">Project Name *</label>
            <input type="text" id="project-name" placeholder="e.g. Deck Construction" required>
          </div>
          <div class="form-group">
            <label for="project-description">Description</label>
            <textarea id="project-description" rows="3" placeholder="Brief description of the project."></textarea>
          </div>
          <div class="form-group">
            <label for="project-budget">Budget Allocation *</label>
            <input type="number" id="project-budget" placeholder="25000" required>
          </div>
          <div class="form-group">
            <label for="project-timeline">Estimated Timeline</label>
            <input type="text" id="project-timeline" placeholder="e.g. 8 weeks, 3 months">
          </div>
          <div class="form-group">
            <label for="project-priority">Priority Level *</label>
            <select id="project-priority" required>
              <option value="high">High Priority</option>
              <option value="medium" selected>Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn-primary">Create Project</button>
          </div>
        </form>
      `);
      const form = modal.querySelector('#new-project-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const newProject = {
          id: 'project-' + Date.now(),
          name: $('#project-name').value,
          description: $('#project-description').value,
          budget: parseFloat($('#project-budget').value),
          timeline: $('#project-timeline').value,
          priority: $('#project-priority').value,
          status: 'planning',
          progress: 0,
          spent: 0,
          tasks: []
        };
        this.projects.push(newProject);
        this.saveData();
        this.closeModal();
        this.toast(`Project <strong>${esc(newProject.name)}</strong> created successfully!`);
      });
    }

    // ===== Kanban =====
    initKanban() {
      setTimeout(() => {
        this.renderKanban();
        this.setupKanbanFilters();
        this.setupAddTaskButtons();
      }, 0);
    }

    setupAddTaskButtons() {
      $$('.add-task-btn').forEach(btn => {
        const status = btn.dataset.status || 'planning';
        btn.addEventListener('click', () => this.showAddTaskModal(status));
      });
    }

    setupKanbanFilters() {
      // Left as-is (selectors are in the HTML). No-op is fine for now.
    }

    filterByProject(value) {
      this.currentFilter = (value || 'all').toLowerCase().replace(/\s+/g, '-');
      if (this.currentFilter.includes('all')) this.currentFilter = 'all';
      if (!['kitchen','basement','bathroom','all'].includes(this.currentFilter)) this.currentFilter = 'all';
      if (this.getCurrentPage() === 'kanban') this.renderKanban();
    }

    filterByPriority(value) {
      const v = (value || '').toLowerCase();
      this.currentPriorityFilter = v.includes('high') ? 'high' : v.includes('medium') ? 'medium' : v.includes('low') ? 'low' : 'all';
      if (this.getCurrentPage() === 'kanban') this.renderKanban();
    }

    getFilteredTasks() {
      return this.tasks.filter(task => {
        const projectMatch = this.currentFilter === 'all' || task.project === this.currentFilter;
        const priorityMatch = this.currentPriorityFilter === 'all' || task.priority === this.currentPriorityFilter;
        return projectMatch && priorityMatch;
      });
    }

    renderKanban() {
      const statuses = ['someday','planning','ready','in-progress','blocked','done'];
      statuses.forEach(status => {
        const container = document.querySelector(`.task-cards[data-status="${status}"]`);
        if (!container) return;
        container.innerHTML = '';
        const tasks = this.getFilteredTasks().filter(t => t.status === status);
        tasks.forEach(task => container.appendChild(this.createTaskCard(task)));
        const countBadge = container.closest('.kanban-column')?.querySelector('.task-count');
        if (countBadge) countBadge.textContent = tasks.length;
      });
      this.setupKanbanDragDrop();
    }

    createTaskCard(task) {
      const card = document.createElement('div');
      card.className = `task-card priority-${task.priority}`;
      card.draggable = true;
      card.dataset.taskId = task.id;
      card.innerHTML = `
        <div class="task-title">${esc(task.title)}</div>
        <div class="task-meta">
          <span class="task-project">${esc(this.projectName(task.project))}</span>
          ${task.dueDate ? `<span class="task-due">${esc(task.dueDate)}</span>` : ''}
        </div>
        ${task.labels?.length ? `<div class="task-labels">${task.labels.map(l => `<span class="task-label">${esc(l)}</span>`).join('')}</div>` : ''}
      `;
      // Open (guard against drag)
      card.addEventListener('click', () => { if (!card.dragging) this.openTaskById(task.id); });
      // Drag flags
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        card.dragging = true;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
      });
      card.addEventListener('dragend', () => { card.classList.remove('dragging'); card.dragging = false; });
      return card;
    }

    setupKanbanDragDrop() {
      const cards = $$('.task-card');
      const columns = $$('.task-cards');

      // Reset card listeners by cloning (prevents duplicates)
      cards.forEach(card => {
        const clone = card.cloneNode(true);
        card.parentNode.replaceChild(clone, card);

        clone.addEventListener('dragstart', (e) => {
          clone.classList.add('dragging');
          clone.dragging = true;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', clone.dataset.taskId);
        });
        clone.addEventListener('dragend', () => { clone.classList.remove('dragging'); clone.dragging = false; });
        clone.addEventListener('click', () => { if (!clone.dragging) this.openTaskById(clone.dataset.taskId); });
      });

      // Reset column listeners
      columns.forEach(col => {
        const clone = col.cloneNode(true);
        col.parentNode.replaceChild(clone, col);

        clone.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const dragging = document.querySelector('.dragging');
          if (!dragging) return;
          const after = this.getDragAfterElement(clone, e.clientY);
          if (after == null) clone.appendChild(dragging);
          else clone.insertBefore(dragging, after);
          clone.classList.add('drag-over');
        });
        clone.addEventListener('dragleave', (e) => { if (e.target === clone) clone.classList.remove('drag-over'); });
        clone.addEventListener('drop', (e) => {
          e.preventDefault();
          clone.classList.remove('drag-over');
          const dragging = document.querySelector('.dragging');
          if (!dragging) return;
          const taskId = dragging.dataset.taskId;
          const newStatus = clone.dataset.status;
          this.updateTaskStatus(taskId, newStatus);
        });
      });
    }

    getDragAfterElement(column, y) {
      const els = [...column.querySelectorAll('.task-card:not(.dragging)')];
      return els.reduce((closest, el) => {
        const box = el.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: el };
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updateTaskStatus(taskId, newStatus) {
      const t = this.tasks.find(x => x.id === taskId);
      if (!t) return;
      const old = t.status;
      t.status = newStatus;
      this.saveData();
      this.reindexTasks();
      this.updateColumnCounts();
      this.showStatusChangeNotification(taskId, newStatus);
      log(`Task ${taskId} moved from ${old} to ${newStatus}`);
    }

    updateColumnCounts() {
      const statuses = ['someday','planning','ready','in-progress','blocked','done'];
      statuses.forEach(s => {
        const count = this.getFilteredTasks().filter(t => t.status === s).length;
        const col = document.querySelector(`.task-cards[data-status="${s}"]`);
        const badge = col?.closest('.kanban-column')?.querySelector('.task-count');
        if (badge) badge.textContent = count;
      });
    }

    showStatusChangeNotification(taskId, newStatus) {
      const t = this.tasks.find(x => x.id === taskId);
      if (!t) return;
      const names = {
        'someday':'Someday/Maybe','planning':'Research & Planning','ready':'Permitted & Ready',
        'in-progress':'Active Work','blocked':'Waiting on External','done':'Done Done'
      };
      this.toast(`<strong>${esc(t.title)}</strong> moved to <strong>${names[newStatus] || newStatus}</strong>`);
    }

    showAddTaskModal(status = 'planning') {
      const modal = this.createModal('Add Task', `
        <form id="add-task-form" class="task-form">
          <div class="form-group">
            <label for="task-title">Task Title *</label>
            <input type="text" id="task-title" required placeholder="e.g. Order backsplash tiles">
          </div>
          <div class="form-group">
            <label for="task-project">Project *</label>
            <select id="task-project" required>
              ${this.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="task-priority">Priority *</label>
            <select id="task-priority" required>
              <option value="high">High Priority</option>
              <option value="medium" selected>Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
          <div class="form-group">
            <label for="task-due">Due Date</label>
            <input type="text" id="task-due" placeholder="e.g. Due Friday, Next week">
          </div>
          <div class="form-group">
            <label for="task-labels">Labels (comma-separated)</label>
            <input type="text" id="task-labels" placeholder="e.g. painting, diy">
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn-primary">Add Task</button>
          </div>
        </form>
      `);

      modal.querySelector('#add-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const newTask = {
          id: uid('t'),
          title: $('#task-title').value,
          project: $('#task-project').value,
          priority: $('#task-priority').value,
          status,
          dueDate: $('#task-due').value || null,
          labels: $('#task-labels').value.split(',').map(l => l.trim()).filter(Boolean)
        };
        this.tasks.push(newTask);
        this.saveData();
        this.reindexTasks();
        if (this.getCurrentPage() === 'kanban') this.renderKanban();
        this.closeModal();
        this.showStatusChangeNotification(newTask.id, newTask.status);
      });
    }

    // ===== Task Detail (Modal) – used everywhere =====
    openTaskById(id) {
      const task = this.tasks.find(t => t.id === id);
      if (!task) { this.toast('Task not found.'); return; }
      this.showTaskDetailModal(task);
    }

    showTaskDetailModal(task) {
      const projectNames = this.projects.reduce((acc, p) => (acc[p.id] = p.name, acc), {});
      const modal = this.createModal('Task Details', `
        <div class="task-detail-modal">
          <h3>${esc(task.title)}</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Project:</strong> <span>${esc(projectNames[task.project] || task.project)}</span></div>
            <div class="detail-row"><strong>Status:</strong> <span>${esc(task.status)}</span></div>
            <div class="detail-row"><strong>Priority:</strong> <span>${esc(task.priority)}</span></div>
            ${task.dueDate ? `<div class="detail-row"><strong>Due:</strong> <span>${esc(task.dueDate)}</span></div>` : ''}
            ${task.labels?.length ? `<div class="detail-row"><strong>Labels:</strong> <span>${task.labels.map(esc).join(', ')}</span></div>` : ''}
            <div class="detail-row"><strong>ID:</strong> <code>${esc(task.id)}</code></div>
          </div>
          <div class="form-actions">
            <button class="btn-secondary" data-modal-close>Close</button>
            <button class="btn-primary" id="btn-move-task">Move…</button>
            <button class="btn-primary" id="btn-edit-task">Edit</button>
          </div>
        </div>
      `);

      $('#btn-move-task', modal).addEventListener('click', () => this.moveTask(task.id));
      $('#btn-edit-task', modal).addEventListener('click', () => this.editTaskModal(task.id));
    }

    editTaskModal(taskId) {
      const t = this.tasks.find(x => x.id === taskId);
      if (!t) return;
      const statuses = ['someday','planning','ready','in-progress','blocked','done'];
      const statusOpts = statuses.map(s => `<option value="${s}" ${t.status===s?'selected':''}>${esc(s)}</option>`).join('');
      const modal = this.createModal('Edit Task', `
        <form id="edit-task-form" class="task-form">
          <div class="form-group">
            <label for="edt-title">Title *</label>
            <input type="text" id="edt-title" required value="${esc(t.title)}">
          </div>
          <div class="form-group">
            <label for="edt-project">Project *</label>
            <select id="edt-project" required>
              ${this.projects.map(p => `<option value="${p.id}" ${t.project===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="edt-status">Status *</label>
            <select id="edt-status" required>${statusOpts}</select>
          </div>
          <div class="form-group">
            <label for="edt-priority">Priority *</label>
            <select id="edt-priority" required>
              <option value="high" ${t.priority==='high'?'selected':''}>High</option>
              <option value="medium" ${t.priority==='medium'?'selected':''}>Medium</option>
              <option value="low" ${t.priority==='low'?'selected':''}>Low</option>
            </select>
          </div>
          <div class="form-group">
            <label for="edt-due">Due</label>
            <input type="text" id="edt-due" value="${esc(t.dueDate||'')}">
          </div>
          <div class="form-group">
            <label for="edt-labels">Labels</label>
            <input type="text" id="edt-labels" value="${esc((t.labels||[]).join(', '))}">
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="btn-del-task">Delete</button>
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      `);

      $('#btn-del-task', modal).addEventListener('click', () => {
        this.tasks = this.tasks.filter(x => x.id !== t.id);
        this.saveData();
        this.reindexTasks();
        this.closeModal();
        if (this.getCurrentPage() === 'kanban') this.renderKanban();
        this.toast('Task deleted.');
      });

      $('#edit-task-form', modal).addEventListener('submit', (e) => {
        e.preventDefault();
        t.title    = $('#edt-title').value.trim();
        t.project  = $('#edt-project').value;
        t.status   = $('#edt-status').value;
        t.priority = $('#edt-priority').value;
        t.dueDate  = $('#edt-due').value || null;
        t.labels   = $('#edt-labels').value.split(',').map(s=>s.trim()).filter(Boolean);
        if (!t.title) { this.toast('Title required.'); return; }
        this.saveData();
        this.reindexTasks();
        this.closeModal();
        if (this.getCurrentPage() === 'kanban') this.renderKanban();
        this.toast('Task updated.');
      });
    }

    moveTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;
      const modal = this.createModal('Move Task', `
        <form id="move-task-form" class="task-form">
          <div class="form-group">
            <label for="move-status">New Status</label>
            <select id="move-status">
              <option value="someday">Someday</option>
              <option value="planning">Planning</option>
              <option value="ready">Ready</option>
              <option value="in-progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn-primary">Move</button>
          </div>
        </form>
      `);
      $('#move-status').value = task.status;
      $('#move-task-form', modal).addEventListener('submit', (e) => {
        e.preventDefault();
        const newStatus = $('#move-status').value;
        this.updateTaskStatus(taskId, newStatus);
        this.closeModal();
      });
    }

    projectName(id) {
      const p = this.projects.find(pp => pp.id === id);
      return p ? p.name : id;
    }

    // ===== Calendar =====
    initCalendar() {
      this.renderCalendarHeader();
      this.renderCalendarGrid();
      this.renderCalendarStats();
    }

    renderCalendarHeader() {
      const monthLabel = $('#monthLabel');
      if (!monthLabel) return;
      const d = new Date(this.calendarYear, this.calendarMonth, 1);
      monthLabel.textContent = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    }

    changeMonth(delta) {
      this.calendarMonth += delta;
      if (this.calendarMonth < 0) { this.calendarMonth = 11; this.calendarYear -= 1; }
      else if (this.calendarMonth > 11) { this.calendarMonth = 0; this.calendarYear += 1; }
      this.renderCalendarHeader();
      this.renderCalendarGrid();
    }

    goToToday() {
      this.calendarMonth = today.getMonth();
      this.calendarYear = today.getFullYear();
      this.renderCalendarHeader();
      this.renderCalendarGrid();
    }

    changeCalendarView(view) {
      if (view === 'week' || view === 'day') this.showComingSoonAlert();
    }

    showComingSoonAlert() { this.toast('Week and Day views are under development.'); }

    filterCalendarByProject(value) {
      this.calendarProjectFilter = (value || 'all').toLowerCase().replace(/\s+/g, '-');
      this.renderCalendarGrid();
    }

    renderCalendarGrid() {
      const grid = $('#calendarGrid');
      if (!grid) return;
      grid.innerHTML = '';

      const first = new Date(this.calendarYear, this.calendarMonth, 1);
      const last = new Date(this.calendarYear, this.calendarMonth + 1, 0);
      const startDay = first.getDay();
      const totalDays = last.getDate();

      for (let i = 0; i < startDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell empty';
        grid.appendChild(cell);
      }

      for (let d = 1; d <= totalDays; d++) {
        const cellDate = new Date(this.calendarYear, this.calendarMonth, d);
        const dateISO = formatDateISO(cellDate);

        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        dayCell.setAttribute('role', 'button');
        dayCell.tabIndex = 0;
        dayCell.dataset.date = dateISO;

        const header = document.createElement('div');
        header.className = 'date-header';
        header.textContent = d;
        dayCell.appendChild(header);

        const dayEvents = this.events.filter(e => {
          const projectMatch = this.calendarProjectFilter === 'all' || e.project === this.calendarProjectFilter;
          return e.date === dateISO && projectMatch;
        });

        if (dayEvents.length) {
          const list = document.createElement('div');
          list.className = 'events-list';
          dayEvents.forEach(ev => {
            const pill = document.createElement('div');
            pill.className = 'event-pill';
            pill.textContent = ev.title;
            pill.title = `${ev.title} — ${this.projectName(ev.project)}`;
            pill.addEventListener('click', (e) => { e.stopPropagation(); this.showEventDetails(ev.id); });
            list.appendChild(pill);
          });
          dayCell.appendChild(list);
        }

        dayCell.addEventListener('click', () => this.showEventsForDate(dateISO));
        dayCell.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') this.showEventsForDate(dateISO); });

        grid.appendChild(dayCell);
      }
    }

    showEventsForDate(dateISO) {
      const items = this.events.filter(e => e.date === dateISO && (this.calendarProjectFilter === 'all' || e.project === this.calendarProjectFilter));
      if (!items.length) { this.toast('No events for this date.'); return; }
      const title = `Events on ${humanDate(dateISO)}`;
      const html = items.map(e => `
        <div class="event-item">
          <div class="event-title"><strong>${esc(e.title)}</strong></div>
          <div class="event-meta">${esc(this.projectName(e.project))} • ${e.duration ? `${e.duration} min` : 'All day'}</div>
          ${e.notes ? `<div class="event-notes">${esc(e.notes)}</div>` : ''}
          <div class="form-actions" style="justify-content:flex-start;margin-top:.75rem;">
            <button class="btn-primary" onclick="window.atlas.showEventDetails('${e.id}')">View</button>
          </div>
        </div>
      `).join('');
      this.createModal(title, html + `<div class="form-actions"><button class="btn-secondary" data-modal-close>Close</button></div>`);
    }

    showAddEventModal() {
      const modal = this.createModal('Schedule New Task/Event', `
        <form id="add-event-form" class="task-form">
          <div class="form-group">
            <label for="ev-title">Title *</label>
            <input type="text" id="ev-title" required placeholder="e.g. Electrical inspection">
          </div>
          <div class="form-group">
            <label for="ev-date">Date *</label>
            <input type="date" id="ev-date" required value="${formatDateISO(new Date(this.calendarYear, this.calendarMonth, today.getDate()))}">
          </div>
          <div class="form-group">
            <label for="ev-project">Project *</label>
            <select id="ev-project" required>
              ${this.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="ev-duration">Duration (minutes)</label>
            <input type="number" id="ev-duration" min="0" placeholder="60">
          </div>
          <div class="form-group">
            <label for="ev-notes">Notes</label>
            <textarea id="ev-notes" rows="3" placeholder="e.g. AM window"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn-primary">Add Event</button>
          </div>
        </form>
      `);

      $('#add-event-form', modal).addEventListener('submit', (e) => {
        e.preventDefault();
        const ev = {
          id: uid('e'),
          title: $('#ev-title').value,
          date: $('#ev-date').value,
          project: $('#ev-project').value,
          duration: parseInt($('#ev-duration').value || '0', 10) || 0,
          notes: $('#ev-notes').value || ''
        };
        this.events.push(ev);
        this.saveData();
        this.closeModal();
        this.renderCalendarGrid();
        this.toast('Event scheduled.');
      });
    }

    showEventDetails(eventId) {
      const e = this.events.find(x => x.id === eventId);
      if (!e) return;
      this.createModal('Event Details', `
        <div class="task-detail-modal">
          <h3>${esc(e.title)}</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Date:</strong> <span>${esc(humanDate(e.date))}</span></div>
            <div class="detail-row"><strong>Project:</strong> <span>${esc(this.projectName(e.project))}</span></div>
            <div class="detail-row"><strong>Duration:</strong> <span>${e.duration ? `${e.duration} min` : 'All day'}</span></div>
            ${e.notes ? `<div class="detail-row"><strong>Notes:</strong> <span>${esc(e.notes)}</span></div>` : ''}
          </div>
          <div class="form-actions">
            <button class="btn-secondary" data-modal-close>Close</button>
          </div>
        </div>
      `);
    }

    renderCalendarStats() {
      const meetingsEl = $('#statMeetings');
      if (meetingsEl) {
        const count = this.events.filter(e => /meeting/i.test(e.title)).length;
        meetingsEl.textContent = String(count);
      }
    }

    // ===== Documents =====
    initDocuments() { /* hooks already wired */ }
    filterByFolder(folderId) {
      const folder = (folderId || 'all').toLowerCase();
      this.toast(folder === 'all' ? 'Showing all documents' : `Filtered to ${this.projectName(folder)}`);
    }
    filterDocsByProject(value) {
      const v = (value || 'all').toLowerCase().replace(/\s+/g, '-');
      this.toast(v === 'all' ? 'All projects' : `Project: ${this.projectName(v)}`);
    }
    filterDocsByType(value) {
      const v = (value || 'all').toLowerCase();
      this.toast(v === 'all' ? 'All types' : `Type: ${v}`);
    }
    toggleDocumentsListView() {
      const grid = $('.documents-grid');
      if (!grid) return;
      grid.classList.toggle('list-mode');
      this.toast(grid.classList.contains('list-mode') ? 'List view' : 'Grid view');
    }
    showFileDetails(docId) {
      const doc = this.documents.find(d => d.id === docId) ||
                  this.documents.find(d => d.id === `doc-${(docId||'').split('-').pop()}`) || null;
      const content = doc ? `
        <div class="task-detail-modal">
          <h3>${esc(doc.title)}</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Project:</strong> <span>${esc(this.projectName(doc.project))}</span></div>
            <div class="detail-row"><strong>Type:</strong> <span>${esc(doc.type)}</span></div>
            <div class="detail-row"><strong>Date:</strong> <span>${esc(humanDate(doc.date))}</span></div>
            ${doc.size ? `<div class="detail-row"><strong>Size:</strong> <span>${esc(doc.size)}</span></div>` : ''}
          </div>
          <div style="margin-top:1rem;">
            ${doc.type === 'photos' ? `<div>Photo set preview (${doc.photos || 0} items)</div>` : `<div>Preview not available in demo.</div>`}
          </div>
          <div class="form-actions">
            <button class="btn-secondary" data-modal-close>Close</button>
            <button class="btn-primary" onclick="navigator.clipboard.writeText('https://share.projectatlas.dev/${doc.id}');window.atlas.toast('Link copied!')">Copy Link</button>
          </div>
        </div>
      ` : `
        <div>File ID: ${esc(docId)}</div>
        <div class="form-actions"><button class="btn-secondary" data-modal-close>Close</button></div>
      `;
      this.createModal('File Details', content);
    }
    showShareModal(docId) { this.showFileDetails(docId); }

    // ===== Budget =====
    initBudget() { /* reserved for charts/summary */ }
    filterBudgetByProject(value) { this.toast(`Budget filter project: ${esc(value)}`); }
    filterBudgetByTime(value) { this.toast(`Budget filter time: ${esc(value)}`); }

    // ===== Dashboard =====
    initDashboard() { /* dashboard tiles call showTaskDetail or carry data-task-id */ }

    // ===== Toast / Notifications =====
    toast(html) {
      let n = $('#atlas-toast');
      if (!n) {
        n = document.createElement('div');
        n.id = 'atlas-toast';
        n.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#111;color:#fff;padding:.6rem .8rem;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.25);opacity:0;pointer-events:none;z-index:1100;transition:opacity .2s';
        document.body.appendChild(n);
      }
      n.innerHTML = `<div class="notification-content">${html}</div>`;
      n.style.opacity = '1';
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(()=>{ n.style.opacity='0'; }, 2000);
    }
  }

  // Bootstrap
  window.atlas = new AtlasApp();

  // ===== Public helper widgets for other pages (optional) =====
  window.AtlasUI = {
    // Render a simple clickable task list into a container
    renderTaskList(container, filterFn) {
      if (!container) return;
      container.innerHTML = '';
      const tasks = window.atlas.tasks.filter(t => !filterFn || filterFn(t));
      if (!tasks.length) { container.innerHTML = '<p class="text-tertiary">No tasks.</p>'; return; }
      const ul = document.createElement('ul');
      ul.className = 'task-list';
      for (const t of tasks) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'task-pill';
        btn.setAttribute('data-task-id', t.id);
        const dot = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟠' : '🟢';
        const due = t.dueDate ? ` • 🗓️ ${esc(t.dueDate)}` : '';
        btn.title = `${window.atlas.projectName(t.project)}${due}`;
        btn.innerHTML = `${dot} ${esc(t.title)}`;
        li.appendChild(btn);
        ul.appendChild(li);
      }
      container.appendChild(ul);
    },
    // Create a single clickable pill (returns a DOM node)
    renderTaskPill(task) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'task-pill';
      btn.setAttribute('data-task-id', task.id);
      const dot = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟠' : '🟢';
      btn.innerHTML = `${dot} ${esc(task.title)}`;
      const due = task.dueDate ? ` • 🗓️ ${esc(task.dueDate)}` : '';
      btn.title = `${window.atlas.projectName(task.project)}${due}`;
      return btn;
    }
  };

})();

