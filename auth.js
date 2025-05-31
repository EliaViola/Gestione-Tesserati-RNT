/**
 * Sistema di Autenticazione Rari Nantes Trento - Versione 2.0
 * Completo con tutti gli account e gestione password
 */

const AuthSystem = (() => {
    // Configurazione
    const CONFIG = {
        SESSION_KEY: 'rn_auth_v2',
        ACCOUNTS_KEY: 'rn_accounts_v2',
        ADMIN_PASSWORD: 'AdminMaster!2023' // Password per visualizzazione
    };

    // Tutti gli account predefiniti (in chiaro per semplicità, in produzione usare crittografia)
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

    // Inizializzazione
    const initialize = () => {
        if (!localStorage.getItem(CONFIG.ACCOUNTS_KEY)) {
            localStorage.setItem(CONFIG.ACCOUNTS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
        }
    };

    // API Pubblica
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
                // Reindirizzamento personalizzato per segreteria1 e segreteria2
                if (username === 'segreteria1' || username === 'segreteria2') {
                    window.location.href = 'segreteria/inserimento-dati-tesserati.html';
                } else {
                    window.location.href = 'admin/visualizza-password.html';
                }
            } else {
                document.getElementById('errorMessage').style.display = 'block';
            }
        });
    }
});