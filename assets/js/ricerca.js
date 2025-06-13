// ricerca.js - Versione definitiva corretta

// Prima definizione delle funzioni globali
window.eseguiRicerca = function() {};
window.resetRicerca = function() {};
window.modificaTesserato = function() {};
window.modificaCorso = function() {};

document.addEventListener('DOMContentLoaded', function() {
  // Elementi UI
  const loadingTesserati = `
    <tr>
      <td colspan="7" class="loading-msg">
        <i class="fas fa-spinner fa-spin"></i> Caricamento tesserati...
      </td>
    </tr>`;
  
  const loadingCorsi = `
    <tr>
      <td colspan="7" class="loading-msg">
        <i class="fas fa-spinner fa-spin"></i> Caricamento corsi...
      </td>
    </tr>`;

  // Inizializza Firebase
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

    // Carica tutti i tesserati
    async function loadTesserati() {
      try {
        const snapshot = await db.collection("tesserati").get();
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

    // Carica tutti i corsi
    async function loadCorsi() {
      try {
        const snapshot = await db.collection("corsi").get();
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
      const filtroCodiceFiscale = document.getElementById('filtro-codice-fiscale').value.toLowerCase();
      const filtroCorso = document.getElementById('filtro-corso').value;
      
      try {
        // Mostra spinner durante il caricamento
        document.getElementById('corpoTabellaTesserati').innerHTML = loadingTesserati;
        document.getElementById('corpoTabellaCorsi').innerHTML = loadingCorsi;
        
        // Carica i dati in parallelo
        const [tesserati, corsi] = await Promise.all([
          loadTesserati(),
          loadCorsi()
        ]);
        
        // Filtra e mostra i tesserati
        mostraTesseratiFiltrati(tesserati, filtroNome, filtroCognome, filtroCodiceFiscale);
        
        // Filtra e mostra i corsi
        mostraCorsiFiltrati(corsi, tesserati, filtroCorso);
        
      } catch (error) {
        console.error("Errore durante la ricerca:", error);
        showFeedback("Errore durante la ricerca dei dati", 'error');
      }
    }

    // Mostra i tesserati filtrati
    function mostraTesseratiFiltrati(tesserati, filtroNome, filtroCognome, filtroCodiceFiscale) {
    const corpoTesserati = document.getElementById('corpoTabellaTesserati');
    corpoTesserati.innerHTML = '';
    
    if (tesserati.length === 0) {
        corpoTesserati.innerHTML = `
          <tr>
            <td colspan="8" class="nessun-risultato">
              Nessun tesserato trovato
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

    // Mostra i corsi filtrati
    function mostraCorsiFiltrati(corsi, tesserati, filtroCorso) {
    const corpoCorsi = document.getElementById('corpoTabellaCorsi');
    corpoCorsi.innerHTML = '';
    
    if (corsi.length === 0) {
        corpoCorsi.innerHTML = `
          <tr>
            <td colspan="8" class="nessun-risultato">
              Nessun corso trovato
            </td>
          </tr>`;
        return;
    }

    const tesseratiMap = {};
    tesserati.forEach(t => tesseratiMap[t.id] = t);
    
    corsiFiltrati.forEach(corso => {
        const tesseratoId = corso.iscritti?.[0] || '';
        const tesserato = tesseratiMap[tesseratoId];
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${tesserato ? tesserato.nomeCompleto : 'N/D'}</td>
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

    // Formatta i giorni per la visualizzazione
    function formatGiorni(giorni) {
      const giorniMap = {
        'lun': 'Lunedì',
        'mar': 'Martedì',
        'mer': 'Mercoledì',
        'gio': 'Giovedì',
        'ven': 'Venerdì'
      };
      
      return giorni.map(g => giorniMap[g] || g).join(', ');
    }

    // Resetta i filtri di ricerca
    function resetRicerca() {
      document.getElementById('filtro-nome').value = '';
      document.getElementById('filtro-cognome').value = '';
      document.getElementById('filtro-codice-fiscale').value = '';
      document.getElementById('filtro-corso').value = '';
      eseguiRicerca();
    }

    // Funzione helper per il nome del corso
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

    // Sovrascrivi le funzioni globali
    window.eseguiRicerca = eseguiRicerca;
    window.resetRicerca = resetRicerca;
    window.modificaTesserato = function(idTesserato) {
      window.location.href = `dettaglio-tesserato.html?id=${idTesserato}`;
    };
    window.modificaCorso = function(idCorso) {
      window.location.href = `modifica-corsi.html?id=${idCorso}`;
    };

    // Aggiungi event listener ai pulsanti
    document.getElementById('btnCerca')?.addEventListener('click', eseguiRicerca);
    document.getElementById('btnReset')?.addEventListener('click', resetRicerca);

    // Aggiungi listener per il tasto Enter nei campi di ricerca
    document.querySelectorAll('.form-control').forEach(input => {
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') eseguiRicerca();
      });
    });

    // Aggiorna l'anno nel footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // Esegui la ricerca iniziale
    eseguiRicerca();

  } catch (error) {
    console.error('Errore inizializzazione Firebase:', error);
    alert('Errore di configurazione: ' + error.message);
  }
});