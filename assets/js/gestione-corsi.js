// gestione-corsi.js

// Funzioni per gestire i corsi con Firebase
async function loadTesserati() {
  try {
    const snapshot = await db.collection("tesserati").orderBy("cognome").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore nel caricamento dei tesserati:", error);
    return [];
  }
}

async function loadPacchetti() {
  try {
    const snapshot = await db.collection("pacchetti").get();
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("Errore nel caricamento dei pacchetti:", error);
    return [];
  }
}

async function salvaIscrizione(data) {
  try {
    await db.collection("iscrizioni_corsi").add({
      ...data,
      data_iscrizione: new Date(),
      stato: "attivo"
    });
    showSuccess("Iscrizione al corso salvata con successo!");
    return true;
  } catch (error) {
    console.error("Errore salvataggio corso:", error);
    showError("Errore durante il salvataggio dell'iscrizione");
    return false;
  }
}

async function caricaIscrizioniCorso(corso, pacchetti) {
  try {
    const snapshot = await db.collection("iscrizioni_corsi")
      .where("tipo_corso", "==", corso)
      .where("pacchetti", "array-contains-any", pacchetti)
      .where("stato", "==", "attivo")
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore caricamento iscrizioni:", error);
    return [];
  }
}

// Funzione per popolare il select dei tesserati
async function populateTesseratiSelect() {
  const select = document.getElementById("tesserato");
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  
  const tesserati = await loadTesserati();
  tesserati.forEach(tesserato => {
    const option = document.createElement("option");
    option.value = tesserato.id;
    option.textContent = `${tesserato.cognome} ${tesserato.nome} (${tesserato.tessera})`;
    select.appendChild(option);
  });
}

// Funzione per popolare il select dei pacchetti
async function populatePacchettiSelect() {
  const select = document.getElementById("pacchettiSelect");
  select.innerHTML = '';
  
  const pacchetti = await loadPacchetti();
  pacchetti.forEach(pacchetto => {
    const option = document.createElement("option");
    option.value = pacchetto.id;
    option.textContent = `${pacchetto.nome} (€${pacchetto.prezzo})`;
    select.appendChild(option);
  });
}

// Funzione per aggiornare l'anteprima degli iscritti
async function aggiornaAnteprima() {
  const corso = document.getElementById("tipo_corso").value;
  const pacchettiSelezionati = Array.from(document.getElementById("pacchettiSelect").selectedOptions)
    .map(opt => opt.value);
  const container = document.getElementById("anteprimaContainer");

  if (!corso || pacchettiSelezionati.length === 0) {
    container.innerHTML = '<p class="nessun-risultato">Seleziona un corso e un pacchetto</p>';
    return;
  }

  try {
    const iscrizioni = await caricaIscrizioniCorso(corso, pacchettiSelezionati);
    
    if (iscrizioni.length === 0) {
      container.innerHTML = '<p class="nessun-risultato">Nessun iscritto trovato per questa combinazione</p>';
      return;
    }

    // Carica i dettagli dei tesserati
    const tesseratiPromises = iscrizioni.map(iscrizione => 
      db.collection("tesserati").doc(iscrizione.tesserato).get().then(doc => ({
        ...doc.data(),
        id: doc.id
      }))
    );
    
    const tesserati = await Promise.all(tesseratiPromises);
    
    // Crea la visualizzazione
    container.innerHTML = iscrizioni.map((iscrizione, index) => {
      const tesserato = tesserati.find(t => t.id === iscrizione.tesserato);
      return `
        <div class="iscritto-card">
          <h3>${tesserato.cognome} ${tesserato.nome}</h3>
          <p>Tessera: ${tesserato.tessera}</p>
          <p>Corso: ${iscrizione.tipo_corso} (Livello ${iscrizione.livello})</p>
          <p>Pacchetti: ${iscrizione.pacchetti.join(', ')}</p>
          <p>Orario: ${iscrizione.orario}</p>
          <p>Istruttore: ${iscrizione.istruttore}</p>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error("Errore durante il caricamento dell'anteprima:", error);
    container.innerHTML = '<p class="nessun-risultato">Errore nel caricamento dei dati</p>';
  }
}

// Inizializzazione
document.addEventListener("DOMContentLoaded", async () => {
  // Imposta l'anno corrente nel footer
  document.getElementById("currentYear").textContent = new Date().getFullYear();
  
  // Popola i select
  await populateTesseratiSelect();
  await populatePacchettiSelect();

  // Gestione del form
  const form = document.getElementById("corsoForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const formData = {
      tesserato: form.tesserato.value,
      tipo_corso: form.tipo_corso.value,
      livello: form.livello.value,
      istruttore: form.istruttore.value.trim(),
      pacchetti: Array.from(form.pacchettiSelect.selectedOptions).map(o => o.value),
      orario: form.orario.value,
      note: form.note.value.trim()
    };

    if (validateForm(formData)) {
      const success = await salvaIscrizione(formData);
      if (success) {
        form.reset();
        await aggiornaAnteprima();
      }
    }
  });

  // Aggiungi event listener per l'aggiornamento automatico dell'anteprima
  document.getElementById("tipo_corso").addEventListener("change", aggiornaAnteprima);
  document.getElementById("pacchettiSelect").addEventListener("change", aggiornaAnteprima);
});

// Funzione di validazione (rimane uguale)
function validateForm(data) {
  if (!data.tesserato) return showError("Seleziona un tesserato.");
  if (!data.tipo_corso) return showError("Seleziona il tipo di corso.");
  if (!data.livello) return showError("Seleziona il livello.");
  if (!data.istruttore.trim()) return showError("Inserisci l'istruttore.");
  if (!data.pacchetti.length) return showError("Seleziona almeno un pacchetto.");
  if (!data.orario) return showError("Seleziona un orario.");
  return true;
}

function showError(message) {
  alert(`Errore: ${message}`);
}

function showSuccess(message) {
  alert(`Successo: ${message}`);
}
