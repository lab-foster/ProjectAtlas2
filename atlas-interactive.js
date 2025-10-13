/**
 * Project Atlas - Interactive App Script
 * Focus of this revision: Fix task opening and detail display across all pages.
 * - Robust global handlers: viewTaskDetail, showTaskDetail, showTaskDetailModal
 * - Click on any task card/item opens a consistent detail modal (Kanban, Projects, Dashboard)
 * - Safer drag vs. click detection to avoid accidental opens after drag
 * - Graceful fallback when tasks are referenced by name (from templates) but not yet created
 * - Consistent data lookup by id OR title across pages
 * - Minimal dependencies (vanilla JS), persistent localStorage
 * Last Updated: 2025-10-12
 */

(function () {
  'use strict';

  // -----------------------------
  // Utilities
  // -----------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function uid(prefix = 't') {
    return `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  }

  function parseQuery() {
    const params = {};
    window.location.search
      .slice(1)
      .split('&')
      .filter(Boolean)
      .forEach(pair => {
        const [k, v] = pair.split('=').map(decodeURIComponent);
        params[k] = v;
      });
    return params;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString();
    } catch {
      return iso;
    }
  }

  // -----------------------------
  // Dummy/seed data (only used if no local data)
  // -----------------------------
  const SEED_TASKS = [
    {
      id: 't9',
      title: 'Schedule plumbing inspection',
      description: 'Coordinate with the city inspector for the rough-in plumbing. Gather photos and permit paperwork.',
      status: 'blocked',
      project: 'bathroom',
      priority: 'high',
      dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      estimate: 2,
      tags: ['Inspection', 'Plumbing'],
      dependencies: ['t3'],
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 't11',
      title: 'Order bathroom vanity',
      description: 'Confirm dimensions and order from preferred retailer. Targets: 36" width, matte black hardware.',
      status: 'planning',
      project: 'bathroom',
      priority: 'medium',
      dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      estimate: 1,
      tags: ['Purchasing'],
      dependencies: [],
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 't8',
      title: 'Research countertop materials',
      description: 'Compare quartz vs. butcher block. Track cost per sq ft, lead times, and maintenance.',
      status: 'planning',
      project: 'kitchen',
      priority: 'low',
      dueDate: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
      estimate: 3,
      tags: ['Research', 'Materials'],
      dependencies: [],
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const SEED_PROJECTS = [
    { id: 'kitchen', name: 'Kitchen Renovation Epic', status: 'in-progress', progress: 65, spent: 23400, budget: 28000 },
    { id: 'basement', name: 'Basement Finishing Epic', status: 'planning', progress: 15, spent: 5200, budget: 35000 },
    { id: 'bathroom', name: 'Bathroom Update Epic', status: 'blocked', progress: 40, spent: 8100, budget: 12000 }
  ];

  // -----------------------------
  // ProjectAtlas class
  // -----------------------------
  class ProjectAtlas {
    constructor() {
      this.dragState = { isDragging: false, startX: 0, startY: 0, moved: false };
      this.loadData();
      this.exposeGlobals();
      this.initializePage();
    }

    // ---------- Data ----------
    loadData() {
      try {
        const tasks = JSON.parse(localStorage.getItem('atlas_tasks'));
        const projects = JSON.parse(localStorage.getItem('atlas_projects'));
        this.tasks = Array.isArray(tasks) ? tasks : SEED_TASKS.slice();
        this.projects = Array.isArray(projects) ? projects : SEED_PROJECTS.slice();
      } catch {
        this.tasks = SEED_TASKS.slice();
        this.projects = SEED_PROJECTS.slice();
      }
      this.indexTasks();
    }

    saveData() {
      localStorage.setItem('atlas_tasks', JSON.stringify(this.tasks));
      localStorage.setItem('atlas_projects', JSON.stringify(this.projects));
      this.indexTasks();
    }

    indexTasks() {
      // Build quick lookups by id and lowercase title
      this.taskById = new Map();
      this.taskByTitle = new Map();
      this.tasks.forEach(t => {
        this.taskById.set(String(t.id), t);
        this.taskByTitle.set(String(t.title).toLowerCase().trim(), t);
      });
    }

    // ---------- Page boot ----------
    getCurrentPage() {
      const path = (location.pathname || '').toLowerCase();
      if (path.endsWith('kanban.html')) return 'kanban';
      if (path.endsWith('projects.html')) return 'projects';
      if (path.endsWith('dashboard.html')) return 'dashboard';
      if (path.endsWith('documents.html')) return 'documents';
      if (path.endsWith('budget.html')) return 'budget';
      if (path.endsWith('calendar.html')) return 'calendar';
      return 'unknown';
    }

    initializePage() {
      const page = this.getCurrentPage();
      switch (page) {
        case 'kanban':
          this.setupKanban();
          break;
        case 'projects':
          this.setupProjectsInteractions();
          break;
        case 'dashboard':
          this.setupDashboardInteractions();
          break;
        default:
          // cross-page safe listeners (if any future)
          break;
      }
      // Always attach a global delegate so ANY element with a known selector opens the detail modal
      this.attachGlobalTaskClickDelegate();
    }

    // -----------------------------
    // MODAL SYSTEM
    // -----------------------------
    createModal(title, content) {
      this.closeModal();

      const modalOverlay = document.createElement('div');
      modalOverlay.className = 'modal-overlay';
      modalOverlay.id = 'atlas-modal';
      modalOverlay.innerHTML = `
        <div class="modal-container" role="dialog" aria-modal="true" aria-label="${this.escape(title)}">
          <div class="modal-header">
            <h3>${this.escape(title)}</h3>
            <button class="modal-close" aria-label="Close dialog">&times;</button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
        </div>
      `;
      document.body.appendChild(modalOverlay);

      // Close handlers
      const closeBtn = modalOverlay.querySelector('.modal-close');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.closeModal();
      });

      const escHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeModal();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);

      setTimeout(() => modalOverlay.classList.add('show'), 10);
      return modalOverlay;
    }

    closeModal() {
      const modal = $('#atlas-modal');
      if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 250);
      }
    }

    // -----------------------------
    // GLOBAL EXPOSURE
    // -----------------------------
    exposeGlobals() {
      // Allow HTML inline calls to find/show tasks
      window.atlas = this;
      // Compat with various pages calling different names
      window.viewTaskDetail = (taskId) => this.openTaskByIdOrName(taskId);
      window.showTaskDetail = (idOrName) => this.openTaskByIdOrName(idOrName);
      window.showTaskDetailModal = (task) => this.showTaskDetailModal(task);
      window.showNewTaskModal = (status) => this.showAddTaskModal(status);
      window.showAddTaskModal = (status) => this.showAddTaskModal(status);
      window.viewProject = (projId) => {
        // Keep existing navigation behavior in page scripts.
        window.location.href = `kanban.html?project=${encodeURIComponent(projId)}`;
      };
      window.showUserMenu = () => this.showUserMenu();
      window.showNewProjectModal = () => this.showNewProjectModal();
    }

    // Open by id OR title (robust across dashboard/projects templates)
    openTaskByIdOrName(idOrName) {
      if (!idOrName) return;
      let task = this.taskById.get(String(idOrName));
      if (!task) {
        const key = String(idOrName).toLowerCase().trim();
        task = this.taskByTitle.get(key);
      }
      // If still not found, attempt fuzzy title contains
      if (!task) {
        const lower = String(idOrName).toLowerCase().trim();
        task = this.tasks.find(t =>
          t.title.toLowerCase().includes(lower) || lower.includes(t.title.toLowerCase())
        );
      }
      if (task) {
        this.showTaskDetailModal(task);
      } else {
        // Fall back to a quick info modal (for template items not yet created)
        const project = this.getCurrentPage() === 'kanban' ? (parseQuery().project || 'kitchen') : 'kitchen';
        this.showQuickTaskInfo(String(idOrName), project);
      }
    }

    // -----------------------------
    // TASK DETAIL MODAL
    // -----------------------------
    showTaskDetailModal(task) {
      if (!task) return;

      const proj = this.projects.find(p => p.id === task.project);
      const depList = (task.dependencies || [])
        .map(depId => {
          const depTask = this.taskById.get(String(depId));
          return depTask ? `<li><button class="link-like" data-open-task="${this.escape(depTask.id)}">${this.escape(depTask.title)}</button></li>` : '';
        })
        .join('');

      const photoStrip = (task.photos || []).map(src => `<img src="${this.escape(src)}" alt="Task photo">`).join('') || '<span class="text-tertiary">No photos yet</span>';

      const content = `
        <div class="task-detail-modal">
          <div class="task-detail-header">
            <span class="badge status-${this.escape(task.status)}">${this.escape(task.status || 'planning')}</span>
            <span class="badge priority-${this.escape(task.priority || 'medium')}">${this.escape(task.priority || 'medium')}</span>
          </div>

          <h3 class="task-title">${this.escape(task.title)}</h3>
          <p class="task-desc">${this.escape(task.description || 'No description')}</p>

          <div class="task-detail-info">
            <div class="detail-row"><strong>Project:</strong><span>${this.escape(proj?.name || task.project || '—')}</span></div>
            <div class="detail-row"><strong>Due:</strong><span>${fmtDate(task.dueDate)}</span></div>
            <div class="detail-row"><strong>Estimate:</strong><span>${task.estimate ? `${task.estimate} hrs` : '—'}</span></div>
            <div class="detail-row"><strong>Tags:</strong><span>${(task.tags || []).join(', ') || '—'}</span></div>
          </div>

          <div class="task-detail-section">
            <h4>Dependencies</h4>
            <ul class="dep-list">
              ${depList || '<li class="text-tertiary">None</li>'}
            </ul>
          </div>

          <div class="task-detail-section">
            <h4>Photos</h4>
            <div class="photo-strip">${photoStrip}</div>
          </div>

          <div class="task-detail-actions">
            <button class="btn-secondary" id="editTaskBtn">Edit</button>
            <button class="btn-danger" id="deleteTaskBtn">Delete</button>
            <span class="spacer"></span>
            <button class="btn-primary" id="closeTaskBtn">Close</button>
          </div>
        </div>
      `;

      const modal = this.createModal('Task Details', content);

      // Wire dependency open buttons
      $$('.dep-list [data-open-task]', modal).forEach(btn => {
        btn.addEventListener('click', () => {
          const ref = btn.getAttribute('data-open-task');
          this.openTaskByIdOrName(ref);
        });
      });

      // Action buttons
      $('#editTaskBtn', modal)?.addEventListener('click', () => this.showEditTaskModal(task.id));
      $('#deleteTaskBtn', modal)?.addEventListener('click', () => this.deleteTask(task.id));
      $('#closeTaskBtn', modal)?.addEventListener('click', () => this.closeModal());
    }

    showQuickTaskInfo(taskName, projectKey) {
      const projectNames = {
        kitchen: 'Kitchen Renovation',
        basement: 'Basement Finishing',
        bathroom: 'Bathroom Update'
      };
      const content = `
        <div class="task-detail-modal">
          <h3>${this.escape(taskName)}</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Project:</strong><span>${this.escape(projectNames[projectKey] || projectKey || '—')}</span></div>
            <div class="detail-row"><strong>Status:</strong><span>Template item (not yet created)</span></div>
          </div>
          <p class="text-medium" style="margin: 1rem 0;">Create this as a real task on the Kanban board for full functionality.</p>
          <div class="task-detail-actions">
            <button class="btn-secondary" id="gotoKanbanBtn">Go to Kanban Board</button>
            <button class="btn-primary" id="closeQuickBtn">Close</button>
          </div>
        </div>
      `;
      const modal = this.createModal('Task Information', content);
      $('#gotoKanbanBtn', modal)?.addEventListener('click', () => (window.location.href = 'kanban.html'));
      $('#closeQuickBtn', modal)?.addEventListener('click', () => this.closeModal());
    }

    // -----------------------------
    // EDIT/ADD TASK MODALS
    // -----------------------------
    showAddTaskModal(status = 'planning') {
      const content = `
        <form id="taskForm" class="task-form">
          <div class="form-group">
            <label>Title *</label>
            <input type="text" id="taskTitle" required placeholder="e.g. Install cabinet doors">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="taskDesc" rows="3"></textarea>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Project *</label>
              <select id="taskProject" required>
                ${this.projects.map(p => `<option value="${this.escape(p.id)}">${this.escape(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Status *</label>
              <select id="taskStatus" required>
                <option value="someday">Someday</option>
                <option value="planning">Planning</option>
                <option value="ready">Ready</option>
                <option value="in-progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Priority</label>
              <select id="taskPriority">
                <option value="high">High</option>
                <option value="medium" selected>Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div class="form-group">
              <label>Due Date</label>
              <input type="date" id="taskDue">
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Estimate (hrs)</label>
              <input type="number" step="0.5" id="taskEstimate" placeholder="1.5">
            </div>
            <div class="form-group">
              <label>Tags (comma-separated)</label>
              <input type="text" id="taskTags" placeholder="Permits, Plumbing">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="cancelTaskBtn">Cancel</button>
            <button type="submit" class="btn-primary">Create Task</button>
          </div>
        </form>
      `;
      const modal = this.createModal('Add New Task', content);

      // default selections
      $('#taskStatus', modal).value = status;
      const params = parseQuery();
      if (params.project && this.projects.find(p => p.id === params.project)) {
        $('#taskProject', modal).value = params.project;
      }

      $('#cancelTaskBtn', modal)?.addEventListener('click', () => this.closeModal());
      $('#taskForm', modal)?.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTask = {
          id: uid('t'),
          title: $('#taskTitle').value.trim(),
          description: $('#taskDesc').value.trim(),
          status: $('#taskStatus').value,
          project: $('#taskProject').value,
          priority: $('#taskPriority').value,
          dueDate: $('#taskDue').value ? new Date($('#taskDue').value).toISOString() : '',
          estimate: $('#taskEstimate').value ? Number($('#taskEstimate').value) : 0,
          tags: $('#taskTags').value ? $('#taskTags').value.split(',').map(s => s.trim()).filter(Boolean) : [],
          dependencies: [],
          photos: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        if (!newTask.title) {
          alert('Title is required.');
          return;
        }
        this.tasks.push(newTask);
        this.saveData();
        this.closeModal();

        // Re-render current page where applicable
        if (this.getCurrentPage() === 'kanban') this.renderKanban();
        if (this.getCurrentPage() === 'projects') this.setupProjectsInteractions();
        if (this.getCurrentPage() === 'dashboard') this.setupDashboardInteractions();

        // Open the newly created task for a smooth flow
        this.showTaskDetailModal(newTask);
      });
    }

    showEditTaskModal(taskId) {
      const task = this.taskById.get(String(taskId));
      if (!task) return;

      const content = `
        <form id="editTaskForm" class="task-form">
          <div class="form-group">
            <label>Title *</label>
            <input type="text" id="taskTitle" required value="${this.escape(task.title)}">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="taskDesc" rows="3">${this.escape(task.description || '')}</textarea>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Project *</label>
              <select id="taskProject" required>
                ${this.projects.map(p => `<option value="${this.escape(p.id)}"${p.id === task.project ? ' selected' : ''}>${this.escape(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Status *</label>
              <select id="taskStatus" required>
                ${['someday', 'planning', 'ready', 'in-progress', 'blocked', 'done'].map(s => `<option value="${s}"${task.status === s ? ' selected' : ''}>${s.replace('-', ' ')}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Priority</label>
              <select id="taskPriority">
                ${['high','medium','low'].map(p => `<option value="${p}"${task.priority === p ? ' selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Due Date</label>
              <input type="date" id="taskDue" value="${task.dueDate ? new Date(task.dueDate).toISOString().substring(0,10) : ''}">
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Estimate (hrs)</label>
              <input type="number" step="0.5" id="taskEstimate" value="${task.estimate || 0}">
            </div>
            <div class="form-group">
              <label>Tags</label>
              <input type="text" id="taskTags" value="${this.escape((task.tags || []).join(', '))}">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="cancelEditBtn">Cancel</button>
            <button type="submit" class="btn-primary">Save Changes</button>
          </div>
        </form>
      `;
      const modal = this.createModal('Edit Task', content);
      $('#cancelEditBtn', modal)?.addEventListener('click', () => this.closeModal());
      $('#editTaskForm', modal)?.addEventListener('submit', (e) => {
        e.preventDefault();
        task.title = $('#taskTitle', modal).value.trim();
        task.description = $('#taskDesc', modal).value.trim();
        task.project = $('#taskProject', modal).value;
        task.status = $('#taskStatus', modal).value;
        task.priority = $('#taskPriority', modal).value;
        task.dueDate = $('#taskDue', modal).value ? new Date($('#taskDue', modal).value).toISOString() : '';
        task.estimate = $('#taskEstimate', modal).value ? Number($('#taskEstimate', modal).value) : 0;
        task.tags = $('#taskTags', modal).value ? $('#taskTags', modal).value.split(',').map(s => s.trim()).filter(Boolean) : [];
        task.updatedAt = new Date().toISOString();

        this.saveData();
        this.closeModal();

        if (this.getCurrentPage() === 'kanban') this.renderKanban();
        if (this.getCurrentPage() === 'projects') this.setupProjectsInteractions();
        if (this.getCurrentPage() === 'dashboard') this.setupDashboardInteractions();

        // Re-open details to reflect new data
        this.showTaskDetailModal(task);
      });
    }

    deleteTask(taskId) {
      if (!confirm('Delete this task?')) return;
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      this.saveData();
      this.closeModal();
      if (this.getCurrentPage() === 'kanban') this.renderKanban();
      if (this.getCurrentPage() === 'projects') this.setupProjectsInteractions();
      if (this.getCurrentPage() === 'dashboard') this.setupDashboardInteractions();
    }

    // -----------------------------
    // PAGE: KANBAN
    // -----------------------------
    setupKanban() {
      this.renderKanban();
      this.setupKanbanDnD();
    }

    renderKanban() {
      // Expect columns with data-status attributes, and .kanban-column-content
      const columns = $$('[data-status]');
      if (!columns.length) return;

      // Clear columns
      columns.forEach(col => {
        const container = col.querySelector('.kanban-column-content') || col;
        container.innerHTML = '';
      });

      // Filter by project if query param present
      const params = parseQuery();
      const filterProject = params.project || null;

      // Create cards
      this.tasks
        .filter(t => (filterProject ? t.project === filterProject : true))
        .forEach(task => {
          const card = this.createTaskCard(task);
          const targetCol = document.querySelector(`[data-status="${task.status}"] .kanban-column-content`) ||
                            document.querySelector(`[data-status="${task.status}"]`) ||
                            document.querySelector(`[data-status="planning"] .kanban-column-content`) ||
                            document.querySelector(`[data-status="planning"]`);
          (targetCol || columns[0]).appendChild(card);
        });
    }

    createTaskCard(task) {
      const card = document.createElement('article');
      card.className = `task-card priority-${task.priority || 'medium'}`;
      card.setAttribute('draggable', 'true');
      card.dataset.taskId = task.id;

      card.innerHTML = `
        <div class="task-card-header">
          <span class="task-priority-dot" aria-hidden="true"></span>
          <h4 class="task-title">${this.escape(task.title)}</h4>
        </div>
        <p class="task-summary">${this.escape(task.description || '')}</p>
        <div class="task-meta">
          <span class="task-due">${task.dueDate ? `Due ${fmtDate(task.dueDate)}` : ''}</span>
          <span class="task-tags">${(task.tags || []).slice(0, 3).join(', ')}</span>
        </div>
      `;

      // Click to open detail — but guard against drags
      this.attachSafeClick(card, () => this.showTaskDetailModal(task));

      return card;
    }

    setupKanbanDnD() {
      // Basic drag & drop; track drag distance to avoid accidental clicks
      let dragCard = null;

      document.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.task-card');
        if (!card) return;
        dragCard = card;
        this.dragState.isDragging = true;
        this.dragState.moved = false;
        this.dragState.startX = e.clientX || 0;
        this.dragState.startY = e.clientY || 0;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.taskId);
      });

      document.addEventListener('dragover', (e) => {
        if (!this.dragState.isDragging) return;
        e.preventDefault();
        const dropCol = e.target.closest('[data-status]');
        if (dropCol) e.dataTransfer.dropEffect = 'move';
        // mark moved if pointer travels enough
        const dx = (e.clientX || 0) - this.dragState.startX;
        const dy = (e.clientY || 0) - this.dragState.startY;
        if (Math.abs(dx) + Math.abs(dy) > 5) this.dragState.moved = true;
      });

      document.addEventListener('drop', (e) => {
        if (!this.dragState.isDragging) return;
        e.preventDefault();
        const dropCol = e.target.closest('[data-status]');
        const taskId = e.dataTransfer.getData('text/plain');
        const task = this.taskById.get(String(taskId));
        if (dropCol && task) {
          const newStatus = dropCol.getAttribute('data-status');
          task.status = newStatus;
          task.updatedAt = new Date().toISOString();
          this.saveData();
          this.renderKanban();
        }
        // cleanup
        $$('.task-card.dragging').forEach(el => el.classList.remove('dragging'));
        this.dragState.isDragging = false;
        this.dragState.moved = false;
        dragCard = null;
      });

      document.addEventListener('dragend', () => {
        $$('.task-card.dragging').forEach(el => el.classList.remove('dragging'));
        this.dragState.isDragging = false;
        this.dragState.moved = false;
        dragCard = null;
      });
    }

    // -----------------------------
    // PAGE: PROJECTS
    // -----------------------------
    setupProjectsInteractions() {
      // Make each .task-item (template lists) clickable to open details if task exists, or a quick info otherwise
      $$('.task-item').forEach(item => {
        if (item.dataset.enhanced) return;
        item.dataset.enhanced = 'true';

        this.attachSafeClick(item, () => {
          const directId = item.getAttribute('data-task-id');
          if (directId && this.taskById.get(directId)) {
            this.showTaskDetailModal(this.taskById.get(directId));
            return;
          }
          // Try reading name
          const nameEl = item.querySelector('.task-name');
          const name = nameEl ? nameEl.textContent.trim() : '';
          if (name) {
            this.openTaskByIdOrName(name);
          }
        });
      });

      // Also enhance project cards with status summarization if desired (optional)
      // (No-op here to keep focus on task opening behavior.)
    }

    // -----------------------------
    // PAGE: DASHBOARD
    // -----------------------------
    setupDashboardInteractions() {
      // Upcoming tasks list items can call viewTaskDetail('id') inline; ensure detail opens
      // Here we add a delegate in case cards are rendered without handlers.
      $$('.task-item, .activity-item').forEach(item => {
        if (item.dataset.enhanced) return;
        item.dataset.enhanced = 'true';

        this.attachSafeClick(item, () => {
          // Prefer explicit id from inline handlers/snippets
          const explicitId = item.getAttribute('data-task-id');
          if (explicitId && this.taskById.get(explicitId)) {
            this.showTaskDetailModal(this.taskById.get(explicitId));
            return;
          }
          // Try find label inside
          const text = (item.querySelector('.task-text, .activity-text, .task-name')?.textContent || '').trim();
          if (text) {
            this.openTaskByIdOrName(text);
          }
        });
      });
    }

    // -----------------------------
    // Global click delegate for any task card or item
    // -----------------------------
    attachGlobalTaskClickDelegate() {
      // Kanban cards -> .task-card
      $$('.task-card').forEach(card => {
        if (card.dataset.enhanced) return;
        card.dataset.enhanced = 'true';
        const taskId = card.getAttribute('data-task-id');
        this.attachSafeClick(card, () => {
          if (this.dragState.isDragging || this.dragState.moved) return;
          if (taskId && this.taskById.get(taskId)) {
            this.showTaskDetailModal(this.taskById.get(taskId));
          }
        });
      });

      // Generic support for any .open-task[data-id|data-name]
      $$('.open-task').forEach(btn => {
        if (btn.dataset.enhanced) return;
        btn.dataset.enhanced = 'true';
        this.attachSafeClick(btn, () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          this.openTaskByIdOrName(id || name);
        });
      });
    }

    // -----------------------------
    // Safe click helper (prevents accidental opens after drag)
    // -----------------------------
    attachSafeClick(el, onClick) {
      let downX = 0, downY = 0, moved = false;
      el.addEventListener('mousedown', (e) => {
        downX = e.clientX || 0;
        downY = e.clientY || 0;
        moved = false;
      });
      el.addEventListener('mousemove', (e) => {
        if (Math.abs((e.clientX || 0) - downX) + Math.abs((e.clientY || 0) - downY) > 4) {
          moved = true;
        }
      });
      el.addEventListener('click', (e) => {
        // If global drag happened OR this element moved notably, ignore click
        if (this.dragState.isDragging || this.dragState.moved || moved) return;
        // Ignore clicks originating on buttons/links inside the card
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'button' || tag === 'a' || e.target.closest('button,a')) return;
        onClick();
      });
      // touch support
      el.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        downX = t.clientX || 0;
        downY = t.clientY || 0;
        moved = false;
      }, { passive: true });
      el.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        if (Math.abs((t.clientX || 0) - downX) + Math.abs((t.clientY || 0) - downY) > 6) {
          moved = true;
        }
      }, { passive: true });
      el.addEventListener('touchend', () => {
        if (!this.dragState.isDragging && !this.dragState.moved && !moved) onClick();
      });
    }

    // -----------------------------
    // User Menu / Project Modal (stubs kept for cross-page calls)
    // -----------------------------
    showNewProjectModal() {
      const content = `
        <form id="newProjectForm" class="task-form">
          <div class="form-group">
            <label>Project Name *</label>
            <input id="projName" required placeholder="e.g. Deck Construction">
          </div>
          <div class="form-group">
            <label>Budget Allocation</label>
            <input id="projBudget" type="number" min="0" step="100" placeholder="25000">
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="cancelProjBtn">Cancel</button>
            <button type="submit" class="btn-primary">Create Project</button>
          </div>
        </form>
      `;
      const modal = this.createModal('Create New Project', content);
      $('#cancelProjBtn', modal)?.addEventListener('click', () => this.closeModal());
      $('#newProjectForm', modal)?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#projName', modal).value.trim();
        if (!name) return alert('Name required');
        const p = {
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          status: 'planning',
          progress: 0,
          spent: 0,
          budget: Number($('#projBudget', modal).value || 0)
        };
        this.projects.push(p);
        this.saveData();
        this.closeModal();
      });
    }

    showUserMenu() {
      const content = `
        <div class="task-detail-modal">
          <h3>Andrew Foster</h3>
          <div class="task-detail-info">
            <div class="detail-row"><strong>Email:</strong><span>andrew@projectatlas.dev</span></div>
            <div class="detail-row"><strong>Theme:</strong><span>Light Blueprint</span></div>
          </div>
          <div class="task-detail-actions">
            <button class="btn-secondary" id="exportDataBtn">Export Data</button>
            <button class="btn-danger" id="clearDataBtn">Clear Data</button>
            <span class="spacer"></span>
            <button class="btn-primary" id="closeUserBtn">Close</button>
          </div>
        </div>
      `;
      const modal = this.createModal('User Settings', content);
      $('#exportDataBtn', modal)?.addEventListener('click', () => this.exportData());
      $('#clearDataBtn', modal)?.addEventListener('click', () => this.clearData());
      $('#closeUserBtn', modal)?.addEventListener('click', () => this.closeModal());
    }

    // -----------------------------
    // Export / Clear
    // -----------------------------
    exportData() {
      const data = {
        tasks: this.tasks,
        projects: this.projects,
        exportedAt: new Date().toISOString()
      };
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `project-atlas-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.closeModal();
      this.toast('Data exported successfully! Check your downloads folder.');
    }

    clearData() {
      if (!confirm('Clear ALL Project Atlas data from this browser?\n\nThis cannot be undone.')) return;
      localStorage.removeItem('atlas_tasks');
      localStorage.removeItem('atlas_projects');
      this.closeModal();
      this.toast('All data cleared. Reloading…');
      setTimeout(() => window.location.reload(), 800);
    }

    toast(message = '') {
      const n = document.createElement('div');
      n.className = 'status-notification';
      n.innerHTML = `<div class="notification-content">${this.escape(message)}</div>`;
      document.body.appendChild(n);
      setTimeout(() => n.classList.add('show'), 10);
      setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 250);
      }, 2500);
    }

    // -----------------------------
    // Helpers
    // -----------------------------
    escape(s) {
      return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  // -----------------------------
  // Init
  // -----------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ProjectAtlas());
  } else {
    new ProjectAtlas();
  }
})();
