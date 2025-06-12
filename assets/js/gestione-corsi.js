const db = firebase.firestore();
const auth = firebase.auth();

// Carica i tesserati con tesseramento attivo
async function loadTesserati() {
  try {
    const snapshot = await db.collection("tesserati")
      .where("tesseramento.stato", "==", "attivo")
      .orderBy("anagrafica.cognome")
      .orderBy("anagrafica.nome")
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore nel caricamento tesserati:", error);
    throw error;
  }
}

// Carica i pacchetti salvati da admin
async function loadPacchetti() {
  try {
    const snapshot = await db.collection("pacchetti")
      .orderBy("nome")
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore nel caricamento pacchetti:", error);
    throw error;
  }
}

// Carica l'anteprima degli iscritti al corso
async function loadAnteprimaIscritti(tipoCorso, livello, orario) {
  try {
    const snapshot = await db.collection("corsi")
      .where("tipologia", "==", tipoCorso)
      .where("livello", "==", livello)
      .where("orario", "==", orario)
      .get();
      
    return snapshot.docs.flatMap(doc => doc.data().iscritti || []);
  } catch (error) {
    console.error("Errore nel caricamento anteprima:", error);
    throw error;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("corsoForm");
  const pacchettoSelect = document.getElementById("pacchettiSelect");
  const tesseratiSelect = document.getElementById("tesseratiSelect");
  const tipoCorsoSelect = document.getElementById("tipo_corso");
  const livelloSelect = document.getElementById("livello");
  const orarioSelect = document.getElementById("orario");
  const feedback = document.getElementById("feedback");
  const anteprimaContainer = document.getElementById("anteprimaContainer");

  // Imposta l'anno corrente nel footer
  document.getElementById("currentYear").textContent = new Date().getFullYear();

  // Caricamento iniziale dei dati
  async function init() {
    try {
      const [pacchetti, tesserati] = await Promise.all([
        loadPacchetti(),
        loadTesserati()
      ]);

      // Popola select pacchetti
      pacchettoSelect.innerHTML = "";
      pacchetti.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = p.nome || "Pacchetto senza nome";
        if (p.date && p.date.length > 0) {
          const sortedDates = [...p.date].sort();
          option.textContent += ` (${sortedDates[0]} - ${sortedDates[sortedDates.length - 1]})`;
        }
        pacchettoSelect.appendChild(option);
      });

      // Popola select tesserati
      tesseratiSelect.innerHTML = '<option value="">-- Seleziona --</option>';
      tesserati.forEach(t => {
        const a = t.anagrafica || {};
        const option = document.createElement("option");
        option.value = t.id;
        option.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`.trim();
        tesseratiSelect.appendChild(option);
      });

    } catch (error) {
      console.error("Errore inizializzazione:", error);
      feedback.textContent = "Errore nel caricamento dei dati iniziali";
      feedback.className = "error";
    }
  }

  // Aggiorna anteprima iscritti quando cambiano i filtri
  async function updateAnteprima() {
    const tipoCorso = tipoCorsoSelect.value;
    const livello = livelloSelect.value;
    const orario = orarioSelect.value;

    if (!tipoCorso || !livello || !orario) {
      anteprimaContainer.innerHTML = '<p class="nessun-risultato">Seleziona un corso e un pacchetto per visualizzare gli iscritti</p>';
      return;
    }

    try {
      const iscrittiIds = await loadAnteprimaIscritti(tipoCorso, livello, orario);
      
      if (iscrittiIds.length === 0) {
        anteprimaContainer.innerHTML = '<p class="nessun-risultato">Nessun iscritto trovato per questa combinazione</p>';
        return;
      }

      // Carica i dettagli dei tesserati
      const tesseratiSnapshot = await db.collection("tesserati")
        .where(firebase.firestore.FieldPath.documentId(), "in", iscrittiIds)
        .get();

      let html = '<div class="anteprima-lista"><h3>Iscritti al corso:</h3><ul>';
      tesseratiSnapshot.forEach(doc => {
        const t = doc.data();
        html += `<li>${t.anagrafica?.cognome || ''} ${t.anagrafica?.nome || ''}</li>`;
      });
      html += '</ul></div>';
      
      anteprimaContainer.innerHTML = html;
    } catch (error) {
      console.error("Errore aggiornamento anteprima:", error);
      anteprimaContainer.innerHTML = '<p class="errore">Errore nel caricamento degli iscritti</p>';
    }
  }

  // Aggiungi event listeners
  tipoCorsoSelect.addEventListener("change", updateAnteprima);
  livelloSelect.addEventListener("change", updateAnteprima);
  orarioSelect.addEventListener("change", updateAnteprima);

  // Gestione submit form
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedback.textContent = "";
    feedback.className = "";

    const formData = new FormData(form);
    const tesseratoId = formData.get("tesserati");
    const pacchetti = formData.getAll("pacchetti");

    if (!tesseratoId || pacchetti.length === 0) {
      feedback.textContent = "Seleziona un tesserato e almeno un pacchetto";
      feedback.className = "error";
      return;
    }

    const corsoData = {
      tipologia: formData.get("tipo_corso"),
      livello: formData.get("livello"),
      orario: formData.get("orario"),
      pacchetti: pacchetti,
      iscritti: [tesseratoId],
      note: formData.get("note_corso") || "",
      creato_il: firebase.firestore.FieldValue.serverTimestamp(),
      creato_da: auth.currentUser?.uid || "anonimo"
    };

    try {
      // Usa una transazione per garantire consistenza
      await db.runTransaction(async (transaction) => {
        // Crea il nuovo corso
        const corsoRef = db.collection("corsi").doc();
        transaction.set(corsoRef, corsoData);

        // Aggiorna il tesserato
        const tesseratoRef = db.collection("tesserati").doc(tesseratoId);
        transaction.update(tesseratoRef, {
          corsi: firebase.firestore.FieldValue.arrayUnion(corsoRef.id),
          pacchetti: firebase.firestore.FieldValue.arrayUnion(...pacchetti)
        });

        // Aggiorna i pacchetti se necessario
        for (const pacchettoId of pacchetti) {
          const pacchettoRef = db.collection("pacchetti").doc(pacchettoId);
          transaction.update(pacchettoRef, {
            assegnato_a: firebase.firestore.FieldValue.arrayUnion(tesseratoId)
          });
        }
      });

      feedback.textContent = "Corso assegnato con successo!";
      feedback.className = "success";
      form.reset();
      updateAnteprima();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      feedback.textContent = "Errore durante il salvataggio: " + error.message;
      feedback.className = "error";
    }
  });

  // Inizializza l'applicazione
  init();
});