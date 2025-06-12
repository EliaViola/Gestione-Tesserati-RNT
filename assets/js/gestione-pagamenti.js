const db = firebase.firestore();

// Carica tesserati attivi
async function loadTesserati() {
  const snapshot = await db.collection("tesserati")
    .where("tesseramento.stato", "==", "attivo")
    .orderBy("anagrafica.cognome")
    .orderBy("anagrafica.nome")
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Carica i corsi a cui partecipa il tesserato
async function loadCorsiPerTesserato(tesseratoId) {
  const corsi = [];

  const tesseratoDoc = await db.collection("tesserati").doc(tesseratoId).get();
  const dati = tesseratoDoc.data();

  if (dati && Array.isArray(dati.corsi)) {
    for (const corso of dati.corsi) {
      if (corso && corso.idCorso && corso.nome) {
        corsi.push(corso);
      }
    }
  }

  return corsi;
}

document.addEventListener("DOMContentLoaded", async () => {
  const tesseratiSelect = document.getElementById("tesseratiSelect");
  const corsiSelect = document.getElementById("corsiSelect");
  const form = document.getElementById("pagamentoForm");
  const feedback = document.getElementById("feedback");

  // Popola tesserati
  try {
    const tesserati = await loadTesserati();
    tesserati.forEach(t => {
      const anagrafica = t.anagrafica || {};
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = `${anagrafica.cognome} ${anagrafica.nome} (${anagrafica.codice_fiscale || 'N/D'})`;
      tesseratiSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Errore nel caricamento tesserati:", error);
    feedback.textContent = "Errore nel caricamento dei tesserati.";
  }

  // Al cambio tesserato → carica i suoi corsi
  tesseratiSelect.addEventListener("change", async () => {
    const tesseratoId = tesseratiSelect.value;
    corsiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;

    if (!tesseratoId) return;

    try {
      const corsi = await loadCorsiPerTesserato(tesseratoId);
      corsi.forEach(corso => {
        const option = document.createElement("option");
        option.value = corso.idCorso;
        option.textContent = corso.nome;
        corsiSelect.appendChild(option);
      });

      if (corsi.length === 0) {
        const option = document.createElement("option");
        option.disabled = true;
        option.textContent = "Nessun corso trovato";
        corsiSelect.appendChild(option);
      }
    } catch (error) {
      console.error("Errore nel caricamento corsi:", error);
      feedback.textContent = "Errore nel caricamento dei corsi.";
    }
  });

  // Submit form pagamento
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedback.textContent = "";

    const tesseratoId = tesseratiSelect.value;
    const corsoId = corsiSelect.value;
    const importo = parseFloat(document.getElementById("importo").value);
    const metodo = document.getElementById("metodo").value;
    const data = document.getElementById("data").value;

    if (!tesseratoId || !corsoId || !importo || !metodo || !data) {
      feedback.textContent = "Compila tutti i campi obbligatori.";
      return;
    }

    const pagamentoData = {
      tesseratoId,
      corsoId,
      importo,
      metodo,
      data,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      // Scrittura globale in 'pagamenti'
      await db.collection("pagamenti").add(pagamentoData);

      // Scrittura anche nel documento del tesserato
      await db.collection("tesserati").doc(tesseratoId).update({
        [`pagamenti.${corsoId}`]: firebase.firestore.FieldValue.arrayUnion(pagamentoData)
      });

      feedback.textContent = "Pagamento registrato con successo.";
      form.reset();
      corsiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;
    } catch (error) {
      console.error("Errore salvataggio pagamento:", error);
      feedback.textContent = "Errore durante la registrazione del pagamento.";
    }
  });
});
