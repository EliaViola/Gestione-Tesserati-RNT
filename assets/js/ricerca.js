// ricerca.js - Versione completa con Firebase

// Verifica che Firebase sia disponibile
document.addEventListener('DOMContentLoaded', function() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase non è stato caricato correttamente!');
    showFeedback("Errore di configurazione: Firebase non disponibile", 'error');
    return;
  }

  // Inizializza Firebase
  const db = firebase.firestore();
  const auth = firebase.auth();

  // Cache per i dati
  let cache = {
    tesserati: [],
    corsi: []
  };

  // Funzione per mostrare feedback
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
      cache.tesserati = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        nomeCompleto: `${doc.data().anagrafica?.cognome || ''} ${doc.data().anagrafica?.nome || ''}`.trim()
      }));
      return cache.tesserati;
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
      cache.corsi = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      return cache.corsi;
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
      document.getElementById('corpoTabellaTesserati').innerHTML = `
        <tr>
          <td colspan="7" class="loading-msg">
            <i class="fas fa-spinner fa-spin"></i> Caricamento...
          </td>
        </tr>`;
      
      document.getElementById('corpoTabellaCorsi').innerHTML = `
        <tr>
          <td colspan="7" class="loading-msg">
            <i class="fas fa-spinner fa-spin"></i> Caricamento...
          </td>
        </tr>`;
      
      // Carica i dati
      const [tesserati, corsi] = await Promise.all([
        loadTesserati(),
        loadCorsi()
      ]);
      
      // Filtra i tesserati
      const tesseratiFiltrati = tesserati.filter(t => {
        const anagrafica = t.anagrafica || {};
        return (filtroNome === '' || (anagrafica.nome && anagrafica.nome.toLowerCase().includes(filtroNome))) &&
               (filtroCognome === '' || (anagrafica.cognome && anagrafica.cognome.toLowerCase().includes(filtroCognome))) &&
               (filtroCodiceFiscale === '' || (anagrafica.codice_fiscale && anagrafica.codice_fiscale.toLowerCase().includes(filtroCodiceFiscale)));
      });
      
      // Popola la tabella tesserati
      const corpoTesserati = document.getElementById('corpoTabellaTesserati');
      corpoTesserati.innerHTML = '';
      
      if (tesseratiFiltrati.length === 0) {
        corpoTesserati.innerHTML = `
          <tr>
            <td colspan="7" class="nessun-risultato">
              Nessun tesserato trovato
            </td>
          </tr>`;
      } else {
        tesseratiFiltrati.forEach(tesserato => {
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
            <td>
              <button class="btn btn-small" onclick="modificaTesserato('${tesserato.id}')">
                <i class="fas fa-edit"></i> Modifica
              </button>
            </td>
          `;
          corpoTesserati.appendChild(row);
        });
      }
      
      // Filtra i corsi
      const corsiFiltrati = corsi.filter(corso => {
        if (filtroCorso === '') return true;
        return corso.tipologia === filtroCorso;
      });
      
      // Popola la tabella corsi
      const corpoCorsi = document.getElementById('corpoTabellaCorsi');
      corpoCorsi.innerHTML = '';
      
      if (corsiFiltrati.length === 0) {
        corpoCorsi.innerHTML = `
          <tr>
            <td colspan="7" class="nessun-risultato">
              Nessun corso trovato
            </td>
          </tr>`;
      } else {
        // Precarica i nomi dei tesserati per ottimizzazione
        const tesseratiMap = {};
        tesserati.forEach(t => tesseratiMap[t.id] = t);
        
        corsiFiltrati.forEach(corso => {
          // Trova il tesserato associato al corso (considera il primo iscritto)
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
            <td>
              <button class="btn btn-small" onclick="modificaCorso('${corso.id}')">
                <i class="fas fa-edit"></i> Modifica
              </button>
            </td>
          `;
          corpoCorsi.appendChild(row);
        });
      }
      
    } catch (error) {
      console.error("Errore durante la ricerca:", error);
      showFeedback("Errore durante la ricerca dei dati", 'error');
    }
  }

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

  // Funzioni per modificare i record
  window.modificaTesserato = function(idTesserato) {
    window.location.href = `inserimento.html?id=${idTesserato}`;
  };

  window.modificaCorso = function(idCorso) {
    window.location.href = `inserimento-dati-corsi.html?id=${idCorso}`;
  };

  // Esegui la ricerca iniziale
  eseguiRicerca();

  // Aggiungi listener per il tasto Enter nei campi di ricerca
  document.querySelectorAll('.form-control').forEach(input => {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') eseguiRicerca();
    });
  });

  // Aggiorna l'anno nel footer
  document.querySelector('.footer-container p').textContent = 
    `© ${new Date().getFullYear()} Rari Nantes Trento. Tutti i diritti riservati.`;
});