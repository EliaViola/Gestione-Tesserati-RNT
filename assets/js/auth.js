document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const feedbackElement = document.getElementById('feedbackMessage');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showFeedback('Inserisci email e password', 'error');
      return;
    }

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Controllo ruolo
      const idToken = await user.getIdTokenResult();
      if (idToken.claims.secretary) {
        window.location.href = 'pages/inserimento.html';
      } else {
        await firebase.auth().signOut();
        showFeedback('Accesso negato: ruolo non autorizzato.', 'error');
      }
    } catch (error) {
      console.error('Errore login:', error);
      showFeedback('Credenziali non valide o errore di rete.', 'error');
    }
  });

  function showFeedback(message, type) {
    feedbackElement.textContent = message;
    feedbackElement.className = `feedback-msg ${type}`;
    feedbackElement.classList.remove('hidden');
    setTimeout(() => {
      feedbackElement.classList.add('hidden');
    }, 5000);
  }
});
