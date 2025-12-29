export function showNodeInfo(nodeId, nodes, onQuizClick, onAutoLinkClick) {
     const node = nodes.get(nodeId);
     if (!node) return;

     document.getElementById('nodeTitle').textContent = node.label;
     document.getElementById('nodeDesc').textContent = node.description || 'Нет описания';
     document.getElementById('nodeInfo').classList.add('active');

     // Quiz button
     const quizBtn = document.getElementById('startQuizBtn');
     if (quizBtn) {
          const newBtn = quizBtn.cloneNode(true);
          quizBtn.parentNode.replaceChild(newBtn, quizBtn);
          newBtn.onclick = () => onQuizClick(node);
     }

     // Auto-Link button
     const linkBtn = document.getElementById('autoLinkBtn');
     if (linkBtn) {
          const newLinkBtn = linkBtn.cloneNode(true);
          linkBtn.parentNode.replaceChild(newLinkBtn, linkBtn);
          newLinkBtn.onclick = () => onAutoLinkClick && onAutoLinkClick(node);
     }
}

export function hideNodeInfo() {
     document.getElementById('nodeInfo').classList.remove('active');
}
