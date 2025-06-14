const db = firebase.firestore();
const auth = firebase.auth();

// Gestione dello stato dell'applicazione
const appState = {
  pacchetti: [],
  currentTesseratoId: null,
  elements: {
    tesseratiSelect: document.getElementById("tesseratiSelect"),
    corsiSelect: document.getElementById("corsiSelect"),
    pacchettiSelect: document.getElementById("pacchettiSelect"),
    importoInput: document.getElementById("importo"),
    metodoSelect: document.getElementById("metodo"),
    dataInput: document.getElementById("data"),
    feedback: document.getElementById("feedback"),
    storicoPagamentiBody: document.getElementById("storicoPagamentiBody"),
    form: document.getElementById("pagamentoForm")
  }
};

// Inizializzazione dell'applicazione
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});

function initializeApp() {
  // Imposta la data odierna
  appState.elements.dataInput.valueAsDate = new Date();
  
  // Configura gli event listeners
  setupEventListeners();
  
  // Gestione autenticazione
  auth.onAuthStateChanged(handleAuthStateChange);
}

function setupEventListeners() {
  appState.elements.tesseratiSelect.addEventListener("change", handleTesseratoChange);
  appState.elements.corsiSelect.addEventListener("change", updatePacchettiList);
  appState.elements.form.addEventListener("submit", handleFormSubmit);
}

async function handleAuthStateChange(user) {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  
  try {
    showLoading("Caricamento tesserati...");
    await loadTesserati();
    clearFeedback();
  } catch (error) {
    showError("Errore nel caricamento tesserati");
    console.error("Errore inizializzazione:", error);
  }
}

// Caricamento tesserati attivi
async function loadTesserati() {
  try {
    const snapshot = await db.collection("tesserati")
      .where("tesseramento.stato", "==", "attivo")
      .orderBy("anagrafica.cognome")
      .orderBy("anagrafica.nome")
      .get();
    
    populateTesseratiSelect(snapshot.docs);
  } catch (error) {
    console.error("Errore caricamento tesserati:", error);
    throw error;
  }
}

function populateTesseratiSelect(docs) {
  const select = appState.elements.tesseratiSelect;
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  
  docs.forEach(doc => {
    const data = doc.data();
    const anagrafica = data.anagrafica || {};
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = `${anagrafica.cognome || ''} ${anagrafica.nome || ''}`.trim() + 
                       ` (${anagrafica.codice_fiscale || 'N/D'})`;
    select.appendChild(option);
  });
}

// Gestione cambio tesserato
async function handleTesseratoChange() {
  const tesseratoId = appState.elements.tesseratiSelect.value;
  
  if (!tesseratoId) {
    resetUI();
    return;
  }

  try {
    showLoading("Caricamento dati...");
    resetDependentFields();
    
    const [corsi, pacchetti] = await Promise.all([
      loadCorsiPerTesserato(tesseratoId),
      loadPacchettiPerTesserato(tesseratoId)
    ]);

    appState.currentTesseratoId = tesseratoId;
    appState.pacchetti = pacchetti;

    populateCorsiSelect(corsi);
    updatePacchettiList();
    await caricaStoricoPagamenti(tesseratoId);
    
    clearFeedback();
  } catch (error) {
    showError("Errore nel caricamento dati");
    console.error("Errore cambio tesserato:", error);
  }
}

// Caricamento corsi con gestione struttura dati flessibile
async function loadCorsiPerTesserato(tesseratoId) {
  try {
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    
    if (!doc.exists) return [];

    const corsiData = doc.data()?.corsi;
    const corsiIds = convertToArray(corsiData);

    if (corsiIds.length === 0) return [];

    return await fetchCorsiDetails(corsiIds);
  } catch (error) {
    console.error("Errore caricamento corsi:", error);
    throw error;
  }
}

// Caricamento pacchetti associati ai corsi del tesserato
async function loadPacchettiPerTesserato(tesseratoId) {
  try {
    // Prima carica i corsi per ottenere gli ID corso
    const corsi = await loadCorsiPerTesserato(tesseratoId);
    const corsiIds = corsi.map(c => c.id);

    if (corsiIds.length === 0) return [];

    // Poi carica i pacchetti associati a questi corsi
    return await fetchPacchettiDetails(corsiIds);
  } catch (error) {
    console.error("Errore caricamento pacchetti:", error);
    throw error;
  }
}

