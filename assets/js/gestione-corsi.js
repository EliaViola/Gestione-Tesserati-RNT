const db = firebase.firestore();
const auth = firebase.auth();

// Cache per i dati
let cache = {
  tesserati: [],
  pacchetti: [],
  corsi: []
};

// Funzione per mostrare feedback
function showFeedback(message, type = 'success') {
  const feedback = document.getElementById('feedback');
  feedback.textContent = message;
  feedback.className = `feedback-msg ${type}`;
  feedback.style.display = 'block';
  
  setTimeout(() => {
    feedback.style.display = 'none';
  }, 5000);
}

// Carica tesserati attivi
async function loadTesserati() {
  if (cache.tesserati.length > 0) return cache.tesserati;
  
  try {
    const snapshot = await db.collection("tesserati")
      .where("tesseramento.stato", "==", "attivo")
      .orderBy("anagrafica.cognome")
      .orderBy("anagrafica.nome")
      .get();
    
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

// Carica pacchetti
async function loadPacchetti() {
  if (cache.pacchetti.length > 0) return cache.pacchetti;
  
  try {
    const snapshot = await db.collection("pacchetti")
      .orderBy("nome")
      .get();
    
    cache.pacchetti = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        dateRange: data.date?.length > 0 
          ? `${data.date[0]} - ${data.date[data.date.length - 1]}`
          : 'Nessuna data'
      };
    });
    
    return cache.pacchetti;
  } catch (error) {
    console.error("Errore caricamento pacchetti:", error);
    showFeedback("Errore nel caricamento dei pacchetti", 'error');
    throw error;
  }
}

// Carica tutti i corsi
async function loadAllCorsi() {
  if (cache.corsi.length > 0) return cache.corsi;
  
  try {
    const snapshot = await db.collection("corsi").get();
    cache.corsi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return cache.corsi;
  } catch (error) {
    console.error("Errore caricamento corsi:", error);
    throw error;
  }
}

