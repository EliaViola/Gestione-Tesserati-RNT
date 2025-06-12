// gestione-pagamenti.js
const db = firebase.firestore();
const auth = firebase.auth();

// Variabile globale per memorizzare i pacchetti del tesserato
let tuttiPacchettiTesserato = [];

// Carica l'elenco dei tesserati attivi
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

// Carica i corsi associati a un tesserato
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

// Carica i pacchetti associati a un tesserato
async function loadPacchettiPerTesserato(tesseratoId) {
  try {
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    const pacchetti = doc.data()?.pacchetti || [];
    
    if (pacchetti.length === 0) return [];
    
    const snap = await db.collection("pacchetti")
      .where(firebase.firestore.FieldPath.documentId(), "in", pacchetti)
      .get();
    
    return snap.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      corsoId: doc.data().corsoId || null
    }));
  } catch (error) {
    console.error("Errore nel caricamento pacchetti:", error);
    throw new Error("Impossibile caricare i pacchetti del tesserato");
  }
}

// Aggiorna la lista dei pacchetti in base al corso selezionato
function updatePacchettiList() {
  const corsoSelezionato = document.getElementById("corsiSelect").value;
  const pSelect = document.getElementById("pacchettiSelect");
  pSelect.innerHTML = "";

  if (tuttiPacchettiTesserato.length === 0) {
    pSelect.innerHTML = '<option disabled>Nessun pacchetto associato</option>';
    return;
  }

  // Filtra i pacchetti per corso selezionato
  const pacchettiFiltrati = corsoSelezionato 
    ? tuttiPacchettiTesserato.filter(p => p.corsoId === corsoSelezionato)
    : tuttiPacchettiTesserato;

  if (pacchettiFiltrati.length === 0) {
    const msg = corsoSelezionato 
      ? 'Nessun pacchetto per questo corso' 
      : 'Nessun pacchetto disponibile';
    pSelect.innerHTML = `<option disabled>${msg}</option>`;
    return;
  }

  // Popola la select con i pacchetti filtrati
  pacchettiFiltrati.forEach(p => {
    const op = document.createElement("option");
    op.value = p.id;
    op.textContent = p.nome || `Pacchetto ${p.id}`;
    pSelect.appendChild(op);
  });
}

// Carica lo storico dei pagamenti per un tesserato
async function caricaStoricoPagamenti(tesseratoId) {
  const storicoPagamentiBody = document.getElementById("storicoPagamentiBody");
  storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Caricamento storico pagamenti...</td></tr>';

  try {
    // Query modificata per evitare necessità di indici complessi
    const pagamentiSnapshot = await db.collection("pagamenti")
      .where("tesseratoId", "==", tesseratoId)
      .get();
    
    // Ordinamento lato client
    const pagamenti = pagamentiSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.data.toDate() - a.data.toDate());

    if (pagamenti.length === 0) {
      storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Nessun pagamento registrato.</td></tr>';
      return;
    }

    // Carica i dettagli dei corsi in parallelo
    const pagamentiPromises = pagamenti.map(async pagamento => {
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

// Inizializzazione della pagina
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

      // Memorizza tutti i pacchetti
      tuttiPacchettiTesserato = pacchetti;

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

      // Mostra tutti i pacchetti inizialmente
      updatePacchettiList();
      
      // Carica storico
      await caricaStoricoPagamenti(id);
    } catch (error) {
      feedback.textContent = error.message;
      feedback.classList.add("error");
    }
  });

  // Gestione cambio corso (filtra pacchetti)
  cSelect.addEventListener("change", updatePacchettiList);

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
    const pacchettiSelezionati = Array.from(pSelect.selectedOptions).map(o => o.value);

    // Validazione campi obbligatori
    if (!tId || !cId || !metodo || isNaN(importo) || !data) {
      feedback.textContent = "Compila tutti i campi obbligatori.";
      feedback.classList.add("error");
      return;
    }

    // Validazione importo
    if (importo <= 0) {
      feedback.textContent = "L'importo deve essere maggiore di zero.";
      feedback.classList.add("error");
      return;
    }

    // Validazione pacchetti (se selezionati)
    if (pacchettiSelezionati.length > 0) {
      const pacchettiNonAppartenenti = pacchettiSelezionati.filter(pId => {
        const pacchetto = tuttiPacchettiTesserato.find(p => p.id === pId);
        return pacchetto && pacchetto.corsoId !== cId;
      });

      if (pacchettiNonAppartenenti.length > 0) {
        feedback.textContent = "Alcuni pacchetti selezionati non appartengono al corso scelto.";
        feedback.classList.add("error");
        return;
      }
    }

    // Prepara i dati del pagamento
    const pagamentoData = {
      tesseratoId: tId,
      corsoId: cId,
      pacchetti: pacchettiSelezionati.filter(p => p), // Rimuovi valori vuoti
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