// Helper per convertire dati in array
function convertToArray(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null) return Object.keys(data);
  return [];
}

// Recupera dettagli corsi con chunking
async function fetchCorsiDetails(ids) {
  const results = [];
  
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const snapshot = await db.collection("corsi")
      .where(firebase.firestore.FieldPath.documentId(), "in", chunk)
      .get();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      results.push({
        id: doc.id,
        nomeCorso: generateCorsoName(data),
        ...data
      });
    });
  }
  
  return results;
}

// Recupera pacchetti per corsi specifici
async function fetchPacchettiDetails(corsiIds) {
  const results = [];
  
  for (const corsoId of corsiIds) {
    const snapshot = await db.collection("pacchetti")
      .where("corsoId", "==", corsoId)
      .get();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      results.push({
        id: doc.id,
        nome: data.nome || `Pacchetto ${doc.id}`,
        corsoId: data.corsoId,
        pagato: data.pagato || false,
        dataPagamento: data.dataPagamento || null,
        ...data
      });
    });
  }
  
  return results;
}

// Genera nome corso standardizzato
function generateCorsoName(corsoData) {
  return corsoData.tipologia && corsoData.livello 
    ? `${corsoData.tipologia} - ${corsoData.livello}`
    : corsoData.nome || `Corso ${corsoData.id}`;
}

// Popola select corsi
function populateCorsiSelect(corsi) {
  const select = appState.elements.corsiSelect;
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  
  if (corsi.length === 0) {
    select.innerHTML = '<option value="" disabled>Nessun corso associato</option>';
    return;
  }

  // Ordina i corsi per nome
  corsi.sort((a, b) => a.nomeCorso.localeCompare(b.nomeCorso));

  corsi.forEach(corso => {
    const option = document.createElement("option");
    option.value = corso.id;
    option.textContent = corso.nomeCorso;
    select.appendChild(option);
  });
}

// Aggiorna lista pacchetti filtrata per corso
function updatePacchettiList() {
  const corsoSelezionato = appState.elements.corsiSelect.value;
  const select = appState.elements.pacchettiSelect;
  select.innerHTML = "";

  if (appState.pacchetti.length === 0) {
    select.innerHTML = '<option disabled>Nessun pacchetto</option>';
    return;
  }

  // Filtra per corso selezionato o mostra tutti se nessun corso selezionato
  const pacchettiFiltrati = corsoSelezionato
    ? appState.pacchetti.filter(p => p.corsoId === corsoSelezionato)
    : appState.pacchetti;

  if (pacchettiFiltrati.length === 0) {
    select.innerHTML = '<option disabled>Nessun pacchetto per questo corso</option>';
    return;
  }

  // Ordina e popola la select
  pacchettiFiltrati.sort((a, b) => a.nome.localeCompare(b.nome))
    .forEach(p => {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.nome;
      
      if (p.pagato) {
        option.style.textDecoration = "line-through";
        option.title = "Pagato il " + (p.dataPagamento?.toDate?.()?.toLocaleDateString('it-IT') || "data sconosciuta");
      }
      
      select.appendChild(option);
    });
}

// Caricamento storico pagamenti
async function caricaStoricoPagamenti(tesseratoId) {
  appState.elements.storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Caricamento...</td></tr>';
  
  try {
    const snapshot = await db.collection("pagamenti")
      .where("tesseratoId", "==", tesseratoId)
      .orderBy("data", "desc")
      .limit(50)
      .get();
    
    if (snapshot.empty) {
      appState.elements.storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Nessun pagamento</td></tr>';
      return;
    }

    const rows = await Promise.all(snapshot.docs.map(doc => createPaymentRow(doc)));
    appState.elements.storicoPagamentiBody.innerHTML = rows.join('');
  } catch (error) {
    console.error("Errore caricamento storico:", error);
    appState.elements.storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Errore nel caricamento</td></tr>';
  }
}

