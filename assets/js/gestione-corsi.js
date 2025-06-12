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
  
  if (!tipoCorso || !livello) {
    container.innerHTML = '<p class="nessun-risultato">Seleziona tipo corso e livello</p>';
    return;
  }
  
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    const [allCorsi, allPacchetti] = await Promise.all([
      loadAllCorsi(),
      loadPacchetti()
    ]);
    
    const corsiFiltrati = allCorsi.filter(corso => 
      corso.tipologia === tipoCorso && corso.livello === livello
    );
    
    if (corsiFiltrati.length === 0) {
      container.innerHTML = '<div class="nessun-risultato"><i class="fas fa-info-circle"></i> Nessun corso trovato per questa combinazione</div>';
      return;
    }
    
    // Raggruppa per orario e converti ID pacchetti in nomi
    const corsiPerOrario = {};
    corsiFiltrati.forEach(corso => {
      const orario = corso.orario || 'Orario non specificato';
      if (!corsiPerOrario[orario]) {
        corsiPerOrario[orario] = [];
      }
      
      const pacchettiNomi = corso.pacchetti.map(pacchettoId => {
        const pacchetto = allPacchetti.find(p => p.id === pacchettoId);
        return pacchetto ? pacchetto.nome : pacchettoId;
      });
      
      corsiPerOrario[orario].push({
        ...corso,
        pacchettiNomi: pacchettiNomi
      });
    });
    
    // Costruisci l'HTML con grafica migliorata
    let html = '<div class="anteprima-corsi-container">';
    
    for (const [orario, corsi] of Object.entries(corsiPerOrario)) {
      html += `<div class="corsi-orario-group">
                <h3 class="orario-header">${orario}</h3>
                <div class="corsi-grid">`;
      
      corsi.forEach(corso => {
        html += `<div class="corso-card">
                  <div class="corso-header">
                    <span class="corso-tipo">${corso.tipologia} - Liv. ${corso.livello}</span>
                    <span class="corso-iscritti">${corso.iscritti.length} iscritti</span>
                  </div>
                  <div class="corso-pacchetti">
                    <i class="fas fa-box-open"></i> ${corso.pacchettiNomi.join(', ')}
                  </div>
                  <div class="corso-istruttore">
                    <i class="fas fa-user-tie"></i> ${corso.istruttore || 'Nessun istruttore assegnato'}
                  </div>
                </div>`;
      });
      
      html += `</div></div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error("Errore aggiornamento anteprima:", error);
    container.innerHTML = '<div class="errore-msg"><i class="fas fa-exclamation-triangle"></i> Errore nel caricamento dei corsi</div>';
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
async function handleSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  // Prepara i dati
  const corsoData = {
    tipologia: formData.get('tipo_corso'),
    livello: formData.get('livello'),
    orario: formData.get('orario'),
    istruttore: formData.get('istruttore') || '',
    pacchetti: Array.from(formData.getAll('pacchetti')),
    iscritti: [formData.get('tesserato')],
    note: formData.get('note') || '',
    creato_il: firebase.firestore.FieldValue.serverTimestamp(),
    creato_da: auth.currentUser?.uid || 'anonimo'
  };
  
  // Validazione
  if (!corsoData.iscritti[0] || corsoData.pacchetti.length === 0) {
    showFeedback('Seleziona un tesserato e almeno un pacchetto', 'error');
    return;
  }
  
  try {
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio in corso...';
    submitBtn.disabled = true;
    
    // Usa una transazione per garantire consistenza
    await db.runTransaction(async (transaction) => {
      const corsoRef = db.collection('corsi').doc();
      transaction.set(corsoRef, corsoData);
      
      // Aggiorna il tesserato
      const tesseratoRef = db.collection('tesserati').doc(corsoData.iscritti[0]);
      transaction.update(tesseratoRef, {
        corsi: firebase.firestore.FieldValue.arrayUnion(corsoRef.id),
        pacchetti: firebase.firestore.FieldValue.arrayUnion(...corsoData.pacchetti)
      });
      
      // Aggiorna i pacchetti
      for (const pacchettoId of corsoData.pacchetti) {
        const pacchettoRef = db.collection('pacchetti').doc(pacchettoId);
        transaction.update(pacchettoRef, {
          assegnato_a: firebase.firestore.FieldValue.arrayUnion(corsoData.iscritti[0])
        });
      }
    });
    
    showFeedback('Corso assegnato con successo!');
    form.reset();
    updateAnteprima();
    cache.corsi = []; // Invalida cache
    
  } catch (error) {
    console.error('Errore salvataggio:', error);
    showFeedback(`Errore durante il salvataggio: ${error.message}`, 'error');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

// Inizializzazione app
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Imposta l'anno corrente
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Inizializza form
    await initForm();
    
    // Aggiungi event listeners
    document.getElementById('tipo_corso').addEventListener('change', updateAnteprima);
    document.getElementById('livello').addEventListener('change', updateAnteprima);
    document.getElementById('corsoForm').addEventListener('submit', handleSubmit);
    
  } catch (error) {
    console.error('Errore inizializzazione:', error);
    showFeedback('Errore durante l\'inizializzazione dell\'applicazione', 'error');
  }
});