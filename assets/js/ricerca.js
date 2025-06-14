// Definizione delle funzioni globali
window.eseguiRicerca = function() {};
window.resetRicerca = function() {};
window.modificaTesserato = function(id) { window.location.href = `dettaglio-tesserato.html?id=${id}`; };
window.modificaCorso = function(id) { window.location.href = `modifica-corsi.html?id=${id}`; };
window.eliminaTesserato = function(id) {};
window.eliminaCorso = function(id) {};

document.addEventListener('DOMContentLoaded', function() {
  try {
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase non è stato caricato correttamente');
    }
    
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Mostra feedback all'utente
    function showFeedback(message, type = 'success') {
      const feedback = document.createElement('div');
      feedback.className = `feedback-msg ${type}`;
      feedback.textContent = message;
      document.body.appendChild(feedback);
      
      setTimeout(() => feedback.remove(), 5000);
    }

    // Carica tesserati con filtri
    async function loadTesseratiFiltrati(filtroNome, filtroCognome, filtroCodiceFiscale) {
      try {
        let query = db.collection("tesserati");
        
        // Aggiungi filtri alla query solo se presenti
        if (filtroNome) {
          query = query.where("anagrafica.nome", ">=", filtroNome)
                       .where("anagrafica.nome", "<=", filtroNome + '\uf8ff');
        }
        
        if (filtroCognome) {
          query = query.where("anagrafica.cognome", ">=", filtroCognome)
                       .where("anagrafica.cognome", "<=", filtroCognome + '\uf8ff');
        }
        
        if (filtroCodiceFiscale) {
          query = query.where("anagrafica.codice_fiscale", "==", filtroCodiceFiscale.toUpperCase());
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          nomeCompleto: `${doc.data().anagrafica?.cognome || ''} ${doc.data().anagrafica?.nome || ''}`.trim()
        }));
      } catch (error) {
        console.error("Errore caricamento tesserati:", error);
        showFeedback("Errore nel caricamento dei tesserati", 'error');
        throw error;
      }
    }

    // Carica corsi con filtri
    async function loadCorsiFiltrati(filtroCorso) {
      try {
        let query = db.collection("corsi");
        
        if (filtroCorso) {
          query = query.where("tipologia", "==", filtroCorso);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data()
        }));
      } catch (error) {
        console.error("Errore caricamento corsi:", error);
        showFeedback("Errore nel caricamento dei corsi", 'error');
        throw error;
      }
    }

    // Funzione principale di ricerca
    async function eseguiRicerca() {
      const filtroNome = document.getElementById('filtro-nome').value.toLowerCase();
      const filtroCognome = document.getElementById('filtro-cognome').value.toLowerCase();
      const filtroCodiceFiscale = document.getElementById('filtro-codice-fiscale').value;
      const filtroCorso = document.getElementById('filtro-corso').value;
      
      try {
        // Mostra spinner durante il caricamento
        document.getElementById('corpoTabellaTesserati').innerHTML = `
          <tr>
            <td colspan="7" class="loading-msg">
              <i class="fas fa-spinner fa-spin"></i> Ricerca tesserati in corso...
            </td>
          </tr>`;
        
        document.getElementById('corpoTabellaCorsi').innerHTML = `
          <tr>
            <td colspan="7" class="loading-msg">
              <i class="fas fa-spinner fa-spin"></i> Ricerca corsi in corso...
            </td>
          </tr>`;
        
        // Esegui le query in parallelo solo se ci sono filtri attivi
        const [tesserati, corsi] = await Promise.all([
          (filtroNome || filtroCognome || filtroCodiceFiscale) ? 
            loadTesseratiFiltrati(filtroNome, filtroCognome, filtroCodiceFiscale) : 
            Promise.resolve([]),
          
          filtroCorso ? 
            loadCorsiFiltrati(filtroCorso) : 
            Promise.resolve([])
        ]);
        
        // Mostra i risultati
        mostraTesseratiFiltrati(tesserati);
        mostraCorsiFiltrati(corsi);
        
      } catch (error) {
        console.error("Errore durante la ricerca:", error);
        showFeedback("Errore durante la ricerca dei dati", 'error');
      }
    }

    // Mostra i tesserati filtrati
    function mostraTesseratiFiltrati(tesserati) {
      const corpoTesserati = document.getElementById('corpoTabellaTesserati');
      corpoTesserati.innerHTML = '';
      
      if (tesserati.length === 0) {
          corpoTesserati.innerHTML = `
            <tr>
              <td colspan="7" class="nessun-risultato">
                Nessun tesserato trovato con i filtri selezionati
              </td>
            </tr>`;
          return;
      }

      tesserati.forEach(tesserato => {
        const anagrafica = tesserato.anagrafica || {};
        const contatti = tesserato.contatti || {};
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${anagrafica.nome || 'N/D'}</td>
          <td>${anagrafica.cognome || 'N/D'}</td>
          <td>${anagrafica.codice_fiscale || 'N/D'}</td>
          <td>${anagrafica.data_nascita ? new Date(anagrafica.data_nascita).toLocaleDateString('it-IT') : 'N/D'}</td>
          <td>${contatti.telefono || 'N/D'}</td>
          <td>${contatti.email || 'N/D'}</td>
          <td class="actions-cell">
            <button class="btn btn-small btn-edit" onclick="modificaTesserato('${tesserato.id}')">
              <i class="fas fa-edit"></i> Modifica
            </button>
            <button class="btn btn-small btn-delete" onclick="eliminaTesserato('${tesserato.id}')">
              <i class="fas fa-trash-alt"></i> Elimina
            </button>
          </td>
        `;
        corpoTesserati.appendChild(row);
      });
    }

    // Aggiungi questa funzione PRIMA di dove viene usata (prima di mostraCorsiFiltrati)
function getCorsoName(tipo) {
  const names = {
    'avviamento': 'Avviamento',
    'principianti': 'Principianti',
    'intermedio': 'Intermedio',
    'perfezionamento': 'Perfezionamento',
    'cuffiegb': 'Cuffie Giallo Blu',
    'calottegb': 'Calottine Giallo Blu',
    'propaganda': 'Propaganda',
    'agonisti': 'Agonisti',
    'pallanuoto': 'Pallanuoto'
  };
  return names[tipo] || tipo;
}

// Aggiungi anche questa funzione per formattare i giorni
function formatGiorni(giorni) {
  const giorniMap = {
    'lun': 'Lunedì',
    'mar': 'Martedì',
    'mer': 'Mercoledì',
    'gio': 'Giovedì',
    'ven': 'Venerdì'
  };
  
  return Array.isArray(giorni) ? 
    giorni.map(g => giorniMap[g] || g).join(', ') : 
    'N/D';
}

// Poi modifica la funzione mostraCorsiFiltrati così:
function mostraCorsiFiltrati(corsi) {
  const corpoCorsi = document.getElementById('corpoTabellaCorsi');
  corpoCorsi.innerHTML = '';
  
  if (corsi.length === 0) {
    corpoCorsi.innerHTML = `
      <tr>
        <td colspan="7" class="nessun-risultato">
          Nessun corso trovato con i filtri selezionati
        </td>
      </tr>`;
    return;
  }

  corsi.forEach(corso => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${corso.iscritti?.length ? corso.iscritti[0] : 'N/D'}</td>
      <td>${getCorsoName(corso.tipologia)}</td>
      <td>${corso.livello || 'N/D'}</td>
      <td>${corso.giorni ? formatGiorni(corso.giorni) : 'N/D'}</td>
      <td>${corso.orario || 'N/D'}</td>
      <td>${corso.istruttore || 'N/D'}</td>
      <td class="actions-cell">
        <button class="btn btn-small btn-edit" onclick="modificaCorso('${corso.id}')">
          <i class="fas fa-edit"></i> Modifica
        </button>
        <button class="btn btn-small btn-delete" onclick="eliminaCorso('${corso.id}')">
          <i class="fas fa-trash-alt"></i> Elimina
        </button>
      </td>
    `;
    corpoCorsi.appendChild(row);
  });
}

