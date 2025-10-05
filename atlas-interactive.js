/**
 * Project Atlas - Interactive JavaScript Module
 * Provides drag-and-drop Kanban, task management, and cross-page interactivity
 * Author: Andrew Foster
 * Last Updated: October 2025
 */

class ProjectAtlas {
    constructor() {
        this.tasks = [];
        this.projects = [];
        this.currentFilter = 'all';
        this.currentPriorityFilter = 'all';
        this.init();
    }

    init() {
        // Load data from localStorage or use defaults
        this.loadData();
        
        // Initialize based on current page
        const currentPage = this.getCurrentPage();
        
        if (currentPage === 'kanban') {
            this.initKanban();
        } else if (currentPage === 'projects') {
            this.initProjects();
        } else if (currentPage === 'dashboard') {
            this.initDashboard();
        }
        
        // Set up global event listeners
        this.setupGlobalListeners();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('kanban')) return 'kanban';
        if (path.includes('projects')) return 'projects';
        if (path.includes('dashboard')) return 'dashboard';
        return 'other';
    }

    loadData() {
        // Try to load from localStorage
        const savedTasks = localStorage.getItem('atlas_tasks');
        const savedProjects = localStorage.getItem('atlas_projects');
        
        if (savedTasks) {
            this.tasks = JSON.parse(savedTasks);
        } else {
            // Initialize with default tasks from the HTML
            this.initializeDefaultTasks();
        }
        
        if (savedProjects) {
            this.projects = JSON.parse(savedProjects);
        } else {
            this.projects = [
                { id: 'kitchen', name: 'Kitchen Renovation', color: '#2196f3' },
                { id: 'basement', name: 'Basement Finishing', color: '#4caf50' },
                { id: 'bathroom', name: 'Bathroom Update', color: '#ff9800' }
            ];
            this.saveData();
        }
    }

    initializeDefaultTasks() {
        // Extract tasks from the current HTML to populate initial state
        this.tasks = [
            // Someday/Maybe
            { id: 't1', title: 'Install smart home automation system', status: 'someday', project: 'future', priority: 'low', labels: ['electrical', 'smart-home'], dueDate: null },
            { id: 't2', title: 'Build deck extension', status: 'someday', project: 'outdoor', priority: 'low', labels: ['outdoor', 'carpentry'], dueDate: 'Summer 2025' },
            { id: 't3', title: 'Research solar panel installation', status: 'someday', project: 'energy', priority: 'low', labels: ['research', 'energy'], dueDate: null },
            { id: 't4', title: 'Landscape backyard', status: 'someday', project: 'outdoor', priority: 'low', labels: ['landscaping'], dueDate: 'Spring 2025' },
            
            // Planning
            { id: 't5', title: 'Research basement waterproofing options', status: 'planning', project: 'basement', priority: 'medium', labels: ['research', 'waterproofing'], dueDate: 'Due in 3 days' },
            { id: 't6', title: 'Get quotes for electrical rough-in', status: 'planning', project: 'basement', priority: 'medium', labels: ['quotes', 'electrical'], dueDate: 'Due Friday' },
            { id: 't7', title: 'Plan basement lighting layout', status: 'planning', project: 'basement', priority: 'low', labels: ['design', 'lighting'], dueDate: 'Due next week' },
            { id: 't8', title: 'Research countertop materials', status: 'planning', project: 'kitchen', priority: 'medium', labels: ['research', 'materials'], dueDate: 'Due Monday' },
            { id: 't9', title: 'Schedule plumbing inspection', status: 'planning', project: 'bathroom', priority: 'high', labels: ['inspection', 'urgent'], dueDate: 'Overdue by 2 days' },
            
            // Ready
            { id: 't10', title: 'Install kitchen cabinet doors', status: 'ready', project: 'kitchen', priority: 'high', labels: ['carpentry', 'kitchen'], dueDate: 'Ready to start' },
            { id: 't11', title: 'Order bathroom vanity', status: 'ready', project: 'bathroom', priority: 'medium', labels: ['ordering', 'bathroom'], dueDate: 'Materials ready' },
            { id: 't12', title: 'Install basement insulation', status: 'ready', project: 'basement', priority: 'medium', labels: ['insulation', 'diy'], dueDate: 'Permit approved' },
            
            // In Progress
            { id: 't13', title: 'Install kitchen backsplash tile', status: 'in-progress', project: 'kitchen', priority: 'high', labels: ['tiling', 'diy'], dueDate: 'In progress - Day 2' },
            { id: 't14', title: 'Prime and paint kitchen walls', status: 'in-progress', project: 'kitchen', priority: 'medium', labels: ['painting', 'diy'], dueDate: '50% complete' },
            { id: 't15', title: 'Install bathroom exhaust fan', status: 'in-progress', project: 'bathroom', priority: 'medium', labels: ['electrical', 'contractor'], dueDate: 'Electrician scheduled' },
            
            // Blocked
            { id: 't16', title: 'Wait for electrical inspection', status: 'blocked', project: 'bathroom', priority: 'high', labels: ['inspection', 'blocked'], dueDate: 'Delayed by inspector' },
            { id: 't17', title: 'Wait for custom cabinet delivery', status: 'blocked', project: 'kitchen', priority: 'medium', labels: ['delivery', 'supplier'], dueDate: 'Expected next Tuesday' },
            
            // Done
            { id: 't18', title: 'Install kitchen countertops', status: 'done', project: 'kitchen', priority: 'high', labels: ['countertops', 'completed'], dueDate: 'Completed yesterday' },
            { id: 't19', title: 'Remove old bathroom fixtures', status: 'done', project: 'bathroom', priority: 'high', labels: ['demolition', 'completed'], dueDate: 'Completed last week' },
            { id: 't20', title: 'Paint basement ceiling', status: 'done', project: 'basement', priority: 'medium', labels: ['painting', 'completed'], dueDate: 'Completed 2 weeks ago' }
        ];
        this.saveData();
    }

    saveData() {
        localStorage.setItem('atlas_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('atlas_projects', JSON.stringify(this.projects));
    }

    // ===== KANBAN PAGE =====
    initKanban() {
        this.renderKanban();
        this.setupKanbanDragDrop();
        this.setupKanbanFilters();
        this.setupAddTaskButtons();
    }

    renderKanban() {
        const columns = ['someday', 'planning', 'ready', 'in-progress', 'blocked', 'done'];
        
        columns.forEach(status => {
            const column = document.querySelector(`.kanban-column.${status} .task-cards`);
            if (!column) return;
            
            // Clear existing cards
            column.innerHTML = '';
            
            // Get filtered tasks for this column
            const tasks = this.getFilteredTasks().filter(t => t.status === status);
            
            // Render each task
            tasks.forEach(task => {
                const card = this.createTaskCard(task);
                column.appendChild(card);
            });
            
            // Update task count
            const countBadge = document.querySelector(`.kanban-column.${status} .task-count`);
            if (countBadge) {
                countBadge.textContent = tasks.length;
            }
        });
    }

    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card ${task.priority}-priority`;
        card.draggable = true;
        card.dataset.taskId = task.id;
        
        // Determine project info
        let projectName = task.project;
        let projectClass = task.project;
        
        if (task.project === 'kitchen') {
            projectName = 'Kitchen Renovation';
            projectClass = 'kitchen';
        } else if (task.project === 'basement') {
            projectName = 'Basement Finishing';
            projectClass = 'basement';
        } else if (task.project === 'bathroom') {
            projectName = 'Bathroom Update';
            projectClass = 'bathroom';
        }
        
        const overdueClass = task.dueDate && task.dueDate.includes('Overdue') ? 'overdue' : '';
        
        card.innerHTML = `
            <div class="task-title">${task.title}</div>
            <div class="task-meta">
                <span class="task-project ${projectClass}">${projectName}</span>
                <span class="task-due ${overdueClass}">${task.dueDate || 'No due date'}</span>
            </div>
            <div class="task-labels">
                ${task.labels.map(label => `<span class="task-label">${label}</span>`).join('')}
            </div>
        `;
        
        // Add click handler for task details
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.task-card').dragging) {
                this.showTaskDetailModal(task);
            }
        });
        
        return card;
    }

    setupKanbanDragDrop() {
        const cards = document.querySelectorAll('.task-card');
        const columns = document.querySelectorAll('.task-cards');
        
        // Set up draggable cards
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', card.innerHTML);
            });
            
            card.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
            });
        });
        
        // Set up drop zones
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const dragging = document.querySelector('.dragging');
                const afterElement = this.getDragAfterElement(column, e.clientY);
                
                if (afterElement == null) {
                    column.appendChild(dragging);
                } else {
                    column.insertBefore(dragging, afterElement);
                }
                
                column.classList.add('drag-over');
            });
            
            column.addEventListener('dragleave', (e) => {
                if (e.target === column) {
                    column.classList.remove('drag-over');
                }
            });
            
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                
                const dragging = document.querySelector('.dragging');
                const taskId = dragging.dataset.taskId;
                const newStatus = column.closest('.kanban-column').className.split(' ')[1];
                
                // Update task status in data
                this.updateTaskStatus(taskId, newStatus);
                
                // Show feedback animation
                this.showStatusChangeNotification(taskId, newStatus);
            });
        });
    }

    getDragAfterElement(column, y) {
        const draggableElements = [...column.querySelectorAll('.task-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updateTaskStatus(taskId, newStatus) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = newStatus;
            this.saveData();
            this.renderKanban();
            this.setupKanbanDragDrop(); // Re-attach listeners
        }
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
        
        const notification = document.createElement('div');
        notification.className = 'status-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${task.title}</strong> moved to <strong>${statusNames[newStatus]}</strong>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    setupKanbanFilters() {
        const projectFilter = document.querySelector('.board-filters .filter-select:first-child');
        const priorityFilter = document.querySelector('.board-filters .filter-select:last-child');
        
        if (projectFilter) {
            projectFilter.addEventListener('change', (e) => {
                this.currentFilter = e.target.value.toLowerCase().replace(' ', '-');
                if (this.currentFilter.includes('all')) this.currentFilter = 'all';
                if (this.currentFilter.includes('kitchen')) this.currentFilter = 'kitchen';
                if (this.currentFilter.includes('basement')) this.currentFilter = 'basement';
                if (this.currentFilter.includes('bathroom')) this.currentFilter = 'bathroom';
                this.renderKanban();
                this.setupKanbanDragDrop();
            });
        }
        
        if (priorityFilter) {
            priorityFilter.addEventListener('change', (e) => {
                const value = e.target.value.toLowerCase();
                this.currentPriorityFilter = value.includes('high') ? 'high' : 
                                             value.includes('medium') ? 'medium' : 
                                             value.includes('low') ? 'low' : 'all';
                this.renderKanban();
                this.setupKanbanDragDrop();
            });
        }
    }

    getFilteredTasks() {
        return this.tasks.filter(task => {
            const projectMatch = this.currentFilter === 'all' || task.project === this.currentFilter;
            const priorityMatch = this.currentPriorityFilter === 'all' || task.priority === this.currentPriorityFilter;
            return projectMatch && priorityMatch;
        });
    }

    setupAddTaskButtons() {
        const addButtons = document.querySelectorAll('.add-task-btn');
        addButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const column = btn.closest('.kanban-column');
                const status = column.className.split(' ')[1];
                this.showAddTaskModal(status);
            });
        });
    }

    showAddTaskModal(status = 'planning') {
        const modal = this.createModal('Add New Task', `
            <form id="add-task-form" class="task-form">
                <div class="form-group">
                    <label for="task-title">Task Title *</label>
                    <input type="text" id="task-title" required>
                </div>
                <div class="form-group">
                    <label for="task-project">Project *</label>
                    <select id="task-project" required>
                        <option value="kitchen">Kitchen Renovation</option>
                        <option value="basement">Basement Finishing</option>
                        <option value="bathroom">Bathroom Update</option>
                        <option value="other">Other</option>
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
                    <input type="text" id="task-due" placeholder="e.g., Due Friday, Next week">
                </div>
                <div class="form-group">
                    <label for="task-labels">Labels (comma-separated)</label>
                    <input type="text" id="task-labels" placeholder="e.g., painting, diy">
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
                title: document.getElementById('task-title').value,
                project: document.getElementById('task-project').value,
                priority: document.getElementById('task-priority').value,
                status: status,
                dueDate: document.getElementById('task-due').value || null,
                labels: document.getElementById('task-labels').value.split(',').map(l => l.trim()).filter(l => l)
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
        const projectNames = {
            'kitchen': 'Kitchen Renovation',
            'basement': 'Basement Finishing',
            'bathroom': 'Bathroom Update'
        };
        
        const modal = this.createModal('Task Details', `
            <div class="task-detail-modal">
                <h3>${task.title}</h3>
                <div class="task-detail-info">
                    <div class="detail-row">
                        <strong>Project:</strong>
                        <span>${projectNames[task.project] || task.project}</span>
                    </div>
                    <div class="detail-row">
                        <strong>Priority:</strong>
                        <span class="priority-badge ${task.priority}">${task.priority.toUpperCase()}</span>
                    </div>
                    <div class="detail-row">
                        <strong>Status:</strong>
                        <span>${this.getStatusName(task.status)}</span>
                    </div>
                    <div class="detail-row">
                        <strong>Due Date:</strong>
                        <span>${task.dueDate || 'Not set'}</span>
                    </div>
                    <div class="detail-row">
                        <strong>Labels:</strong>
                        <div class="task-labels">
                            ${task.labels.map(label => `<span class="task-label">${label}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="task-detail-actions">
                    <button class="btn-secondary" onclick="window.atlas.editTask('${task.id}')">Edit Task</button>
                    <button class="btn-secondary" onclick="window.atlas.deleteTask('${task.id}')">Delete Task</button>
                    <button class="btn-primary" onclick="window.atlas.closeModal()">Close</button>
                </div>
            </div>
        `);
    }

    getStatusName(status) {
        const names = {
            'someday': 'Someday/Maybe',
            'planning': 'Research & Planning',
            'ready': 'Permitted & Ready',
            'in-progress': 'Active Work',
            'blocked': 'Waiting on External',
            'done': 'Done Done'
        };
        return names[status] || status;
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        this.closeModal();
        
        const modal = this.createModal('Edit Task', `
            <form id="edit-task-form" class="task-form">
                <div class="form-group">
                    <label for="edit-task-title">Task Title *</label>
                    <input type="text" id="edit-task-title" value="${task.title}" required>
                </div>
                <div class="form-group">
                    <label for="edit-task-project">Project *</label>
                    <select id="edit-task-project" required>
                        <option value="kitchen" ${task.project === 'kitchen' ? 'selected' : ''}>Kitchen Renovation</option>
                        <option value="basement" ${task.project === 'basement' ? 'selected' : ''}>Basement Finishing</option>
                        <option value="bathroom" ${task.project === 'bathroom' ? 'selected' : ''}>Bathroom Update</option>
                        <option value="other" ${task.project === 'other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="edit-task-priority">Priority *</label>
                    <select id="edit-task-priority" required>
                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High Priority</option>
                        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium Priority</option>
                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low Priority</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="edit-task-due">Due Date</label>
                    <input type="text" id="edit-task-due" value="${task.dueDate || ''}" placeholder="e.g., Due Friday, Next week">
                </div>
                <div class="form-group">
                    <label for="edit-task-labels">Labels (comma-separated)</label>
                    <input type="text" id="edit-task-labels" value="${task.labels.join(', ')}" placeholder="e.g., painting, diy">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.atlas.closeModal()">Cancel</button>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>
        `);
        
        const form = modal.querySelector('#edit-task-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            task.title = document.getElementById('edit-task-title').value;
            task.project = document.getElementById('edit-task-project').value;
            task.priority = document.getElementById('edit-task-priority').value;
            task.dueDate = document.getElementById('edit-task-due').value || null;
            task.labels = document.getElementById('edit-task-labels').value.split(',').map(l => l.trim()).filter(l => l);
            
            this.saveData();
            this.renderKanban();
            this.setupKanbanDragDrop();
            this.closeModal();
        });
    }

    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task? This cannot be undone.')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveData();
            this.renderKanban();
            this.setupKanbanDragDrop();
            this.closeModal();
        }
    }

    // ===== PROJECTS PAGE =====
    initProjects() {
        this.renderProjectsPage();
        this.setupProjectsFilters();
        this.updateProjectStats();
    }

    renderProjectsPage() {
        // Update project cards with real task data
        const projectCards = document.querySelectorAll('.project-epic');
        
        projectCards.forEach(card => {
            const projectName = card.querySelector('h3').textContent.trim();
            let projectKey = '';
            
            if (projectName.includes('Kitchen')) projectKey = 'kitchen';
            else if (projectName.includes('Basement')) projectKey = 'basement';
            else if (projectName.includes('Bathroom')) projectKey = 'bathroom';
            
            if (!projectKey) return;
            
            // Get tasks for this project
            const projectTasks = this.tasks.filter(t => t.project === projectKey);
            const completedTasks = projectTasks.filter(t => t.status === 'done');
            const activeTasks = projectTasks.filter(t => t.status === 'in-progress');
            const blockedTasks = projectTasks.filter(t => t.status === 'blocked');
            
            // Calculate progress
            const progress = projectTasks.length > 0 
                ? Math.round((completedTasks.length / projectTasks.length) * 100)
                : 0;
            
            // Update progress bar and text
            const progressBar = card.querySelector('.progress-fill');
            const progressText = card.querySelector('.progress-info span:first-child');
            if (progressBar) progressBar.style.width = progress + '%';
            if (progressText) progressText.textContent = `Progress: ${progress}%`;
            
            // Update status badge based on project state
            const statusBadge = card.querySelector('.status-badge');
            if (statusBadge) {
                if (blockedTasks.length > 0) {
                    statusBadge.className = 'status-badge blocked';
                    statusBadge.textContent = 'Blocked';
                } else if (activeTasks.length > 0) {
                    statusBadge.className = 'status-badge in-progress';
                    statusBadge.textContent = 'In Progress';
                } else if (completedTasks.length === projectTasks.length && projectTasks.length > 0) {
                    statusBadge.className = 'status-badge completed';
                    statusBadge.textContent = 'Completed';
                } else {
                    statusBadge.className = 'status-badge planning';
                    statusBadge.textContent = 'Planning';
                }
            }
            
            // Make tasks clickable to show details
            const taskItems = card.querySelectorAll('.task-item');
            taskItems.forEach(taskItem => {
                if (!taskItem.dataset.enhanced) {
                    taskItem.style.cursor = 'pointer';
                    taskItem.addEventListener('click', () => {
                        const taskName = taskItem.querySelector('.task-name').textContent.trim();
                        const task = this.tasks.find(t => 
                            t.title.toLowerCase().includes(taskName.toLowerCase()) ||
                            taskName.toLowerCase().includes(t.title.toLowerCase())
                        );
                        
                        if (task) {
                            this.showTaskDetailModal(task);
                        } else {
                            // Create a quick task detail view for tasks that don't exist yet
                            this.showQuickTaskInfo(taskName, projectKey);
                        }
                    });
                    taskItem.dataset.enhanced = 'true';
                }
            });
        });
    }

    showQuickTaskInfo(taskName, projectKey) {
        const projectNames = {
            'kitchen': 'Kitchen Renovation',
            'basement': 'Basement Finishing',
            'bathroom': 'Bathroom Update'
        };
        
        const modal = this.createModal('Task Information', `
            <div class="task-detail-modal">
                <h3>${taskName}</h3>
                <div class="task-detail-info">
                    <div class="detail-row">
                        <strong>Project:</strong>
                        <span>${projectNames[projectKey]}</span>
                    </div>
                    <div class="detail-row">
                        <strong>Status:</strong>
                        <span>This is a placeholder task from the project template</span>
                    </div>
                </div>
                <p style="color: var(--text-medium); margin: 1rem 0;">
                    This task can be created and managed on the Kanban board for full functionality.
                </p>
                <div class="task-detail-actions">
                    <button class="btn-secondary" onclick="window.location.href='kanban.html'">Go to Kanban Board</button>
                    <button class="btn-primary" onclick="window.atlas.closeModal()">Close</button>
                </div>
            </div>
        `);
    }

    updateProjectStats() {
        // Update the stats cards at the top
        const activeProjects = 3; // Currently hardcoded, could be dynamic
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(t => t.status === 'done').length;
        const avgProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        const statCards = document.querySelectorAll('.projects-stats .stat-card');
        if (statCards[1]) {
            statCards[1].querySelector('.stat-number').textContent = totalTasks;
        }
        if (statCards[2]) {
            statCards[2].querySelector('.stat-number').textContent = avgProgress + '%';
        }
    }

    setupProjectsFilters() {
        const filters = document.querySelectorAll('.project-filters .filter-select');
        filters.forEach(filter => {
            filter.addEventListener('change', (e) => {
                const filterType = e.target.options[0].textContent.includes('Status') ? 'status' : 'priority';
                const value = e.target.value.toLowerCase();
                
                // Filter project cards based on selection
                const projectCards = document.querySelectorAll('.project-epic');
                projectCards.forEach(card => {
                    let shouldShow = true;
                    
                    if (filterType === 'status' && value !== 'all status') {
                        const badge = card.querySelector('.status-badge');
                        const cardStatus = badge ? badge.textContent.toLowerCase() : '';
                        shouldShow = cardStatus.includes(value);
                    }
                    
                    if (filterType === 'priority' && value !== 'all priorities') {
                        // For now, show all since we don't have priority on projects
                        // Could be enhanced to filter based on project priority
                    }
                    
                    card.style.display = shouldShow ? 'block' : 'none';
                });
            });
        });
    }

    // ===== DASHBOARD PAGE =====
    initDashboard() {
        this.updateDashboardStats();
        this.makeActivityItemsClickable();
        this.makeProjectCardsInteractive();
        this.makeUpcomingTasksInteractive();
    }

    updateDashboardStats() {
        // Update dashboard with real task counts
        const activeTasks = this.tasks.filter(t => t.status === 'in-progress').length;
        const totalTasks = this.tasks.length;
        const needAttention = this.tasks.filter(t => 
            t.priority === 'high' && (t.status === 'blocked' || t.dueDate?.includes('Overdue'))
        ).length;
        
        // Update welcome message
        const welcomeText = document.querySelector('.dashboard-header p');
        if (welcomeText) {
            welcomeText.textContent = `You have ${activeTasks} active task${activeTasks !== 1 ? 's' : ''} and ${needAttention} item${needAttention !== 1 ? 's' : ''} that need your attention`;
        }
    }

    makeActivityItemsClickable() {
        const activityItems = document.querySelectorAll('.activity-item');
        activityItems.forEach(item => {
            if (!item.dataset.enhanced) {
                item.addEventListener('click', () => {
                    const text = item.querySelector('.activity-text').textContent;
                    const timeText = item.querySelector('.activity-time').textContent;
                    
                    this.createModal('Activity Details', `
                        <div class="task-detail-modal">
                            <h3>Activity Log Entry</h3>
                            <div class="task-detail-info">
                                <div class="detail-row">
                                    <strong>Action:</strong>
                                    <span>${text}</span>
                                </div>
                                <div class="detail-row">
                                    <strong>Time:</strong>
                                    <span>${timeText}</span>
                                </div>
                                <div class="detail-row">
                                    <strong>Type:</strong>
                                    <span>Project Activity</span>
                                </div>
                            </div>
                            <p style="color: var(--text-medium); margin: 1rem 0;">
                                Full activity tracking with detailed logs, comments, and attachments coming in future updates.
                            </p>
                            <div class="task-detail-actions">
                                <button class="btn-primary" onclick="window.atlas.closeModal()">Close</button>
                            </div>
                        </div>
                    `);
                });
                item.dataset.enhanced = 'true';
            }
        });
    }

    makeProjectCardsInteractive() {
        const projectCards = document.querySelectorAll('.project-card');
        
        projectCards.forEach(card => {
            if (card.dataset.enhanced) return;
            
            const projectName = card.querySelector('h4').textContent.trim();
            let projectKey = '';
            
            if (projectName.includes('Kitchen')) projectKey = 'kitchen';
            else if (projectName.includes('Basement')) projectKey = 'basement';
            else if (projectName.includes('Bathroom')) projectKey = 'bathroom';
            
            // Make action buttons functional
            const viewButton = card.querySelector('.btn-link:first-of-type');
            const updateButton = card.querySelector('.btn-link:last-of-type');
            
            if (viewButton) {
                viewButton.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = 'kanban.html';
                };
            }
            
            if (updateButton) {
                updateButton.onclick = (e) => {
                    e.stopPropagation();
                    this.showProjectUpdateModal(projectKey, projectName);
                };
            }
            
            card.dataset.enhanced = 'true';
        });
    }

    showProjectUpdateModal(projectKey, projectName) {
        const modal = this.createModal('Update Project Status', `
            <form id="update-project-form" class="task-form">
                <h4 style="margin-bottom: 1rem;">${projectName}</h4>
                <div class="form-group">
                    <label for="project-status-update">Status Update</label>
                    <select id="project-status-update">
                        <option value="planning">Planning</option>
                        <option value="in-progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="project-notes">Notes</label>
                    <textarea id="project-notes" rows="4" placeholder="Add any updates, blockers, or notes about the project..."></textarea>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="update-timeline" style="margin-right: 0.5rem;">
                        Timeline on track
                    </label>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.atlas.closeModal()">Cancel</button>
                    <button type="submit" class="btn-primary">Save Update</button>
                </div>
            </form>
        `);
        
        const form = modal.querySelector('#update-project-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const status = document.getElementById('project-status-update').value;
            const notes = document.getElementById('project-notes').value;
            
            this.closeModal();
            
            // Show success notification
            const notification = document.createElement('div');
            notification.className = 'status-notification';
            notification.innerHTML = `
                <div class="notification-content">
                    <strong>${projectName}</strong> status updated successfully!
                </div>
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.classList.add('show'), 10);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        });
    }

    makeUpcomingTasksInteractive() {
        const taskItems = document.querySelectorAll('.upcoming-tasks .task-item');
        
        taskItems.forEach(item => {
            if (item.dataset.enhanced) return;
            
            item.addEventListener('click', () => {
                const taskText = item.querySelector('.task-text').textContent.trim();
                const taskDue = item.querySelector('.task-due').textContent.trim();
                const priority = item.classList.contains('priority-high') ? 'high' : 
                               item.classList.contains('priority-medium') ? 'medium' : 'low';
                
                // Try to find matching task in our data
                const task = this.tasks.find(t => 
                    t.title.toLowerCase().includes(taskText.toLowerCase()) ||
                    taskText.toLowerCase().includes(t.title.toLowerCase())
                );
                
                if (task) {
                    this.showTaskDetailModal(task);
                } else {
                    // Show a quick info modal
                    this.createModal('Upcoming Task', `
                        <div class="task-detail-modal">
                            <h3>${taskText}</h3>
                            <div class="task-detail-info">
                                <div class="detail-row">
                                    <strong>Due:</strong>
                                    <span>${taskDue}</span>
                                </div>
                                <div class="detail-row">
                                    <strong>Priority:</strong>
                                    <span class="priority-badge ${priority}">${priority.toUpperCase()}</span>
                                </div>
                            </div>
                            <p style="color: var(--text-medium); margin: 1rem 0;">
                                Manage this task on the Kanban board for full functionality including status updates, labels, and notes.
                            </p>
                            <div class="task-detail-actions">
                                <button class="btn-secondary" onclick="window.location.href='kanban.html'">Go to Kanban</button>
                                <button class="btn-primary" onclick="window.atlas.closeModal()">Close</button>
                            </div>
                        </div>
                    `);
                }
            });
            
            item.dataset.enhanced = 'true';
        });
    }

    // ===== MODAL SYSTEM =====
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
                    <button class="modal-close" onclick="window.atlas.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        document.body.appendChild(modalOverlay);
        
        // Close on overlay click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeModal();
            }
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

    // ===== GLOBAL LISTENERS =====
    setupGlobalListeners() {
        // Replace the old modal functions
        window.showNewTaskModal = () => this.showAddTaskModal();
        window.showTaskDetail = (taskName) => {
            const task = this.tasks.find(t => t.title === taskName);
            if (task) {
                this.showTaskDetailModal(task);
            }
        };
        window.showNewProjectModal = () => this.showNewProjectModal();
        window.showUserMenu = () => this.showUserMenu();
    }

    // ===== NEW PROJECT MODAL =====
    showNewProjectModal() {
        const modal = this.createModal('Create New Project', `
            <form id="new-project-form" class="task-form">
                <div class="form-group">
                    <label for="project-name">Project Name *</label>
                    <input type="text" id="project-name" placeholder="e.g., Deck Construction" required>
                </div>
                <div class="form-group">
                    <label for="project-description">Description</label>
                    <textarea id="project-description" rows="3" placeholder="Brief description of the project..."></textarea>
                </div>
                <div class="form-group">
                    <label for="project-budget">Budget Allocation *</label>
                    <input type="number" id="project-budget" placeholder="25000" required>
                </div>
                <div class="form-group">
                    <label for="project-timeline">Estimated Timeline</label>
                    <input type="text" id="project-timeline" placeholder="e.g., 8 weeks, 3 months">
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
                name: document.getElementById('project-name').value,
                description: document.getElementById('project-description').value,
                budget: parseFloat(document.getElementById('project-budget').value),
                timeline: document.getElementById('project-timeline').value,
                priority: document.getElementById('project-priority').value,
                status: 'planning',
                progress: 0,
                spent: 0,
                tasks: []
            };
            
            this.projects.push(newProject);
            this.saveData();
            this.closeModal();
            
            // Show success notification
            const notification = document.createElement('div');
            notification.className = 'status-notification';
            notification.innerHTML = `
                <div class="notification-content">
                    Project <strong>${newProject.name}</strong> created successfully!
                </div>
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.classList.add('show'), 10);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
            
            // Refresh page if on projects page
            if (this.getCurrentPage() === 'projects') {
                this.renderProjectsPage();
            }
        });
    }

    // ===== USER MENU =====
    showUserMenu() {
        const modal = this.createModal('User Settings', `
            <div class="task-detail-modal">
                <h3>Andrew Foster</h3>
                <div class="task-detail-info">
                    <div class="detail-row">
                        <strong>Email:</strong>
                        <span>andrew@projectatlas.dev</span>
                    </div>
                    <div class="detail-row">
                        <strong>Active Projects:</strong>
                        <span>3</span>
                    </div>
                    <div class="detail-row">
                        <strong>Total Tasks:</strong>
                        <span>${this.tasks.length}</span>
                    </div>
                    <div class="detail-row">
                        <strong>Data Storage:</strong>
                        <span>Browser LocalStorage</span>
                    </div>
                </div>
                <div style="margin: 1.5rem 0; padding: 1rem; background: var(--app-bg-light); border-radius: 6px;">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem;">Data Management</h4>
                    <p style="color: var(--text-medium); font-size: 0.85rem; margin: 0 0 1rem 0;">
                        Your tasks are stored locally in your browser. You can export or clear your data below.
                    </p>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-secondary" onclick="window.atlas.exportData()" style="font-size: 0.85rem; padding: 0.5rem 1rem;">Export Data</button>
                        <button class="btn-secondary" onclick="window.atlas.clearData()" style="font-size: 0.85rem; padding: 0.5rem 1rem;">Clear All Data</button>
                    </div>
                </div>
                <div class="task-detail-actions">
                    <button class="btn-primary" onclick="window.atlas.closeModal()">Close</button>
                </div>
            </div>
        `);
    }

    exportData() {
        const data = {
            tasks: this.tasks,
            projects: this.projects,
            exportDate: new Date().toISOString()
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
        
        const notification = document.createElement('div');
        notification.className = 'status-notification';
        notification.innerHTML = `
            <div class="notification-content">
                Data exported successfully! Check your downloads folder.
            </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    clearData() {
        if (confirm('Are you sure you want to clear all data? This will delete all tasks and projects. This cannot be undone.\n\nConsider exporting your data first.')) {
            localStorage.removeItem('atlas_tasks');
            localStorage.removeItem('atlas_projects');
            
            this.closeModal();
            
            const notification = document.createElement('div');
            notification.className = 'status-notification';
            notification.innerHTML = `
                <div class="notification-content">
                    All data cleared. The page will reload with default data.
                </div>
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.classList.add('show'), 10);
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.atlas = new ProjectAtlas();
    });
} else {
    window.atlas = new ProjectAtlas();
}
