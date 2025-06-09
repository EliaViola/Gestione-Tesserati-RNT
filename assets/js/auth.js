document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('secretaryLoginForm');
  const errorMessage = document.getElementById('errorMessage');
  const loginButton = document.getElementById('loginButton');
  const spinner = document.getElementById('spinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showError('Inserisci email e password.');
      return;
    }

    try {
      toggleLoading(true);

      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      const idToken = await user.getIdTokenResult();

      if (idToken.claims.secretary) {
        window.location.href = 'pages/inserimento.html';
      } else {
        await firebase.auth().signOut();
        showError('Accesso non autorizzato: ruolo mancante.');
      }
    } catch (error) {
      console.error(error);
      showError('Credenziali non valide o errore di rete.');
    } finally {
      toggleLoading(false);
    }
  });

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
      errorMessage.classList.add('hidden');
    }, 5000);
  }

  function toggleLoading(isLoading) {
    loginButton.disabled = isLoading;
    spinner.classList.toggle('hidden', !isLoading);
  }
});
