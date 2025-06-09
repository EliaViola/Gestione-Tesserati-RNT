// Configurazione Firebase (sostituisci con la tua configurazione)
const firebaseConfig = {
  apiKey: "AIzaSyBVcNJhXiytEKBtC09T3kbykVzAY0AHZmM",
  authDomain: "rari-nantes-tesserati.firebaseapp.com",
  projectId: "rari-nantes-tesserati",
  storageBucket: "rari-nantes-tesserati.appspot.com",
  messagingSenderId: "435337228811",
  appId: "1:435337228811:web:a5f1fd0fb9e17bfbc00d0e"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Funzioni per caricare dati da Firestore
async function loadTesserati() {
  try {
    const snapshot = await db.collection("tesserati").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore nel caricamento dei tesserati:", error);
    showError("Impossibile caricare i tesserati");
    return [];
  }
}

async function loadPacchetti() {
  try {
    const snapshot = await db.collection("pacchetti").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));  // meglio avere anche id
  } catch (error) {
    console.error("Errore nel caricamento dei pacchetti:", error);
    showError("Impossibile caricare i pacchetti");
    return [];
  }
}

async function loadIstruttori() {
  try {
    const snapshot = await db.collection("istruttori").get();
    return snapshot.docs.map(doc => doc.data().nome || "");
  } catch (error) {
    console.error("Errore nel caricamento degli istruttori:", error);
    return [];
  }
}

// Popola select dei tesserati
async function populateTesseratiSelect() {
  const select = document.getElementById("tesserati");
  const tesserati = await loadTesserati();

  select.innerHTML = '<option value="">-- Seleziona --</option>';

  tesserati.forEach(tesserato => {
    const option = document.createElement("option");
    option.value = tesserato.id;
    option.textContent = `${tesserato.anagrafica?.nome || ''} ${tesserato.anagrafica?.cognome || ''} (${tesserato.id})`;
    select.appendChild(option);
  });
}

// Popola select dei pacchetti
async function populatePacchettiSelect() {
  const select = document.getElementById("pacchettiSelect");
  const pacchetti = await loadPacchetti();

  select.innerHTML = '<option value="">-- Seleziona --</option>';

  pacchetti.forEach(pacchetto => {
    const option = document.createElement("option");
    option.value = pacchetto.nome || pacchetto.id;  // usa nome o id come valore
    option.textContent = `${pacchetto.nome || 'Pacchetto senza nome'} (${pacchetto.durata || 'N/D'})`;
    select.appendChild(option);
  });
}

// Popola datalist degli istruttori
async function populateIstruttoriList() {
  const datalist = document.getElementById("istruttoriList");
  const istruttori = await loadIstruttori();

  datalist.innerHTML = '';

  istruttori.forEach(istruttore => {
    if (istruttore.trim()) {
      const option = document.createElement("option");
      option.value = istruttore;
      datalist.appendChild(option);
    }
  });
}

// Validazione form iscrizione corso
function validateForm(data) {
  if (!data.tesserato) {
    showError("Seleziona un tesserato");
    return false;
  }
  if (!data.tipo_corso) {
    showError("Seleziona il tipo di corso");
    return false;
  }
  if (!data.livello) {
    showError("Seleziona il livello");
    return false;
  }
  if (!data.istruttore || !data.istruttore.trim()) {
    showError("Inserisci l'istruttore responsabile");
    return false;
  }
  if (!data.pacchetti || data.pacchetti.length === 0) {
    showError("Seleziona almeno un pacchetto");
    return false;
  }
  if (!data.orario) {
    showError("Seleziona un orario");
    return false;
  }
  return true;
}

// Salvataggio iscrizione corso e aggiornamento tesserato
async function salvaIscrizione(data) {
  try {
    // Aggiungi data iscrizione con Timestamp di Firestore
    data.dataIscrizione = firebase.firestore.FieldValue.serverTimestamp();

    // Salva corso nella collezione 'corsi'
    const corsoRef = await db.collection("corsi").add(data);

    // Aggiorna array 'corsi' nel documento tesserato con riferimento al corso creato
    await db.collection("tesserati").doc(data.tesserato).update({
      corsi: firebase.firestore.FieldValue.arrayUnion({
        idCorso: corsoRef.id,
        tipo: data.tipo_corso,
        livello: data.livello,
        istruttore: data.istruttore,
        pacchetti: data.pacchetti,
        orario: data.orario,
        dataIscrizione: data.dataIscrizione,
        note: data.note || ""
      })
    });

    showSuccess("Corso assegnato con successo al tesserato");
    return true;
  } catch (error) {
    console.error("Errore nel salvataggio:", error);
    showError("Errore nel salvataggio dei dati");
    return false;
  }
}

