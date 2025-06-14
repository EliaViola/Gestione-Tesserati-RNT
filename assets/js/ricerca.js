// Definizione delle funzioni globali
window.eseguiRicerca = function() {};
window.resetRicerca = function() {};
window.modificaTesserato = function(id) { 
  window.location.href = `dettaglio-tesserato.html?id=${id}`; 
};
window.eliminaTesserato = async function(id) {
  if (!confirm('ATTENZIONE: Eliminare definitivamente questo tesserato?\n\nVerrà rimosso completamente dal sistema.')) {
    return;
  }

  try {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Utente non autenticato');
    
    const token = await user.getIdTokenResult();
    if (!token.claims.secretary && !token.claims.director) {
      throw new Error('Permessi insufficienti');
    }

    const db = firebase.firestore();
    const batch = db.batch();

    // 1. Rimuovi da tutti i corsi
    const corsiSnapshot = await db.collection("corsi")
      .where("iscritti", "array-contains", id)
      .get();

    corsiSnapshot.forEach(doc => {
      const corsoRef = db.collection("corsi").doc(doc.id);
      const updatedIscritti = doc.data().iscritti.filter(tId => tId !== id);
      batch.update(corsoRef, { iscritti: updatedIscritti });
    });

    // 2. Elimina il tesserato
    const tesseratoRef = db.collection("tesserati").doc(id);
    batch.delete(tesseratoRef);

    await batch.commit();
    showFeedback('Tesserato eliminato definitivamente!', 'success');
    eseguiRicerca();
    
  } catch (error) {
    console.error("Errore eliminazione tesserato:", error);
    showFeedback(`Errore: ${error.message}`, 'error');
  }
};

window.rimuoviTesseratoDalCorso = async function(idCorso, idTesserato) {
  if (!confirm('Rimuovere questo tesserato dal corso?')) {
    return;
  }

  try {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Utente non autenticato');
    
    const token = await user.getIdTokenResult();
    if (!token.claims.secretary && !token.claims.director) {
      throw new Error('Permessi insufficienti');
    }

    const db = firebase.firestore();
    const corsoRef = db.collection("corsi").doc(idCorso);
    
    // Usa una transazione per garantire consistenza
    await db.runTransaction(async (transaction) => {
      const corsoDoc = await transaction.get(corsoRef);
      if (!corsoDoc.exists) throw new Error('Corso non trovato');
      
      const iscritti = corsoDoc.data().iscritti || [];
      if (!iscritti.includes(idTesserato)) {
        throw new Error('Tesserato non iscritto a questo corso');
      }
      
      const updatedIscritti = iscritti.filter(id => id !== idTesserato);
      transaction.update(corsoRef, { iscritti: updatedIscritti });
    });

    showFeedback('Tesserato rimosso dal corso!', 'success');
    eseguiRicerca();
    
  } catch (error) {
    console.error("Errore rimozione dal corso:", error);
    showFeedback(`Errore: ${error.message}`, 'error');
  }
};

