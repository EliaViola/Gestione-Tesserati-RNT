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
  const doc = await db.collection("tesserati").doc(tesseratoId).get();
  const corsiIds = doc.data()?.corsi || [];
  
  const results = [];
  for (const corsoId of corsiIds) {
    const doc = await db.collection("corsi").doc(corsoId).get();
    if (doc.exists) {
      const data = doc.data();
      results.push({
        id: doc.id,
        nomeCorso: data.tipologia && data.livello 
          ? `${data.tipologia} - ${data.livello}`
          : data.nome || `Corso ${doc.id}`
      });
    }
  }
  return results;
}

async function loadPacchettiPerTesserato(tesseratoId) {
  try {
    console.log(`Caricamento pacchetti per tesserato: ${tesseratoId}`);
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    
    if (!doc.exists) {
      console.log("Tesserato non trovato");
      return [];
    }

    const pacchettiIds = doc.data()?.pacchetti || [];
    console.log(`ID pacchetti trovati: ${JSON.stringify(pacchettiIds)}`);
    
    if (pacchettiIds.length === 0) {
      console.log("Nessun pacchetto associato a questo tesserato");
      return [];
    }

    const results = [];
    for (let i = 0; i < pacchettiIds.length; i += 10) {
      const chunk = pacchettiIds.slice(i, i + 10);
      const snapshot = await db.collection("pacchetti")
        .where(firebase.firestore.FieldPath.documentId(), "in", chunk)
        .get();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        results.push({
          id: doc.id,
          nome: data.nome || `Pacchetto ${doc.id}`,
          corsoId: data.corsoId
        });
      });
    }
    
    console.log(`Pacchetti caricati: ${results.length}`);
    return results;
  } catch (error) {
    console.error("Errore nel caricamento pacchetti:", error);
    throw error;
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

// Helper functions
function resetCampi() {
  document.getElementById("corsiSelect").innerHTML = '<option value="">-- Seleziona --</option>';
  document.getElementById("pacchettiSelect").innerHTML = '<option value="">Seleziona un tesserato</option>';
  storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Seleziona un tesserato</td></tr>';
  currentTesseratoId = null;
  tuttiPacchettiTesserato = [];
}

function showError(message) {
  const feedback = document.getElementById("feedback");
  feedback.textContent = message;
  feedback.classList.add("error");
}

// Inizializzazione
document.addEventListener("DOMContentLoaded", async () => {
  const tSelect = document.getElementById("tesseratiSelect");
  const cSelect = document.getElementById("corsiSelect");
  const pSelect = document.getElementById("pacchettiSelect");
  const form = document.getElementById("pagamentoForm");

  // Imposta data odierna
  document.getElementById("data").valueAsDate = new Date();

  // Gestione autenticazione
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }

    try {
      const feedback = document.getElementById("feedback");
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
      showError(error.message);
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
    console.log(`Tesserato selezionato: ${tesseratoId}`);
    feedback.textContent = "Caricamento dati...";
    
    // Reset campi
    cSelect.innerHTML = '<option value="">-- Seleziona --</option>';
    pSelect.innerHTML = '<option value="">Caricamento...</option>';

    // Carica dati in parallelo
    const [corsi, pacchetti] = await Promise.all([
      loadCorsiPerTesserato(tesseratoId),
      loadPacchettiPerTesserato(tesseratoId)
    ]);

    console.log(`Totale corsi: ${corsi.length}, pacchetti: ${pacchetti.length}`);
    
    // Aggiorna stato globale
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
      cSelect.innerHTML = '<option value="" disabled>Nessun corso associato</option>';
      console.warn("Nessun corso trovato per questo tesserato");
    }

    // Aggiorna pacchetti e storico
    updatePacchettiList();
    await caricaStoricoPagamenti(tesseratoId);
    
    feedback.textContent = "";
  } catch (error) {
    console.error("Errore nel cambio tesserato:", error);
    feedback.textContent = "Errore nel caricamento dei dati";
    feedback.classList.add("error");
  }
});

  // Cambio corso
  cSelect.addEventListener("change", updatePacchettiList);

  // Submit form
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const feedback = document.getElementById("feedback");
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
    if (!tesseratoId || !corsoId || isNaN(importo)) {
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
});