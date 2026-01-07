/**
 * TaskModal - Handles task creation and editing
 */

import taskService from '../services/taskService.js';

export class TaskModal {
  constructor(app) {
    this.app = app;
  }

  init() {
    document.getElementById('closeTaskModal').addEventListener('click', () => this.hide());
    document.getElementById('cancelTaskBtn').addEventListener('click', () => this.hide());
    document.getElementById('taskForm').addEventListener('submit', (e) => this.handleSubmit(e));
  }

  show(task = null) {
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

  hide() {
    document.getElementById('taskModal').classList.remove('active');
  }

  async handleSubmit(e) {
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
      const task = this.app.tasks.find(t => t.id === parseInt(id));
      if (task) {
        Object.assign(task, data);
        await taskService.updateTask(task);
      }
    } else {
      await taskService.createTask(data, () => this.app.getNextTaskId());
    }

    this.hide();
    await this.app.loadAllData();
  }
}
