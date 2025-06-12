const db = firebase.firestore();
const auth = firebase.auth();

// Funzione per caricare tesserati con tesseramento attivo
function loadTesserati() {
  return db.collection("tesserati")
    .where("tesseramento.stato", "==", "attivo")
    .orderBy("anagrafica.cognome")
    .orderBy("anagrafica.nome")
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

document.addEventListener("DOMContentLoaded", () => {
  const tesseratiSelect = document.getElementById("tesseratiSelect");
  const feedback = document.getElementById("feedback");
  const pagamentoForm = document.getElementById("pagamentoForm");

  if (!tesseratiSelect || !feedback || !pagamentoForm) {
    console.error("Elementi HTML mancanti.");
    return;
  }

  // Attende autenticazione utente
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      feedback.textContent = "Errore: utente non autenticato. Effettua il login.";
      tesseratiSelect.innerHTML = `<option disabled>Accesso non autorizzato</option>`;
      return;
    }

    // Utente autenticato, carica tesserati
    try {
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
