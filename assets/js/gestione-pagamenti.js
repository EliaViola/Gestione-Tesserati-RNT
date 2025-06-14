const db = firebase.firestore();
const auth = firebase.auth();

// Variabili globali
let tuttiPacchettiTesserato = [];
let currentTesseratoId = null;
const storicoPagamentiBody = document.getElementById("storicoPagamentiBody");

// Carica tutti i tesserati attivi
async function loadTesserati() {
  try {
    const snapshot = await db.collection("tesserati")
      .where("tesseramento.stato", "==", "attivo")
      .orderBy("anagrafica.cognome")
      .orderBy("anagrafica.nome")
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      nomeCompleto: `${doc.data().anagrafica?.cognome || ''} ${doc.data().anagrafica?.nome || ''}`.trim()
    }));
  } catch (error) {
    console.error("Errore caricamento tesserati:", error);
    throw new Error("Impossibile caricare l'elenco dei tesserati");
  }
}

// Carica i corsi di un tesserato
async function loadCorsiPerTesserato(tesseratoId) {
  try {
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    if (!doc.exists) return [];
    
    const corsiIds = doc.data()?.corsi || [];
    if (corsiIds.length === 0) return [];
    
    const MAX_IN_CLAUSE = 10;
    const results = [];
    
    for (let i = 0; i < corsiIds.length; i += MAX_IN_CLAUSE) {
      const chunk = corsiIds.slice(i, i + MAX_IN_CLAUSE);
      const snapshot = await db.collection("corsi")
        .where(firebase.firestore.FieldPath.documentId(), "in", chunk)
        .select("tipologia", "livello", "nome")
        .get();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        results.push({
          id: doc.id,
          nomeCorso: data.tipologia && data.livello 
            ? `${data.tipologia} - ${data.livello}`
            : (data.nome || `Corso ${doc.id}`)
        });
      });
    }
    
    return results;
  } catch (error) {
    console.error("Errore caricamento corsi:", error);
    throw new Error("Impossibile caricare i corsi del tesserato");
  }
}

// Carica i pacchetti di un tesserato
async function loadPacchettiPerTesserato(tesseratoId) {
  try {
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    if (!doc.exists) return [];
    
    const pacchettiIds = doc.data()?.pacchetti || [];
    if (pacchettiIds.length === 0) return [];
    
    const MAX_IN_CLAUSE = 10;
    const results = [];
    
    for (let i = 0; i < pacchettiIds.length; i += MAX_IN_CLAUSE) {
      const chunk = pacchettiIds.slice(i, i + MAX_IN_CLAUSE);
      const snapshot = await db.collection("pacchetti")
        .where(firebase.firestore.FieldPath.documentId(), "in", chunk)
        .select("nome", "corsoId")
        .get();
      
      snapshot.docs.forEach(doc => {
        results.push({
          id: doc.id,
          nome: doc.data().nome || `Pacchetto ${doc.id}`,
          corsoId: doc.data().corsoId
        });
      });
    }
    
    return results;
  } catch (error) {
    console.error("Errore caricamento pacchetti:", error);
    throw new Error("Impossibile caricare i pacchetti del tesserato");
  }
}

// Aggiorna la lista dei pacchetti
function updatePacchettiList() {
  const corsoSelezionato = document.getElementById("corsiSelect").value;
  const pSelect = document.getElementById("pacchettiSelect");
  pSelect.innerHTML = "";

  if (tuttiPacchettiTesserato.length === 0) {
    pSelect.innerHTML = '<option disabled>Nessun pacchetto</option>';
    return;
  }

  const pacchettiFiltrati = corsoSelezionato
    ? tuttiPacchettiTesserato.filter(p => p.corsoId === corsoSelezionato)
    : tuttiPacchettiTesserato;

  if (pacchettiFiltrati.length === 0) {
    pSelect.innerHTML = '<option disabled>Nessun pacchetto per questo corso</option>';
    return;
  }

  pacchettiFiltrati.forEach(p => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.nome;
    pSelect.appendChild(option);
  });
}

// Carica lo storico pagamenti
async function caricaStoricoPagamenti(tesseratoId) {
  storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Caricamento...</td></tr>';
  
  try {
    const snapshot = await db.collection("pagamenti")
      .where("tesseratoId", "==", tesseratoId)
      .orderBy("data", "desc")
      .limit(50)
      .get();
    
    if (snapshot.empty) {
      storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Nessun pagamento</td></tr>';
      return;
    }

    const pagamenti = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      let nomeCorso = data.corsoId;
      
      try {
        const corsoDoc = await db.collection("corsi").doc(data.corsoId).get();
        if (corsoDoc.exists) {
          const corsoData = corsoDoc.data();
          nomeCorso = corsoData.tipologia && corsoData.livello
            ? `${corsoData.tipologia} - ${corsoData.livello}`
            : (corsoData.nome || data.corsoId);
        }
      } catch (e) {
        console.warn("Errore caricamento corso:", e);
      }
      
      return `
        <tr>
          <td>${data.data.toDate().toLocaleDateString('it-IT')}</td>
          <td>${nomeCorso}</td>
          <td>€${data.importo.toFixed(2)}</td>
          <td>${data.metodo}</td>
        </tr>
      `;
    }));
    
    storicoPagamentiBody.innerHTML = pagamenti.join('');
  } catch (error) {
    console.error("Errore caricamento storico:", error);
    storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Errore nel caricamento</td></tr>';
  }
}

