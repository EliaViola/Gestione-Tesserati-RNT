document.addEventListener('DOMContentLoaded', async () => {
  // Inizializzazione
  const form = document.getElementById('tesseratoForm');
  const feedbackElement = document.getElementById('feedbackMessage');
  const submitBtn = document.getElementById('submitBtn');
  const spinner = document.getElementById('formSpinner');
  const logoutBtn = document.getElementById('logoutBtn');
  
  // Aggiorna anno footer
  document.getElementById('currentYear').textContent = new Date().getFullYear();

  // Verifica autenticazione e ruolo
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }
    
    try {
      const idToken = await user.getIdTokenResult();
      if (!idToken.claims.secretary) {
        await firebase.auth().signOut();
        window.location.href = '../../index.html';
      }
    } catch (error) {
      console.error('Error verifying role:', error);
      window.location.href = '../../index.html';
    }
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    try {
      await firebase.auth().signOut();
      window.location.href = '../../index.html';
    } catch (error) {
      showFeedback('Errore durante il logout', 'error');
    }
  });

  // Gestione submit form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!form.checkValidity()) {
      showFeedback('Compila tutti i campi obbligatori correttamente', 'error');
      return;
    }

    try {
      toggleLoading(true);
      
      const formData = new FormData(form);
      const tesserato = {
        anagrafica: {
          nome: formData.get('nome').trim(),
          cognome: formData.get('cognome').trim(),
          data_nascita: formData.get('data_nascita'),
          luogo_nascita: formData.get('luogo_nascita')?.trim(),
          codice_fiscale: formData.get('codice_fiscale')?.toUpperCase(),
          genere: formData.get('genere')
        },
        contatti: {
          indirizzo: formData.get('indirizzo')?.trim(),
          cap: formData.get('cap'),
          citta: formData.get('citta')?.trim(),
          provincia: formData.get('provincia')?.toUpperCase(),
          telefono: formData.get('telefono'),
          email: formData.get('email').toLowerCase()
        },
        tesseramento: {
          numero: formData.get('tessera').toUpperCase(),
          data_iscrizione: new Date(),
          stato: 'attivo'
        },
        metadata: {
          creato_il: firebase.firestore.FieldValue.serverTimestamp(),
          creato_da: firebase.auth().currentUser.uid,
          ultima_modifica: firebase.firestore.FieldValue.serverTimestamp()
        }
      };

      // Salva su Firestore
      await firebase.firestore().collection('tesserati').add(tesserato);
      
      showFeedback('Tesserato salvato con successo!', 'success');
      form.reset();
      
    } catch (error) {
      console.error('Errore salvataggio:', error);
      showFeedback(`Errore durante il salvataggio: ${error.message}`, 'error');
    } finally {
      toggleLoading(false);
    }
  });

  // Funzioni di supporto
  function showFeedback(message, type) {
    feedbackElement.textContent = message;
    feedbackElement.className = `feedback-msg ${type}`;
    feedbackElement.classList.remove('hidden');
    
    setTimeout(() => {
      feedbackElement.classList.add('hidden');
    }, 5000);
  }

  function toggleLoading(isLoading) {
    submitBtn.disabled = isLoading;
    spinner.classList.toggle('hidden', !isLoading);
  }
});
