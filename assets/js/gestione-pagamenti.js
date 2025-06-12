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

  const tesseratoDoc = await db.collection("tesserati").doc(tesseratoId).get();
  if (!tesseratoDoc.exists) return [];

  const tesseratoData = tesseratoDoc.data();
  const corsiIds = tesseratoData.corsi || [];

  if (corsiIds.length === 0) return [];

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

  // Cambio tesserato
  tesseratiSelect.addEventListener("change", async () => {
    const selectedTesseratoId = tesseratiSelect.value;
    corsiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;

    if (!selectedTesseratoId) return;

    try {
      const corsi = await loadCorsiPerTesserato(selectedTesseratoId);
      if (corsi.length === 0) {
        corsiSelect.innerHTML = `<option disabled>Nessun corso trovato</option>`;
      } else {
        corsi.forEach(corso => {
          const option = document.createElement("option");
          option.value = corso.id;
          option.textContent = corso.nome || `Corso ${corso.id}`;
          corsiSelect.appendChild(option);
        });
      }

      // Carica storico pagamenti
      await caricaStoricoPagamenti(selectedTesseratoId);

    } catch (error) {
      console.error("Errore nel caricamento corsi:", error);
      corsiSelect.innerHTML = `<option disabled>Errore nel caricamento corsi</option>`;
    }
  });

  // Invio pagamento
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
      // Salva nella raccolta globale
      const docRef = await db.collection("pagamenti").add(pagamentoData);

      // Salva anche nel profilo del tesserato
      await db.collection("tesserati").doc(tesseratoId).update({
        [`pagamenti.${corsoId}.${docRef.id}`]: pagamentoData
      });

      pagamentoForm.reset();
      corsiSelect.innerHTML = `<option value="">-- Seleziona --</option>`;
      feedback.textContent = "Pagamento registrato con successo.";
      feedback.classList.add("success");

      // Aggiorna lo storico
      await caricaStoricoPagamenti(tesseratoId);

    } catch (error) {
      console.error("Errore durante la registrazione del pagamento:", error);
      feedback.textContent = "Errore nella registrazione del pagamento.";
      feedback.classList.add("error");
    }
  });
});

// Funzione storico
async function caricaStoricoPagamenti(tesseratoId) {
  const storicoContainer = document.getElementById("storico-pagamenti");
  storicoContainer.innerHTML = "";

  try {
    const pagamentiSnapshot = await db.collection("pagamenti")
      .where("tesseratoId", "==", tesseratoId)
      .get();

    const pagamenti = [];

    for (const doc of pagamentiSnapshot.docs) {
      const pagamento = doc.data();
      pagamento.id = doc.id;

      // Recupera nome del corso
      let nomeCorso = "Corso non trovato";
      if (pagamento.corsoId) {
        try {
          const corsoDoc = await db.collection("corsi").doc(pagamento.corsoId).get();
          if (corsoDoc.exists) {
            const corsoData = corsoDoc.data();
            nomeCorso = corsoData.tipologia + " " + corsoData.livello;
          }
        } catch (err) {
          console.error("Errore nel recupero del corso:", err);
        }
      }

      pagamenti.push({
        ...pagamento,
        nomeCorso,
      });
    }

    // Ordina per data decrescente
    pagamenti.sort((a, b) => b.data.toDate() - a.data.toDate());

    for (const pagamento of pagamenti) {
      const data = pagamento.data.toDate().toLocaleDateString();
      const importo = pagamento.importo.toFixed(2);
      const metodo = pagamento.metodo;
      const nomeCorso = pagamento.nomeCorso;

      const row = document.createElement("div");
      row.classList.add("pagamento-row");
      row.innerHTML = `
        <div>${data}</div>
        <div>${nomeCorso}</div>
        <div>${importo} €</div>
        <div>${metodo}</div>
      `;
      storicoContainer.appendChild(row);
    }
  } catch (error) {
    console.error("Errore nel caricamento dello storico pagamenti:", error);
  }
}



