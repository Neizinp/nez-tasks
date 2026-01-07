/**
 * BacklogPicker - Modal for adding tasks from backlog to sprint
 */

import taskService from '../services/taskService.js';

export class BacklogPicker {
  constructor(app) {
    this.app = app;
    this.selectedTasks = new Set();
  }

  init() {
    document.getElementById('closeBacklogPickerModal').addEventListener('click', () => this.hide());
    document.getElementById('cancelBacklogPickerBtn').addEventListener('click', () => this.hide());
    document.getElementById('addSelectedTasksBtn').addEventListener('click', () => this.addSelectedToSprint());
  }

  show() {
    const modal = document.getElementById('backlogPickerModal');
    const container = document.getElementById('backlogPicker');
    const backlogTasks = this.app.tasks.filter(t => t.sprint === null);

    this.selectedTasks.clear();

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
            this.selectedTasks.add(id);
          } else {
            this.selectedTasks.delete(id);
          }
        });
      });
    }

    modal.classList.add('active');
  }

  hide() {
    document.getElementById('backlogPickerModal').classList.remove('active');
  }

  async addSelectedToSprint() {
    for (const taskId of this.selectedTasks) {
      const task = this.app.tasks.find(t => t.id === taskId);
      if (task) {
        await taskService.moveToSprint(task, this.app.currentSprintId);
      }
    }

    this.hide();
    await this.app.loadAllData();
  }
}
