import { QuizStats } from '../game/QuizStats.js';

export function showDashboard() {
     const stats = QuizStats.getSummary();
     const weakTopics = QuizStats.getWeakTopics();
     const history = QuizStats.getStats().sessionHistory.slice().reverse().slice(0, 10); // Last 10

     // Create modal overlay
     const overlay = document.createElement('div');
     overlay.className = 'll-modal-overlay';
     overlay.id = 'stats-dashboard';

     // Modal Content
     const content = document.createElement('div');
     content.className = 'll-modal-content dashboard-content';

     // Header
     const header = document.createElement('div');
     header.className = 'dashboard-header';
     header.innerHTML = `
        <h3>📊 Learning Statistics</h3>
        <button class="close-btn" id="close-dashboard">×</button>
    `;
     content.appendChild(header);

     // Summary Cards
     const summaryGrid = document.createElement('div');
     summaryGrid.className = 'stats-grid';
     summaryGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${Math.round(stats.overallAccuracy * 100)}%</div>
            <div class="stat-label">Total Accuracy</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.totalQuestions}</div>
            <div class="stat-label">Questions Answered</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.weakTopicsCount}</div>
            <div class="stat-label">Weak Topics</div>
        </div>
    `;
     content.appendChild(summaryGrid);

     // Weak Topics Section
     const weakSection = document.createElement('div');
     weakSection.className = 'dashboard-section';
     weakSection.innerHTML = `<h4>🎯 Focus Areas (Accuracy < 60%)</h4>`;

     if (weakTopics.length > 0) {
          const list = document.createElement('div');
          list.className = 'weak-topics-list';

          weakTopics.forEach(topic => {
               const accuracy = Math.round(topic.accuracy * 100);
               const item = document.createElement('div');
               item.className = 'weak-topic-item';
               item.innerHTML = `
                <div class="topic-info">
                    <span class="topic-name">${topic.topic}</span>
                    <span class="topic-accuracy">${accuracy}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${accuracy}%; background: ${getColorForAccuracy(topic.accuracy)}"></div>
                </div>
            `;
               list.appendChild(item);
          });
          weakSection.appendChild(list);
     } else {
          weakSection.innerHTML += `<p class="empty-state">No weak topics found! Keep up the good work! 🎉</p>`;
     }
     content.appendChild(weakSection);

     // Recent Activity
     const historySection = document.createElement('div');
     historySection.className = 'dashboard-section';
     historySection.innerHTML = `<h4>🕒 Recent Activity</h4>`;

     if (history.length > 0) {
          const list = document.createElement('div');
          list.className = 'history-list';

          history.forEach(item => {
               const row = document.createElement('div');
               row.className = 'history-item';
               row.innerHTML = `
                <span class="history-result ${item.correct ? 'correct' : 'wrong'}">
                    ${item.correct ? '✅' : '❌'}
                </span>
                <span class="history-topic">${item.topic}</span>
                <span class="history-time">${new Date(item.date).toLocaleTimeString()}</span>
            `;
               list.appendChild(row);
          });
          historySection.appendChild(list);
     } else {
          historySection.innerHTML += `<p class="empty-state">No recent activity.</p>`;
     }
     content.appendChild(historySection);

     // Footer Actions
     const footer = document.createElement('div');
     footer.className = 'dashboard-footer';

     const clearBtn = document.createElement('button');
     clearBtn.className = 'll-modal-btn ll-modal-btn-secondary';
     clearBtn.textContent = '🗑️ Reset Stats';
     clearBtn.onclick = () => {
          if (confirm('Are you sure you want to reset all statistics?')) {
               QuizStats.clearStats();
               document.body.removeChild(overlay);
               showDashboard(); // Re-open empty
          }
     };

     footer.appendChild(clearBtn);
     content.appendChild(footer);

     overlay.appendChild(content);
     document.body.appendChild(overlay);

     // Close handlers
     document.getElementById('close-dashboard').onclick = () => document.body.removeChild(overlay);
     overlay.onclick = (e) => {
          if (e.target === overlay) document.body.removeChild(overlay);
     };
}

function getColorForAccuracy(accuracy) {
     if (accuracy < 0.4) return '#e74c3c'; // Red
     if (accuracy < 0.6) return '#f39c12'; // Orange
     return '#2ecc71'; // Green
}
