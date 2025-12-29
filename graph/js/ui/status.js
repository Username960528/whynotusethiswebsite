export function showStatus(type, message) {
     const status = document.getElementById('status');
     if (!status) return;

     status.textContent = message;
     status.className = `status ${type}`;
     status.style.display = 'block';
}

export function hideStatus() {
     const status = document.getElementById('status');
     if (status) {
          status.style.display = 'none';
     }
}
