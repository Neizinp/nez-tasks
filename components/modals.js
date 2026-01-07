/**
 * ModalsController - Facade for all modal components
 */

import { TaskModal } from './TaskModal.js';
import { SprintModal } from './SprintModal.js';
import { BacklogPicker } from './BacklogPicker.js';

export class ModalsController {
  constructor(app) {
    this.app = app;
    this.taskModal = new TaskModal(app);
    this.sprintModal = new SprintModal(app);
    this.backlogPicker = new BacklogPicker(app);
  }

  init() {
    this.taskModal.init();
    this.sprintModal.init();
    this.backlogPicker.init();

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
  }

  // Delegate to specific modals
  showTaskModal(task = null) {
    this.taskModal.show(task);
  }

  showSprintModal() {
    this.sprintModal.show();
  }

  showBacklogPicker() {
    this.backlogPicker.show();
  }
}
