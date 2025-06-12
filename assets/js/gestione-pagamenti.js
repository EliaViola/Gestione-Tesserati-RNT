const db = firebase.firestore();
const auth = firebase.auth();

function loadTesserati() {
  return db.collection("tesserati")
    .where("tesseramento.stato", "==", "attivo")
    .orderBy("anagrafica.cognome")
    .orderBy("anagrafica.nome")
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

async function loadCorsiPerTesserato(tesseratoId) {
  if (!tesseratoId) return [];

  // Recupero il documento tesserato
  const tesseratoDoc = await db.collection("tesserati").doc(tesseratoId).get();
  if (!tesseratoDoc.exists) return [];

  const tesseratoData = tesseratoDoc.data();
  const corsiIds = tesseratoData.corsi || [];  // supponendo sia array di id corsi

  if (corsiIds.length === 0) return [];

  // Carico i corsi
  const corsiSnapshot = await db.collection("corsi")
    .where(firebase.firestore.FieldPath.documentId(), "in", corsiIds)
    .get();

  return corsiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

document.addEventListener("DOMContentLoaded", () => {
  const tesseratiSelect = document.getElementById("tesseratiSelect");
  const corsiSelect = document.getElementById("corsiSelect");
  const feedback = document.getElementById("feedback");
  const pagamentoForm = document.getElementById("pagamentoForm");

  if (!tesseratiSelect || !corsiSelect || !feedback || !pagamentoForm) {
    console.error("Elementi HTML mancanti.");
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      feedback.textContent = "Errore: utente non autenticato. Effettua il login.";
      tesseratiSelect.innerHTML = `<option disabled>Accesso non autorizzato</option>`;
      return;
    }

    try {
      // Carica tesserati
      const tesserati = await loadTesserati();
      tesseratiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;
      tesserati.forEach(t => {
        const a = t.anagrafica || {};
        const option = document.createElement("option");
        option.value = t.id;
        option.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`;
        tesseratiSelect.appendChild(option);
      });
      feedback.textContent = "";
    } catch (error) {
      console.error("Errore nel caricamento tesserati:", error);
      feedback.textContent = "Errore nel caricamento tesserati. Riprova più tardi.";
      tesseratiSelect.innerHTML = `<option disabled>Errore nel caricamento</option>`;
    }
  });

  // Quando cambia il tesserato selezionato, carico i corsi suoi
  tesseratiSelect.addEventListener("change", async () => {
    const selectedTesseratoId = tesseratiSelect.value;
    corsiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;

    if (!selectedTesseratoId) {
      return; // Se niente selezionato, pulisco
    }

    try {
      const corsi = await loadCorsiPerTesserato(selectedTesseratoId);
      if (corsi.length === 0) {
        corsiSelect.innerHTML = `<option disabled>Nessun corso trovato</option>`;
        return;
      }
      corsi.forEach(corso => {
        const option = document.createElement("option");
        option.value = corso.id;
        option.textContent = corso.nome || `Corso ${corso.id}`;
        corsiSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Errore nel caricamento corsi:", error);
      corsiSelect.innerHTML = `<option disabled>Errore nel caricamento corsi</option>`;
    }
  });

  // Gestione submit pagamento (opzionale)
  pagamentoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    // Logica per salvare il pagamento
  });
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
