// assets/js/auth.js
import { auth, db } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!firebase.apps.length) {
      throw new Error("Firebase non è stato inizializzato correttamente");
    }

    const loginForm = document.getElementById('secretaryLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.username.value.trim();
        const password = loginForm.password.value;
        const errorElement = document.getElementById('errorMessage');

        try {
          const email = `${username}@rari-nantes.tn.it`;
          const userCredential = await auth.signInWithEmailAndPassword(email, password);
          const userDoc = await db.collection('accounts').doc(username).get();

          if (!userDoc.exists) {
            await auth.signOut();
            throw new Error('Account non trovato nel database');
          }

          const userData = userDoc.data();

          if (userData.role === 'admin') {
            window.location.href = 'admin/gestione-password.html';
          } else if (userData.role === 'secretary') {
            window.location.href = 'segreteria/inserimento-dati-tesserati.html';
          } else {
            throw new Error('Ruolo non autorizzato');
          }

        } catch (error) {
          console.error('Login error:', error);
          let errorMessage = 'Errore durante il login';

          if (error.code === 'auth/wrong-password') {
            errorMessage = 'Password errata';
          } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'Utente non trovato';
          } else if (error.message.includes('Firebase non è stato inizializzato')) {
            errorMessage = 'Errore di configurazione del sistema';
          }

          errorElement.textContent = errorMessage;
          errorElement.classList.remove('hidden');
        }
      });
    }
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Errore critico nel sistema di autenticazione');
  }
});
