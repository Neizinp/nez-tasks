/**
 * SprintModal - Handles sprint creation
 */

import sprintService from '../services/sprintService.js';

export class SprintModal {
  constructor(app) {
    this.app = app;
  }

  init() {
    document.getElementById('closeSprintModal').addEventListener('click', () => this.hide());
    document.getElementById('cancelSprintBtn').addEventListener('click', () => this.hide());
    document.getElementById('sprintForm').addEventListener('submit', (e) => this.handleSubmit(e));
  }

  show() {
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

  hide() {
    document.getElementById('sprintModal').classList.remove('active');
  }

  async handleSubmit(e) {
    e.preventDefault();

    const data = {
      name: document.getElementById('sprintName').value,
      goal: document.getElementById('sprintGoal').value,
      startDate: document.getElementById('sprintStart').value,
      endDate: document.getElementById('sprintEnd').value
    };

    await sprintService.createSprint(data, () => this.app.getNextSprintId());
    this.hide();
    await this.app.loadAllData();
  }
}