// Crea riga tabella storico
async function createPaymentRow(doc) {
  const data = doc.data();
  const nomeCorso = await getCorsoName(data.corsoId);
  
  return `
    <tr>
      <td>${data.data.toDate().toLocaleDateString('it-IT')}</td>
      <td>${nomeCorso}</td>
      <td>€${data.importo.toFixed(2)}</td>
      <td>${data.metodo}</td>
    </tr>
  `;
}

// Recupera nome corso
async function getCorsoName(corsoId) {
  try {
    const doc = await db.collection("corsi").doc(corsoId).get();
    if (!doc.exists) return corsoId;
    
    const data = doc.data();
    return generateCorsoName(data);
  } catch (e) {
    console.warn("Errore recupero nome corso:", e);
    return corsoId;
  }
}

// Gestione submit form
async function handleFormSubmit(e) {
  e.preventDefault();
  clearFeedback();

  const formData = getFormData();
  
  if (!validateForm(formData)) return;

  try {
    showLoading("Registrazione in corso...");
    
    await registerPayment(formData);
    await updateUIAfterPayment(formData.tesseratoId);
    
    showSuccess("Pagamento registrato con successo!");
  } catch (error) {
    showError("Errore durante la registrazione");
    console.error("Errore submit form:", error);
  }
}

// Estrae dati dal form
function getFormData() {
  return {
    tesseratoId: appState.elements.tesseratiSelect.value,
    corsoId: appState.elements.corsiSelect.value,
    importo: parseFloat(appState.elements.importoInput.value),
    metodo: appState.elements.metodoSelect.value,
    data: appState.elements.dataInput.value,
    pacchetti: Array.from(appState.elements.pacchettiSelect.selectedOptions)
      .map(opt => opt.value)
      .filter(Boolean)
  };
}

// Validazione form
function validateForm({ tesseratoId, corsoId, importo }) {
  if (!tesseratoId || !corsoId || isNaN(importo)) {
    showError("Compila tutti i campi obbligatori");
    return false;
  }

  if (importo <= 0) {
    showError("L'importo deve essere positivo");
    return false;
  }

  return true;
}

// Registra pagamento nel database
async function registerPayment({ tesseratoId, corsoId, importo, metodo, data, pacchetti }) {
  const batch = db.batch();
  const pagamentoRef = db.collection("pagamenti").doc();
  
  const pagamentoData = {
    tesseratoId,
    corsoId,
    pacchetti,
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
  if (pacchetti.length > 0) {
    pacchetti.forEach(pacchettoId => {
      const pacchettoRef = db.collection("pacchetti").doc(pacchettoId);
      batch.update(pacchettoRef, {
        pagato: true,
        dataPagamento: pagamentoData.data
      });
    });
  }
  
  await batch.commit();
}

// Aggiorna UI dopo pagamento
async function updateUIAfterPayment(tesseratoId) {
  appState.elements.form.reset();
  appState.elements.dataInput.valueAsDate = new Date();
  
  await Promise.all([
    caricaStoricoPagamenti(tesseratoId),
    refreshPacchetti(tesseratoId)
  ]);
}

// Ricarica pacchetti
async function refreshPacchetti(tesseratoId) {
  appState.pacchetti = await loadPacchettiPerTesserato(tesseratoId);
  updatePacchettiList();
}

// Helpers UI
function resetUI() {
  appState.elements.corsiSelect.innerHTML = '<option value="">-- Seleziona --</option>';
  appState.elements.pacchettiSelect.innerHTML = '<option value="">Seleziona un tesserato</option>';
  appState.elements.storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Seleziona un tesserato</td></tr>';
  appState.currentTesseratoId = null;
  appState.pacchetti = [];
}

function resetDependentFields() {
  appState.elements.corsiSelect.innerHTML = '<option value="">-- Seleziona --</option>';
  appState.elements.pacchettiSelect.innerHTML = '<option value="">Caricamento...</option>';
}

function showLoading(message) {
  appState.elements.feedback.textContent = message;
  appState.elements.feedback.className = "form-feedback";
}

function showError(message) {
  appState.elements.feedback.textContent = message;
  appState.elements.feedback.classList.add("error");
}

function showSuccess(message) {
  appState.elements.feedback.textContent = message;
  appState.elements.feedback.classList.add("success");
}

function clearFeedback() {
  appState.elements.feedback.textContent = "";
  appState.elements.feedback.className = "form-feedback";
}