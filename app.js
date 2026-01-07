/**
 * Nez Tasks - Main Application
 * A Jira-like Scrum board with markdown-based storage
 */

import fileSystemService from './services/fileSystemService.js';
import taskService from './services/taskService.js';
import sprintService from './services/sprintService.js';
import { SearchController } from './components/search.js';
import { ModalsController } from './components/modals.js';
import { TaskCardRenderer } from './components/taskCard.js';

// Project configuration
const PROJECT_CONFIG_FILE = 'project.md';

class App {
  constructor() {
    this.projectConfig = null;
    this.currentView = 'backlog';
    this.currentSprintId = null;
    this.tasks = [];
    this.sprints = [];
    this.draggedTask = null;

    // Initialize components
    this.search = new SearchController(this);
    this.modals = new ModalsController(this);
    this.taskCard = new TaskCardRenderer(this);

    this.init();
  }

  init() {
    this.bindEvents();
    this.search.init();
    this.modals.init();
    this.checkBrowserSupport();
    this.tryRestoreProject();
  }

  /**
   * Try to restore the previously used directory on startup
   */
  async tryRestoreProject() {
    const restored = await fileSystemService.restoreHandle();
    if (restored) {
      await this.loadProject();
      this.showMainContent();
    }
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
    document.getElementById('newSprintBtn').addEventListener('click', () => this.modals.showSprintModal());
    document.getElementById('newTaskBtn').addEventListener('click', () => this.modals.showTaskModal());
    document.getElementById('addToSprintBtn').addEventListener('click', () => this.modals.showBacklogPicker());

    // Search bar
    document.getElementById('searchBarBtn').addEventListener('click', () => this.search.show());

    // Sprint actions
    document.getElementById('startSprintBtn').addEventListener('click', () => this.startCurrentSprint());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        this.search.hide();
      }
      // Ctrl+K or Cmd+K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (this.projectConfig) {
          this.search.show();
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

    container.innerHTML = backlogTasks.map(task => this.taskCard.render(task)).join('');
    this.taskCard.bindEvents(container);
    this.taskCard.setupDragAndDrop(container);
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
        container.innerHTML = tasksByStatus[status].map(task => this.taskCard.render(task)).join('');
        this.taskCard.bindEvents(container);
      }
      
      this.taskCard.setupColumnDragAndDrop(container, status);
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
  // Utilities
  // ============================================

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app
new App();
