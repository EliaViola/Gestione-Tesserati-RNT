// assets/js/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('secretaryLoginForm');
  const errorMsg = document.getElementById('errorMessage');
  const spinner = document.getElementById('spinner');
  const loginButton = document.getElementById('loginButton');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');
    spinner.classList.remove('hidden');
    loginButton.disabled = true;

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      // Login con Firebase
      const { user } = await firebase.auth().signInWithEmailAndPassword(email, password);

      // Recupera i custom claims
      const idTokenResult = await user.getIdTokenResult();

      if (idTokenResult.claims.secretary) {
        // Se è un segretario → vai alla pagina protetta
        window.location.href = 'pages/inserimento.html';
      } else {
        // Se non ha il ruolo → logout + messaggio
        await firebase.auth().signOut();
        showError('Accesso negato: non sei autorizzato.');
      }
    } catch (error) {
      console.error('Errore login:', error);
      showError('Credenziali non valide o errore di rete.');
    } finally {
      spinner.classList.add('hidden');
      loginButton.disabled = false;
    }
  });

  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
  }
});
