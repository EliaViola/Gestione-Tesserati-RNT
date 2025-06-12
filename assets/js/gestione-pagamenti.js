const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const tesseratiSelect = document.getElementById("tesserato");
const corsiSelect = document.getElementById("corso");

// Carica tesserati attivi con corsi
async function loadTesserati() {
  const snapshot = await db
    .collection("tesserati")
    .where("tesseramento.stato", "==", "attivo")
    .get();

  const tesserati = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(t => Array.isArray(t.corsi) && t.corsi.length > 0);

  tesseratiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;
  tesserati.forEach(t => {
    const a = t.anagrafica || {};
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`;
    tesseratiSelect.appendChild(option);
  });
}

// Carica corsi del tesserato selezionato
async function loadCorsiForTesserato(tesseratoId) {
  corsiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;

  const doc = await db.collection("tesserati").doc(tesseratoId).get();
  const tesserato = doc.data();

  if (!tesserato || !Array.isArray(tesserato.corsi)) return;

  for (const corso of tesserato.corsi) {
    const option = document.createElement("option");
    option.value = corso.corsoId || ""; // assicurati che 'corsoId' venga salvato nel profilo
    option.textContent = `${corso.tipologia} - ${corso.livello} - ${corso.orario}`;
    corsiSelect.appendChild(option);
  }
}

// Event: cambio tesserato -> carica corsi
tesseratiSelect.addEventListener("change", (e) => {
  const selectedId = e.target.value;
  if (selectedId) {
    loadCorsiForTesserato(selectedId);
  } else {
    corsiSelect.innerHTML = `<option value="">-- Seleziona un tesserato prima --</option>`;
  }
});

// Invia pagamento
document.getElementById("pagamentoForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const tesseratoId = tesseratiSelect.value;
  const corsoId = corsiSelect.value;
  const importo = parseFloat(document.getElementById("importo").value);
  const metodo = document.getElementById("metodo").value;
  const dataPagamento = document.getElementById("data").value;

  if (!tesseratoId || !corsoId || isNaN(importo) || !metodo || !dataPagamento) {
    alert("Per favore, compila tutti i campi.");
    return;
  }

  try {
    const tesseratoSnap = await db.collection("tesserati").doc(tesseratoId).get();
    const corsoSnap = await db.collection("corsi").doc(corsoId).get();

    if (!tesseratoSnap.exists || !corsoSnap.exists) {
      alert("Errore nel recupero dati tesserato o corso.");
      return;
    }

    const tesseratoData = tesseratoSnap.data();
    const corsoData = corsoSnap.data();

    const pagamentoData = {
      tesseratoId,
      nomeTesserato: `${tesseratoData.anagrafica?.nome || ''} ${tesseratoData.anagrafica?.cognome || ''}`,
      corsoId,
      descrizioneCorso: `${corsoData.tipologia} - ${corsoData.livello} - ${corsoData.orario}`,
      importo,
      metodo,
      data: firebase.firestore.Timestamp.fromDate(new Date(dataPagamento))
    };

    // Salva nella raccolta globale 'pagamenti'
    await db.collection("pagamenti").add(pagamentoData);

    // Aggiungi al profilo del tesserato
    await db.collection("tesserati").doc(tesseratoId).update({
      pagamenti: firebase.firestore.FieldValue.arrayUnion(pagamentoData)
    });

    alert("Pagamento registrato con successo.");
    document.getElementById("pagamentoForm").reset();
    corsiSelect.innerHTML = `<option value="">-- Seleziona un tesserato --</option>`;
  } catch (error) {
    console.error("Errore durante il salvataggio:", error);
    alert("Errore durante il salvataggio del pagamento.");
  }
});

// Avvia caricamento tesserati al load
window.addEventListener("DOMContentLoaded", loadTesserati);