// Funzione helper per i nomi dei corsi
function getCorsoName(tipo) {
  const names = {
    'avviamento': 'Avviamento',
    'principianti': 'Principianti',
    'intermedio': 'Intermedio',
    'perfezionamento': 'Perfezionamento',
    'cuffiegb': 'Cuffie Giallo Blu',
    'calottegb': 'Calottine Giallo Blu',
    'propaganda': 'Propaganda',
    'agonisti': 'Agonisti',
    'pallanuoto': 'Pallanuoto'
  };
  return names[tipo] || tipo;
}

// Funzione helper per formattare i giorni
function formatGiorni(giorni) {
  const giorniMap = {
    'lun': 'Lunedì',
    'mar': 'Martedì',
    'mer': 'Mercoledì',
    'gio': 'Giovedì',
    'ven': 'Venerdì'
  };
  
  return Array.isArray(giorni) ? 
    giorni.map(g => giorniMap[g] || g).join(', ') : 
    'N/D';
} 

    // Mostra i corsi filtrati
    function mostraCorsiFiltrati(corsi) {
      const corpoCorsi = document.getElementById('corpoTabellaCorsi');
      corpoCorsi.innerHTML = '';
      
      if (corsi.length === 0) {
          corpoCorsi.innerHTML = `
            <tr>
              <td colspan="7" class="nessun-risultato">
                Nessun corso trovato con i filtri selezionati
              </td>
            </tr>`;
          return;
      }

      corsi.forEach(corso => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${corso.iscritti?.length ? corso.iscritti[0] : 'N/D'}</td>
            <td>${getCorsoName(corso.tipologia)}</td>
            <td>${corso.livello || 'N/D'}</td>
            <td>${corso.giorni ? formatGiorni(corso.giorni) : 'N/D'}</td>
            <td>${corso.orario || 'N/D'}</td>
            <td>${corso.istruttore || 'N/D'}</td>
            <td class="actions-cell">
              <button class="btn btn-small btn-edit" onclick="modificaCorso('${corso.id}')">
                <i class="fas fa-edit"></i> Modifica
              </button>
              <button class="btn btn-small btn-delete" onclick="eliminaCorso('${corso.id}')">
                <i class="fas fa-trash-alt"></i> Elimina
              </button>
            </td>
          `;
          corpoCorsi.appendChild(row);
      });
    }

    // Resetta i filtri di ricerca
    function resetRicerca() {
      document.getElementById('filtro-nome').value = '';
      document.getElementById('filtro-cognome').value = '';
      document.getElementById('filtro-codice-fiscale').value = '';
      document.getElementById('filtro-corso').value = '';
      
      // Svuota le tabelle
      document.getElementById('corpoTabellaTesserati').innerHTML = `
        <tr>
          <td colspan="7" class="nessun-risultato">
            Utilizza i filtri sopra e clicca "Cerca" per visualizzare i risultati
          </td>
        </tr>`;
      
      document.getElementById('corpoTabellaCorsi').innerHTML = `
        <tr>
          <td colspan="7" class="nessun-risultato">
            Utilizza i filtri sopra e clicca "Cerca" per visualizzare i risultati
          </td>
        </tr>`;
    }

    // Funzioni per eliminazione
    window.eliminaTesserato = async function(idTesserato) {
      if (!confirm('Sei sicuro di voler eliminare questo tesserato?')) return;
      
      try {
          await db.collection("tesserati").doc(idTesserato).delete();
          showFeedback('Tesserato eliminato con successo!');
          eseguiRicerca();
      } catch (error) {
          console.error("Errore eliminazione tesserato:", error);
          showFeedback("Errore durante l'eliminazione del tesserato", 'error');
      }
    };

    window.eliminaCorso = async function(idCorso) {
      if (!confirm('Sei sicuro di voler eliminare questo corso?')) return;
      
      try {
          await db.collection("corsi").doc(idCorso).delete();
          showFeedback('Corso eliminato con successo!');
          eseguiRicerca();
      } catch (error) {
          console.error("Errore eliminazione corso:", error);
          showFeedback("Errore durante l'eliminazione del corso", 'error');
      }
    };

    // Sovrascrivi le funzioni globali
    window.eseguiRicerca = eseguiRicerca;
    window.resetRicerca = resetRicerca;

    // Aggiungi event listener
    document.getElementById('btnCerca').addEventListener('click', eseguiRicerca);
    document.getElementById('btnReset').addEventListener('click', resetRicerca);

    // Inizializza le tabelle vuote
    resetRicerca();

  } catch (error) {
    console.error('Errore inizializzazione Firebase:', error);
    alert('Errore di configurazione: ' + error.message);
  }
});