// Aggiorna anteprima iscritti al corso selezionato e pacchetti scelti
async function aggiornaAnteprima() {
  const corsoSelezionato = document.getElementById("tipo_corso").value;
  const pacchettiSelezionati = Array.from(document.getElementById("pacchettiSelect").selectedOptions)
    .map(option => option.value);
  const container = document.getElementById("anteprimaContainer");

  if (!corsoSelezionato || pacchettiSelezionati.length === 0) {
    container.innerHTML = '<p class="nessun-risultato">Seleziona un corso e un pacchetto per visualizzare gli iscritti</p>';
    return;
  }

  try {
    const snapshot = await db.collection("corsi")
      .where("tipo_corso", "==", corsoSelezionato)
      .where("pacchetti", "array-contains-any", pacchettiSelezionati)
      .get();

    if (snapshot.empty) {
      container.innerHTML = '<p class="nessun-risultato">Nessun iscritto trovato per questa combinazione</p>';
      return;
    }

    container.innerHTML = '';

    for (const doc of snapshot.docs) {
      const corso = doc.data();
      if (!corso.tesserato) continue;

      const tesseratoDoc = await db.collection("tesserati").doc(corso.tesserato).get();
      if (!tesseratoDoc.exists) continue;
      const tesserato = tesseratoDoc.data();

      const card = document.createElement("div");
      card.className = "iscritto-card";

      const dataIscrizione = corso.dataIscrizione && corso.dataIscrizione.toDate
        ? corso.dataIscrizione.toDate().toLocaleDateString("it-IT")
        : "N/D";

      card.innerHTML = `
        <h3>${tesserato.anagrafica?.nome || ''} ${tesserato.anagrafica?.cognome || ''}</h3>
        <p><strong>Corso:</strong> ${corso.tipo_corso} (Livello ${corso.livello})</p>
        <p><strong>Pacchetti:</strong> ${corso.pacchetti.join(", ")}</p>
        <p><strong>Orario:</strong> ${corso.orario}</p>
        <p><strong>Istruttore:</strong> ${corso.istruttore}</p>
        <p><small>Iscritto il: ${dataIscrizione}</small></p>
      `;

      container.appendChild(card);
    }
  } catch (error) {
    console.error("Errore nel caricamento dell'anteprima:", error);
    container.innerHTML = '<p class="nessun-risultato">Errore nel caricamento dei dati</p>';
  }
}

// Funzioni di utilità per messaggi feedback
function showError(message) {
  clearMessages();
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;

  const form = document.getElementById("corsoForm");
  form.prepend(errorDiv);

  setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
  clearMessages();
  const successDiv = document.createElement("div");
  successDiv.className = "success-message";
  successDiv.textContent = message;

  const form = document.getElementById("corsoForm");
  form.prepend(successDiv);

  setTimeout(() => successDiv.remove(), 5000);
}

function clearMessages() {
  const form = document.getElementById("corsoForm");
  const messages = form.querySelectorAll(".error-message, .success-message");
  messages.forEach(msg => msg.remove());
}

// Inizializzazione pagina
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("currentYear").textContent = new Date().getFullYear();

  await populateTesseratiSelect();
  await populatePacchettiSelect();
  await populateIstruttoriList();

  document.getElementById("corsoForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const formData = {
      tesserato: form.tesserati.value || form.tesserato.value,  // verifica id corretto
      tipo_corso: form.tipo_corso.value,
      livello: form.livello.value,
      istruttore: form.istruttore.value.trim(),
      pacchetti: Array.from(form.pacchettiSelect.selectedOptions).map(option => option.value),
      orario: form.orario.value,
      note: form.note.value.trim()
    };

    if (validateForm(formData)) {
      const success = await salvaIscrizione(formData);
      if (success) {
        form.reset();
        aggiornaAnteprima();
      }
    }
  });

  document.getElementById("tipo_corso").addEventListener("change", aggiornaAnteprima);
  document.getElementById("pacchettiSelect").addEventListener("change", aggiornaAnteprima);
  aggiornaAnteprima(); // carica anteprima all'avvio
});
