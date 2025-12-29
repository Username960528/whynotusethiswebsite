let currentGraphId = null;

import { getCurrentUser } from '../auth.js';

export async function initSession(nodes, edges, onUpdate) {
     const urlParams = new URLSearchParams(window.location.search);
     let graphId = urlParams.get('id');

     if (graphId) {
          // Try to load existing graph
          try {
               const response = await fetch(`/api/graphs/${graphId}`);
               if (!response.ok) throw new Error('Graph not found');
               const data = await response.json();

               nodes.clear();
               edges.clear();
               nodes.add(data.nodes);
               edges.add(data.edges);

               console.log(`Loaded graph: ${data.name}`);
               onUpdate();
               return; // Successfully loaded, exit
          } catch (e) {
               console.warn('Failed to load graph (might be deleted or invalid), creating a new one:', e);
               // Fall through to create new graph logic
               // Clear invalid ID from URL
               const newUrl = window.location.pathname;
               window.history.pushState({ path: newUrl }, '', newUrl);
          }
     }

     // Create new graph (if no ID or load failed)
     try {
          const user = getCurrentUser();
          const response = await fetch('/api/graphs', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                    name: 'New Graph ' + new Date().toLocaleString(),
                    username: user ? user.username : 'anonymous'
               })
          });

          if (!response.ok) throw new Error('Failed to create graph');

          const data = await response.json();

          // Update URL to include new ID
          const newUrl = `${window.location.pathname}?id=${data.id}`;
          window.history.pushState({ path: newUrl }, '', newUrl);

          console.log(`Created new graph: ${data.id}`);
     } catch (e) {
          console.error('Failed to create session:', e);
     }

     onUpdate();
}

export async function saveToStorage(nodes, edges) {
     const data = {
          nodes: nodes.get(),
          edges: edges.get()
     };

     // Save to localStorage as backup
     localStorage.setItem('qa_knowledge_graph', JSON.stringify(data));

     try {
          if (!currentGraphId) {
               // Create new graph
               const response = await fetch('/api/graphs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Untitled Graph' })
               });
               if (!response.ok) throw new Error('Failed to create graph');

               const result = await response.json();
               currentGraphId = result.id;

               // Update URL without reload
               const newUrl = `${window.location.pathname}?id=${currentGraphId}`;
               window.history.pushState({ path: newUrl }, '', newUrl);
               console.log('Created new graph:', currentGraphId);
          }

          // Update existing graph
          const response = await fetch(`/api/graphs/${currentGraphId}`, {
               method: 'PUT',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(data)
          });

          if (!response.ok) throw new Error('Failed to save to server');

          // Update status UI if possible (need to export/import showStatus or use callback)
          const statusEl = document.getElementById('saveStatus');
          if (statusEl) {
               statusEl.textContent = 'Сохранено: ' + new Date().toLocaleTimeString();
               statusEl.style.color = '#2ecc71';
          }
     } catch (e) {
          console.error('Error saving to server:', e);
          const statusEl = document.getElementById('saveStatus');
          if (statusEl) {
               statusEl.textContent = 'Ошибка сохранения!';
               statusEl.style.color = '#e74c3c';
          }
     }
}

async function loadGraphFromServer(id, nodes, edges, updateStatsCallback) {
     try {
          const response = await fetch(`/api/graphs/${id}`);
          if (!response.ok) throw new Error('Graph not found');

          const data = await response.json();
          nodes.clear();
          edges.clear();
          nodes.add(data.nodes || []);
          edges.add(data.edges || []);

          if (updateStatsCallback) updateStatsCallback();
          console.log('Loaded graph:', id);
     } catch (e) {
          console.error('Error loading graph:', e);
          alert('Ошибка загрузки графа: ' + e.message);
     }
}

// Deprecated: loadFromStorage (renamed/removed to avoid confusion, or kept as local fallback)
export async function loadFromStorage(nodes, edges, updateStatsCallback) {
     // This is now handled by initSession -> loadGraphFromServer
     // But we can keep it for "Draft" mode if needed, or just remove.
     // Let's keep it simple: if no ID, we are empty.
}


export function saveStackPreference(stackValue, customStackValue) {
     localStorage.setItem('qa_tech_stack', stackValue);
     if (stackValue === 'custom') {
          localStorage.setItem('qa_custom_stack', customStackValue);
     }
}

export function loadStackPreference() {
     return {
          stack: localStorage.getItem('qa_tech_stack'),
          customStack: localStorage.getItem('qa_custom_stack')
     };
}

export function exportGraph(nodes, edges) {
     const data = {
          nodes: nodes.get(),
          edges: edges.get(),
          exportDate: new Date().toISOString()
     };

     const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);

     const a = document.createElement('a');
     a.href = url;
     a.download = `qa_knowledge_graph_${Date.now()}.json`;
     a.click();

     URL.revokeObjectURL(url);
}

export function importGraph(nodes, edges, saveCallback) {
     const input = document.createElement('input');
     input.type = 'file';
     input.accept = '.json';

     input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const text = await file.text();
          try {
               const data = JSON.parse(text);
               nodes.clear();
               edges.clear();
               nodes.add(data.nodes);
               edges.add(data.edges);
               if (saveCallback) saveCallback();
          } catch (err) {
               alert('Ошибка при импорте: ' + err.message);
          }
     };

     input.click();
}
