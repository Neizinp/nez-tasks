/**
 * SprintService - Handles sprint management with markdown serialization
 */

import fileSystemService from './fileSystemService.js';
import { parseMarkdown, createMarkdown } from './markdownParser.js';

const SPRINTS_DIR = 'sprints';

class SprintService {
  /**
   * Generate filename from sprint
   * @param {Object} sprint - Sprint object
   * @returns {string} Filename
   */
  generateFilename(sprint) {
    const slug = sprint.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${slug}.md`;
  }

  /**
   * Serialize sprint to markdown format
   * @param {Object} sprint - Sprint object
   * @returns {string} Markdown content
   */
  serializeSprint(sprint) {
    const frontmatter = {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal || '',
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status
    };
    return createMarkdown(frontmatter, sprint.body || '');
  }

  /**
   * Get all sprints
   * @returns {Promise<Object[]>} Array of sprint objects
   */
  async getAllSprints() {
    const files = await fileSystemService.listFiles(SPRINTS_DIR);
    const sprints = [];

    for (const filename of files) {
      const content = await fileSystemService.readFile(SPRINTS_DIR, filename);
      const { frontmatter, body } = parseMarkdown(content);
      sprints.push({
        ...frontmatter,
        body,
        filename
      });
    }

    return sprints.sort((a, b) => a.id - b.id);
  }

  /**
   * Get the active sprint
   * @returns {Promise<Object|null>}
   */
  async getActiveSprint() {
    const sprints = await this.getAllSprints();
    return sprints.find(s => s.status === 'active') || null;
  }

  /**
   * Get sprint by ID
   * @param {number} id - Sprint ID
   * @returns {Promise<Object|null>}
   */
  async getSprintById(id) {
    const sprints = await this.getAllSprints();
    return sprints.find(s => s.id === id) || null;
  }

  /**
   * Create a new sprint
   * @param {Object} data - Sprint data
   * @param {Function} getNextId - Function to get next sprint ID
   * @returns {Promise<Object>} Created sprint
   */
  async createSprint(data, getNextId) {
    const sprint = {
      id: await getNextId(),
      name: data.name,
      goal: data.goal || '',
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'planning',
      body: data.body || ''
    };

    const filename = this.generateFilename(sprint);
    const content = this.serializeSprint(sprint);
    await fileSystemService.writeFile(SPRINTS_DIR, filename, content);

    return { ...sprint, filename };
  }

  /**
   * Update an existing sprint
   * @param {Object} sprint - Sprint with updates
   * @returns {Promise<Object>} Updated sprint
   */
  async updateSprint(sprint) {
    const oldFilename = sprint.filename;
    const newFilename = this.generateFilename(sprint);
    const content = this.serializeSprint(sprint);
    
    await fileSystemService.renameFile(SPRINTS_DIR, oldFilename, newFilename, content);
    
    return { ...sprint, filename: newFilename };
  }

  /**
   * Start a sprint (set to active)
   * @param {Object} sprint - Sprint to start
   * @returns {Promise<Object>} Updated sprint
   */
  async startSprint(sprint) {
    // First, complete any other active sprint
    const activeSprint = await this.getActiveSprint();
    if (activeSprint && activeSprint.id !== sprint.id) {
      activeSprint.status = 'completed';
      await this.updateSprint(activeSprint);
    }

    sprint.status = 'active';
    return await this.updateSprint(sprint);
  }

  /**
   * Complete a sprint
   * @param {Object} sprint - Sprint to complete
   * @returns {Promise<Object>} Updated sprint
   */
  async completeSprint(sprint) {
    sprint.status = 'completed';
    return await this.updateSprint(sprint);
  }

  /**
   * Delete a sprint
   * @param {Object} sprint - Sprint to delete
   */
  async deleteSprint(sprint) {
    await fileSystemService.deleteFile(SPRINTS_DIR, sprint.filename);
  }
}

export default new SprintService();
