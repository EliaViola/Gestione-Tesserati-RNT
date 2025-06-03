/**
 * Sistema di Autenticazione Rari Nantes Trento - Versione Firebase
 * Integrazione completa con Firestore per la gestione degli account
 */

const AuthSystem = (() => {
    // Configurazione ruoli e permessi
    const ROLES_CONFIG = {
        secretary: ["insert", "view", "edit"],
        coordinator: ["view", "edit", "approve", "reports"],
        director: ["view", "reports", "finance"],
        admin: ["full_access"]
    };

    // Riferimento al database Firestore
    const accountsRef = firebase.firestore().collection('accounts');

    // API Pubblica
    return {
        initialize: async () => {
            // Verifica se esistono account, altrimenti crea quelli predefiniti
            const snapshot = await accountsRef.get();
            if (snapshot.empty) {
                await this._createDefaultAccounts();
            }
        },

        login: async (username, password) => {
            try {
                // Converti username in email (aggiungendo il dominio)
                const email = `${username}@rari-nantes.tn.it`;
                
                // Autenticazione con Firebase
                const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Recupera i dati aggiuntivi da Firestore
                const accountDoc = await accountsRef.doc(username).get();
                if (!accountDoc.exists) {
                    await firebase.auth().signOut();
                    return { success: false, error: "Account non trovato nel database" };
                }
                
                const accountData = accountDoc.data();
                
                return {
                    success: true,
                    session: {
                        username,
                        name: accountData.name,
                        role: accountData.role,
                        permissions: accountData.permissions || ROLES_CONFIG[accountData.role],
                        lastLogin: new Date().toISOString()
                    }
                };
            } catch (error) {
                console.error("Login error:", error);
                let errorMessage = "Credenziali non valide";
                if (error.code === 'auth/user-not-found') {
                    errorMessage = "Utente non registrato";
                } else if (error.code === 'auth/wrong-password') {
                    errorMessage = "Password errata";
                }
                return { success: false, error: errorMessage };
            }
        },

        logout: async () => {
            try {
                await firebase.auth().signOut();
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        getSession: async () => {
            const user = firebase.auth().currentUser;
            if (!user) return null;
            
            const username = user.email.split('@')[0];
            const accountDoc = await accountsRef.doc(username).get();
            if (!accountDoc.exists) return null;
            
            const accountData = accountDoc.data();
            
            return {
                username,
                name: accountData.name,
                role: accountData.role,
                permissions: accountData.permissions || ROLES_CONFIG[accountData.role],
                lastLogin: new Date().toISOString()
            };
        },

        changePassword: async (username, newPassword) => {
            try {
                const user = firebase.auth().currentUser;
                
                // Verifica che l'utente loggato corrisponda all'username
                if (!user || user.email !== `${username}@rari-nantes.tn.it`) {
                    return { success: false, error: "Non autorizzato" };
                }
                
                await user.updatePassword(newPassword);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // Metodo privato per creare account predefiniti
        _createDefaultAccounts: async () => {
            const defaultAccounts = {
                "segreteria1": {
                    name: "Segreteria 1",
                    password: "Segretaria1!2023", // Verrà sovrascritto dopo
                    role: "secretary",
                    permissions: ["insert", "view", "edit"],
                    email: "segreteria1@rari-nantes.tn.it"
                },
                "segreteria2": {
                    name: "Segreteria 2",
                    password: "Segretaria2!2023",
                    role: "secretary",
                    permissions: ["insert", "view", "edit"],
                    email: "segreteria2@rari-nantes.tn.it"
                },
                "coordinatore": {
                    name: "Coordinatore",
                    password: "Coordinatore!2023",
                    role: "coordinator",
                    permissions: ["view", "edit", "approve", "reports"],
                    email: "coordinatore@rari-nantes.tn.it"
                },
                "direttore": {
                    name: "Direttore",
                    password: "Direttore!2023",
                    role: "director",
                    permissions: ["view", "reports", "finance"],
                    email: "direttore@rari-nantes.tn.it"
                },
                "admin": {
                    name: "Amministratore",
                    password: "AdminMaster!2023",
                    role: "admin",
                    permissions: ["full_access"],
                    email: "admin@rari-nantes.tn.it"
                }
            };

            const batch = db.batch();
            
            for (const [username, accountData] of Object.entries(defaultAccounts)) {
                const accountRef = accountsRef.doc(username);
                batch.set(accountRef, {
                    name: accountData.name,
                    role: accountData.role,
                    permissions: accountData.permissions,
                    email: accountData.email
                });
                
                // Crea l'utente in Firebase Authentication
                try {
                    await firebase.auth().createUserWithEmailAndPassword(
                        accountData.email,
                        accountData.password
                    );
                } catch (error) {
                    console.warn(`User ${username} may already exist:`, error.message);
                }
            }
            
            await batch.commit();
            console.log("Account predefiniti creati con successo");
        }
    };
})();

// Gestione del form di login
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await AuthSystem.initialize();

        const loginForm = document.getElementById('secretaryLoginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = loginForm.username.value.trim();
                const password = loginForm.password.value;

                const result = await AuthSystem.login(username, password);

                const errorElement = document.getElementById('errorMessage');
                if (result.success) {
                    // Reindirizzamento basato sul ruolo
                    switch(result.session.role) {
                        case 'secretary':
                            window.location.href = 'segreteria/inserimento-dati-tesserati.html';
                            break;
                        case 'admin':
                            window.location.href = '../admin/gestione-password.html';
                            break;
                        default:
                            window.location.href = 'dashboard.html';
                    }
                } else {
                    errorElement.textContent = result.error || "Errore durante il login";
                    errorElement.classList.remove('hidden');
                    setTimeout(() => {
                        errorElement.classList.add('hidden');
                    }, 5000);
                }
            });
        }
    } catch (error) {
        console.error("Initialization error:", error);
    }
});