// Inizializzazione
document.addEventListener("DOMContentLoaded", async () => {
  const tSelect = document.getElementById("tesseratiSelect");
  const cSelect = document.getElementById("corsiSelect");
  const pSelect = document.getElementById("pacchettiSelect");
  const form = document.getElementById("pagamentoForm");
  const feedback = document.getElementById("feedback");

  // Imposta data odierna
  document.getElementById("data").valueAsDate = new Date();

  // Gestione autenticazione
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }

    try {
      feedback.textContent = "Caricamento tesserati...";
      const tesserati = await loadTesserati();
      
      tSelect.innerHTML = '<option value="">-- Seleziona --</option>';
      tesserati.forEach(t => {
        const option = document.createElement("option");
        option.value = t.id;
        option.textContent = `${t.nomeCompleto} (${t.anagrafica?.codice_fiscale || 'N/D'})`;
        tSelect.appendChild(option);
      });
      
      feedback.textContent = "";
    } catch (error) {
      feedback.textContent = error.message;
      feedback.classList.add("error");
    }
  });

  // Cambio tesserato
  tSelect.addEventListener("change", async () => {
    const tesseratoId = tSelect.value;
    
    if (!tesseratoId) {
      resetCampi();
      return;
    }

    try {
      feedback.textContent = "Caricamento dati...";
      feedback.classList.remove("error", "success");
      
      cSelect.innerHTML = '<option value="">-- Seleziona --</option>';
      pSelect.innerHTML = '<option value="">Caricamento...</option>';
      
      const [corsi, pacchetti] = await Promise.all([
        loadCorsiPerTesserato(tesseratoId),
        loadPacchettiPerTesserato(tesseratoId)
      ]);
      
      currentTesseratoId = tesseratoId;
      tuttiPacchettiTesserato = pacchetti;
      
      // Popola corsi
      if (corsi.length > 0) {
        corsi.forEach(c => {
          const option = document.createElement("option");
          option.value = c.id;
          option.textContent = c.nomeCorso;
          cSelect.appendChild(option);
        });
      } else {
        cSelect.innerHTML = '<option value="" disabled>Nessun corso</option>';
      }
      
      // Aggiorna pacchetti e storico
      updatePacchettiList();
      await caricaStoricoPagamenti(tesseratoId);
      
      feedback.textContent = "";
    } catch (error) {
      feedback.textContent = "Errore nel caricamento dei dati";
      feedback.classList.add("error");
      console.error("Errore cambio tesserato:", error);
    }
  });

  // Cambio corso
  cSelect.addEventListener("change", updatePacchettiList);

  // Submit form
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedback.textContent = "";
    feedback.className = "form-feedback";

    const tesseratoId = tSelect.value;
    const corsoId = cSelect.value;
    const importo = parseFloat(document.getElementById("importo").value);
    const metodo = document.getElementById("metodo").value;
    const data = document.getElementById("data").value;
    const pacchettiSelezionati = Array.from(pSelect.selectedOptions)
      .map(opt => opt.value)
      .filter(Boolean);

    // Validazioni
    if (!tesseratoId || !corsoId || isNaN(importo) {
      showError("Compila tutti i campi obbligatori");
      return;
    }

    if (importo <= 0) {
      showError("L'importo deve essere positivo");
      return;
    }

    try {
      feedback.textContent = "Registrazione in corso...";
      
      const batch = db.batch();
      const pagamentoRef = db.collection("pagamenti").doc();
      
      // Dati pagamento
      const pagamentoData = {
        tesseratoId,
        corsoId,
        pacchetti: pacchettiSelezionati,
        importo,
        metodo,
        data: firebase.firestore.Timestamp.fromDate(new Date(data)),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      batch.set(pagamentoRef, pagamentoData);
      
      // Aggiorna tesserato
      const tesseratoRef = db.collection("tesserati").doc(tesseratoId);
      batch.update(tesseratoRef, {
        [`pagamenti.${corsoId}.${pagamentoRef.id}`]: {
          importo,
          data: pagamentoData.data,
          metodo
        }
      });
      
      // Aggiorna pacchetti se selezionati
      if (pacchettiSelezionati.length > 0) {
        pacchettiSelezionati.forEach(pacchettoId => {
          const pacchettoRef = db.collection("pacchetti").doc(pacchettoId);
          batch.update(pacchettoRef, {
            pagato: true,
            dataPagamento: pagamentoData.data
          });
        });
      }
      
      await batch.commit();
      
      // Reset e feedback
      form.reset();
      document.getElementById("data").valueAsDate = new Date();
      feedback.textContent = "Pagamento registrato con successo!";
      feedback.classList.add("success");
      
      // Ricarica dati
      await Promise.all([
        caricaStoricoPagamenti(tesseratoId),
        loadPacchettiPerTesserato(tesseratoId).then(pacchetti => {
          tuttiPacchettiTesserato = pacchetti;
          updatePacchettiList();
        })
      ]);
    } catch (error) {
      showError("Errore durante la registrazione");
      console.error("Errore submit form:", error);
    }
  });

  // Helper functions
  function resetCampi() {
    cSelect.innerHTML = '<option value="">-- Seleziona --</option>';
    pSelect.innerHTML = '<option value="">Seleziona un tesserato</option>';
    storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Seleziona un tesserato</td></tr>';
    currentTesseratoId = null;
    tuttiPacchettiTesserato = [];
  }

  function showError(message) {
    feedback.textContent = message;
    feedback.classList.add("error");
  }
});