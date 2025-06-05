const AuthSystem = (() => {
    const CONFIG = {
        SESSION_KEY: 'rn_auth_v2',
        ACCOUNTS_KEY: 'rn_accounts_v2',
        ADMIN_PASSWORD: 'AdminMaster!2023'
    };

    const DEFAULT_ACCOUNTS = {
        "segreteria1": {
            name: "Segreteria 1",
            password: "Segretaria1!2023",
            permissions: ["insert", "view", "edit"],
            role: "secretary"
        },
        "segreteria2": {
            name: "Segreteria 2",
            password: "Segretaria2!2023",
            permissions: ["insert", "view", "edit"],
            role: "secretary"
        },
        "coordinatore": {
            name: "Coordinatore",
            password: "Coordinatore!2023",
            permissions: ["view", "edit", "approve", "reports"],
            role: "coordinator"
        },
        "direttore": {
            name: "Direttore",
            password: "Direttore!2023",
            permissions: ["view", "reports", "finance"],
            role: "director"
        },
        "admin": {
            name: "Amministratore",
            password: CONFIG.ADMIN_PASSWORD,
            permissions: ["full_access"],
            role: "admin"
        }
    };

    const initialize = () => {
        if (!localStorage.getItem(CONFIG.ACCOUNTS_KEY)) {
            localStorage.setItem(CONFIG.ACCOUNTS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
        }
    };

    return {
        initialize,

        login: (username, password) => {
            const accounts = JSON.parse(localStorage.getItem(CONFIG.ACCOUNTS_KEY)) || {};
            const account = accounts[username];

            if (!account || account.password !== password) {
                return { success: false };
            }

            const session = {
                username,
                name: account.name,
                role: account.role,
                permissions: account.permissions,
                lastLogin: new Date().toISOString()
            };

            sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
            return { success: true, session };
        },

        logout: () => {
            sessionStorage.removeItem(CONFIG.SESSION_KEY);
        },

        getSession: () => {
            return JSON.parse(sessionStorage.getItem(CONFIG.SESSION_KEY));
        },

        getAllAccounts: (adminPassword) => {
            if (adminPassword !== CONFIG.ADMIN_PASSWORD) return null;
            return JSON.parse(localStorage.getItem(CONFIG.ACCOUNTS_KEY));
        },

        changePassword: (username, oldPass, newPass) => {
            const accounts = JSON.parse(localStorage.getItem(CONFIG.ACCOUNTS_KEY)) || {};
            if (!accounts[username] || accounts[username].password !== oldPass) {
                return false;
            }
            accounts[username].password = newPass;
            localStorage.setItem(CONFIG.ACCOUNTS_KEY, JSON.stringify(accounts));
            return true;
        },

        renderProfile: () => {
            const profileContainer = document.getElementById('userProfile');
            const session = AuthSystem.getSession();
            if (!profileContainer || !session) return;

            const date = new Date(session.lastLogin).toLocaleString('it-IT');
            profileContainer.innerHTML = `
                <div class="profile-box">
                    <h3>Profilo Utente</h3>
                    <p><strong>Nome:</strong> ${session.name}</p>
                    <p><strong>Username:</strong> ${session.username}</p>
                    <p><strong>Ruolo:</strong> ${session.role}</p>
                    <p><strong>Permessi:</strong> ${session.permissions.join(', ')}</p>
                    <p><strong>Ultimo accesso:</strong> ${date}</p>
                    <button id="logoutBtn" class="btn btn-danger mt-2">Esci</button>
                </div>
            `;

            document.getElementById('logoutBtn').addEventListener('click', () => {
                AuthSystem.logout();
                window.location.href = 'login.html';
            });
        }
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    AuthSystem.initialize();

    const loginForm = document.getElementById('secretaryLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = loginForm.username.value.trim();
            const password = loginForm.password.value;

            const result = AuthSystem.login(username, password);

            if (result.success) {
                if (username === 'segreteria1' || username === 'segreteria2') {
                    window.location.href = '/Gestione-Tesserati-RNT/segreteria/inserimento-dati-tesserati.html';
                } 
                if (username === 'admin'){
                    window.location.href = '/Gestione-Tesserati-RNT/admin/reset-password.html';
                }
            } else {
                document.getElementById('errorMessage').style.display = 'block';
            }
        });
    }

    // Se siamo in una pagina con profilo, lo renderizziamo
    AuthSystem.renderProfile();
});
