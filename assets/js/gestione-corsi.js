const db = firebase.firestore();
const auth = firebase.auth();

// Cache per i dati
let cache = {
  tesserati: [],
  pacchetti: [],
  corsi: []
};

// Configurazione limiti corsi
const LIMITI_CORSI = {
  avviamento: { max: 8, durata: '30 min' },
  principianti: { max: 8, durata: '30 min' },
  intermedio: { max: 8, durata: '30 min' },
  perfezionamento: { max: 8, durata: '30 min' },
  cuffiegb: { max: 12, durata: '30 min' },
  calottegb: { max: 12, durata: '30 min' },
  propaganda: { max: 15, durata: '40 min' },
  agonisti: { max: 20, durata: '60 min' },
  pallanuoto: { max: 15, durata: '90 min' }
};

// Giorni della settimana
const GIORNI_SETTIMANA = [
  { id: 'lun', nome: 'Lunedì' },
  { id: 'mar', nome: 'Martedì' },
  { id: 'mer', nome: 'Mercoledì' },
  { id: 'gio', nome: 'Giovedì' },
  { id: 'ven', nome: 'Venerdì' }
];

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

// Aggiorna l'anteprima con la tabella
async function updateAnteprima() {
  const container = document.getElementById('anteprimaContainer');
  const tipoCorso = document.getElementById('tipo_corso').value;
  const livello = document.getElementById('livello').value;
  const orario = document.getElementById('orario').value;
  const pacchettiSelect = document.getElementById('pacchettiSelect');
  const pacchettiSelezionati = Array.from(pacchettiSelect.selectedOptions).map(opt => opt.value);

  if (!tipoCorso || !livello) {
    container.innerHTML = '<div class="nessun-risultato"><i class="fas fa-info-circle"></i> Seleziona tipo e livello del corso</div>';
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
    let corsiFiltrati = allCorsi.filter(corso => 
      corso.tipologia === tipoCorso && 
      corso.livello === livello
    );

    // Filtra per orario se selezionato
    if (orario) {
      corsiFiltrati = corsiFiltrati.filter(corso => corso.orario === orario);
    }

    // Filtra per pacchetti se sono selezionati
    if (pacchettiSelezionati.length > 0) {
      corsiFiltrati = corsiFiltrati.filter(corso =>
        corso.pacchetti.some(p => pacchettiSelezionati.includes(p))
      );
    }

    if (corsiFiltrati.length === 0) {
      container.innerHTML = `
        <div class="nessun-risultato">
          <i class="fas fa-info-circle"></i> Nessun corso trovato con questi filtri
          <div class="limite-corso">
            Massimo partecipanti: ${LIMITI_CORSI[tipoCorso]?.max || 'N/D'} - 
            Durata lezione: ${LIMITI_CORSI[tipoCorso]?.durata || 'N/D'}
          </div>
        </div>`;
      return;
    }

    // Costruisci la tabella HTML
    let html = `
      <div class="table-responsive">
        <table class="anteprima-table">
          <thead>
            <tr>
              <th>Tipo/Livello</th>
              <th>Orario</th>
              <th>Frequenza</th>
              <th>Giorni</th>
              <th>Partecipanti (${corsiFiltrati.reduce((acc, corso) => acc + corso.iscritti.length, 0)})</th>
              <th>Disponibilità</th>
              <th>Pacchetti</th>
            </tr>
          </thead>
          <tbody>`;

    // Raggruppa per orario e giorni
    const corsiRaggruppati = {};
    corsiFiltrati.forEach(corso => {
      const key = `${corso.orario}_${corso.giorni.join(',')}`;
      if (!corsiRaggruppati[key]) {
        corsiRaggruppati[key] = {
          orario: corso.orario,
          giorni: corso.giorni,
          iscritti: [],
          pacchetti: [...new Set(corso.pacchetti)],
          tipologia: corso.tipologia,
          livello: corso.livello,
          frequenza: corso.frequenza
        };
      }
      corsiRaggruppati[key].iscritti.push(...corso.iscritti);
    });

    // Popola la tabella con i corsi raggruppati
    Object.values(corsiRaggruppati).forEach(corso => {
      const limiteCorso = LIMITI_CORSI[corso.tipologia]?.max || 0;
      const postiDisponibili = limiteCorso - corso.iscritti.length;
      const disponibilitaClass = postiDisponibili <= 0 ? 'limite-raggiunto' : '';

      // Converti ID pacchetti in nomi
      const pacchettiNomi = corso.pacchetti.map(pacchettoId => {
        const pacchetto = allPacchetti.find(p => p.id === pacchettoId);
        return pacchetto ? pacchetto.nome : pacchettoId;
      }).join(', ');

      // Converti ID tesserati in nomi
      const tesseratiNomi = corso.iscritti.map(tesseratoId => {
        const tesserato = allTesserati.find(t => t.id === tesseratoId);
        return tesserato ? tesserato.nomeCompleto : tesseratoId;
      });

      // Formatta i giorni
      const giorniFormattati = corso.giorni 
        ? corso.giorni.map(g => GIORNI_SETTIMANA.find(gs => gs.id === g)?.nome || g).join(', ')
        : 'N/D';

      html += `
        <tr>
          <td>${corso.tipologia} - Liv.${corso.livello}</td>
          <td>${corso.orario}</td>
          <td>
            <span class="badge-frequenza badge-${corso.frequenza === '2giorni' ? '2giorni' : '1giorno'}">
              ${corso.frequenza === '2giorni' ? '2 giorni' : '1 giorno'}
            </span>
          </td>
          <td>${giorniFormattati}</td>
          <td>
            <ul class="tesserati-list">
              ${tesseratiNomi.map(t => `<li>${t}</li>`).join('')}
            </ul>
          </td>
          <td class="${disponibilitaClass}">
            ${corso.iscritti.length}/${limiteCorso}
            ${postiDisponibili <= 0 ? ' (COMPLETO)' : ''}
          </td>
          <td>${pacchettiNomi}</td>
        </tr>`;
    });

    html += `
          </tbody>
        </table>
        <div class="limite-corso">
          Massimo partecipanti: ${LIMITI_CORSI[tipoCorso]?.max || 'N/D'} - 
          Durata lezione: ${LIMITI_CORSI[tipoCorso]?.durata || 'N/D'}
        </div>
      </div>`;
    
    container.innerHTML = html;

  } catch (error) {
    console.error("Errore aggiornamento anteprima:", error);
    container.innerHTML = '<div class="errore-msg"><i class="fas fa-exclamation-triangle"></i> Errore nel caricamento</div>';
  }
}

