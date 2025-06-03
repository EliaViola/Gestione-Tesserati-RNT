document.addEventListener('DOMContentLoaded', async () => {
    // Inizializza Firebase
    try {
        // Configurazione Firebase (deve corrispondere a firebase-config.js)
        const firebaseConfig = {
            apiKey: "AIzaSyBVcNJhXiytEKBtC09T3kbykVzAY0AHZmM",
            authDomain: "rari-nantes-tesserati.firebaseapp.com",
            projectId: "rari-nantes-tesserati",
            storageBucket: "rari-nantes-tesserati.appspot.com",
            messagingSenderId: "435337228811",
            appId: "1:435337228811:web:a5f1fd0fb9e17bfbc00d0e"
        };
        
        // Inizializza Firebase se non è già inizializzato
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // Gestione del form di login
        const loginForm = document.getElementById('secretaryLoginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = loginForm.username.value.trim();
                const password = loginForm.password.value;
                const errorElement = document.getElementById('errorMessage');

                try {
                    // 1. Effettua il login
                    const email = `${username}@rari-nantes.tn.it`;
                    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                    
                    // 2. Verifica il ruolo nell'account Firestore
                    const db = firebase.firestore();
                    const userDoc = await db.collection('accounts').doc(username).get();
                    
                    if (!userDoc.exists) {
                        throw new Error('Account non trovato nel database');
                    }
                    
                    const userData = userDoc.data();
                    
                    // 3. Reindirizzamento in base al ruolo
                    if (userData.role === 'admin') {
                        window.location.href = 'admin/gestione-password.html';
                    } else if (userData.role === 'secretary') {
                        window.location.href = 'segreteria/inserimento-dati-tesserati.html';
                    } else {
                        throw new Error('Ruolo non autorizzato');
                    }
                    
                } catch (error) {
                    console.error('Login error:', error);
                    
                    // Gestione errori specifici
                    let errorMessage = 'Errore durante il login';
                    if (error.code === 'auth/wrong-password') {
                        errorMessage = 'Password errata';
                    } else if (error.code === 'auth/user-not-found') {
                        errorMessage = 'Utente non trovato';
                    }
                    
                    // Mostra l'errore all'utente
                    errorElement.textContent = errorMessage;
                    errorElement.style.display = 'block';
                    
                    // Nascondi il messaggio dopo 5 secondi
                    setTimeout(() => {
                        errorElement.style.display = 'none';
                    }, 5000);
                }
            });
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
