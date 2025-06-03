document.addEventListener('DOMContentLoaded', async () => {
  // Elementi della pagina
  const userProfile = document.getElementById('userProfile');
  const logoutButton = document.getElementById('logoutButton');
  const searchInput = document.getElementById('searchInput');
  const tableBody = document.getElementById('usersTableBody');
  
  // Aggiorna anno footer
  document.getElementById('currentYear').textContent = new Date().getFullYear();

  try {
    // Verifica autenticazione e ruolo admin
    const user = await new Promise((resolve) => {
      const unsubscribe = firebase.auth().onAuthStateChanged(user => {
        unsubscribe();
        resolve(user);
      });
    });

    if (!user) {
      window.location.href = '../index.html';
      return;
    }

    const idToken = await user.getIdTokenResult();
    if (!idToken.claims.admin) {
      alert('Accesso negato: solo gli amministratori possono accedere a questa pagina');
      window.location.href = '../index.html';
      return;
    }

    // Mostra profilo admin
    userProfile.innerHTML = `
      <h3>Profilo Amministratore</h3>
      <p><strong>Nome:</strong> ${user.displayName || 'N/D'}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Ultimo accesso:</strong> ${new Date(user.metadata.lastSignInTime).toLocaleString('it-IT')}</p>
    `;

    // Logout
    logoutButton.addEventListener('click', async () => {
      try {
        await firebase.auth().signOut();
        window.location.href = '../index.html';
      } catch (error) {
        console.error('Logout error:', error);
        alert('Errore durante il logout');
      }
    });

    // Carica gli utenti
    const loadUsers = async (filter = '') => {
      try {
        const snapshot = await firebase.firestore().collection('accounts')
          .orderBy('name')
          .get();

        tableBody.innerHTML = '';

        if (snapshot.empty) {
          tableBody.innerHTML = '<tr><td colspan="6">Nessun utente trovato</td></tr>';
          return;
        }

        snapshot.forEach(doc => {
          const userData = doc.data();
          const username = doc.id;
          
          // Applica filtro se presente
          if (filter && 
              !username.toLowerCase().includes(filter.toLowerCase()) && 
              !userData.name.toLowerCase().includes(filter.toLowerCase())) {
            return;
          }

          const lastLogin = userData.lastLogin 
            ? new Date(userData.lastLogin).toLocaleString('it-IT') 
            : 'Mai effettuato';

          const status = userData.disabled 
            ? '<span class="status-badge status-inactive">Disabilitato</span>' 
            : '<span class="status-badge status-active">Attivo</span>';

          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${username}</td>
            <td>${userData.name}</td>
            <td>${userData.role}</td>
            <td>${status}</td>
            <td>${lastLogin}</td>
            <td>
              <button class="reset-btn" data-email="${userData.email}">Reimposta Password</button>
            </td>
          `;
          tableBody.appendChild(row);
        });

        // Aggiungi event listener ai pulsanti
        document.querySelectorAll('.reset-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const email = e.target.dataset.email;
            await resetUserPassword(email);
          });
        });

      } catch (error) {
        console.error('Error loading users:', error);
        tableBody.innerHTML = '<tr><td colspan="6">Errore nel caricamento degli utenti</td></tr>';
      }
    };

    // Funzione per reimpostare la password
    const resetUserPassword = async (email) => {
      if (!confirm(`Inviare email di reset password a ${email}?`)) {
        return;
      }

      try {
        await firebase.auth().sendPasswordResetEmail(email);
        
        // Registra l'azione nel log
        await firebase.firestore().collection('admin_logs').add({
          adminId: user.uid,
          action: `Password reset requested for ${email}`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(`Email di reset inviata a ${email}`);
      } catch (error) {
        console.error('Password reset error:', error);
        alert(`Errore: ${error.message}`);
      }
    };

    // Ricerca live
    searchInput.addEventListener('input', () => {
      loadUsers(searchInput.value.trim());
    });

    // Caricamento iniziale
    loadUsers();

  } catch (error) {
    console.error('Initialization error:', error);
    window.location.href = '../index.html';
  }
});
