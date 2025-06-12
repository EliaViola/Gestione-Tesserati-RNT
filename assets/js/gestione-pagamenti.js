// gestione-pagamenti.js
const db = firebase.firestore();
const auth = firebase.auth();

// Funzioni di supporto
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
    throw new Error("Impossibile caricare l'elenco dei tesserati");
  }
}

async function loadCorsiPerTesserato(tesseratoId) {
  try {
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    const corsi = doc.data()?.corsi || [];
    
    if (corsi.length === 0) return [];
    
    const snap = await db.collection("corsi")
      .where(firebase.firestore.FieldPath.documentId(), "in", corsi)
      .get();
    
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore nel caricamento corsi:", error);
    throw new Error("Impossibile caricare i corsi del tesserato");
  }
}

async function loadPacchettiPerTesserato(tesseratoId) {
  try {
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    const pacchetti = doc.data()?.pacchetti || [];
    
    if (pacchetti.length === 0) return [];
    
    const snap = await db.collection("pacchetti")
      .where(firebase.firestore.FieldPath.documentId(), "in", pacchetti)
      .get();
    
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore nel caricamento pacchetti:", error);
    throw new Error("Impossibile caricare i pacchetti del tesserato");
  }
}

async function caricaStoricoPagamenti(tesseratoId) {
  const storicoPagamentiBody = document.getElementById("storicoPagamentiBody");
  storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Caricamento storico pagamenti...</td></tr>';

  try {
    const pagamentiSnapshot = await db.collection("pagamenti")
      .where("tesseratoId", "==", tesseratoId)
      .orderBy("data", "desc")
      .get();

    if (pagamentiSnapshot.empty) {
      storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Nessun pagamento registrato.</td></tr>';
      return;
    }

    const pagamentiPromises = pagamentiSnapshot.docs.map(async doc => {
      const pagamento = doc.data();
      const corsoId = pagamento.corsoId;
      let nomeCorso = corsoId;

      try {
        const corsoDoc = await db.collection("corsi").doc(corsoId).get();
        if (corsoDoc.exists) {
          const corsoData = corsoDoc.data();
          nomeCorso = corsoData.tipologia && corsoData.livello 
            ? `${corsoData.tipologia} - ${corsoData.livello}` 
            : (corsoData.nome || corsoId);
        }
      } catch (e) {
        console.warn("Corso non trovato:", corsoId);
      }

      const dataPag = pagamento.data.toDate().toLocaleDateString('it-IT');
      return `
        <tr>
          <td>${dataPag}</td>
          <td>${nomeCorso}</td>
          <td>€${pagamento.importo.toFixed(2)}</td>
          <td>${pagamento.metodo}</td>
        </tr>
      `;
    });

    const rows = await Promise.all(pagamentiPromises);
    storicoPagamentiBody.innerHTML = rows.join('');

  } catch (error) {
    console.error("Errore nel caricamento storico:", error);
    storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Errore nel caricamento dei pagamenti.</td></tr>';
  }
}

// Inizializzazione pagina
document.addEventListener("DOMContentLoaded", async () => {
  const tSelect = document.getElementById("tesseratiSelect");
  const cSelect = document.getElementById("corsiSelect");
  const pSelect = document.getElementById("pacchettiSelect");
  const form = document.getElementById("pagamentoForm");
  const feedback = document.getElementById("feedback");

  // Imposta la data di oggi come valore predefinito
  document.getElementById("data").valueAsDate = new Date();

  // Gestione autenticazione
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }

    try {
      const tesserati = await loadTesserati();
      tSelect.innerHTML = '<option value="">-- Seleziona --</option>';
      
      tesserati.forEach(t => {
        const a = t.anagrafica || {};
        const op = document.createElement("option");
        op.value = t.id;
        op.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`.trim();
        tSelect.appendChild(op);
      });
    } catch (error) {
      feedback.textContent = error.message;
      feedback.classList.add("error");
    }
  });

  // Gestione cambio tesserato
  tSelect.addEventListener("change", async () => {
    const id = tSelect.value;
    if (!id) return;

    try {
      // Reset campi dipendenti
      cSelect.innerHTML = '<option value="">-- Seleziona --</option>';
      pSelect.innerHTML = '<option value="">Caricamento...</option>';

      // Carica dati in parallelo
      const [corsi, pacchetti] = await Promise.all([
        loadCorsiPerTesserato(id),
        loadPacchettiPerTesserato(id)
      ]);

      // Popola corsi
      corsi.forEach(c => {
        const op = document.createElement("option");
        op.value = c.id;
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

      // Popola pacchetti
      pSelect.innerHTML = "";
      if (pacchetti.length === 0) {
        pSelect.innerHTML = '<option disabled>Nessun pacchetto associato</option>';
      } else {
        pacchetti.forEach(p => {
          const op = document.createElement("option");
          op.value = p.id;
          op.textContent = p.nome || p.id;
          pSelect.appendChild(op);
        });
      }

      // Carica storico
      await caricaStoricoPagamenti(id);
    } catch (error) {
      feedback.textContent = error.message;
      feedback.classList.add("error");
    }
  });

  // Gestione submit form
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

    // Validazione
    if (!tId || !cId || !metodo || isNaN(importo) || !data) {
      feedback.textContent = "Compila tutti i campi obbligatori.";
      feedback.classList.add("error");
      return;
    }

    if (importo <= 0) {
      feedback.textContent = "L'importo deve essere maggiore di zero.";
      feedback.classList.add("error");
      return;
    }

    const pagamentoData = {
      tesseratoId: tId,
      corsoId: cId,
      pacchetti: pacchetti.filter(p => p), // Rimuovi valori vuoti
      importo,
      metodo,
      data: firebase.firestore.Timestamp.fromDate(new Date(data)),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      // Esegui operazioni in batch per consistenza dati
      const batch = db.batch();
      const pagamentoRef = db.collection("pagamenti").doc();
      batch.set(pagamentoRef, pagamentoData);

      // Aggiorna il tesserato
      const tesseratoRef = db.collection("tesserati").doc(tId);
      batch.set(tesseratoRef, {
        pagamenti: {
          [cId]: {
            [pagamentoRef.id]: pagamentoData
          }
        }
      }, { merge: true });

      await batch.commit();

      // Reset form e feedback
      form.reset();
      document.getElementById("data").valueAsDate = new Date();
      feedback.textContent = "Pagamento registrato con successo!";
      feedback.classList.add("success");

      // Ricarica storico
      await caricaStoricoPagamenti(tId);
    } catch (err) {
      console.error("Errore:", err);
      feedback.textContent = "Errore durante la registrazione. Riprova più tardi.";
      feedback.classList.add("error");
    }
  });
});