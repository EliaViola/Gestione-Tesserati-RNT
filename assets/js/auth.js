document.addEventListener('DOMContentLoaded', () => {
  const adminBtn = document.getElementById('adminBtn');
  const secretaryBtn = document.getElementById('secretaryBtn');
  const loginForm = document.getElementById('loginForm');
  const authForm = document.getElementById('authForm');
  let currentRole = null;

  // Selezione ruolo
  adminBtn.addEventListener('click', () => {
    currentRole = 'admin';
    loginForm.classList.remove('hidden');
    document.querySelector('.login-header h2').textContent = 'Accesso Amministratore';
  });

  secretaryBtn.addEventListener('click', () => {
    currentRole = 'secretary';
    loginForm.classList.remove('hidden');
    document.querySelector('.login-header h2').textContent = 'Accesso Segreteria';
  });

  // Login
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const email = `${username}@rari-nantes.tn.it`;

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      const idToken = await user.getIdTokenResult();

      // Verifica ruolo
      if ((currentRole === 'admin' && !idToken.claims.admin) || 
          (currentRole === 'secretary' && !idToken.claims.secretary)) {
        await firebase.auth().signOut();
        throw new Error('Non hai i permessi per questo ruolo');
      }

      // Reindirizzamento
      if (currentRole === 'admin') {
        window.location.href = 'admin/gestione-password.html';
      } else {
        window.location.href = 'segreteria/gestione-tesserati.html';
      }

    } catch (error) {
      alert(`Errore di accesso: ${error.message}`);
    }
  });
});
