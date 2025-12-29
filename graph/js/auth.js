export const AUTH_KEY = 'qa_kg_user';

export function getCurrentUser() {
     const user = localStorage.getItem(AUTH_KEY);
     return user ? JSON.parse(user) : null;
}

export function login(username) {
     if (!username) return;
     const user = { username };
     localStorage.setItem(AUTH_KEY, JSON.stringify(user));
     return user;
}

export function logout() {
     localStorage.removeItem(AUTH_KEY);
     window.location.reload();
}

export function requireAuth() {
     const user = getCurrentUser();
     if (!user) {
          showLoginModal();
          return false;
     }
     return true;
}

function showLoginModal() {
     let modal = document.getElementById('loginModal');
     if (!modal) {
          createLoginModal();
          modal = document.getElementById('loginModal');
     }
     modal.style.display = 'flex';
}

function createLoginModal() {
     const div = document.createElement('div');
     div.id = 'loginModal';
     div.className = 'modal-overlay';
     div.style.display = 'none'; // Hidden by default
     div.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-title">👋 Welcome to QA Graph</div>
            <div class="modal-message">
                <p>Enter your username to access your personal knowledge graphs.</p>
                <input type="text" id="loginUsername" placeholder="Username (e.g. qa_guru)" style="width: 100%; padding: 10px; margin-top: 15px; background: #2a2a3a; border: 1px solid #444; color: #fff; border-radius: 4px;">
            </div>
            <div class="modal-buttons">
                <button class="modal-btn confirm" id="loginBtn" style="width: 100%;">Login</button>
            </div>
        </div>
    `;
     document.body.appendChild(div);

     const btn = document.getElementById('loginBtn');
     const input = document.getElementById('loginUsername');

     const handleLogin = async () => {
          const username = input.value.trim();
          if (!username) return alert('Please enter a username');

          try {
               const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
               });

               if (res.ok) {
                    const data = await res.json();
                    login(data.username);
                    document.getElementById('loginModal').style.display = 'none';
                    window.location.reload(); // Reload to fetch user data
               } else {
                    alert('Login failed');
               }
          } catch (e) {
               console.error(e);
               alert('Login error');
          }
     };

     btn.onclick = handleLogin;
     input.onkeypress = (e) => {
          if (e.key === 'Enter') handleLogin();
     };
}
