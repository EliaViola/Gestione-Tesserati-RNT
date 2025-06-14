// Definizione delle funzioni globali
    window.eseguiRicerca = function() {};
    window.resetRicerca = function() {};
    window.modificaTesserato = function(id) { window.location.href = `dettaglio-tesserato.html?id=${id}`; };
    window.modificaCorso = function(id) { window.location.href = `modifica-corsi.html?id=${id}`; };
    window.eliminaTesserato = function(id) {};
    window.eliminaCorso = function(id) {};

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
                  <td colspan="7" class="nessun-risultato">
                    Nessun tesserato trovato
                  </td>
                </tr>`;
              return;
          }

          const tesseratiFiltrati = tesserati.filter(t => {
            const anagrafica = t.anagrafica || {};
            const nomeMatch = !filtroNome || (anagrafica.nome && anagrafica.nome.toLowerCase().includes(filtroNome));
            const cognomeMatch = !filtroCognome || (anagrafica.cognome && anagrafica.cognome.toLowerCase().includes(filtroCognome));
            const cfMatch = !filtroCodiceFiscale || (anagrafica.codice_fiscale && anagrafica.codice_fiscale.toLowerCase().includes(filtroCodiceFiscale));
            return nomeMatch && cognomeMatch && cfMatch;
          });

          if (tesseratiFiltrati.length === 0) {
            corpoTesserati.innerHTML = `
              <tr>
                <td colspan="7" class="nessun-risultato">
                  Nessun tesserato corrisponde ai filtri
                </td>
              </tr>`;
            return;
          }

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
              <td class="actions-cell">
                <button class="btn btn-small btn-edit" onclick="modificaTesserato('${tesserato.id}')">
                  <i class="fas fa-edit"></i> Tesserato
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
                  <td colspan="7" class="nessun-risultato">
                    Nessun corso trovato
                  </td>
                </tr>`;
              return;
          }

          const tesseratiMap = {};
          tesserati.forEach(t => tesseratiMap[t.id] = t);
          
          // Applica filtro corso se specificato
          const corsiFiltrati = filtroCorso 
              ? corsi.filter(corso => 
                  corso.tipologia?.toLowerCase().includes(filtroCorso.toLowerCase()) ||
                  corso.livello?.toLowerCase().includes(filtroCorso.toLowerCase()) ||
                  corso.istruttore?.toLowerCase().includes(filtroCorso.toLowerCase()))
              : corsi;
          
          if (corsiFiltrati.length === 0) {
            corpoCorsi.innerHTML = `
              <tr>
                <td colspan="7" class="nessun-risultato">
                  Nessun corso corrisponde ai filtri
                </td>
              </tr>`;
            return;
          }

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

        // Formatta i giorni per la visualizzazione
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

        window.eliminaTesseratoDalCorso = async function(idTesserato, idCorso = null) {
  if (!confirm('Sei sicuro di voler rimuovere questo tesserato dal corso?')) return;

  try {
    const db = firebase.firestore();
    const batch = db.batch();

    // 1. Se è specificato un corso, rimuovi solo da quello
    if (idCorso) {
      const corsoRef = db.collection("corsi").doc(idCorso);
      batch.update(corsoRef, {
        iscritti: firebase.firestore.FieldValue.arrayRemove(idTesserato)
      });
    } 
    // 2. Altrimenti rimuovi da tutti i corsi
    else {
      const corsiSnapshot = await db.collection("corsi")
        .where("iscritti", "array-contains", idTesserato)
        .get();

      corsiSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          iscritti: firebase.firestore.FieldValue.arrayRemove(idTesserato)
        });
      });
    }

    await batch.commit();
    showFeedback('Tesserato rimosso dai corsi con successo!');
    
    // Ricarica i dati se siamo nella pagina di ricerca
    if (typeof eseguiRicerca === 'function') eseguiRicerca();
    
  } catch (error) {
    console.error("Errore durante la rimozione:", error);
    showFeedback("Errore durante la rimozione del tesserato", 'error');
  }
};

        // Sovrascrivi le funzioni globali
        window.eseguiRicerca = eseguiRicerca;
        window.resetRicerca = resetRicerca;

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