// Aggiorna l'anteprima con grafica migliorata
async function updateAnteprima() {
  const container = document.getElementById('anteprimaContainer');
  const tipoCorso = document.getElementById('tipo_corso').value;
  const livello = document.getElementById('livello').value;
  const orario = document.getElementById('orario').value;

  if (!tipoCorso || !livello || !orario) {
    container.innerHTML = '<div class="nessun-risultato"><i class="fas fa-info-circle"></i> Seleziona tipo, livello e orario</div>';
    return;
  }

  container.innerHTML = '<div class="spinner"></div>';

  try {
    const [allCorsi, allTesserati, allPacchetti] = await Promise.all([
      loadAllCorsi(),
      loadTesserati(),
      loadPacchetti()
    ]);

    // Filtra i corsi
    const corsiFiltrati = allCorsi.filter(corso => 
      corso.tipologia === tipoCorso && 
      corso.livello === livello && 
      corso.orario === orario
    );

    if (corsiFiltrati.length === 0) {
      container.innerHTML = '<div class="nessun-risultato"><i class="fas fa-info-circle"></i> Nessun corso trovato</div>';
      return;
    }

    // Costruisci l'HTML
    let html = '<div class="anteprima-corsi-container">';
    
    corsiFiltrati.forEach(corso => {
      // Converti ID pacchetti in nomi
      const pacchettiNomi = corso.pacchetti.map(pacchettoId => {
        const pacchetto = allPacchetti.find(p => p.id === pacchettoId);
        return pacchetto ? pacchetto.nome : pacchettoId;
      });

      // Converti ID tesserati in nomi
      const tesseratiNomi = corso.iscritti.map(tesseratoId => {
        const tesserato = allTesserati.find(t => t.id === tesseratoId);
        return tesserato ? tesserato.nomeCompleto : tesseratoId;
      });

      html += `
        <div class="corso-card">
          <div class="corso-header">
            <span class="corso-tipo">${corso.tipologia} - Liv. ${corso.livello}</span>
            <span class="corso-orario">${corso.orario}</span>
          </div>
          <div class="corso-pacchetti">
            <i class="fas fa-box-open"></i> ${pacchettiNomi.join(', ')}
          </div>
          <div class="corso-tesserati">
            <h4><i class="fas fa-users"></i> Partecipanti (${tesseratiNomi.length})</h4>
            <ul class="tesserati-list">
              ${tesseratiNomi.map(t => `<li>${t}</li>`).join('')}
            </ul>
          </div>
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;

  } catch (error) {
    console.error("Errore aggiornamento anteprima:", error);
    container.innerHTML = '<div class="errore-msg"><i class="fas fa-exclamation-triangle"></i> Errore nel caricamento</div>';
  }
}

// Inizializzazione form
async function initForm() {
  try {
    const [tesserati, pacchetti] = await Promise.all([
      loadTesserati(),
      loadPacchetti()
    ]);
    
    // Popola tesserati
    const tesseratiSelect = document.getElementById('tesserato');
    tesseratiSelect.innerHTML = '<option value="">-- Seleziona --</option>';
    tesserati.forEach(t => {
      const option = document.createElement('option');
      option.value = t.id;
      option.textContent = `${t.nomeCompleto} (${t.anagrafica?.codice_fiscale || 'N/D'})`;
      tesseratiSelect.appendChild(option);
    });
    
    // Popola pacchetti
    const pacchettiSelect = document.getElementById('pacchettiSelect');
    pacchettiSelect.innerHTML = '<option value="">-- Seleziona --</option>';
    pacchetti.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${p.nome} (${p.dateRange})`;
      pacchettiSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error("Errore inizializzazione form:", error);
    showFeedback("Errore nel caricamento dei dati iniziali", 'error');
  }
}

// Gestione submit del form
// Continua da handleSubmit
async function handleSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';

  try {
    const tesseratoId = formData.get('tesserato');
    const tipologia = formData.get('tipo_corso');
    const livello = formData.get('livello');
    const orario = formData.get('orario');
    const note = formData.get('note') || '';
    const pacchetti = Array.from(document.getElementById('pacchettiSelect').selectedOptions).map(opt => opt.value);

    if (!tesseratoId || !tipologia || !livello || !orario || pacchetti.length === 0) {
      showFeedback('Compila tutti i campi richiesti.', 'error');
      return;
    }

    // Crea il documento corso
    const corsoData = {
      tipologia,
      livello,
      orario,
      note,
      pacchetti,
      iscritti: [tesseratoId],
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    const corsoRef = await db.collection("corsi").add(corsoData);
    const corsoId = corsoRef.id;

    // Aggiorna profilo del tesserato
    await db.collection("tesserati").doc(tesseratoId).update({
      [`corsi.${corsoId}`]: {
        tipologia,
        livello,
        orario,
        pacchetti,
        note
      }
    });

    showFeedback('Corso assegnato con successo.');
    form.reset();
    updateAnteprima();

  } catch (error) {
    console.error("Errore nell'assegnazione del corso:", error);
    showFeedback('Errore durante il salvataggio del corso.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}



// Inizializzazione dell'app all'avvio del DOM
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Mostra l'anno corrente nel footer o in un elemento designato
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
      currentYearElement.textContent = new Date().getFullYear();
    }

    // Inizializza il form con i dati necessari (es. pacchetti, opzioni, etc.)
    await initForm();

    // Associa gli event listener ai campi del form
    const tipoCorso = document.getElementById('tipo_corso');
    const livello = document.getElementById('livello');
    const corsoForm = document.getElementById('corsoForm');

    if (tipoCorso) tipoCorso.addEventListener('change', updateAnteprima);
    if (livello) livello.addEventListener('change', updateAnteprima);
    if (corsoForm) corsoForm.addEventListener('submit', handleSubmit);

  } catch (error) {
    console.error('Errore durante l\'inizializzazione:', error);
    showFeedback('Errore durante l\'inizializzazione dell\'applicazione', 'error');
  }
});
