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
  const body = document.getElementById("storicoPagamentiBody");
  if (!body) return;

  try {
    const pagSnap = await db.collection("pagamenti")
      .where("tesseratoId", "==", tesseratoId)
      .get();

    if (pagSnap.empty) {
      body.innerHTML = `<tr><td colspan="4">Nessun pagamento registrato</td></tr>`;
      return;
    }

    const pagamenti = [];
    const corsiSet = new Set();

    pagSnap.forEach(doc => {
      const p = doc.data();
      pagamenti.push(p);
      if (p.corsoId) corsiSet.add(p.corsoId);
    });

    pagamenti.sort((a, b) => (b.data?.toDate?.() || 0) - (a.data?.toDate?.() || 0));

    const corsiMap = {};
    if (corsiSet.size > 0) {
      const snap = await db.collection("corsi")
        .where(firebase.firestore.FieldPath.documentId(), "in", Array.from(corsiSet))
        .get();
      snap.forEach(doc => corsiMap[doc.id] = doc.data().nome || `Corso ${doc.id}`);
    }

    body.innerHTML = "";
    pagamenti.forEach(p => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${p.data?.toDate()?.toLocaleDateString("it-IT") || "-"}</td>
        <td>${corsiMap[p.corsoId] || "-"}</td>
        <td>${(p.importo || 0).toFixed(2)}</td>
        <td>${p.metodo || "-"}</td>`;
      body.appendChild(row);
    });

  } catch (err) {
    console.error("Errore storico:", err);
    body.innerHTML = `<tr><td colspan="4">Errore caricamento</td></tr>`;
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
      op.textContent = c.nome || `Corso ${c.id}`;
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
      await db.collection("tesserati").doc(tId).update({
        [`pagamenti.${cId}.${docRef.id}`]: pagamentoData
      });

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
