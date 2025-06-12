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

function loadCorsiPerTesserato(tesseratoId) {
  return db.collection("tesserati").doc(tesseratoId).get()
    .then(doc => {
      const corsi = doc.data().corsi || [];
      if (corsi.length === 0) return [];
      return db.collection("corsi")
        .where(firebase.firestore.FieldPath.documentId(), "in", corsi)
        .get()
        .then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
}

function loadPacchettiPerTesserato(tesseratoId) {
  return db.collection("tesserati").doc(tesseratoId).get()
    .then(doc => {
      const pacchetti = doc.data().pacchetti || [];
      if (pacchetti.length === 0) return [];
      return db.collection("pacchetti")
        .where(firebase.firestore.FieldPath.documentId(), "in", pacchetti)
        .get()
        .then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
}

async function caricaStoricoPagamenti(tesseratoId) {
  storicoDiv.innerHTML = "<p>Caricamento storico pagamenti...</p>";

  try {
    const pagamentiSnapshot = await db.collection("pagamenti")
      .where("tesseratoId", "==", tesseratoId)
      .orderBy("data", "desc")
      .get();

    if (pagamentiSnapshot.empty) {
      storicoDiv.innerHTML = "<p>Nessun pagamento registrato.</p>";
      return;
    }

    let html = "<ul>";
    for (const doc of pagamentiSnapshot.docs) {
      const pagamento = doc.data();
      const corsoId = pagamento.corsoId;
      let nomeCorso = corsoId;

      // 🔁 Recupera nome corso da Firestore
      try {
        const corsoDoc = await db.collection("corsi").doc(corsoId).get();
        if (corsoDoc.exists) {
          const corsoData = corsoDoc.data();
          nomeCorso = corsoData.tipologia + " - " + corsoData.livello; // o corsoData.nome se esiste
        }
      } catch (e) {
        console.warn("Corso non trovato:", corsoId);
      }

      const dataPag = pagamento.data.toDate().toLocaleDateString();
      html += `
        <li>
          <strong>Corso:</strong> ${nomeCorso}<br>
          <strong>Data:</strong> ${dataPag}<br>
          <strong>Importo:</strong> €${pagamento.importo}<br>
          <strong>Metodo:</strong> ${pagamento.metodo}<br>
          <strong>Pacchetti:</strong> ${pagamento.pacchetti.join(", ")}
        </li><hr>
      `;
    }
    html += "</ul>";
    storicoDiv.innerHTML = html;

  } catch (error) {
    console.error("Errore nel caricamento storico:", error);
    storicoDiv.innerHTML = "<p>Errore nel caricamento dei pagamenti.</p>";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const tSelect = document.getElementById("tesseratiSelect");
  const cSelect = document.getElementById("corsiSelect");
  const pSelect = document.getElementById("pacchettiSelect");
  const form = document.getElementById("pagamentoForm");
  const feedback = document.getElementById("feedback");

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    const tesserati = await loadTesserati();
    tSelect.innerHTML = `<option value="">-- Seleziona --</option>`;
    tesserati.forEach(t => {
      const a = t.anagrafica || {};
      const op = document.createElement("option");
      op.value = t.id;
      op.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`;
      tSelect.appendChild(op);
    });
  });

  tSelect.addEventListener("change", async () => {
    const id = tSelect.value;
    if (!id) return;

    // Corsi
    const corsi = await loadCorsiPerTesserato(id);
    cSelect.innerHTML = `<option value="">-- Seleziona --</option>`;
    corsi.forEach(c => {
  const op = document.createElement("option");
  op.value = c.id;

  // Costruisci nome leggibile, esempio:
  let nomeCorso = "";
  if (c.tipologia && c.livello) {
    nomeCorso = `${c.tipologia} - ${c.livello}`;
  } else if (c.nome) {
    nomeCorso = c.nome;
  } else {
    nomeCorso = `Corso ${c.id}`;
  }

  op.textContent = nomeCorso;
  cSelect.appendChild(op);
});

    // Pacchetti
    const pacchetti = await loadPacchettiPerTesserato(id);
    pSelect.innerHTML = "";
    if (pacchetti.length === 0) {
      pSelect.innerHTML = `<option disabled>Nessun pacchetto associato</option>`;
    } else {
      pacchetti.forEach(p => {
        const op = document.createElement("option");
        op.value = p.id;
        op.textContent = p.nome || p.id;
        pSelect.appendChild(op);
      });
    }

    await caricaStoricoPagamenti(id);
  });

  form.addEventListener("submit", async (e) => {
  e.preventDefault();
  feedback.textContent = "";
  feedback.className = "form-feedback";

  const tId = tSelect.value;
  const cId = cSelect.value;
  const importo = parseFloat(document.getElementById("importo").value);
  const metodo = document.getElementById("metodo").value;
  const data = document.getElementById("data").value;
  const pacchetti = Array.from(pSelect.selectedOptions).map(o => o.value);

  if (!tId || !cId || !metodo || isNaN(importo) || !data || pacchetti.length === 0) {
    feedback.textContent = "Compila tutti i campi obbligatori.";
    feedback.classList.add("error");
    return;
  }

  const pagamentoData = {
    tesseratoId: tId,
    corsoId: cId,
    pacchetti,
    importo,
    metodo,
    data: firebase.firestore.Timestamp.fromDate(new Date(data)),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    const docRef = await db.collection("pagamenti").add(pagamentoData);

    // Aggiungi anche nel documento del tesserato
    await db.collection("tesserati").doc(tId).set({
      pagamenti: {
        [cId]: {
          [docRef.id]: pagamentoData
        }
      }
    }, { merge: true });

    form.reset();
    cSelect.innerHTML = `<option value="">-- Seleziona --</option>`;
    pSelect.innerHTML = `<option>Seleziona tesserato</option>`;
    feedback.textContent = "Pagamento registrato con successo.";
    feedback.classList.add("success");

    await caricaStoricoPagamenti(tId);
  } catch (err) {
    console.error("Errore:", err);
    feedback.textContent = "Errore durante la registrazione.";
    feedback.classList.add("error");
  }
});

});
