import { millionaireGame } from './game/millionaire.js';
import { EDGE_STYLES, CATEGORY_COLORS } from './config.js';
import { initGraph } from './graph/network.js';
import { init3DGraph } from './graph/graph3d.js';
import { toggleCluster } from './graph/clustering.js';
import { saveToStorage, initSession, exportGraph, importGraph, loadStackPreference } from './data/storage.js';
import { fetchQuestion, getRelatedTopics, findSemanticRelations } from './ai/gemini.js';
import { initSidebar, updateStats, getStackInfo } from './ui/sidebar.js';
import { showNodeInfo, hideNodeInfo } from './ui/nodeInfo.js';
import { initModals, showDeleteModal, confirmDelete, closeDeleteModal, openHelpModal, closeHelpModal, showQuizModal, closeQuizModal } from './ui/modal.js';
import { showStatus, hideStatus } from './ui/status.js';
import { initSpaceBackground } from './ui/space-background.js';
import { getCurrentUser, requireAuth, logout } from './auth.js';

// ============ DATA STORE ============
let nodes = null;
let edges = null;
let network = null;
let graph3D = null;
let is3DMode = false;
let currentSelectedNodeIds = [];
let connectModeActive = false;
let firstNodeForConnect = null;
let currentUser = null;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
     try {
          console.log('🚀 Initializing application...');

          // Check Auth
          if (!requireAuth()) return;
          currentUser = getCurrentUser();
          console.log('👤 Logged in as:', currentUser.username);

          // Initialize Data Sets
          if (typeof vis === 'undefined') {
               throw new Error('Vis.js library not loaded');
          }
          nodes = new vis.DataSet([]);
          edges = new vis.DataSet([]);

          // Init Space Background
          try {
               initSpaceBackground();
               console.log('✅ Space Background initialized');
          } catch (e) {
               console.error('❌ Space Background failed:', e);
          }

          // Init Graph
          const container = document.getElementById('graph');
          if (!container) throw new Error('Graph container not found');

          network = initGraph(container, nodes, edges, {
               onClick: handleNodeClick,
               onSelect: (params) => {
                    if (params.nodes.length > 0) {
                         // Check if it's a cluster
                         if (network.isCluster(params.nodes[0])) {
                              network.openCluster(params.nodes[0]);
                              return;
                         }

                         currentSelectedNodeIds = params.nodes;

                         if (currentSelectedNodeIds.length === 1) {
                              showNodeInfo(
                                   currentSelectedNodeIds[0],
                                   nodes,
                                   (node) => showQuiz([{ topic: node.label, description: node.description }]),
                                   (node) => handleAutoLink(node)
                              );
                         } else {
                              showMultiSelectInfo(currentSelectedNodeIds);
                         }
                    }
               },
               onDeselect: () => {
                    hideNodeInfo();
                    currentSelectedNodeIds = [];
               }
          });
          console.log('✅ Graph initialized');

          // Init Sidebar & UI
          initSidebar({
               onToggleViewMode: toggleViewMode,
               onToggleCluster: (category) => toggleCluster(network, category),
               currentUser,
               onLogout: logout
          });
          console.log('✅ Sidebar initialized');

          initModals();
          loadStackPreference(); // Restore stack selection

          // Load Data (Session)
          initSession(nodes, edges, () => updateStats(nodes, edges));
          console.log('✅ Session loaded');

          // Attach Event Listeners
          document.getElementById('addTopicAIBtn').addEventListener('click', addTopicWithAI);
          document.getElementById('addTopicManualBtn').addEventListener('click', addTopicManual);
          document.getElementById('connectModeBtn').addEventListener('click', connectMode);
          document.getElementById('exportBtn').addEventListener('click', () => exportGraph(nodes, edges));
          document.getElementById('importBtn').addEventListener('click', () => importGraph(nodes, edges, () => {
               saveToStorage(nodes, edges);
               updateStats(nodes, edges);
          }));
          document.getElementById('deleteBtn').addEventListener('click', deleteSelected);
          document.getElementById('clearBtn').addEventListener('click', clearGraph);
          document.getElementById('helpBtn').addEventListener('click', openHelpModal);
          document.getElementById('closeHelpBtn').addEventListener('click', closeHelpModal);

          // Keyboard shortcuts
          document.addEventListener('keydown', (e) => {
               if (e.key === 'Delete' || e.key === 'Backspace') {
                    // Only if not typing in input
                    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                         deleteSelected();
                    }
               }
               if (e.key === 'Enter') {
                    if (e.target.id === 'topicInput') {
                         if (e.shiftKey) {
                              addTopicManual();
                         } else {
                              addTopicWithAI();
                         }
                    }
               }
          });

          console.log('✅ Initialization complete');
     } catch (error) {
          console.error('❌ Initialization Error:', error);
          alert('Initialization Error: ' + error.message);
     }
});