// Gestione submit del form
async function handleSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';

  try {
    const tesseratoId = document.getElementById('tesserato').value;
    const tipologia = document.getElementById('tipo_corso').value;
    const livello = document.getElementById('livello').value;
    const orario = document.getElementById('orario').value;
    const note = document.getElementById('note').value || '';
    const pacchetti = Array.from(document.getElementById('pacchettiSelect').selectedOptions).map(opt => opt.value);
    const frequenza = document.querySelector('input[name="frequenza"]:checked').value;
    const giorniSelezionati = Array.from(document.querySelectorAll('input[name="giorno"]:checked')).map(el => el.value);

    // Validazione
    if (!tesseratoId || !tipologia || !livello || !orario || pacchetti.length === 0) {
      showFeedback('Compila tutti i campi richiesti.', 'error');
      return;
    }

    if ((frequenza === "2giorni" && giorniSelezionati.length !== 2) ||
        (frequenza === "1giorno" && giorniSelezionati.length !== 1)) {
      showFeedback('Seleziona il numero corretto di giorni in base alla frequenza scelta.', 'error');
      return;
    }

    // Verifica disponibilità posti per ogni giorno selezionato
    const limiteCorso = LIMITI_CORSI[tipologia]?.max || 0;
    
    for (const giorno of giorniSelezionati) {
      const querySnapshot = await db.collection("corsi")
        .where("tipologia", "==", tipologia)
        .where("livello", "==", livello)
        .where("orario", "==", orario)
        .where("giorni", "array-contains", giorno)
        .get();

      let postiOccupati = 0;
      querySnapshot.forEach(doc => {
        postiOccupati += doc.data().iscritti.length;
      });

      if (postiOccupati >= limiteCorso) {
        showFeedback(`Il corso del ${GIORNI_SETTIMANA.find(g => g.id === giorno)?.nome} ha raggiunto il limite massimo di ${limiteCorso} partecipanti.`, 'error');
        return;
      }
    }

    // Crea il documento corso
    const corsoData = {
      tipologia,
      livello,
      orario,
      note,
      pacchetti,
      iscritti: [tesseratoId],
      frequenza,
      giorni: giorniSelezionati,
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
        note,
        frequenza,
        giorni: giorniSelezionati
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

// Inizializzazione form
// Modifica la funzione initForm per posizionare correttamente le sezioni
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
    
    // Aggiungi sezione frequenza DOPO il campo pacchetti
    const pacchettiGroup = document.querySelector('#pacchettiSelect').closest('.form-group');
    const frequenzaHTML = `
      <div class="form-group required-field">
        <label><i class="fas fa-calendar-week"></i> Frequenza</label>
        <div class="frequenza-selector">
          <label>
            <input type="radio" name="frequenza" value="1giorno" checked> 1 giorno/settimana
          </label>
          <label>
            <input type="radio" name="frequenza" value="2giorni"> 2 giorni/settimana
          </label>
        </div>
      </div>
      <div class="form-group required-field giorni-container">
        <label><i class="fas fa-calendar-day"></i> Seleziona giorno/i</label>
        <div class="giorni-selector">
          ${GIORNI_SETTIMANA.map(g => `
            <label>
              <input type="checkbox" name="giorno" value="${g.id}"> ${g.nome}
            </label>
          `).join('')}
        </div>
      </div>`;
    
    pacchettiGroup.insertAdjacentHTML('afterend', frequenzaHTML);

    // Gestione cambio frequenza
    document.querySelectorAll('input[name="frequenza"]').forEach(radio => {
      radio.addEventListener('change', function() {
        const giorniContainer = document.querySelector('.giorni-container');
        if (this.value === '2giorni') {
          giorniContainer.querySelector('label').textContent = 'Seleziona 2 giorni';
          // Deseleziona tutti i checkbox quando si cambia frequenza
          document.querySelectorAll('input[name="giorno"]').forEach(cb => cb.checked = false);
        } else {
          giorniContainer.querySelector('label').textContent = 'Seleziona giorno';
        }
      });
    });

    // Aggiungi validazione per i giorni selezionati
    document.getElementById('corsoForm').addEventListener('submit', function(e) {
      const frequenza = document.querySelector('input[name="frequenza"]:checked').value;
      const giorniSelezionati = document.querySelectorAll('input[name="giorno"]:checked').length;
      
      if ((frequenza === '1giorno' && giorniSelezionati !== 1) ||
          (frequenza === '2giorni' && giorniSelezionati !== 2)) {
        e.preventDefault();
        showFeedback(`Seleziona esattamente ${frequenza === '1giorno' ? '1 giorno' : '2 giorni'}`, 'error');
      }
    });

  } catch (error) {
    console.error("Errore inizializzazione form:", error);
    showFeedback("Errore nel caricamento dei dati iniziali", 'error');
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
    document.getElementById('pacchettiSelect').addEventListener('change', updateAnteprima);
    document.getElementById('orario').addEventListener('change', updateAnteprima);
    document.getElementById('corsoForm').addEventListener('submit', handleSubmit);
    
  } catch (error) {
    console.error('Errore inizializzazione:', error);
    showFeedback('Errore durante l\'inizializzazione dell\'applicazione', 'error');
  }
});