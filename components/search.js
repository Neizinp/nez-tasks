/**
 * SearchController - Fuzzy search functionality
 */

export class SearchController {
  constructor(app) {
    this.app = app;
    this.searchSelectedIndex = 0;
    this.searchResults = [];
  }

  init() {
    // Search input
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.performSearch(e.target.value);
    });

    // Close on overlay click
    document.getElementById('searchModal').addEventListener('click', (e) => {
      if (e.target.id === 'searchModal') {
        this.hide();
      }
    });

    // Keyboard navigation within search
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateResults(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateResults(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.selectResult();
      }
    });
  }

  show() {
    const modal = document.getElementById('searchModal');
    const input = document.getElementById('searchInput');
    
    modal.classList.add('active');
    input.value = '';
    input.focus();
    
    this.searchSelectedIndex = 0;
    this.performSearch('');
  }

  hide() {
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
    if (matches.length === 0) return this.app.escapeHtml(text);
    
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
      result += this.app.escapeHtml(text.substring(lastIdx, start));
      result += '<mark>' + this.app.escapeHtml(text.substring(start, end + 1)) + '</mark>';
      lastIdx = end + 1;
    }
    result += this.app.escapeHtml(text.substring(lastIdx));
    
    return result;
  }

  performSearch(query) {
    if (!query.trim()) {
      // Show all tasks when no query
      this.searchResults = this.app.tasks.slice(0, 10).map(task => ({
        task,
        highlighted: this.app.escapeHtml(task.title),
        score: 0
      }));
    } else {
      // Fuzzy search
      this.searchResults = this.app.tasks
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
    this.renderResults();
  }

  renderResults() {
    const container = document.getElementById('searchResults');
    
    if (this.searchResults.length === 0) {
      container.innerHTML = '<div class="search-results-empty">No tasks found</div>';
      return;
    }
    
    container.innerHTML = this.searchResults.map((result, idx) => {
      const task = result.task;
      const sprint = task.sprint ? this.app.sprints.find(s => s.id === task.sprint) : null;
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
        this.selectResult();
      });
    });
  }

  navigateResults(direction) {
    if (this.searchResults.length === 0) return;
    
    this.searchSelectedIndex = (this.searchSelectedIndex + direction + this.searchResults.length) % this.searchResults.length;
    this.renderResults();
    
    // Scroll selected into view
    const selected = document.querySelector('.search-result-item.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  selectResult() {
    if (this.searchResults.length === 0) return;
    
    const result = this.searchResults[this.searchSelectedIndex];
    if (!result) return;
    
    const task = result.task;
    this.hide();
    
    // Navigate to the task's location and open edit modal
    if (task.sprint) {
      this.app.showSprint(task.sprint);
    } else {
      this.app.showBacklog();
    }
    
    // Open the task for editing
    this.app.modals.showTaskModal(task);
  }
}