// ============ LOGIC ============

async function handleAutoLink(node) {
     showStatus('loading', `🔍 Searching for connections for "${node.label}"...`);
     try {
          const connections = await findRelatedNodes(node.label);

          if (connections.length === 0) {
               showStatus('error', 'No new connections found.');
               setTimeout(hideStatus, 2000);
               return;
          }

          let newEdgesCount = 0;
          connections.forEach(conn => {
               // Check if edge already exists
               const exists = edges.get().some(e =>
                    (e.from === node.id && e.to === conn.id) ||
                    (e.from === conn.id && e.to === node.id)
               );

               if (!exists) {
                    addEdge(node.id, conn.id, conn.edgeType, conn.relation);
                    newEdgesCount++;
               }
          });

          if (newEdgesCount > 0) {
               showStatus('loading', `✅ Added ${newEdgesCount} new connections!`);
               saveToStorage(nodes, edges);
          } else {
               showStatus('loading', '⚠️ All found connections already exist.');
          }
          setTimeout(hideStatus, 2000);

     } catch (e) {
          console.error(e);
          showStatus('error', 'Error finding connections');
          setTimeout(hideStatus, 2000);
     }
}

function showMultiSelectInfo(nodeIds) {
     const nodeInfo = document.getElementById('nodeInfo');
     const title = document.getElementById('nodeTitle');
     const desc = document.getElementById('nodeDesc');
     const quizBtn = document.getElementById('startQuizBtn');

     title.textContent = `Selected ${nodeIds.length} Topics`;
     desc.textContent = nodeIds.map(id => nodes.get(id).label).join(', ');

     nodeInfo.classList.add('visible');
     quizBtn.onclick = () => showQuiz(nodeIds.map(id => {
          const n = nodes.get(id);
          return { topic: n.label, description: n.description };
     }));
     quizBtn.textContent = '🎓 Start Joint Quiz';
}

async function showQuiz(topicsData) {
     millionaireGame.start(topicsData);
}

function toggleViewMode() {
     is3DMode = !is3DMode;
     const btn = document.getElementById('viewModeBtn');
     const graph2D = document.getElementById('graph');
     const graph3DContainer = document.getElementById('graph-3d');

     if (is3DMode) {
          btn.innerText = '🔄 Переключить на 2D';
          graph2D.style.display = 'none';
          graph3DContainer.style.display = 'block';

          // Add delay to ensure layout is computed and container has correct dimensions
          setTimeout(() => {
               if (!graph3D) {
                    graph3D = init3DGraph(graph3DContainer, nodes, edges, {
                         onNodeClick: (node) => {
                              showNodeInfo(
                                   node.id,
                                   nodes,
                                   (n) => showQuiz([{ topic: n.label, description: n.description }]),
                                   (n) => handleAutoLink(n)
                              );
                              currentSelectedNodeIds = [node.id];
                         },
                         onBackgroundClick: () => {
                              hideNodeInfo();
                              currentSelectedNodeIds = [];
                         }
                    });
               } else {
                    // Force resize update
                    const { width, height } = graph3DContainer.getBoundingClientRect();
                    graph3D.width(width);
                    graph3D.height(height);
                    graph3D.graphData({
                         nodes: nodes.get().map(n => ({
                              id: n.id,
                              name: n.label,
                              group: n.group,
                              description: n.title,
                              category: n.category,
                              color: n.color
                         })),
                         links: edges.get().map(e => ({
                              source: e.from,
                              target: e.to,
                              type: e.edgeType || 'causal'
                         }))
                    });
               }
          }, 50);
     } else {
          btn.innerText = '🔄 Переключить на 3D';
          graph2D.style.display = 'block';
          graph3DContainer.style.display = 'none';
     }
}

async function addTopicWithAI() {
     const topicInput = document.getElementById('topicInput');
     const topic = topicInput.value.trim();

     if (!topic) return alert('Введите тему');

     showStatus('loading', '⏳ Анализирую связи...');

     // Add the main node first
     const nodeId = addNode(topic);

     try {
          const { description, examples } = getStackInfo();
          const existingTopics = nodes.get().map(n => n.label);

          const relatedTopics = await getRelatedTopics(topic, null, description, examples, existingTopics);

          // Add related nodes and edges
          relatedTopics.forEach(related => {
               // Check if node already exists
               let existingNode = nodes.get().find(n =>
                    n.label.toLowerCase() === related.topic.toLowerCase()
               );

               let targetId;
               if (existingNode) {
                    targetId = existingNode.id;
               } else {
                    // Pass category from AI response
                    targetId = addNode(related.topic, related.description, related.category);
               }

               // Add edge
               addEdge(nodeId, targetId, related.edgeType, related.relation);
          });

          // NEW: Explicitly check for semantic links to existing nodes (Global Context)
          const semanticLinks = await findRelatedNodes(topic);
          semanticLinks.forEach(conn => {
               // conn.id is the ID of the existing node
               addEdge(nodeId, conn.id, conn.edgeType, conn.relation);
          });

          hideStatus();
          topicInput.value = '';
          saveToStorage(nodes, edges);

     } catch (error) {
          showStatus('error', '❌ ' + error.message);
          setTimeout(hideStatus, 3000);
     }
}

