document.addEventListener('DOMContentLoaded', async () => {
  // Elementi del form
  const form = document.getElementById('passwordChangeForm');
  const currentPassword = document.getElementById('currentPassword');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const errorElement = document.getElementById('errorMessage');
  const successElement = document.getElementById('successMessage');
  const spinner = document.getElementById('spinner');
  const submitButton = document.getElementById('submitButton');
  const logoutButton = document.getElementById('logoutButton');

  // Verifica autenticazione
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = 'login.html';
    }
  });

  // Logout
  logoutButton.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await firebase.auth().signOut();
      window.location.href = 'login.html';
    } catch (error) {
      showError('Errore durante il logout: ' + error.message);
    }
  });

  // Submit form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Reset messaggi
    hideMessages();
    
    // Validazione
    if (newPassword.value !== confirmPassword.value) {
      showError('Le nuove password non coincidono');
      return;
    }

    if (!isPasswordValid(newPassword.value)) {
      showError('La password deve contenere almeno 8 caratteri, includendo una maiuscola, un numero e un carattere speciale');
      return;
    }

    try {
      showLoading();
      
      const user = firebase.auth().currentUser;
      const email = user.email;
      const credential = firebase.auth.EmailAuthProvider.credential(
        email,
        currentPassword.value
      );

      // Verifica password corrente
      await user.reauthenticateWithCredential(credential);
      
      // Aggiorna password
      await user.updatePassword(newPassword.value);
      
      showSuccess('Password aggiornata con successo!');
      form.reset();
    } catch (error) {
      console.error('Error changing password:', error);
      
      let errorMessage = 'Errore durante l\'aggiornamento della password';
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage = 'La password attuale non è corretta';
          break;
        case 'auth/weak-password':
          errorMessage = 'La password è troppo debole';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'La sessione è scaduta, effettua il login nuovamente';
          setTimeout(() => {
            firebase.auth().signOut();
            window.location.href = 'login.html';
          }, 3000);
          break;
      }
      
      showError(errorMessage);
    } finally {
      hideLoading();
    }
  });

  // Funzioni di supporto
  function isPasswordValid(password) {
    const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  }

  function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }

  function showSuccess(message) {
    successElement.textContent = message;
    successElement.classList.remove('hidden');
  }

  function hideMessages() {
    errorElement.classList.add('hidden');
    successElement.classList.add('hidden');
  }

  function showLoading() {
    submitButton.disabled = true;
    spinner.classList.remove('hidden');
  }

  function hideLoading() {
    submitButton.disabled = false;
    spinner.classList.add('hidden');
  }
});
