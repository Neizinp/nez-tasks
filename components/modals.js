/**
 * ModalsController - Handles all modal dialogs
 */

import taskService from '../services/taskService.js';
import sprintService from '../services/sprintService.js';

export class ModalsController {
  constructor(app) {
    this.app = app;
    this.selectedBacklogTasks = new Set();
  }

  init() {
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
      document.getElementById('taskSprint').value = this.app.currentView === 'sprint' ? this.app.currentSprintId : '';
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
      const task = this.app.tasks.find(t => t.id === parseInt(id));
      if (task) {
        Object.assign(task, data);
        await taskService.updateTask(task);
      }
    } else {
      // Create new task
      await taskService.createTask(data, () => this.app.getNextTaskId());
    }

    this.hideTaskModal();
    await this.app.loadAllData();
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
    const sprintNum = this.app.sprints.length + 1;
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

    await sprintService.createSprint(data, () => this.app.getNextSprintId());
    this.hideSprintModal();
    await this.app.loadAllData();
  }

  // ============================================
  // Backlog Picker Modal
  // ============================================

  showBacklogPicker() {
    const modal = document.getElementById('backlogPickerModal');
    const container = document.getElementById('backlogPicker');
    const backlogTasks = this.app.tasks.filter(t => t.sprint === null);

    this.selectedBacklogTasks.clear();

    if (backlogTasks.length === 0) {
      container.innerHTML = '<div class="backlog-picker-empty">No tasks in backlog</div>';
    } else {
      container.innerHTML = backlogTasks.map(task => `
        <label class="backlog-picker-item" data-task-id="${task.id}">
          <input type="checkbox" value="${task.id}">
          <span class="task-id">#${task.id}</span>
          <span class="task-title" style="flex: 1;">${this.app.escapeHtml(task.title)}</span>
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
      const task = this.app.tasks.find(t => t.id === taskId);
      if (task) {
        await taskService.moveToSprint(task, this.app.currentSprintId);
      }
    }

    this.hideBacklogPicker();
    await this.app.loadAllData();
  }
}