function addTopicManual() {
     const topicInput = document.getElementById('topicInput');
     const topic = topicInput.value.trim();
     if (!topic) return alert('Введите тему');

     const nodeId = addNode(topic);

     // Force physics update
     network.stabilize();
     setTimeout(() => {
          network.focus(nodeId, { scale: 1.2, animation: true });
     }, 100);

     topicInput.value = '';
     saveToStorage(nodes, edges);
}

function addNode(label, description = '', category = null) {
     // Check for duplicates (case-insensitive)
     const existing = nodes.get().find(n =>
          n.label.toLowerCase() === label.toLowerCase()
     );

     if (existing) {
          network.selectNodes([existing.id]);
          network.focus(existing.id, { scale: 1.2, animation: true });
          return existing.id;
     }

     // Get category from selector if not provided
     if (!category) {
          category = document.getElementById('nodeCategory').value;
     }

     const id = 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
     const nodeData = {
          id,
          label,
          title: description || label,
          description,
          category,
          color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Core']
     };

     nodes.add(nodeData);
     updateStats(nodes, edges);

     if (is3DMode && graph3D) {
          init3DGraph(document.getElementById('graph-3d'), nodes, edges, {});
     }

     return id;
}

function addEdge(from, to, type, label = '') {
     // Check if edge exists? Vis.js allows multiple edges.
     // Let's avoid duplicates if same type.
     const existing = edges.get().find(e => e.from === from && e.to === to && e.edgeType === type);
     if (existing) return;

     const style = getEdgeStyle(type);

     edges.add({
          from,
          to,
          label,
          ...style,
          edgeType: type
     });
     updateStats(nodes, edges);

     if (is3DMode && graph3D) {
          init3DGraph(document.getElementById('graph-3d'), nodes, edges, {});
     }
}

function getEdgeStyle(type) {
     return EDGE_STYLES[type] || EDGE_STYLES.multiway;
}

function connectMode() {
     connectModeActive = !connectModeActive;
     firstNodeForConnect = null;

     const graphContainer = document.querySelector('.graph-container');

     if (connectModeActive) {
          graphContainer.classList.add('connect-mode-active');
          showStatus('loading', '🔗 Шаг 1/2: Кликните на ПЕРВЫЙ узел...');
     } else {
          graphContainer.classList.remove('connect-mode-active');
          hideStatus();
     }
}

function handleNodeClick(params) {
     if (!connectModeActive || params.nodes.length === 0) return;

     const clickedNode = params.nodes[0];

     if (!firstNodeForConnect) {
          firstNodeForConnect = clickedNode;
          const nodeName = nodes.get(clickedNode).label;
          showStatus('loading', `🔗 Шаг 2/2: Выбран "${nodeName}". Кликните на ВТОРОЙ узел...`);
          network.selectNodes([clickedNode]);
     } else {
          if (clickedNode === firstNodeForConnect) {
               showStatus('error', '❌ Нельзя связать узел с самим собой!');
               setTimeout(() => showStatus('loading', '🔗 Шаг 1/2: Кликните на ПЕРВЫЙ узел...'), 2000);
               firstNodeForConnect = null;
               return;
          }

          const edgeType = document.getElementById('edgeType').value;
          addEdge(firstNodeForConnect, clickedNode, edgeType);

          firstNodeForConnect = null;
          connectModeActive = false;
          document.querySelector('.graph-container').classList.remove('connect-mode-active');
          showStatus('loading', '✅ Связь создана!');
          setTimeout(hideStatus, 2000);
          saveToStorage(nodes, edges);
     }
}

function deleteSelected() {
     // Use the first selected node for now
     const nodeId = currentSelectedNodeIds[0];
     const result = showDeleteModal(nodes, edges, is3DMode, nodeId, network);
     if (result.success) {
          // Wait for confirmation
          document.getElementById('confirmDeleteBtn').onclick = () => {
               confirmDelete(nodes, edges, () => {
                    saveToStorage(nodes, edges);
                    updateStats(nodes, edges);
                    if (is3DMode && graph3D) init3DGraph(document.getElementById('graph-3d'), nodes, edges, {});
               }, () => hideNodeInfo());
          };
          document.getElementById('cancelDeleteBtn').onclick = closeDeleteModal;
     } else {
          showStatus('error', result.message);
          setTimeout(hideStatus, 2000);
     }
}

