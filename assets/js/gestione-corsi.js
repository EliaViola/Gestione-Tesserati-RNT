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

// Carica tesserati attivi con cache
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

// Carica pacchetti con cache
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

// Carica tutti i corsi esistenti
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

// Nuova funzione per visualizzare l'anteprima raggruppata per orario
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
      loadPacchetti() // Assicurati che i pacchetti siano caricati
    ]);
    
    const corsiFiltrati = allCorsi.filter(corso => 
      corso.tipologia === tipoCorso && corso.livello === livello
    );
    
    if (corsiFiltrati.length === 0) {
      container.innerHTML = '<p class="nessun-risultato">Nessun corso trovato per questa combinazione</p>';
      return;
    }
    
    // Raggruppa per orario
    const corsiPerOrario = {};
    corsiFiltrati.forEach(corso => {
      if (!corsiPerOrario[corso.orario]) {
        corsiPerOrario[corso.orario] = [];
      }
      
      // Converti gli ID pacchetti in nomi
      const pacchettiCorso = corso.pacchetti.map(pacchettoId => {
        const pacchetto = allPacchetti.find(p => p.id === pacchettoId);
        return pacchetto ? pacchetto.nome : pacchettoId;
      });
      
      corsiPerOrario[corso.orario].push({
        ...corso,
        nomiPacchetti: pacchettiCorso
      });
    });
    
    // Costruisci l'HTML
    let html = '<div class="anteprima-corsi">';
    
    for (const [orario, corsi] of Object.entries(corsiPerOrario)) {
      html += `<div class="corsi-reparto">
                <h3 class="orario-title">Orario: ${orario}</h3>
                <table class="tabella-corsi">
                  <thead>
                    <tr>
                      <th>Pacchetti</th>
                      <th>Tipo Corso</th>
                      <th>Livello</th>
                      <th>Num. Iscritti</th>
                    </tr>
                  </thead>
                  <tbody>`;
      
      corsi.forEach(corso => {
        html += `<tr>
                  <td>${corso.nomiPacchetti.join(', ')}</td>
                  <td>${corso.tipologia}</td>
                  <td>${corso.livello}</td>
                  <td>${corso.iscritti.length}</td>
                </tr>`;
      });
      
      html += `</tbody></table></div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error("Errore aggiornamento anteprima:", error);
    container.innerHTML = '<p class="errore">Errore nel caricamento dei corsi</p>';
  }
}

// Inizializzazione form
async function initForm() {
  const [tesserati, pacchetti] = await Promise.all([
    loadTesserati(),
    loadPacchetti()
  ]);
  
  // Popola tesserati
  const tesseratiSelect = document.getElementById('tesseratiSelect');
  tesseratiSelect.innerHTML = '<option value="">-- Seleziona --</option>';
  tesserati.forEach(t => {
    const option = document.createElement('option');
    option.value = t.id;
    option.textContent = `${t.nomeCompleto} (${t.anagrafica?.codice_fiscale || 'N/D'})`;
    tesseratiSelect.appendChild(option);
  });
  
  // Popola pacchetti
  const pacchettiSelect = document.getElementById('pacchettiSelect');
  pacchettiSelect.innerHTML = '';
  pacchetti.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `${p.nome} (${p.dateRange})`;
    pacchettiSelect.appendChild(option);
  });
}

// Gestione submit del form
async function handleSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const tesseratoId = formData.get('tesserati');
  const pacchetti = formData.getAll('pacchetti');
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  // Validazione
  if (!tesseratoId || pacchetti.length === 0) {
    showFeedback('Seleziona un tesserato e almeno un pacchetto', 'error');
    return;
  }
  
  const corsoData = {
    tipologia: formData.get('tipo_corso'),
    livello: formData.get('livello'),
    orario: formData.get('orario'),
    pacchetti: pacchetti,
    iscritti: [tesseratoId],
    note: formData.get('note_corso') || '',
    creato_il: firebase.firestore.FieldValue.serverTimestamp(),
    creato_da: auth.currentUser?.uid || 'anonimo'
  };
  
  try {
    submitBtn.innerHTML = '<span class="spinner"></span> Salvataggio in corso...';
    submitBtn.disabled = true;
    
    await db.runTransaction(async (transaction) => {
      const corsoRef = db.collection('corsi').doc();
      transaction.set(corsoRef, corsoData);
      
      const tesseratoRef = db.collection('tesserati').doc(tesseratoId);
      transaction.update(tesseratoRef, {
        corsi: firebase.firestore.FieldValue.arrayUnion(corsoRef.id),
        pacchetti: firebase.firestore.FieldValue.arrayUnion(...pacchetti)
      });
      
      for (const pacchettoId of pacchetti) {
        const pacchettoRef = db.collection('pacchetti').doc(pacchettoId);
        transaction.update(pacchettoRef, {
          assegnato_a: firebase.firestore.FieldValue.arrayUnion(tesseratoId)
        });
      }
    });
    
    showFeedback('Corso assegnato con successo!');
    form.reset();
    updateAnteprima();
    cache.corsi = []; // Invalida la cache dei corsi
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
    // Inizializza form
    await initForm();
    
    // Aggiungi event listeners
    document.getElementById('tipo_corso').addEventListener('change', updateAnteprima);
    document.getElementById('livello').addEventListener('change', updateAnteprima);
    // Non serve più il listener per l'orario per l'anteprima
    
    document.getElementById('corsoForm').addEventListener('submit', handleSubmit);
    
    // Imposta l'anno corrente
    document.getElementById('currentYear').textContent = new Date().getFullYear();
  } catch (error) {
    console.error('Errore inizializzazione:', error);
    showFeedback('Errore durante l\'inizializzazione dell\'applicazione', 'error');
  }
});