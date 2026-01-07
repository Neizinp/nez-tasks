/**
 * Nez Tasks - Main Application
 * A Jira-like Scrum board with markdown-based storage
 */

import fileSystemService from './services/fileSystemService.js';
import taskService from './services/taskService.js';
import sprintService from './services/sprintService.js';

// Project configuration
const PROJECT_CONFIG_FILE = 'project.md';

class App {
  constructor() {
    this.projectConfig = null;
    this.currentView = 'backlog';
    this.currentSprintId = null;
    this.tasks = [];
    this.sprints = [];
    this.selectedBacklogTasks = new Set();
    this.draggedTask = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.initSearch();
    this.checkBrowserSupport();
  }

  checkBrowserSupport() {
    if (!fileSystemService.isSupported()) {
      alert('Your browser does not support the File System Access API. Please use Chrome, Edge, or another Chromium-based browser.');
    }
  }

  bindEvents() {
    // Folder selection
    document.getElementById('selectFolderBtn').addEventListener('click', () => this.selectFolder());
    document.getElementById('welcomeSelectBtn').addEventListener('click', () => this.selectFolder());

    // Navigation
    document.querySelector('[data-view="backlog"]').addEventListener('click', () => this.showBacklog());

    // Sprint & Task creation
    document.getElementById('newSprintBtn').addEventListener('click', () => this.showSprintModal());
    document.getElementById('newTaskBtn').addEventListener('click', () => this.showTaskModal());
    document.getElementById('addToSprintBtn').addEventListener('click', () => this.showBacklogPicker());

    // Search bar
    document.getElementById('searchBarBtn').addEventListener('click', () => this.showSearch());

    // Sprint actions
    document.getElementById('startSprintBtn').addEventListener('click', () => this.startCurrentSprint());

    // Task modal
    document.getElementById('closeTaskModal').addEventListener('click', () => this.hideTaskModal());
    document.getElementById('cancelTaskBtn').addEventListener('click', () => this.hideTaskModal());
    document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));

    // Sprint modal
    document.getElementById('closeSprintModal').addEventListener('click', () => this.hideSprintModal());
    document.getElementById('cancelSprintBtn').addEventListener('click', () => this.hideSprintModal());
    document.getElementById('sprintForm').addEventListener('submit', (e) => this.handleSprintSubmit(e));

    // Backlog picker modal
    document.getElementById('closeBacklogPickerModal').addEventListener('click', () => this.hideBacklogPicker());
    document.getElementById('cancelBacklogPickerBtn').addEventListener('click', () => this.hideBacklogPicker());
    document.getElementById('addSelectedTasksBtn').addEventListener('click', () => this.addSelectedToSprint());

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        this.hideSearch();
      }
      // Ctrl+K or Cmd+K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (this.projectConfig) {
          this.showSearch();
        }
      }
    });
  }

  // ============================================
  // Folder & Project Management
  // ============================================

  async selectFolder() {
    const success = await fileSystemService.requestDirectory();
    if (!success) return;

    await this.loadProject();
    this.showMainContent();
  }

  async loadProject() {
    // Try to load existing config
    const configContent = await fileSystemService.readRootFile(PROJECT_CONFIG_FILE);
    
    if (configContent) {
      const { frontmatter } = taskService.parseMarkdown(configContent);
      this.projectConfig = frontmatter;
    } else {
      // Create new project config
      this.projectConfig = {
        name: fileSystemService.getDirectoryName() || 'My Project',
        nextTaskId: 1,
        nextSprintId: 1,
        statuses: ['todo', 'in-progress', 'done']
      };
      await this.saveProjectConfig();
    }

    document.getElementById('projectName').textContent = this.projectConfig.name;
    document.getElementById('newSprintBtn').disabled = false;
    document.getElementById('searchBarBtn').disabled = false;

    // Load data
    await this.loadAllData();
  }

  async saveProjectConfig() {
    const content = [
      '---',
      `name: "${this.projectConfig.name}"`,
      `nextTaskId: ${this.projectConfig.nextTaskId}`,
      `nextSprintId: ${this.projectConfig.nextSprintId}`,
      `statuses: ["${this.projectConfig.statuses.join('", "')}"]`,
      '---',
      ''
    ].join('\n');
    
    await fileSystemService.writeRootFile(PROJECT_CONFIG_FILE, content);
  }

  async getNextTaskId() {
    const id = this.projectConfig.nextTaskId;
    this.projectConfig.nextTaskId++;
    await this.saveProjectConfig();
    return id;
  }

  async getNextSprintId() {
    const id = this.projectConfig.nextSprintId;
    this.projectConfig.nextSprintId++;
    await this.saveProjectConfig();
    return id;
  }

  showMainContent() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
  }

  // ============================================
  // Data Loading
  // ============================================

  async loadAllData() {
    this.tasks = await taskService.getAllTasks();
    this.sprints = await sprintService.getAllSprints();
    
    this.renderSprintList();
    this.renderCurrentView();
  }

  // ============================================
  // Navigation
  // ============================================

  showBacklog() {
    this.currentView = 'backlog';
    this.currentSprintId = null;
    
    // Update nav
    document.querySelectorAll('.nav-item, .sprint-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector('[data-view="backlog"]').classList.add('active');
    
    // Show view
    document.getElementById('backlogView').style.display = 'flex';
    document.getElementById('sprintView').style.display = 'none';
    
    this.renderBacklog();
  }

  showSprint(sprintId) {
    this.currentView = 'sprint';
    this.currentSprintId = sprintId;
    
    // Update nav
    document.querySelectorAll('.nav-item, .sprint-nav-item').forEach(el => el.classList.remove('active'));
    const sprintNav = document.querySelector(`.sprint-nav-item[data-sprint-id="${sprintId}"]`);
    if (sprintNav) sprintNav.classList.add('active');
    
    // Show view
    document.getElementById('backlogView').style.display = 'none';
    document.getElementById('sprintView').style.display = 'flex';
    
    this.renderSprintBoard();
  }

  renderCurrentView() {
    if (this.currentView === 'backlog') {
      this.renderBacklog();
    } else if (this.currentView === 'sprint' && this.currentSprintId) {
      this.renderSprintBoard();
    }
  }

  // ============================================
  // Sprint List (Sidebar)
  // ============================================

  renderSprintList() {
    const container = document.getElementById('sprintList');
    
    if (this.sprints.length === 0) {
      container.innerHTML = '<div class="nav-label" style="opacity: 0.5;">No sprints yet</div>';
      return;
    }

    container.innerHTML = this.sprints.map(sprint => `
      <button class="sprint-nav-item ${this.currentSprintId === sprint.id ? 'active' : ''}" 
              data-sprint-id="${sprint.id}">
        <span class="sprint-indicator ${sprint.status}"></span>
        ${this.escapeHtml(sprint.name)}
      </button>
    `).join('');

    // Bind click events
    container.querySelectorAll('.sprint-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.sprintId);
        this.showSprint(id);
      });
    });
  }

  // ============================================
  // Backlog View
  // ============================================

  renderBacklog() {
    const container = document.getElementById('backlogList');
    const backlogTasks = this.tasks.filter(t => t.sprint === null);

    if (backlogTasks.length === 0) {
      container.innerHTML = `
        <div class="backlog-empty">
          <div class="backlog-empty-icon">📋</div>
          <p>No tasks in backlog</p>
          <p style="font-size: 12px; margin-top: 8px;">Click "New Task" to create one</p>
        </div>
      `;
      return;
    }

    container.innerHTML = backlogTasks.map(task => this.renderTaskCard(task)).join('');
    this.bindTaskCardEvents(container);
    this.setupDragAndDrop(container);
  }

  // ============================================
  // Sprint Board View
  // ============================================

  renderSprintBoard() {
    const sprint = this.sprints.find(s => s.id === this.currentSprintId);
    if (!sprint) return;

    // Update header
    document.getElementById('sprintTitle').textContent = sprint.name;
    document.getElementById('sprintDates').textContent = `${sprint.startDate} → ${sprint.endDate}`;
    
    const badge = document.getElementById('sprintStatusBadge');
    badge.textContent = sprint.status;
    badge.className = `sprint-status-badge ${sprint.status}`;

    // Update start button visibility
    const startBtn = document.getElementById('startSprintBtn');
    if (sprint.status === 'planning') {
      startBtn.style.display = 'block';
      startBtn.textContent = 'Start Sprint';
    } else if (sprint.status === 'active') {
      startBtn.style.display = 'block';
      startBtn.textContent = 'Complete Sprint';
    } else {
      startBtn.style.display = 'none';
    }

    // Render columns
    const sprintTasks = this.tasks.filter(t => t.sprint === this.currentSprintId);
    const tasksByStatus = {
      'todo': sprintTasks.filter(t => t.status === 'todo'),
      'in-progress': sprintTasks.filter(t => t.status === 'in-progress'),
      'done': sprintTasks.filter(t => t.status === 'done')
    };

    // Update counts
    document.getElementById('todoCount').textContent = tasksByStatus['todo'].length;
    document.getElementById('inProgressCount').textContent = tasksByStatus['in-progress'].length;
    document.getElementById('doneCount').textContent = tasksByStatus['done'].length;

    // Render tasks
    ['todo', 'in-progress', 'done'].forEach(status => {
      const columnId = status === 'todo' ? 'todoTasks' : 
                       status === 'in-progress' ? 'inProgressTasks' : 'doneTasks';
      const container = document.getElementById(columnId);
      
      if (tasksByStatus[status].length === 0) {
        container.innerHTML = '<div class="backlog-empty" style="padding: 24px;"><p style="font-size: 12px; color: var(--color-text-muted);">Drop tasks here</p></div>';
      } else {
        container.innerHTML = tasksByStatus[status].map(task => this.renderTaskCard(task)).join('');
        this.bindTaskCardEvents(container);
      }
      
      this.setupColumnDragAndDrop(container, status);
    });
  }

  setupColumnDragAndDrop(container, status) {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      
      if (this.draggedTask && this.draggedTask.status !== status) {
        await taskService.updateStatus(this.draggedTask, status);
        await this.loadAllData();
      }
    });
  }

  async startCurrentSprint() {
    const sprint = this.sprints.find(s => s.id === this.currentSprintId);
    if (!sprint) return;

    if (sprint.status === 'planning') {
      await sprintService.startSprint(sprint);
    } else if (sprint.status === 'active') {
      await sprintService.completeSprint(sprint);
    }

    await this.loadAllData();
  }

  // ============================================
  // Task Card Rendering
  // ============================================

  renderTaskCard(task) {
    return `
      <div class="task-card" draggable="true" data-task-id="${task.id}">
        <div class="task-card-header">
          <span class="task-id">#${task.id}</span>
          <span class="task-priority ${task.priority}">${task.priority}</span>
        </div>
        <div class="task-title">${this.escapeHtml(task.title)}</div>
        <div class="task-footer">
          <span class="task-points">
            ${task.storyPoints > 0 ? `🎯 ${task.storyPoints} pts` : ''}
          </span>
          <div class="task-actions">
            <button class="task-action-btn edit-task" data-task-id="${task.id}">Edit</button>
            <button class="task-action-btn delete delete-task" data-task-id="${task.id}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  bindTaskCardEvents(container) {
    // Edit buttons
    container.querySelectorAll('.edit-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.taskId);
        this.editTask(id);
      });
    });

    // Delete buttons
    container.querySelectorAll('.delete-task').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.taskId);
        await this.deleteTask(id);
      });
    });
  }

  setupDragAndDrop(container) {
    container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        const id = parseInt(card.dataset.taskId);
        this.draggedTask = this.tasks.find(t => t.id === id);
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.draggedTask = null;
      });
    });
  }

  // ============================================
  // Task Modal
  // ============================================

  showTaskModal(task = null) {
    const modal = document.getElementById('taskModal');
    const title = document.getElementById('taskModalTitle');
    const form = document.getElementById('taskForm');

    if (task) {
      title.textContent = `Edit Task #${task.id}`;
      document.getElementById('taskTitle').value = task.title;
      document.getElementById('taskPriority').value = task.priority;
      document.getElementById('taskPoints').value = task.storyPoints || 0;
      document.getElementById('taskBody').value = task.body || '';
      document.getElementById('taskId').value = task.id;
      document.getElementById('taskSprint').value = task.sprint || '';
    } else {
      title.textContent = 'New Task';
      form.reset();
      document.getElementById('taskId').value = '';
      document.getElementById('taskSprint').value = this.currentView === 'sprint' ? this.currentSprintId : '';
    }

    modal.classList.add('active');
    document.getElementById('taskTitle').focus();
  }

  hideTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
  }

  async handleTaskSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('taskId').value;
    const sprintValue = document.getElementById('taskSprint').value;
    
    const data = {
      title: document.getElementById('taskTitle').value,
      priority: document.getElementById('taskPriority').value,
      storyPoints: parseInt(document.getElementById('taskPoints').value) || 0,
      body: document.getElementById('taskBody').value,
      sprint: sprintValue ? parseInt(sprintValue) : null
    };

    if (id) {
      // Update existing task
      const task = this.tasks.find(t => t.id === parseInt(id));
      if (task) {
        Object.assign(task, data);
        await taskService.updateTask(task);
      }
    } else {
      // Create new task
      await taskService.createTask(data, () => this.getNextTaskId());
    }

    this.hideTaskModal();
    await this.loadAllData();
  }

  editTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      this.showTaskModal(task);
    }
  }

  async deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      await taskService.deleteTask(task);
      await this.loadAllData();
    }
  }

  // ============================================
  // Sprint Modal
  // ============================================

  showSprintModal() {
    const modal = document.getElementById('sprintModal');
    const form = document.getElementById('sprintForm');
    form.reset();

    // Set default dates (2 weeks from today)
    const today = new Date();
    const twoWeeks = new Date(today);
    twoWeeks.setDate(today.getDate() + 14);
    
    document.getElementById('sprintStart').value = today.toISOString().split('T')[0];
    document.getElementById('sprintEnd').value = twoWeeks.toISOString().split('T')[0];

    // Default name
    const sprintNum = this.sprints.length + 1;
    document.getElementById('sprintName').value = `Sprint ${sprintNum}`;

    modal.classList.add('active');
  }

  hideSprintModal() {
    document.getElementById('sprintModal').classList.remove('active');
  }

  async handleSprintSubmit(e) {
    e.preventDefault();

    const data = {
      name: document.getElementById('sprintName').value,
      goal: document.getElementById('sprintGoal').value,
      startDate: document.getElementById('sprintStart').value,
      endDate: document.getElementById('sprintEnd').value
    };

    await sprintService.createSprint(data, () => this.getNextSprintId());
    this.hideSprintModal();
    await this.loadAllData();
  }

  // ============================================
  // Backlog Picker (Add tasks to sprint)
  // ============================================

  showBacklogPicker() {
    const modal = document.getElementById('backlogPickerModal');
    const container = document.getElementById('backlogPicker');
    const backlogTasks = this.tasks.filter(t => t.sprint === null);

    this.selectedBacklogTasks.clear();

    if (backlogTasks.length === 0) {
      container.innerHTML = '<div class="backlog-picker-empty">No tasks in backlog</div>';
    } else {
      container.innerHTML = backlogTasks.map(task => `
        <label class="backlog-picker-item" data-task-id="${task.id}">
          <input type="checkbox" value="${task.id}">
          <span class="task-id">#${task.id}</span>
          <span class="task-title" style="flex: 1;">${this.escapeHtml(task.title)}</span>
          <span class="task-priority ${task.priority}" style="margin-left: auto;">${task.priority}</span>
        </label>
      `).join('');

      container.querySelectorAll('.backlog-picker-item').forEach(item => {
        const checkbox = item.querySelector('input');
        item.addEventListener('click', (e) => {
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
          }
          item.classList.toggle('selected', checkbox.checked);
          
          const id = parseInt(item.dataset.taskId);
          if (checkbox.checked) {
            this.selectedBacklogTasks.add(id);
          } else {
            this.selectedBacklogTasks.delete(id);
          }
        });
      });
    }

    modal.classList.add('active');
  }

  hideBacklogPicker() {
    document.getElementById('backlogPickerModal').classList.remove('active');
  }

  async addSelectedToSprint() {
    for (const taskId of this.selectedBacklogTasks) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        await taskService.moveToSprint(task, this.currentSprintId);
      }
    }

    this.hideBacklogPicker();
    await this.loadAllData();
  }

  // ============================================
  // Utilities
  // ============================================

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // Fuzzy Search
  // ============================================

  initSearch() {
    this.searchSelectedIndex = 0;
    this.searchResults = [];

    // Search input
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.performSearch(e.target.value);
    });

    // Close on overlay click
    document.getElementById('searchModal').addEventListener('click', (e) => {
      if (e.target.id === 'searchModal') {
        this.hideSearch();
      }
    });

    // Keyboard navigation within search
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateSearchResults(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateSearchResults(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.selectSearchResult();
      }
    });
  }

  showSearch() {
    const modal = document.getElementById('searchModal');
    const input = document.getElementById('searchInput');
    
    modal.classList.add('active');
    input.value = '';
    input.focus();
    
    this.searchSelectedIndex = 0;
    this.performSearch('');
  }

  hideSearch() {
    document.getElementById('searchModal').classList.remove('active');
    document.getElementById('searchInput').value = '';
  }

  /**
   * Fuzzy match scoring algorithm
   * Returns score (higher = better match) or -1 if no match
   */
  fuzzyMatch(text, query) {
    if (!query) return { score: 0, matches: [] };
    
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Check if all characters exist in order
    let queryIdx = 0;
    let matches = [];
    
    for (let i = 0; i < text.length && queryIdx < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIdx]) {
        matches.push(i);
        queryIdx++;
      }
    }
    
    // Not all query chars found
    if (queryIdx !== queryLower.length) {
      return { score: -1, matches: [] };
    }
    
    // Calculate score
    let score = 100;
    
    // Bonus for exact match
    if (textLower === queryLower) {
      score += 1000;
    }
    
    // Bonus for starting with query
    if (textLower.startsWith(queryLower)) {
      score += 500;
    }
    
    // Bonus for consecutive matches
    let consecutiveBonus = 0;
    for (let i = 1; i < matches.length; i++) {
      if (matches[i] === matches[i-1] + 1) {
        consecutiveBonus += 50;
      }
    }
    score += consecutiveBonus;
    
    // Penalty for matches later in string
    score -= matches[0] * 2;
    
    // Penalty for gaps between matches
    const totalGaps = matches[matches.length - 1] - matches[0] - (matches.length - 1);
    score -= totalGaps * 5;
    
    return { score, matches };
  }

  /**
   * Highlight matched characters in text
   */
  highlightMatches(text, matches) {
    if (matches.length === 0) return this.escapeHtml(text);
    
    let result = '';
    let lastIdx = 0;
    
    // Group consecutive matches
    const groups = [];
    let groupStart = matches[0];
    let groupEnd = matches[0];
    
    for (let i = 1; i < matches.length; i++) {
      if (matches[i] === groupEnd + 1) {
        groupEnd = matches[i];
      } else {
        groups.push([groupStart, groupEnd]);
        groupStart = matches[i];
        groupEnd = matches[i];
      }
    }
    groups.push([groupStart, groupEnd]);
    
    // Build highlighted string
    for (const [start, end] of groups) {
      result += this.escapeHtml(text.substring(lastIdx, start));
      result += '<mark>' + this.escapeHtml(text.substring(start, end + 1)) + '</mark>';
      lastIdx = end + 1;
    }
    result += this.escapeHtml(text.substring(lastIdx));
    
    return result;
  }

  performSearch(query) {
    const container = document.getElementById('searchResults');
    
    if (!query.trim()) {
      // Show all tasks when no query
      this.searchResults = this.tasks.slice(0, 10).map(task => ({
        task,
        highlighted: this.escapeHtml(task.title),
        score: 0
      }));
    } else {
      // Fuzzy search
      this.searchResults = this.tasks
        .map(task => {
          const result = this.fuzzyMatch(task.title, query);
          return {
            task,
            highlighted: this.highlightMatches(task.title, result.matches),
            score: result.score
          };
        })
        .filter(r => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    }
    
    this.searchSelectedIndex = 0;
    this.renderSearchResults();
  }

  renderSearchResults() {
    const container = document.getElementById('searchResults');
    
    if (this.searchResults.length === 0) {
      container.innerHTML = '<div class="search-results-empty">No tasks found</div>';
      return;
    }
    
    container.innerHTML = this.searchResults.map((result, idx) => {
      const task = result.task;
      const sprint = task.sprint ? this.sprints.find(s => s.id === task.sprint) : null;
      const location = sprint ? sprint.name : 'Backlog';
      const badgeClass = sprint ? 'sprint' : 'backlog';
      
      return `
        <div class="search-result-item ${idx === this.searchSelectedIndex ? 'selected' : ''}" 
             data-index="${idx}">
          <span class="search-result-icon">📋</span>
          <div class="search-result-content">
            <div class="search-result-title">${result.highlighted}</div>
            <div class="search-result-meta">
              <span class="task-id">#${task.id}</span>
              <span class="task-priority ${task.priority}">${task.priority}</span>
              <span class="search-result-badge ${badgeClass}">${location}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Bind click events
    container.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        this.searchSelectedIndex = parseInt(item.dataset.index);
        this.selectSearchResult();
      });
    });
  }

  navigateSearchResults(direction) {
    if (this.searchResults.length === 0) return;
    
    this.searchSelectedIndex = (this.searchSelectedIndex + direction + this.searchResults.length) % this.searchResults.length;
    this.renderSearchResults();
    
    // Scroll selected into view
    const selected = document.querySelector('.search-result-item.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  selectSearchResult() {
    if (this.searchResults.length === 0) return;
    
    const result = this.searchResults[this.searchSelectedIndex];
    if (!result) return;
    
    const task = result.task;
    this.hideSearch();
    
    // Navigate to the task's location and open edit modal
    if (task.sprint) {
      this.showSprint(task.sprint);
    } else {
      this.showBacklog();
    }
    
    // Open the task for editing
    this.showTaskModal(task);
  }
}

// Initialize app
new App();