function clearGraph() {
     if (confirm('Вы уверены, что хотите удалить ВЕСЬ граф? Это действие нельзя отменить.')) {
          nodes.clear();
          edges.clear();
          saveToStorage(nodes, edges);
          updateStats(nodes, edges);
          if (is3DMode && graph3D) init3DGraph(document.getElementById('graph-3d'), nodes, edges, {});
          hideNodeInfo();
     }
}

// ============ EXPORTS FOR QUIZ INTEGRATION ============
/**
 * Add nodes from quiz to the graph
 * @param {Array} concepts - Array of concept objects from quiz
 * @returns {Array} - Array of created node IDs
 */
export async function addNodesFromQuiz(concepts) {
     const createdNodes = [];

     // Process sequentially to avoid overwhelming the API
     for (const concept of concepts) {
          try {
               // Add node to graph
               const nodeId = addNode(concept.topic, concept.description, concept.category);

               if (nodeId) {
                    createdNodes.push({ id: nodeId, ...concept });

                    // Find semantic relations using AI
                    const relatedConnections = await findRelatedNodes(concept.topic);

                    relatedConnections.forEach(conn => {
                         // conn.id is the ID of the existing node
                         // conn.edgeType and conn.relation come from AI
                         addEdge(nodeId, conn.id, conn.edgeType, conn.relation);
                    });
               }
          } catch (error) {
               console.error(`Error adding node ${concept.topic}:`, error);
          }
     }

     // Save changes
     if (createdNodes.length > 0) {
          saveToStorage(nodes, edges);
          updateStats(nodes, edges);

          // Refresh 3D view if active
          if (is3DMode && graph3D) {
               init3DGraph(document.getElementById('graph-3d'), nodes, edges, {});
          }

          // Focus on first new node
          if (network && createdNodes.length > 0) {
               setTimeout(() => {
                    network.focus(createdNodes[0].id, { scale: 1.2, animation: true });
               }, 300);
          }
     }
     return createdNodes;
}

/**
 * Find nodes related to a topic using AI Semantic Search
 * @param {string} topic - Topic name
 * @returns {Promise<Array>} - Array of connection objects { id, edgeType, relation }
 */
async function findRelatedNodes(topic) {
     const allNodes = nodes.get();

     // Filter out self
     const candidates = allNodes
          .filter(n => n.label !== topic)
          .map(n => n.label);

     if (candidates.length === 0) return [];

     // Limit candidates if too many (e.g., take top 50 most recent or random)
     // For now, let's take up to 100 to be safe
     const limitedCandidates = candidates.slice(0, 100);

     try {
          showStatus('loading', `🔍 Searching for connections for "${topic}"...`);
          const relations = await findSemanticRelations(topic, limitedCandidates);
          hideStatus();

          // Map back to IDs
          return relations.map(r => {
               const node = allNodes.find(n => n.label === r.id);
               return node ? { id: node.id, edgeType: r.edgeType, relation: r.relation } : null;
          }).filter(Boolean);

     } catch (error) {
          console.error('Semantic search failed, falling back to simple matching:', error);
          hideStatus();
          return findRelatedNodesFallback(topic);
     }
}

/**
 * Fallback: Find nodes related to a topic using token-based similarity
 */
function findRelatedNodesFallback(topic) {
     const allNodes = nodes.get();
     const candidates = [];

     // Helper to tokenize and clean strings
     const tokenize = (str) => str.toLowerCase().split(/[\s-_]+/).filter(t => t.length > 2);
     const topicTokens = tokenize(topic);

     allNodes.forEach(node => {
          if (node.label === topic) return; // Skip self

          let score = 0;

          // Token Overlap (Similarity)
          const nodeTokens = tokenize(node.label);
          if (topicTokens.length > 0 && nodeTokens.length > 0) {
               const matches = topicTokens.filter(t =>
                    nodeTokens.some(nt => nt.includes(t) || t.includes(nt))
               );
               const similarity = matches.length / Math.max(topicTokens.length, nodeTokens.length);
               score += similarity;
          }

          if (score > 0.4) { // Threshold for relevance
               candidates.push({ id: node.id, edgeType: 'branchial', relation: 'similar topic' });
          }
     });

     // Sort by score and take top 3
     candidates.sort((a, b) => b.score - a.score);
     return candidates.slice(0, 3);
}
