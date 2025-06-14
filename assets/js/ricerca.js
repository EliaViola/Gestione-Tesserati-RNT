// Funzione principale di ricerca - VERSIONE DEFINITIVA
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

// Versione semplificata di loadTesseratiFiltrati
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