/**
 * TaskCardRenderer - Handles task card rendering and events
 */

import taskService from '../services/taskService.js';

export class TaskCardRenderer {
  constructor(app) {
    this.app = app;
  }

  /**
   * Render a single task card
   */
  render(task) {
    return `
      <div class="task-card" draggable="true" data-task-id="${task.id}">
        <div class="task-card-header">
          <span class="task-id">#${task.id}</span>
          <span class="task-priority ${task.priority}">${task.priority}</span>
        </div>
        <div class="task-title">${this.app.escapeHtml(task.title)}</div>
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

  /**
   * Bind events to task cards in a container
   */
  bindEvents(container) {
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

  /**
   * Setup drag and drop for task cards
   */
  setupDragAndDrop(container) {
    container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', () => {
        const id = parseInt(card.dataset.taskId);
        this.app.draggedTask = this.app.tasks.find(t => t.id === id);
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.app.draggedTask = null;
      });
    });
  }

  /**
   * Setup drag and drop for kanban columns
   */
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
      
      if (this.app.draggedTask && this.app.draggedTask.status !== status) {
        await taskService.updateStatus(this.app.draggedTask, status);
        await this.app.loadAllData();
      }
    });
  }

  editTask(id) {
    const task = this.app.tasks.find(t => t.id === id);
    if (task) {
      this.app.modals.showTaskModal(task);
    }
  }

  async deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    const task = this.app.tasks.find(t => t.id === id);
    if (task) {
      await taskService.deleteTask(task);
      await this.app.loadAllData();
    }
  }
}
