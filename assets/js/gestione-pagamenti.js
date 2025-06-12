const db = firebase.firestore();
const auth = firebase.auth();

// Carica tutti i tesserati con tesseramento attivo
function loadTesserati() {
  return db.collection("tesserati")
    .where("tesseramento.stato", "==", "attivo")
    .orderBy("anagrafica.cognome")
    .orderBy("anagrafica.nome")
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

// Carica i corsi a cui partecipa il tesserato selezionato
function loadCorsiPerTesserato(tesseratoId) {
  return db.collection("corsi")
    .where("partecipanti", "array-contains", tesseratoId)
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

document.addEventListener("DOMContentLoaded", async () => {
  const tesseratiSelect = document.getElementById("tesseratiSelect");
  const corsiSelect = document.getElementById("corsiSelect");
  const pagamentoForm = document.getElementById("pagamentoForm");
  const feedback = document.getElementById("feedback");

  // Caricamento tesserati nel menu a discesa
  try {
    const tesserati = await loadTesserati();
    tesserati.forEach(t => {
      const a = t.anagrafica || {};
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`;
      tesseratiSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Errore nel caricamento dei tesserati:", error);
    tesseratiSelect.innerHTML = `<option disabled>Errore nel caricamento</option>`;
  }

  // Quando selezioni un tesserato, carica i corsi a cui partecipa
  tesseratiSelect.addEventListener("change", async () => {
    const tesseratoId = tesseratiSelect.value;
    corsiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;

    if (!tesseratoId) return;

    try {
      const corsi = await loadCorsiPerTesserato(tesseratoId);
      if (corsi.length === 0) {
        corsiSelect.innerHTML = `<option disabled>Nessun corso trovato</option>`;
      } else {
        corsi.forEach(c => {
          const option = document.createElement("option");
          option.value = c.id;
          option.textContent = `${c.tipologia || 'Corso'} - ${c.livello || 'Livello'} (${c.orario || ''})`;
          corsiSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Errore nel caricamento corsi:", error);
      corsiSelect.innerHTML = `<option disabled>Errore nel caricamento</option>`;
    }
  });

  // Gestione invio del pagamento
  pagamentoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedback.textContent = "";
    feedback.className = "form-feedback";

    const tesseratoId = tesseratiSelect.value;
    const corsoId = corsiSelect.value;
    const importo = parseFloat(document.getElementById("importo").value);
    const metodo = document.getElementById("metodo").value;
    const data = document.getElementById("data").value;

    if (!tesseratoId || !corsoId || isNaN(importo) || !metodo || !data) {
      feedback.textContent = "Compila tutti i campi obbligatori.";
      feedback.classList.add("error");
      return;
    }

    const pagamentoData = {
      tesseratoId,
      corsoId,
      importo,
      metodo,
      data: firebase.firestore.Timestamp.fromDate(new Date(data)),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      // Aggiunta alla raccolta globale "pagamenti"
      const docRef = await db.collection("pagamenti").add(pagamentoData);

      // Salvataggio anche nel profilo del tesserato
      await db.collection("tesserati").doc(tesseratoId).update({
        [`pagamenti.${corsoId}.${docRef.id}`]: pagamentoData
      });

      pagamentoForm.reset();
      corsiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;
      feedback.textContent = "Pagamento registrato con successo.";
      feedback.classList.add("success");
    } catch (error) {
      console.error("Errore durante la registrazione del pagamento:", error);
      feedback.textContent = "Errore nella registrazione del pagamento.";
      feedback.classList.add("error");
    }
  });
});
