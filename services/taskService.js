/**
 * TaskService - Handles task CRUD operations with markdown serialization
 */

import fileSystemService from './fileSystemService.js';

const TASKS_DIR = 'tasks';

class TaskService {
  /**
   * Parse YAML frontmatter from markdown content
   * @param {string} content - Markdown content
   * @returns {Object} { frontmatter: Object, body: string }
   */
  parseMarkdown(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const frontmatter = {};
    const yamlLines = match[1].split('\n');
    
    for (const line of yamlLines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();
        
        // Parse values
        if (value === 'null' || value === '') {
          value = null;
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (/^-?\d+$/.test(value)) {
          value = parseInt(value, 10);
        } else if (/^-?\d+\.\d+$/.test(value)) {
          value = parseFloat(value);
        } else if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        frontmatter[key] = value;
      }
    }

    return { frontmatter, body: match[2].trim() };
  }

  /**
   * Serialize task to markdown format
   * @param {Object} task - Task object
   * @returns {string} Markdown content
   */
  serializeTask(task) {
    const frontmatter = [
      '---',
      `id: ${task.id}`,
      `title: "${task.title}"`,
      `status: "${task.status}"`,
      `sprint: ${task.sprint === null ? 'null' : task.sprint}`,
      `priority: "${task.priority}"`,
      `storyPoints: ${task.storyPoints || 0}`,
      `createdAt: "${task.createdAt}"`,
      `updatedAt: "${task.updatedAt}"`,
      '---',
      ''
    ].join('\n');

    return frontmatter + (task.body || '');
  }

  /**
   * Generate filename from task
   * @param {Object} task - Task object
   * @returns {string} Filename
   */
  generateFilename(task) {
    const idPadded = String(task.id).padStart(3, '0');
    const slug = task.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
    return `${idPadded}-${slug}.md`;
  }

  /**
   * Get all tasks from the tasks directory
   * @returns {Promise<Object[]>} Array of task objects
   */
  async getAllTasks() {
    const files = await fileSystemService.listFiles(TASKS_DIR);
    const tasks = [];

    for (const filename of files) {
      const content = await fileSystemService.readFile(TASKS_DIR, filename);
      const { frontmatter, body } = this.parseMarkdown(content);
      tasks.push({
        ...frontmatter,
        body,
        filename
      });
    }

    return tasks.sort((a, b) => a.id - b.id);
  }

  /**
   * Get backlog tasks (not assigned to any sprint)
   * @returns {Promise<Object[]>}
   */
  async getBacklogTasks() {
    const tasks = await this.getAllTasks();
    return tasks.filter(t => t.sprint === null);
  }

  /**
   * Get tasks for a specific sprint
   * @param {number} sprintId - Sprint ID
   * @returns {Promise<Object[]>}
   */
  async getSprintTasks(sprintId) {
    const tasks = await this.getAllTasks();
    return tasks.filter(t => t.sprint === sprintId);
  }

  /**
   * Get tasks grouped by status for a sprint
   * @param {number} sprintId - Sprint ID
   * @returns {Promise<Object>} { todo: [], 'in-progress': [], done: [] }
   */
  async getSprintTasksByStatus(sprintId) {
    const tasks = await this.getSprintTasks(sprintId);
    return {
      'todo': tasks.filter(t => t.status === 'todo'),
      'in-progress': tasks.filter(t => t.status === 'in-progress'),
      'done': tasks.filter(t => t.status === 'done')
    };
  }

  /**
   * Create a new task
   * @param {Object} data - Task data (title, priority, storyPoints, body)
   * @param {Function} getNextId - Function to get next task ID
   * @returns {Promise<Object>} Created task
   */
  async createTask(data, getNextId) {
    const now = new Date().toISOString();
    const task = {
      id: await getNextId(),
      title: data.title,
      status: 'todo',
      sprint: data.sprint || null,
      priority: data.priority || 'medium',
      storyPoints: data.storyPoints || 0,
      createdAt: now,
      updatedAt: now,
      body: data.body || ''
    };

    const filename = this.generateFilename(task);
    const content = this.serializeTask(task);
    await fileSystemService.writeFile(TASKS_DIR, filename, content);

    return { ...task, filename };
  }

  /**
   * Update an existing task
   * @param {Object} task - Task with updates
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(task) {
    const oldFilename = task.filename;
    task.updatedAt = new Date().toISOString();
    
    const newFilename = this.generateFilename(task);
    const content = this.serializeTask(task);
    
    await fileSystemService.renameFile(TASKS_DIR, oldFilename, newFilename, content);
    
    return { ...task, filename: newFilename };
  }

  /**
   * Move task to a sprint
   * @param {Object} task - Task to move
   * @param {number|null} sprintId - Sprint ID or null for backlog
   * @returns {Promise<Object>} Updated task
   */
  async moveToSprint(task, sprintId) {
    task.sprint = sprintId;
    return await this.updateTask(task);
  }

  /**
   * Update task status
   * @param {Object} task - Task to update
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated task
   */
  async updateStatus(task, status) {
    task.status = status;
    return await this.updateTask(task);
  }

  /**
   * Delete a task
   * @param {Object} task - Task to delete
   */
  async deleteTask(task) {
    await fileSystemService.deleteFile(TASKS_DIR, task.filename);
  }
}

export default new TaskService();
