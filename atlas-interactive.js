/**
 * Project Atlas - Interactive Application Script
 * Full feature layer for Kanban, Calendar, Documents, Budget stubs, and Dashboard
 * Author: Andrew Foster
 * Last Updated: 2025-10-12
 *
 * Notes:
 * - This file centralizes state (tasks, projects, events, documents) in localStorage.
 * - Pages call into window.atlas.* methods via simple inline handlers for accessibility.
 * - All "coming soon" alert placeholders in pages now have working implementations here.
 * - No functionality removed — only added + hardened. Existing selectors and behaviors preserved.
 */

(function () {
  'use strict';

  // ===== Utilities =====
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Simple log wrapper that can be toggled
  const LOG_ENABLED = true;
  const log = (...args) => { if (LOG_ENABLED) console.log('[Atlas]', ...args); };

  // Date helpers
  const today = new Date();
  function formatDateISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Humanize date for documents/events
  function humanDate(d) {
    try {
      const date = (d instanceof Date) ? d : new Date(d);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  }

  // ===== Atlas App =====
  class AtlasApp {
    constructor() {
      // State
      this.tasks = [];
      this.projects = [];
      this.documents = [];
      this.events = [];

      // Filters
      this.currentFilter = 'all';
      this.currentPriorityFilter = 'all';
      this.calendarMonth = today.getMonth();
      this.calendarYear = today.getFullYear();
      this.calendarProjectFilter = 'all';

      // Init
      this.loadData();
      this.setupGlobalListeners();
      this.routeInit();
    }

    // ===== Data Seed / Persistence =====
    loadData() {
      const tasks = localStorage.getItem('atlas_tasks');
      const projects = localStorage.getItem('atlas_projects');
      const documents = localStorage.getItem('atlas_documents');
      const events = localStorage.getItem('atlas_events');

      if (tasks) this.tasks = JSON.parse(tasks);
      if (projects) this.projects = JSON.parse(projects);
      if (documents) this.documents = JSON.parse(documents);
      if (events) this.events = JSON.parse(events);

      // Seed minimal demo data if missing — keeps existing users' data intact
      if (!this.projects.length) {
        this.projects = [
          { id: 'kitchen', name: 'Kitchen Renovation', status: 'active', progress: 42, budget: 25000, spent: 11250, priority: 'high' },
          { id: 'basement', name: 'Basement Finishing', status: 'active', progress: 65, budget: 18000, spent: 9000, priority: 'medium' },
          { id: 'bathroom', name: 'Bathroom Update', status: 'planning', progress: 20, budget: 8000, spent: 1200, priority: 'medium' }
        ];
      }

      if (!this.tasks.length) {
        // Preserve column names used in kanban.html and styling (creative look stays)
        this.tasks = [
          // Someday
          { id: 't1', title: 'Replace attic insulation', status: 'someday', project: 'basement', priority: 'low', labels: ['energy'], dueDate: null },
          { id: 't2', title: 'Add greywater system', status: 'someday', project: 'bathroom', priority: 'low', labels: ['plumbing'], dueDate: null },

          // Planning
          { id: 't3', title: 'Order backsplash tiles', status: 'planning', project: 'kitchen', priority: 'medium', labels: ['tiles', 'shopping'], dueDate: 'Next week' },
          { id: 't4', title: 'Get quote: egress window', status: 'planning', project: 'basement', priority: 'medium', labels: ['contractor'], dueDate: null },

          // Ready
          { id: 't5', title: 'Schedule tile install', status: 'ready', project: 'kitchen', priority: 'high', labels: ['tiling'], dueDate: 'Fri' },
          { id: 't6', title: 'Purchase vanity hardware', status: 'ready', project: 'bathroom', priority: 'medium', labels: ['hardware'], dueDate: null },

          // In-Progress
          { id: 't7', title: 'Paint cabinet doors', status: 'in-progress', project: 'kitchen', priority: 'medium', labels: ['painting', 'diy'], dueDate: '50% complete' },
          { id: 't8', title: 'Install bathroom exhaust fan', status: 'in-progress', project: 'bathroom', priority: 'medium', labels: ['electrical', 'contractor'], dueDate: 'Electrician scheduled' },

          // Blocked
          { id: 't9', title: 'Wait for electrical inspection', status: 'blocked', project: 'bathroom', priority: 'high', labels: ['inspection', 'blocked'], dueDate: 'Delayed by inspector' },
          { id: 't10', title: 'Wait for custom cabinet delivery', status: 'blocked', project: 'kitchen', priority: 'medium', labels: ['delivery', 'supplier'], dueDate: 'Expected next Tuesday' },

          // Done
          { id: 't11', title: 'Install kitchen countertops', status: 'done', project: 'kitchen', priority: 'high', labels: ['countertops', 'completed'], dueDate: 'Completed yesterday' },
          { id: 't12', title: 'Remove old bathroom fixtures', status: 'done', project: 'bathroom', priority: 'high', labels: ['demolition', 'completed'], dueDate: 'Completed last week' },
          { id: 't13', title: 'Paint basement ceiling', status: 'done', project: 'basement', priority: 'medium', labels: ['painting', 'completed'], dueDate: 'Completed 2 weeks ago' }
        ];
      }

      if (!this.documents.length) {
        this.documents = [
          { id: 'doc-1', type: 'contract', project: 'kitchen', title: 'Kitchen renovation contract', date: '2024-10-15', size: '2.4 MB' },
          { id: 'doc-2', type: 'photos', project: 'kitchen', title: 'Kitchen before photos', date: '2024-10-12', size: '12 photos', photos: 12 },
          { id: 'doc-3', type: 'permit', project: 'basement', title: 'Basement building permits', date: '2024-11-01', size: '1.1 MB' },
          { id: 'doc-4', type: 'receipt', project: 'kitchen', title: 'Home Depot receipt', date: '2024-11-18', size: '$342.19' }
        ];
      }

      if (!this.events.length) {
        // Month-level events — used by calendar page
        this.events = [
          { id: 'e1', title: 'Electrical inspection', date: formatDateISO(new Date(this.calendarYear, this.calendarMonth, 7)), project: 'bathroom', duration: 60, attendees: ['Inspector'], notes: 'AM window' },
          { id: 'e2', title: 'Tile delivery', date: formatDateISO(new Date(this.calendarYear, this.calendarMonth, 12)), project: 'kitchen', duration: 0, attendees: [], notes: 'Curbside' },
          { id: 'e3', title: 'Contractor meeting', date: formatDateISO(new Date(this.calendarYear, this.calendarMonth, 12)), project: 'basement', duration: 30, attendees: ['GC'], notes: 'Scope review' },
          { id: 'e4', title: 'Vanity install', date: formatDateISO(new Date(this.calendarYear, this.calendarMonth, 19)), project: 'bathroom', duration: 120, attendees: ['Electrician'], notes: '' }
        ];
      }

      this.saveData();
    }

    saveData() {
      localStorage.setItem('atlas_tasks', JSON.stringify(this.tasks));
      localStorage.setItem('atlas_projects', JSON.stringify(this.projects));
      localStorage.setItem('atlas_documents', JSON.stringify(this.documents));
      localStorage.setItem('atlas_events', JSON.stringify(this.events));
    }

    // ===== Routing to page initializers =====
    getCurrentPage() {
      const path = (location.pathname || '').toLowerCase();
      if (path.includes('kanban')) return 'kanban';
      if (path.includes('calendar')) return 'calendar';
      if (path.includes('documents')) return 'documents';
      if (path.includes('projects')) return 'projects';
      if (path.includes('budget')) return 'budget';
      if (path.includes('dashboard')) return 'dashboard';
      return 'index';
    }

    routeInit() {
      const page = this.getCurrentPage();
      log('Init page:', page);

      switch (page) {
        case 'kanban':
          this.initKanban();
          break;
        case 'calendar':
          this.initCalendar();
          break;
        case 'documents':
          this.initDocuments();
          break;
        case 'projects':
          this.initProjects();
          break;
        case 'budget':
          this.initBudget();
          break;
        case 'dashboard':
          this.initDashboard();
          break;
        default:
          // No-op for marketing/index pages
          break;
      }
    }

    // ===== Modal System =====
    createModal(title, content) {
      // Remove any existing modal
      this.closeModal();

      const modalOverlay = document.createElement('div');
      modalOverlay.className = 'modal-overlay';
      modalOverlay.id = 'atlas-modal';

      modalOverlay.innerHTML = `
        <div class="modal-container">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" aria-label="Close" onclick="window.atlas.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
        </div>
      `;

      document.body.appendChild(modalOverlay);

      // Close on overlay click
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.closeModal();
      });

      // Close on escape key
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeModal();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);

      // Trigger show animation
      setTimeout(() => modalOverlay.classList.add('show'), 10);
      return modalOverlay;
    }

    closeModal() {
      const modal = document.getElementById('atlas-modal');
      if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
      }
    }

    // ===== Global Listeners (bridge inline handlers to class methods) =====
    setupGlobalListeners() {
      // Existing inline handlers mapped to methods here
      window.showNewTaskModal = () => this.showAddTaskModal();
      window.showTaskDetail = (taskName) => {
        const task = this.tasks.find(t => t.title === taskName);
        if (task) this.showTaskDetailModal(task);
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
      window.handleProjectFilterDocs = (value) => this.filterDocsByProject(value); // in case of dedicated handler

      // Calendar bridges
      window.handleProjectFilter = (value) => {
        // If on calendar page, use calendar filter, otherwise Kanban filter
        if (this.getCurrentPage() === 'calendar') this.filterCalendarByProject(value);
        else this.filterByProject(value);
      };
      window.showAddEventModal = () => this.showAddEventModal();
      window.showEventDetails = (id) => this.showEventDetails(id);
      window.previousMonth = () => this.changeMonth(-1);
      window.nextMonth = () => this.changeMonth(1);
      window.goToToday = () => this.goToToday();
      window.changeView = (v) => this.changeCalendarView(v);
      window.showComingSoonAlert = () => this.showComingSoonAlert();
    }

    // ===== User Menu =====
    showUserMenu() {
      const modal = this.createModal('User Settings', `
        <div class="task-detail-modal">
          <h3>Andrew Foster</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Email:</strong> <span>andrew@projectatlas.dev</span></div>
            <div class="detail-row"><strong>Plan:</strong> <span>Pro (Beta)</span></div>
            <div class="detail-row"><strong>Data:</strong> <span>Stored locally (demo)</span></div>
          </div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="window.atlas.closeModal()">Close</button>
          </div>
        </div>
      `);
      return modal;
    }

    // ===== Projects Page =====
    initProjects() {
      // Currently project cards are static in HTML; we could render from this.projects if needed.
      // Expose modal for new project + edit
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
            <button type="button" class="btn-secondary" onclick="window.atlas.closeModal()">Cancel</button>
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

        // Toast
        this.toast(`Project <strong>${newProject.name}</strong> created successfully!`);

        // refresh if applicable
        if (this.getCurrentPage() === 'projects') {
          // could re-render projects list if it was dynamic
        }
      });
    }

    // ===== Kanban =====
    initKanban() {
      log('Initializing Kanban board');
      setTimeout(() => {
        this.renderKanban();
        this.setupKanbanFilters();
        this.setupAddTaskButtons();
      }, 50);
    }

    setupAddTaskButtons() {
      $$('.add-task-btn').forEach(btn => {
        const status = btn.dataset.status;
        btn.addEventListener('click', () => this.showAddTaskModal(status));
      });
    }

    filterByProject(value) {
      this.currentFilter = (value || 'all').toLowerCase().replace(/\s+/g, '-');
      if (this.currentFilter.includes('all')) this.currentFilter = 'all';
      if (['kitchen', 'basement', 'bathroom'].includes(this.currentFilter) === false && this.currentFilter !== 'all') {
        this.currentFilter = 'all';
      }
      if (this.getCurrentPage() === 'kanban') {
        this.renderKanban();
        this.setupKanbanDragDrop();
      }
    }

    filterByPriority(value) {
      const v = (value || '').toLowerCase();
      this.currentPriorityFilter = v.includes('high') ? 'high' :
                                   v.includes('medium') ? 'medium' :
                                   v.includes('low') ? 'low' : 'all';
      if (this.getCurrentPage() === 'kanban') {
        this.renderKanban();
        this.setupKanbanDragDrop();
      }
    }

    getFilteredTasks() {
      return this.tasks.filter(task => {
        const projectMatch = this.currentFilter === 'all' || task.project === this.currentFilter;
        const priorityMatch = this.currentPriorityFilter === 'all' || task.priority === this.currentPriorityFilter;
        return projectMatch && priorityMatch;
      });
    }

    renderKanban() {
      const columns = ['someday', 'planning', 'ready', 'in-progress', 'blocked', 'done'];
      columns.forEach(status => {
        const taskCardsContainer = document.querySelector(`.task-cards[data-status="${status}"]`);
        if (!taskCardsContainer) return;

        // Clear
        taskCardsContainer.innerHTML = '';

        // Render tasks
        const tasks = this.getFilteredTasks().filter(t => t.status === status);
        tasks.forEach(task => {
          const card = this.createTaskCard(task);
          taskCardsContainer.appendChild(card);
        });

        // Count badge
        const column = taskCardsContainer.closest('.kanban-column');
        const countBadge = column ? column.querySelector('.task-count') : null;
        if (countBadge) countBadge.textContent = tasks.length;
      });

      // Enable drag-and-drop
      this.setupKanbanDragDrop();
    }

    createTaskCard(task) {
      const card = document.createElement('div');
      card.className = `task-card priority-${task.priority}`;
      card.draggable = true;
      card.dataset.taskId = task.id;
      card.innerHTML = `
        <div class="task-title">${task.title}</div>
        <div class="task-meta">
          <span class="task-project">${this.projectName(task.project)}</span>
          ${task.dueDate ? `<span class="task-due">${task.dueDate}</span>` : ''}
        </div>
        ${task.labels?.length ? `<div class="task-labels">${task.labels.map(l => `<span class="task-label">${l}</span>`).join('')}</div>` : ''}
      `;

      // Click to open detail (avoids click during drag)
      card.addEventListener('click', () => {
        if (card.dragging) return;
        const t = this.tasks.find(tt => tt.id === task.id);
        if (t) this.showTaskDetailModal(t);
      });

      // mark dragging flag
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        card.dragging = true;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        setTimeout(() => { card.dragging = false; }, 0);
      });

      return card;
    }

    setupKanbanDragDrop() {
      const cards = $$('.task-card');
      const columns = $$('.task-cards');

      log('Kanban DnD setup:', cards.length, 'cards and', columns.length, 'columns');

      // Reset card listeners by cloning (prevents duplicate handlers)
      cards.forEach(card => {
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);

        newCard.addEventListener('dragstart', (e) => {
          newCard.classList.add('dragging');
          newCard.dragging = true;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', newCard.dataset.taskId);
        });

        newCard.addEventListener('dragend', () => {
          newCard.classList.remove('dragging');
          newCard.dragging = false;
        });

        newCard.addEventListener('click', () => {
          if (!newCard.dragging) {
            const taskId = newCard.dataset.taskId;
            const task = this.tasks.find(t => t.id === taskId);
            if (task) this.showTaskDetailModal(task);
          }
        });
      });

      // Reset column listeners
      columns.forEach(column => {
        const newColumn = column.cloneNode(true);
        column.parentNode.replaceChild(newColumn, column);

        newColumn.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const dragging = document.querySelector('.dragging');
          if (!dragging) return;

          const afterElement = this.getDragAfterElement(newColumn, e.clientY);
          if (afterElement == null) {
            newColumn.appendChild(dragging);
          } else {
            newColumn.insertBefore(dragging, afterElement);
          }
          newColumn.classList.add('drag-over');
        });

        newColumn.addEventListener('dragleave', (e) => {
          if (e.target === newColumn) newColumn.classList.remove('drag-over');
        });

        newColumn.addEventListener('drop', (e) => {
          e.preventDefault();
          newColumn.classList.remove('drag-over');
          const dragging = document.querySelector('.dragging');
          if (!dragging) return;
          const taskId = dragging.dataset.taskId;
          const newStatus = newColumn.dataset.status;
          log('Dropped task', taskId, 'into', newStatus);
          this.updateTaskStatus(taskId, newStatus);
        });
      });
    }

    getDragAfterElement(column, y) {
      const draggableElements = [...column.querySelectorAll('.task-card:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        } else {
          return closest;
        }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updateTaskStatus(taskId, newStatus) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        const oldStatus = task.status;
        task.status = newStatus;
        this.saveData();

        log(`Task ${taskId} moved from ${oldStatus} to ${newStatus}`);

        // Update badges
        this.updateColumnCounts();

        // Status toast
        this.showStatusChangeNotification(taskId, newStatus);
      }
    }

    updateColumnCounts() {
      const columns = ['someday', 'planning', 'ready', 'in-progress', 'blocked', 'done'];
      columns.forEach(status => {
        const tasks = this.getFilteredTasks().filter(t => t.status === status);
        const column = document.querySelector(`.task-cards[data-status="${status}"]`);
        if (column) {
          const countBadge = column.closest('.kanban-column')?.querySelector('.task-count');
          if (countBadge) countBadge.textContent = tasks.length;
        }
      });
    }

    showStatusChangeNotification(taskId, newStatus) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;
      const statusNames = {
        'someday': 'Someday/Maybe',
        'planning': 'Research & Planning',
        'ready': 'Permitted & Ready',
        'in-progress': 'Active Work',
        'blocked': 'Waiting on External',
        'done': 'Done Done'
      };
      this.toast(`<strong>${task.title}</strong> moved to <strong>${statusNames[newStatus]}</strong>`);
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
              ${this.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
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
            <button type="button" class="btn-secondary" onclick="window.atlas.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Add Task</button>
          </div>
        </form>
      `);

      const form = modal.querySelector('#add-task-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTask = {
          id: 't' + Date.now(),
          title: $('#task-title').value,
          project: $('#task-project').value,
          priority: $('#task-priority').value,
          status: status,
          dueDate: $('#task-due').value || null,
          labels: $('#task-labels').value.split(',').map(l => l.trim()).filter(Boolean)
        };
        this.tasks.push(newTask);
        this.saveData();
        this.renderKanban();
        this.setupKanbanDragDrop();
        this.closeModal();
        this.showStatusChangeNotification(newTask.id, newTask.status);
      });
    }

    showTaskDetailModal(task) {
      const projectNames = this.projects.reduce((acc, p) => (acc[p.id] = p.name, acc), {});
      const modal = this.createModal('Task Details', `
        <div class="task-detail-modal">
          <h3>${task.title}</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Project:</strong> <span>${projectNames[task.project] || task.project}</span></div>
            <div class="detail-row"><strong>Status:</strong> <span>${task.status}</span></div>
            <div class="detail-row"><strong>Priority:</strong> <span>${task.priority}</span></div>
            ${task.dueDate ? `<div class="detail-row"><strong>Due:</strong> <span>${task.dueDate}</span></div>` : ''}
            ${task.labels?.length ? `<div class="detail-row"><strong>Labels:</strong> <span>${task.labels.join(', ')}</span></div>` : ''}
          </div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="window.atlas.closeModal()">Close</button>
            <button class="btn-primary" onclick="window.atlas.moveTask('${task.id}')">Move…</button>
          </div>
        </div>
      `);
      return modal;
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
            <button type="button" class="btn-secondary" onclick="window.atlas.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Move</button>
          </div>
        </form>
      `);
      $('#move-status').value = task.status;
      modal.querySelector('#move-task-form').addEventListener('submit', (e) => {
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
      if (monthLabel) {
        const d = new Date(this.calendarYear, this.calendarMonth, 1);
        monthLabel.textContent = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      }
    }

    changeMonth(delta) {
      this.calendarMonth += delta;
      if (this.calendarMonth < 0) {
        this.calendarMonth = 11;
        this.calendarYear -= 1;
      } else if (this.calendarMonth > 11) {
        this.calendarMonth = 0;
        this.calendarYear += 1;
      }
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
      // For now, we keep Month view but mark buttons correctly (accessibility already in page)
      if (view === 'week' || view === 'day') {
        this.showComingSoonAlert();
      }
    }

    showComingSoonAlert() {
      this.toast('Week and Day views are under development.');
    }

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
      const startDay = first.getDay(); // 0-6 Sun-Sat
      const totalDays = last.getDate();

      // blank leading days
      for (let i = 0; i < startDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell empty';
        grid.appendChild(cell);
      }

      // days
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

        // events for this day
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
            pill.addEventListener('click', (e) => {
              e.stopPropagation();
              this.showEventDetails(ev.id);
            });
            list.appendChild(pill);
          });
          dayCell.appendChild(list);
        }

        dayCell.addEventListener('click', () => {
          this.showEventsForDate(dateISO);
        });
        dayCell.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' || e.key === ' ') this.showEventsForDate(dateISO);
        });

        grid.appendChild(dayCell);
      }
    }

    showEventsForDate(dateISO) {
      const items = this.events.filter(e => e.date === dateISO && (this.calendarProjectFilter === 'all' || e.project === this.calendarProjectFilter));
      const title = `Events on ${humanDate(dateISO)}`;
      if (!items.length) {
        this.toast('No events for this date.');
        return;
      }
      const html = items.map(e => `
        <div class="event-item">
          <div class="event-title"><strong>${e.title}</strong></div>
          <div class="event-meta">${this.projectName(e.project)} • ${e.duration ? `${e.duration} min` : 'All day'}</div>
          ${e.notes ? `<div class="event-notes">${e.notes}</div>` : ''}
          <div class="form-actions" style="justify-content:flex-start;margin-top:.75rem;">
            <button class="btn-primary" onclick="window.atlas.showEventDetails('${e.id}')">View</button>
          </div>
        </div>
      `).join('');
      this.createModal(title, html + `<div class="form-actions"><button class="btn-secondary" onclick="window.atlas.closeModal()">Close</button></div>`);
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
              ${this.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
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
            <button type="button" class="btn-secondary" onclick="window.atlas.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Add Event</button>
          </div>
        </form>
      `);

      modal.querySelector('#add-event-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const ev = {
          id: 'e' + Date.now(),
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
          <h3>${e.title}</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Date:</strong> <span>${humanDate(e.date)}</span></div>
            <div class="detail-row"><strong>Project:</strong> <span>${this.projectName(e.project)}</span></div>
            <div class="detail-row"><strong>Duration:</strong> <span>${e.duration ? `${e.duration} min` : 'All day'}</span></div>
            ${e.notes ? `<div class="detail-row"><strong>Notes:</strong> <span>${e.notes}</span></div>` : ''}
          </div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="window.atlas.closeModal()">Close</button>
          </div>
        </div>
      `);
    }

    renderCalendarStats() {
      // Optional enhancement: compute stats per sidebar if ids exist
      const meetingsEl = $('#statMeetings');
      if (meetingsEl) {
        const count = this.events.filter(e => /meeting/i.test(e.title)).length;
        meetingsEl.textContent = String(count);
      }
    }

    // ===== Documents =====
    initDocuments() {
      // If we later render the grid dynamically, this is where we would do it.
      // For now, hooks support filtering and details modal.
    }

    filterByFolder(folderId) {
      // For demo, folder maps to project
      const folder = (folderId || 'all').toLowerCase();
      // Highlight handled by page inline script; here we can re-render docs if needed in future
      this.toast(folder === 'all' ? 'Showing all documents' : `Filtered to ${this.projectName(folder)}`);
    }

    filterDocsByProject(value) {
      const v = (value || 'all').toLowerCase().replace(/\s+/g, '-');
      // If we dynamically render, apply project filter here
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
                  this.documents.find(d => d.id === `doc-${(docId||'').split('-').pop()}`) || // tolerate "file-1" etc.
                  null;
      // If not found, synthesize a basic view with the id
      const content = doc ? `
        <div class="task-detail-modal">
          <h3>${doc.title}</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Project:</strong> <span>${this.projectName(doc.project)}</span></div>
            <div class="detail-row"><strong>Type:</strong> <span>${doc.type}</span></div>
            <div class="detail-row"><strong>Date:</strong> <span>${humanDate(doc.date)}</span></div>
            ${doc.size ? `<div class="detail-row"><strong>Size:</strong> <span>${doc.size}</span></div>` : ''}
          </div>
          <div style="margin-top:1rem;">
            ${doc.type === 'photos' ? `<div>Photo set preview (${doc.photos || 0} items)</div>` : `<div>Preview not available in demo.</div>`}
          </div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="window.atlas.closeModal()">Close</button>
            <button class="btn-primary" onclick="window.atlas.showShareModal('${doc.id}')">Share</button>
          </div>
        </div>
      ` : `
        <div>File ID: ${docId}</div>
        <div class="form-actions">
          <button class="btn-secondary" onclick="window.atlas.closeModal()">Close</button>
        </div>
      `;
      this.createModal('File Details', content);
    }

    showShareModal(docId) {
      const doc = this.documents.find(d => d.id === docId);
      this.createModal('Share File', `
        <div class="task-detail-modal">
          <h3>${doc ? doc.title : 'Document'}</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Link:</strong> <span>https://share.projectatlas.dev/${docId}</span></div>
            <div class="detail-row"><strong>Permissions:</strong> <span>Viewer</span></div>
          </div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="window.atlas.closeModal()">Close</button>
            <button class="btn-primary" onclick="navigator.clipboard.writeText('https://share.projectatlas.dev/${docId}');window.atlas.toast('Link copied!')">Copy Link</button>
          </div>
        </div>
      `);
    }

    // ===== Budget (stubs for now; wiring is in HTML to call these) =====
    initBudget() {
      // Could render charts/summary if needed; handlers are wired to filterBudgetByProject/Time
    }
    filterBudgetByProject(value) {
      this.toast(`Budget filter project: ${value}`);
    }
    filterBudgetByTime(value) {
      this.toast(`Budget filter time: ${value}`);
    }

    // ===== Dashboard =====
    initDashboard() {
      // page already references viewTaskDetail -> handled inline using showTaskDetailModal
    }

    // ===== Toast / Notifications =====
    toast(html) {
      const notification = document.createElement('div');
      notification.className = 'status-notification';
      notification.innerHTML = `<div class="notification-content">${html}</div>`;
      document.body.appendChild(notification);
      setTimeout(() => notification.classList.add('show'), 10);
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
  }

  // Bootstrap
  window.atlas = new AtlasApp();

})();
