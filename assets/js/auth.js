document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorElement = document.getElementById('errorMessage');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const email = `${username}@rari-nantes.tn.it`;

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      const idToken = await user.getIdTokenResult();

      // Reindirizzamento in base al ruolo
      if (idToken.claims.admin) {
        window.location.href = 'admin/gestione-password.html';
      } else if (idToken.claims.secretary) {
        window.location.href = 'segreteria/inserimento-dati.html';
      } else {
        throw new Error('Ruolo non autorizzato');
      }

    } catch (error) {
      errorElement.textContent = 'Credenziali non valide o permessi insufficienti';
      errorElement.classList.remove('hidden');
      console.error('Login error:', error);
    }
  });
});
