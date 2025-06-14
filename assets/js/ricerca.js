// Definizione delle funzioni globali
window.eseguiRicerca = function() {};
window.resetRicerca = function() {};
window.modificaTesserato = function(id) { window.location.href = `dettaglio-tesserato.html?id=${id}`; };
window.modificaCorso = function(id) { window.location.href = `modifica-corsi.html?id=${id}`; };
window.eliminaTesserato = function(id) {};
window.rimuoviTesseratoDaiCorsi = function(id) {};

document.addEventListener('DOMContentLoaded', function() {
  try {
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase non è stato caricato correttamente');
    }
    
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Funzioni helper
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

    // Mostra feedback all'utente
    function showFeedback(message, type = 'success') {
      const feedback = document.createElement('div');
      feedback.className = `feedback-msg ${type}`;
      feedback.textContent = message;
      document.body.appendChild(feedback);
      
      setTimeout(() => feedback.remove(), 5000);
    }

    // Carica tesserati con filtri
    async function loadTesseratiFiltrati() {
  try {
    const snapshot = await db.collection("tesserati").get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      nomeCompleto: `${doc.data().anagrafica?.cognome || ''} ${doc.data().anagrafica?.nome || ''}`.trim(),
      anagrafica: {
        nome: doc.data().anagrafica?.nome || 'N/D',
        cognome: doc.data().anagrafica?.cognome || 'N/D',
        codice_fiscale: doc.data().anagrafica?.codice_fiscale || 'N/D',
        data_nascita: doc.data().anagrafica?.data_nascita || null
      },
      contatti: {
        telefono: doc.data().contatti?.telefono || 'N/D',
        email: doc.data().contatti?.email || 'N/D'
      }
    }));
  } catch (error) {
    console.error("Errore caricamento tesserati:", error);
    showFeedback("Errore nel caricamento dei tesserati", 'error');
    throw error;
  }
}

    // Carica corsi con filtri e nomi dei tesserati
    async function loadCorsiFiltrati(filtroCorso) {
      try {
        let query = db.collection("corsi");
        
        if (filtroCorso) {
          query = query.where("tipologia", "==", filtroCorso);
        }

        const snapshot = await query.get();
        const corsi = [];
        
        // Carica in parallelo i nomi dei tesserati
        await Promise.all(snapshot.docs.map(async (doc) => {
          const corsoData = doc.data();
          const corso = {
            id: doc.id,
            ...corsoData,
            nomeTesserato: 'N/D' // Valore di default
          };
          
          // Se ci sono iscritti, carica il nome del primo tesserato
          if (corsoData.iscritti?.length > 0) {
            try {
              const tesseratoDoc = await db.collection("tesserati").doc(corsoData.iscritti[0]).get();
              if (tesseratoDoc.exists) {
                const tesseratoData = tesseratoDoc.data();
                corso.nomeTesserato = `${tesseratoData.anagrafica?.cognome || ''} ${tesseratoData.anagrafica?.nome || ''}`.trim();
              }
            } catch (error) {
              console.error("Errore caricamento tesserato:", error);
            }
          }
          
          corsi.push(corso);
        }));
        
        return corsi;
      } catch (error) {
        console.error("Errore caricamento corsi:", error);
        showFeedback("Errore nel caricamento dei corsi", 'error');
        throw error;
      }
    }

    // Mostra i tesserati filtrati
    function mostraTesseratiFiltrati(tesserati) {
  const corpoTesserati = document.getElementById('corpoTabellaTesserati');
  corpoTesserati.innerHTML = '';
  
  if (!tesserati || tesserati.length === 0) {
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
        <button class="btn btn-small btn-detail" onclick="modificaTesserato('${tesserato.id}')">
          <i class="fas fa-info-circle"></i> Dettaglio
        </button>
        <button class="btn btn-small btn-remove" onclick="rimuoviTesseratoDaiCorsi('${tesserato.id}')">
  <i class="fas fa-user-minus"></i> Rimuovi da corsi
</button>
      </td>
    `;
    corpoTesserati.appendChild(row);
  });
}

    // Mostra i corsi filtrati
    function mostraCorsiFiltrati(corsi) {
      const corpoCorsi = document.getElementById('corpoTabellaCorsi');
      corpoCorsi.innerHTML = '';
      
      if (!corsi || corsi.length === 0) {
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
            <td>${corso.nomeTesserato || 'N/D'}</td>
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

    // Funzione principale di ricerca
    async function eseguiRicerca() {
  const filtroNome = document.getElementById('filtro-nome').value.trim();
  const filtroCognome = document.getElementById('filtro-cognome').value.trim();
  const filtroCodiceFiscale = document.getElementById('filtro-codice-fiscale').value.trim();
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

    // Carica sempre i tesserati (senza filtri iniziali)
    let tesserati = await db.collection("tesserati").get()
      .then(snapshot => snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        nomeCompleto: `${doc.data().anagrafica?.cognome || ''} ${doc.data().anagrafica?.nome || ''}`.trim()
      })));

    // Applica filtri lato client se specificati
    if (filtroNome) {
      tesserati = tesserati.filter(t => 
        t.anagrafica?.nome?.toLowerCase().includes(filtroNome.toLowerCase())
      );
    }
    
    if (filtroCognome) {
      tesserati = tesserati.filter(t => 
        t.anagrafica?.cognome?.toLowerCase().includes(filtroCognome.toLowerCase())
      );
    }
    
    if (filtroCodiceFiscale) {
      tesserati = tesserati.filter(t => 
        t.anagrafica?.codice_fiscale?.toUpperCase() === filtroCodiceFiscale.toUpperCase()
      );
    }

    // Carica i corsi con filtri
    let corsi = [];
    if (filtroCorso) {
      corsi = await loadCorsiFiltrati(filtroCorso);
    }

    // Mostra i risultati
    mostraTesseratiFiltrati(tesserati);
    mostraCorsiFiltrati(corsi);

  } catch (error) {
    console.error("Errore durante la ricerca:", error);
    showFeedback("Errore durante la ricerca dei dati", 'error');
  }
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
  if (!confirm('Sei sicuro di voler eliminare questo tesserato da tutti i corsi e dal database?')) return;
  
  try {
    // 1. Prima rimuovi il tesserato da tutti i corsi a cui è iscritto
    const corsiSnapshot = await db.collection("corsi")
      .where("iscritti", "array-contains", idTesserato)
      .get();

    // Aggiorna tutti i corsi in parallelo
    const updatePromises = corsiSnapshot.docs.map(async (doc) => {
      const corsoData = doc.data();
      const updatedIscritti = corsoData.iscritti.filter(id => id !== idTesserato);
      
      await db.collection("corsi").doc(doc.id).update({
        iscritti: updatedIscritti
      });
    });

    await Promise.all(updatePromises);

    // 2. Poi elimina il tesserato dalla collezione tesserati
    await db.collection("tesserati").doc(idTesserato).delete();
    
    showFeedback('Tesserato rimosso con successo da tutti i corsi e dal database!');
    eseguiRicerca(); // Ricarica i risultati
    
  } catch (error) {
    console.error("Errore durante l'eliminazione del tesserato:", error);
    showFeedback("Errore durante l'eliminazione del tesserato", 'error');
  }
};

    window.rimuoviTesseratoDaiCorsi = async function(idTesserato) {
  if (!confirm('Sei sicuro di voler rimuovere questo tesserato da tutti i corsi?')) return;
  
  try {
    const corsiSnapshot = await db.collection("corsi")
      .where("iscritti", "array-contains", idTesserato)
      .get();

    const updatePromises = corsiSnapshot.docs.map(async (doc) => {
      const updatedIscritti = doc.data().iscritti.filter(id => id !== idTesserato);
      await db.collection("corsi").doc(doc.id).update({
        iscritti: updatedIscritti
      });
    });

    await Promise.all(updatePromises);
    
    showFeedback('Tesserato rimosso con successo da tutti i corsi!');
    eseguiRicerca();
    
  } catch (error) {
    console.error("Errore durante la rimozione del tesserato dai corsi:", error);
    showFeedback("Errore durante la rimozione del tesserato dai corsi", 'error');
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