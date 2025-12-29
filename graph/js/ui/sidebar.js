import { saveStackPreference } from '../data/storage.js';
import { CATEGORY_COLORS } from '../config.js';
import { showDashboard } from './dashboard.js';

export function initSidebar(callbacks) {
     // Tech Stack Change
     document.getElementById('techStack').onchange = handleStackChange;

     // Buttons
     document.getElementById('viewModeBtn').onclick = callbacks.onToggleViewMode;

     // User Profile
     if (callbacks.currentUser) {
          renderUserProfile(callbacks.currentUser, callbacks.onLogout);
     }

     // Render Category Panel
     renderCategoryPanel(callbacks.onToggleCluster);

     // Recent Graphs
     renderRecentGraphs(callbacks.currentUser?.username);
}

function renderUserProfile(user, onLogout) {
     const sidebar = document.querySelector('.sidebar');
     const container = document.createElement('div');
     container.className = 'user-profile';
     container.style.padding = '10px';
     container.style.marginBottom = '10px';
     container.style.background = '#2a2a3a';
     container.style.borderRadius = '8px';
     container.style.display = 'flex';
     container.style.justifyContent = 'space-between';
     container.style.alignItems = 'center';

     const info = document.createElement('div');
     info.innerHTML = `<div style="font-size: 0.8rem; color: #888;">Logged in as</div><div style="font-weight: bold;">${user.username}</div>`;

     const logoutBtn = document.createElement('button');
     logoutBtn.className = 'secondary';
     logoutBtn.textContent = 'Logout';
     logoutBtn.style.padding = '4px 8px';
     logoutBtn.style.fontSize = '0.8rem';
     logoutBtn.onclick = onLogout;

     container.appendChild(info);
     container.appendChild(logoutBtn);

     // Insert at the top, after title
     const title = sidebar.querySelector('h1');
     title.parentNode.insertBefore(container, title.nextSibling);
}

function renderCategoryPanel(onToggleCluster) {
     const container = document.createElement('div');
     container.className = 'legend'; // Reuse legend style for now or create new
     container.style.marginTop = '10px';
     container.innerHTML = '<h3>КЛАСТЕРИЗАЦИЯ</h3>';

     Object.keys(CATEGORY_COLORS).forEach(cat => {
          const item = document.createElement('div');
          item.className = 'legend-item';
          item.style.justifyContent = 'space-between';
          item.style.cursor = 'pointer';

          const left = document.createElement('div');
          left.style.display = 'flex';
          left.style.alignItems = 'center';
          left.style.gap = '10px';

          const dot = document.createElement('div');
          dot.className = 'legend-line';
          dot.style.background = CATEGORY_COLORS[cat].background;
          dot.style.width = '12px';
          dot.style.height = '12px';
          dot.style.borderRadius = '50%';

          const label = document.createElement('span');
          label.textContent = cat;

          left.appendChild(dot);
          left.appendChild(label);

          const btn = document.createElement('button');
          btn.className = 'secondary';
          btn.style.padding = '2px 8px';
          btn.style.fontSize = '0.7rem';
          btn.textContent = 'Свернуть';

          btn.onclick = (e) => {
               e.stopPropagation();
               const isClustered = onToggleCluster(cat);
               btn.textContent = isClustered ? 'Развернуть' : 'Свернуть';
               item.style.opacity = isClustered ? '0.7' : '1';
          };

          item.appendChild(left);
          item.appendChild(btn);
          container.appendChild(item);
     });

     // Insert after the existing legend
     const legend = document.querySelector('.legend');
     legend.parentNode.insertBefore(container, legend.nextSibling);

     // Add Save Status Indicator
     const statusDiv = document.createElement('div');
     statusDiv.id = 'saveStatus';
     statusDiv.style.fontSize = '0.8rem';
     statusDiv.style.color = '#888';
     statusDiv.style.marginTop = '10px';
     statusDiv.style.textAlign = 'center';
     statusDiv.textContent = 'Автосохранение включено';

     container.parentNode.insertBefore(statusDiv, container.nextSibling);

     // Add Statistics Button
     const statsBtn = document.createElement('button');
     statsBtn.className = 'secondary';
     statsBtn.style.width = '100%';
     statsBtn.style.marginTop = '10px';
     statsBtn.innerHTML = '📊 Статистика обучения';
     statsBtn.onclick = () => showDashboard();
     statusDiv.parentNode.insertBefore(statsBtn, statusDiv.nextSibling);

     // Add Share Button
     const shareBtn = document.createElement('button');
     shareBtn.className = 'secondary';
     shareBtn.style.width = '100%';
     shareBtn.style.marginTop = '10px';
     shareBtn.innerHTML = '🔗 Поделиться ссылкой';
     shareBtn.onclick = () => {
          const url = window.location.href;
          navigator.clipboard.writeText(url).then(() => {
               const originalText = shareBtn.innerHTML;
               shareBtn.innerHTML = '✅ Скопировано!';
               setTimeout(() => shareBtn.innerHTML = originalText, 2000);
          });
     };
     statusDiv.parentNode.insertBefore(shareBtn, statusDiv.nextSibling);

     // Add Recent Graphs List
     renderRecentGraphs();
}

