// Inizializza Firebase solo se non è già inizializzata
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Abilita persistenza IndexedDB con sincronizzazione multi-tab
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistenza non abilitata: già attiva in un altro tab');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistenza non supportata dal browser');
    } else {
      console.error("Errore nell'abilitare la persistenza:", err);
    }
  });

// Carica tesserati attivi, ordinati per cognome e nome
async function loadTesserati() {
  try {
    const snapshot = await db.collection("tesserati")
      .where("tesseramento.stato", "==", "attivo")
      .orderBy("anagrafica.cognome")
      .orderBy("anagrafica.nome")
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        nomeCompleto: `${data.anagrafica.cognome} ${data.anagrafica.nome}`
      };
    });
  } catch (error) {
    console.error("Errore durante il caricamento dei tesserati:", error);
    return [];
  }
}

// Popola select tesserati
async function populateTesseratiSelect() {
  const select = document.getElementById("tesserati");
  if (!select) return;
  
  const tesserati = await loadTesserati();
  select.innerHTML = '';

  tesserati.forEach(tesserato => {
    const option = document.createElement("option");
    option.value = tesserato.id;
    option.textContent = `${tesserato.anagrafica.cognome} ${tesserato.anagrafica.nome} (${tesserato.anagrafica.codice_fiscale || 'N/D'})`;
    select.appendChild(option);
  });
}

// Carica pacchetti con date ordinate
async function loadPacchetti() {
  try {
    const snapshot = await db.collection('pacchetti').get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      const sortedDates = Array.isArray(data.date) ? data.date.slice().sort((a, b) => new Date(a) - new Date(b)) : [];
      return {
        id: doc.id,
        nome: data.nome,
        durata: data.durata || '',
        prezzo: data.prezzo || '',
        date: sortedDates
      };
    });
  } catch (error) {
    console.error('Errore nel caricamento dei pacchetti:', error);
    return [];
  }
}

// Popola select multiplo pacchetti
async function populatePacchettiSelect() {
  const select = document.getElementById("pacchettiSelect");
  if (!select) return;
  
  const pacchetti = await loadPacchetti();
  select.innerHTML = '';

  pacchetti.forEach(pacchetto => {
    const option = document.createElement("option");
    const primaData = pacchetto.date.length ? pacchetto.date[0] : 'N/D';
    const ultimaData = pacchetto.date.length ? pacchetto.date[pacchetto.date.length - 1] : 'N/D';
    option.value = pacchetto.id;
    option.textContent = `${pacchetto.nome} – Dal: ${primaData} al: ${ultimaData} (€${pacchetto.prezzo})`;
    select.appendChild(option);
  });
}

// Carica istruttori attivi e ordina per nome
async function loadIstruttori() {
  try {
    const snapshot = await db.collection("istruttori")
      .where("attivo", "==", true)
      .orderBy("nome")
      .get();
    return snapshot.docs.map(doc => doc.data().nome);
  } catch (error) {
    console.error("Errore nel caricamento degli istruttori:", error);
    showFeedback("Impossibile caricare gli istruttori", "error");
    return [];
  }
}

// Popola datalist istruttori
async function populateIstruttoriList() {
  const datalist = document.getElementById("istruttoriList");
  if (!datalist) return;

  const istruttori = await loadIstruttori();
  datalist.innerHTML = '';

  istruttori.forEach(nome => {
    const option = document.createElement("option");
    option.value = nome;
    datalist.appendChild(option);
  });
}

// Validazione form
function validateForm(data) {
  const errors = [];

  if (!data.tesserato) errors.push("Seleziona un tesserato");
  if (!data.tipo_corso) errors.push("Seleziona il tipo di corso");
  if (!data.livello) errors.push("Seleziona il livello");
  if (!data.istruttore.trim()) errors.push("Inserisci l'istruttore responsabile");
  if (!data.pacchetti || data.pacchetti.length === 0) errors.push("Seleziona almeno un pacchetto");
  if (!data.orario) errors.push("Seleziona un orario");

  if (errors.length > 0) {
    showFeedback(errors.join("<br>"), "error");
    return false;
  }
  return true;
}

// Salva iscrizione corso e aggiorna tesserato
async function salvaIscrizione(data) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Utente non autenticato");

    const metadata = {
      creatoIl: firebase.firestore.FieldValue.serverTimestamp(),
      creatoDa: user.uid,
      ultimaModifica: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Salva corso
    const corsoRef = await db.collection("corsi").add({
      ...data,
      ...metadata,
      dataIscrizione: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Aggiorna array corsi nel tesserato
    await db.collection("tesserati").doc(data.tesserato).update({
      corsi: firebase.firestore.FieldValue.arrayUnion({
        id: corsoRef.id,
        tipo: data.tipo_corso,
        livello: data.livello,
        istruttore: data.istruttore,
        pacchetti: data.pacchetti,
        orario: data.orario,
        dataIscrizione: firebase.firestore.FieldValue.serverTimestamp()
      })
    });

    showFeedback("Corso assegnato con successo al tesserato", "success");
    return true;
  } catch (error) {
    console.error("Errore nel salvataggio:", error);
    showFeedback(`Errore nel salvataggio: ${error.message}`, "error");
    return false;
  }
}

// Aggiorna anteprima iscritti per corso e pacchetti selezionati
async function aggiornaAnteprima() {
  const corsoSelezionato = document.getElementById("tipo_corso").value;
  const pacchettiSelezionati = Array.from(document.getElementById("pacchettiSelect").selectedOptions)
    .map(option => option.value);
  const container = document.getElementById("anteprimaContainer");
  container.innerHTML = '<div class="loading-spinner"></div>';

  if (!corsoSelezionato || pacchettiSelezionati.length === 0) {
    container.innerHTML = '<p class="nessun-risultato">Seleziona un corso e almeno un pacchetto per visualizzare gli iscritti</p>';
    return;
  }

  try {
    const snapshot = await db.collection("corsi")
      .where("tipo_corso", "==", corsoSelezionato)
      .where("pacchetti", "array-contains-any", pacchettiSelezionati)
      .orderBy("dataIscrizione", "desc")
      .limit(20)
      .get();

    if (snapshot.empty) {
      container.innerHTML = '<p class="nessun-risultato">Nessun iscritto trovato per questa combinazione</p>';
      return;
    }

    container.innerHTML = '<h3>Ultimi 20 iscritti:</h3>';

    const promises = snapshot.docs.map(async doc => {
      const corso = doc.data();
      const tesseratoDoc = await db.collection("tesserati").doc(corso.tesserato).get();
      const tesserato = tesseratoDoc.data();

      const card = document.createElement("div");
      card.className = "iscritto-card";

      const dataIscrizione = corso.dataIscrizione ? corso.dataIscrizione.toDate().toLocaleDateString("it-IT") : "N/D";

      card.innerHTML = `
        <h4>${tesserato.anagrafica.cognome} ${tesserato.anagrafica.nome}</h4>
        <p><strong>CF:</strong
