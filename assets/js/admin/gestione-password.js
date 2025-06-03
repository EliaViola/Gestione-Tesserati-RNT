document.addEventListener('DOMContentLoaded', async () => {
  // Elementi della pagina
  const usersTableBody = document.getElementById('usersTableBody');
  const searchInput = document.getElementById('searchInput');
  const errorElement = document.getElementById('errorMessage');
  const logoutButton = document.getElementById('logoutButton');

  // Verifica ruolo admin
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const idTokenResult = await user.getIdTokenResult();
      if (idTokenResult.claims.role !== 'admin') {
        window.location.href = 'login.html';
        return;
      }

      // Carica gli utenti
      loadUsers();
    } catch (error) {
      console.error('Error verifying admin role:', error);
      window.location.href = 'login.html';
    }
  });

  // Logout
  logoutButton.addEventListener('click', () => {
    firebase.auth().signOut()
      .then(() => window.location.href = 'login.html')
      .catch(error => showError('Errore durante il logout'));
  });

  // Ricerca utenti
  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    const rows = usersTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
      const username = row.cells[0].textContent.toLowerCase();
      row.style.display = username.includes(searchTerm) ? '' : 'none';
    });
  });

  // Carica gli utenti da Firestore
  async function loadUsers() {
    try {
      const snapshot = await firebase.firestore().collection('users').get();
      
      if (snapshot.empty) {
        showError('Nessun utente trovato');
        return;
      }

      usersTableBody.innerHTML = '';
      
      snapshot.forEach(doc => {
        const user = doc.data();
        const row = document.createElement('tr');
        
        row.innerHTML = `
          <td>${doc.id}</td>
          <td>${user.name || '-'}</td>
          <td><span class="badge ${getBadgeClass(user.role)}">${user.role}</span></td>
          <td>${formatDate(user.lastLogin)}</td>
          <td>
            <button class="btn-small btn-reset" data-username="${doc.id}">Reimposta Password</button>
          </td>
        `;
        
        usersTableBody.appendChild(row);
      });

      // Aggiungi event listener ai pulsanti
      document.querySelectorAll('.btn-reset').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const username = e.target.dataset.username;
          resetUserPassword(username);
        });
      });
      
    } catch (error) {
      console.error('Error loading users:', error);
      showError('Errore nel caricamento degli utenti');
    }
  }

  // Reimposta password utente
  async function resetUserPassword(username) {
    if (!confirm(`Sicuro di voler reimpostare la password per ${username}? Verrà inviata una email di reset.`)) {
      return;
    }

    try {
      const userEmail = `${username}@rari-nantes.tn.it`;
      await firebase.auth().sendPasswordResetEmail(userEmail);
      alert(`Email di reset password inviata a ${userEmail}`);
    } catch (error) {
      console.error('Error resetting password:', error);
      showError('Errore durante il reset della password');
    }
  }

  // Funzioni di supporto
  function getBadgeClass(role) {
    switch (role) {
      case 'admin': return 'badge-admin';
      case 'secretary': return 'badge-secretary';
      default: return 'badge-default';
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleString('it-IT');
  }

  function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    setTimeout(() => errorElement.classList.add('hidden'), 5000);
  }
});