async function renderRecentGraphs(username) {
     try {
          const url = username ? `/api/graphs/recent?username=${encodeURIComponent(username)}` : '/api/graphs/recent';
          const response = await fetch(url);
          if (!response.ok) return;

          const graphs = await response.json();
          if (graphs.length === 0) return;

          const container = document.createElement('div');
          container.className = 'legend';
          container.style.marginTop = '20px';
          container.innerHTML = '<h3>НЕДАВНИЕ ГРАФЫ</h3>';

          graphs.forEach(g => {
               const item = document.createElement('div');
               item.className = 'legend-item';
               item.style.cursor = 'pointer';
               item.style.justifyContent = 'space-between';

               const link = document.createElement('a');
               link.href = `/?id=${g.id}`;
               link.textContent = g.name || 'Untitled Graph';
               link.style.color = '#fff';
               link.style.textDecoration = 'none';
               link.style.fontSize = '0.9rem';

               const date = document.createElement('span');
               date.textContent = new Date(g.updated_at).toLocaleDateString();
               date.style.fontSize = '0.7rem';
               date.style.color = '#888';

               item.appendChild(link);
               item.appendChild(date);
               container.appendChild(item);
          });

          const sidebar = document.querySelector('.sidebar');
          sidebar.appendChild(container);
     } catch (e) {
          console.error('Failed to load recent graphs:', e);
     }
}

export function handleStackChange() {
     const stackSelector = document.getElementById('techStack');
     const customStackGroup = document.getElementById('customStackGroup');
     const customStackInput = document.getElementById('customStack');

     if (stackSelector.value === 'custom') {
          customStackGroup.style.display = 'flex';
     } else {
          customStackGroup.style.display = 'none';
     }

     saveStackPreference(stackSelector.value, customStackInput.value);
}

export function updateStats(nodes, edges) {
     const countNodes = nodes.length;
     const countEdges = edges.length;
     document.getElementById('statsText').innerText = `${countNodes} узлов • ${countEdges} связей`;
}

export function getStackInfo() {
     const stackSelector = document.getElementById('techStack');
     const customStackInput = document.getElementById('customStack');

     let description = '';
     let examples = '';

     switch (stackSelector.value) {
          case 'python':
               description = 'Python, Selenium, pytest, requests';
               examples = 'pytest fixtures, Page Object Model (Python), pytest-html, Allure, unittest, requests library, BeautifulSoup';
               break;
          case 'java':
               description = 'Java, Selenium, JUnit, REST Assured, TestNG';
               examples = 'Page Object Model (Java), JUnit 5, TestNG annotations, REST Assured, Maven, Gradle, Cucumber';
               break;
          case 'javascript':
               description = 'JavaScript/TypeScript, Playwright, Jest, Cypress';
               examples = 'Playwright fixtures, Cypress commands, Jest matchers, Page Object Model (JS), Mocha, Chai, Supertest';
               break;
          case 'custom':
               description = customStackInput.value.trim() || 'универсальный QA стек';
               examples = 'различные инструменты и библиотеки тестирования';
               break;
          default:
               description = 'Python, Selenium, pytest, requests';
               examples = 'pytest fixtures, Page Object Model (Python), pytest-html, Allure, unittest, requests library, BeautifulSoup';
     }

     return { description, examples };
}
