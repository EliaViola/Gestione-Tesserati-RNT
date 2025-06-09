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

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { user } = await firebase.auth().signInWithEmailAndPassword(email, password);
      const idTokenResult = await user.getIdTokenResult();
      const claims = idTokenResult.claims;

      // Redirect in base al ruolo
      if (claims.admin) {
        window.location.href = 'admin/reset-password.html';
      } else if (claims.secretary) {
        window.location.href = 'segreteria/inserimento.html';
      } else if (claims.director) {
        window.location.href = 'direttore/crea-pacchetto.html';
      } else if (claims.coordinator) {
        window.location.href = 'coordinatore.html';
      } else {
        await firebase.auth().signOut();
        showError('Accesso negato: nessun ruolo assegnato.');
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