document.addEventListener('DOMContentLoaded', function() {
  try {
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase non è stato caricato correttamente');
    }
    
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Funzioni helper
    const getCorsoName = (tipo) => {
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
    };

    const formatGiorni = (giorni) => {
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
    };

    const showFeedback = (message, type = 'success') => {
      const feedback = document.createElement('div');
      feedback.className = `feedback-msg ${type}`;
      feedback.textContent = message;
      document.body.appendChild(feedback);
      setTimeout(() => feedback.remove(), 5000);
    };

    // Caricamento dati
    const loadTesseratiFiltrati = async () => {
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
    };

    const loadCorsiFiltrati = async (filtroCorso) => {
      try {
        let query = db.collection("corsi");
        if (filtroCorso) query = query.where("tipologia", "==", filtroCorso);

        const snapshot = await query.get();
        const corsi = [];
        
        await Promise.all(snapshot.docs.map(async (doc) => {
          const corsoData = doc.data();
          const corso = { id: doc.id, ...corsoData, nomeTesserato: 'N/D' };
          
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
    };

    // Visualizzazione risultati
    const mostraTesseratiFiltrati = (tesserati) => {
      const corpoTesserati = document.getElementById('corpoTabellaTesserati');
      corpoTesserati.innerHTML = tesserati.length === 0 ? `
        <tr><td colspan="7" class="nessun-risultato">Nessun tesserato trovato</td></tr>` 
        : tesserati.map(tesserato => {
          const a = tesserato.anagrafica || {};
          const c = tesserato.contatti || {};
          return `
            <tr>
              <td>${a.nome || 'N/D'}</td>
              <td>${a.cognome || 'N/D'}</td>
              <td>${a.codice_fiscale || 'N/D'}</td>
              <td>${a.data_nascita ? new Date(a.data_nascita).toLocaleDateString('it-IT') : 'N/D'}</td>
              <td>${c.telefono || 'N/D'}</td>
              <td>${c.email || 'N/D'}</td>
              <td class="actions-cell">
                <button class="btn btn-small btn-detail" onclick="modificaTesserato('${tesserato.id}')">
                  <i class="fas fa-info-circle"></i> Dettaglio
                </button>
                <button class="btn btn-small btn-delete" onclick="eliminaTesserato('${tesserato.id}')">
                  <i class="fas fa-trash-alt"></i> Elimina
                </button>
              </td>
            </tr>`;
        }).join('');
    };

    const mostraCorsiFiltrati = (corsi) => {
      const corpoCorsi = document.getElementById('corpoTabellaCorsi');
      corpoCorsi.innerHTML = corsi.length === 0 ? `
        <tr><td colspan="7" class="nessun-risultato">Nessun corso trovato</td></tr>`
        : corsi.map(corso => `
          <tr>
            <td>${corso.nomeTesserato || 'N/D'}</td>
            <td>${getCorsoName(corso.tipologia)}</td>
            <td>${corso.livello || 'N/D'}</td>
            <td>${corso.giorni ? formatGiorni(corso.giorni) : 'N/D'}</td>
            <td>${corso.orario || 'N/D'}</td>
            <td>${corso.istruttore || 'N/D'}</td>
            <td class="actions-cell">
              ${corso.iscritti?.length > 0 ? `
                <button class="btn btn-small btn-remove" 
                        onclick="rimuoviTesseratoDalCorso('${corso.id}', '${corso.iscritti[0]}')">
                  <i class="fas fa-user-minus"></i> Rimuovi
                </button>` : 'Nessun iscritto'}
            </td>
          </tr>`).join('');
    };

    // Funzione principale di ricerca
    window.eseguiRicerca = async function() {
      const filtroNome = document.getElementById('filtro-nome').value.trim();
      const filtroCognome = document.getElementById('filtro-cognome').value.trim();
      const filtroCodiceFiscale = document.getElementById('filtro-codice-fiscale').value.trim();
      const filtroCorso = document.getElementById('filtro-corso').value;

      try {
        // Mostra spinner
        document.getElementById('corpoTabellaTesserati').innerHTML = `
          <tr><td colspan="7" class="loading-msg">
            <i class="fas fa-spinner fa-spin"></i> Ricerca in corso...
          </td></tr>`;
        
        // Carica tesserati
        let tesserati = await loadTesseratiFiltrati();
        
        // Applica filtri
        if (filtroNome) tesserati = tesserati.filter(t => 
          t.anagrafica?.nome?.toLowerCase().includes(filtroNome.toLowerCase()));
        if (filtroCognome) tesserati = tesserati.filter(t => 
          t.anagrafica?.cognome?.toLowerCase().includes(filtroCognome.toLowerCase()));
        if (filtroCodiceFiscale) tesserati = tesserati.filter(t => 
          t.anagrafica?.codice_fiscale?.toUpperCase() === filtroCodiceFiscale.toUpperCase());

        // Carica corsi
        const corsi = filtroCorso ? await loadCorsiFiltrati(filtroCorso) : [];

        // Mostra risultati
        mostraTesseratiFiltrati(tesserati);
        mostraCorsiFiltrati(corsi);

      } catch (error) {
        console.error("Errore durante la ricerca:", error);
        showFeedback("Errore durante la ricerca dei dati", 'error');
      }
    };

    // Resetta i filtri
    window.resetRicerca = function() {
      document.getElementById('filtro-nome').value = '';
      document.getElementById('filtro-cognome').value = '';
      document.getElementById('filtro-codice-fiscale').value = '';
      document.getElementById('filtro-corso').value = '';
      
      document.getElementById('corpoTabellaTesserati').innerHTML = `
        <tr><td colspan="7" class="nessun-risultato">
          Utilizza i filtri e clicca "Cerca"</td></tr>`;
      
      document.getElementById('corpoTabellaCorsi').innerHTML = `
        <tr><td colspan="7" class="nessun-risultato">
          Utilizza i filtri e clicca "Cerca"</td></tr>`;
    };

    // Inizializzazione
    document.getElementById('btnCerca').addEventListener('click', eseguiRicerca);
    document.getElementById('btnReset').addEventListener('click', resetRicerca);
    resetRicerca();

  } catch (error) {
    console.error('Errore inizializzazione:', error);
    alert('Errore di configurazione: ' + error.message);
  }
});