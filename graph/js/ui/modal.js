export function initModals() {
     // Close modals on outside click
     window.onclick = function (event) {
          if (event.target.classList.contains('modal-overlay')) {
               event.target.classList.remove('active');
               // Also hide quiz container if it's the target
               if (event.target.id === 'quiz-container') {
                    event.target.style.display = 'none';
               }
          }
     };
}

// ============ DELETE MODAL ============
let pendingDeleteNodes = [];
let pendingDeleteEdges = [];

export function showDeleteModal(nodes, edges, is3DMode, currentSelectedNodeId, network) {
     let selectedNodes = [];
     let selectedEdges = [];

     if (is3DMode) {
          if (currentSelectedNodeId) selectedNodes = [currentSelectedNodeId];
     } else {
          selectedNodes = network.getSelectedNodes();
          selectedEdges = network.getSelectedEdges();
     }

     if (selectedNodes.length === 0 && selectedEdges.length === 0) {
          // We need a way to show status. Passing showStatus callback?
          // For now, let's return false or throw error? 
          // Or better, return an object indicating success/failure/message
          return { success: false, message: 'Сначала выберите узел или связь для удаления' };
     }

     const message = selectedNodes.length > 0
          ? `Удалить выбранные узлы (${selectedNodes.length}) и их связи?`
          : `Удалить выбранные связи (${selectedEdges.length})?`;

     pendingDeleteNodes = selectedNodes;
     pendingDeleteEdges = selectedEdges;

     const modal = document.getElementById('deleteModal');
     document.getElementById('modalMessage').textContent = message;
     modal.classList.add('active');

     return { success: true };
}

export function closeDeleteModal() {
     document.getElementById('deleteModal').classList.remove('active');
     pendingDeleteNodes = [];
     pendingDeleteEdges = [];
}

export function confirmDelete(nodes, edges, saveCallback, hideNodeInfoCallback) {
     if (pendingDeleteNodes.length > 0) {
          nodes.remove(pendingDeleteNodes);
          if (hideNodeInfoCallback) hideNodeInfoCallback();
     }

     if (pendingDeleteEdges.length > 0) {
          edges.remove(pendingDeleteEdges);
     }

     closeDeleteModal();
     if (saveCallback) saveCallback();
}

// ============ HELP MODAL ============
export function openHelpModal() {
     document.getElementById('helpModal').classList.add('active');
}

export function closeHelpModal() {
     document.getElementById('helpModal').classList.remove('active');
}

// ============ QUIZ MODAL ============
export function showQuizModal(questionData, onAnswerClick) {
     const quizBox = document.getElementById('quiz-container');
     const qText = document.getElementById('q-text');
     const optsBox = document.getElementById('options-box');

     quizBox.style.display = 'flex';
     optsBox.innerHTML = '';
     qText.innerText = questionData.question;

     questionData.answers.forEach((ans, index) => {
          let btn = document.createElement('div');
          btn.className = 'option-btn';
          btn.innerText = `ABCD`[index] + `: ${ans}`;
          btn.onclick = () => onAnswerClick(index, btn);
          optsBox.appendChild(btn);
     });
}

export function closeQuizModal() {
     document.getElementById('quiz-container').style.display = 'none';
}
