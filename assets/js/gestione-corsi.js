// Inizializza Firebase solo se non è già stata inizializzata
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();


// Imposta impostazioni di persistenza (opzionale)
db.enablePersistence()
  .catch((err) => {
    console.error("Errore nell'abilitare la persistenza:", err);
  });

// Funzioni per gestire i corsi
async function loadTesserati() {
  try {
    console.log("Inizio caricamento tesserati...");
    
    const snapshot = await db.collection("tesserati")
      .where("tesseramento.stato", "==", "attivo")
      .orderBy("anagrafica.cognome")
      .orderBy("anagrafica.nome")
      .get();

    console.log(`Trovati ${snapshot.size} documenti`);
    
    const result = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`Documento ID: ${doc.id}`, data);
      return {
        id: doc.id,
        ...data,
        nomeCompleto: `${data.anagrafica.nome} ${data.anagrafica.cognome}`
      };
    });

    console.log("Dati trasformati:", result);
    return result;

  } catch (error) {
    console.error("Errore completo:", error);
    console.error("Dettagli errore:", {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    showFeedback(`Errore tecnico: ${error.message}`, "error");
    return [];
  }
}

async function loadPacchetti() {
  try {
    const snapshot = await db.collection("pacchetti")
      .orderBy("nome")
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore nel caricamento dei pacchetti:", error);
    showFeedback("Impossibile caricare i pacchetti", "error");
    return [];
  }
}

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

async function populateTesseratiSelect() {
  const select = document.getElementById("tesserati");
  const tesserati = await loadTesserati();
  
  select.innerHTML = '<option value="">-- Seleziona tesserato --</option>';
  
  tesserati.forEach(tesserato => {
    const option = document.createElement("option");
    option.value = tesserato.id;
    option.textContent = `${tesserato.anagrafica.cognome} ${tesserato.anagrafica.nome} (${tesserato.anagrafica.codice_fiscale || 'N/D'})`;
    option.dataset.cf = tesserato.anagrafica.codice_fiscale || '';
    select.appendChild(option);
  });
}

async function populatePacchettiSelect() {
  const select = document.getElementById("pacchettiSelect");
  const pacchetti = await loadPacchetti();
  
  select.innerHTML = '';
  
  pacchetti.forEach(pacchetto => {
    const option = document.createElement("option");
    option.value = pacchetto.id;
    option.textContent = `${pacchetto.nome} (${pacchetto.durata} - €${pacchetto.prezzo})`;
    select.appendChild(option);
  });
}

async function populateIstruttoriList() {
  const datalist = document.getElementById("istruttoriList");
  const istruttori = await loadIstruttori();
  
  datalist.innerHTML = '';
  
  istruttori.forEach(istruttore => {
    const option = document.createElement("option");
    option.value = istruttore;
    datalist.appendChild(option);
  });
}

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

async function salvaIscrizione(data) {
  try {
    // Aggiungi metadata
    const metadata = {
      creatoIl: firebase.firestore.FieldValue.serverTimestamp(),
      creatoDa: firebase.auth().currentUser.uid,
      ultimaModifica: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Salva il corso nel database
    const corsoRef = await db.collection("corsi").add({
      ...data,
      ...metadata,
      dataIscrizione: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Aggiorna il tesserato con il nuovo corso
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

async function aggiornaAnteprima() {
  const corsoSelezionato = document.getElementById("tipo_corso").value;
  const pacchettiSelezionati = Array.from(document.getElementById("pacchettiSelect").selectedOptions)
    .map(option => option.value);
  const container = document.getElementById("anteprimaContainer");

  container.innerHTML = '<div class="loading-spinner"></div>';

  if (!corsoSelezionato || pacchettiSelezionati.length === 0) {
    container.innerHTML = '<p class="nessun-risultato">Seleziona un corso e un pacchetto per visualizzare gli iscritti</p>';
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
    
    // Per ogni corso trovato, otteniamo i dettagli del tesserato
    const promises = snapshot.docs.map(async doc => {
      const corso = doc.data();
      const tesseratoDoc = await db.collection("tesserati").doc(corso.tesserato).get();
      const tesserato = tesseratoDoc.data();

      const card = document.createElement("div");
      card.className = "iscritto-card";
      
      const dataIscrizione = corso.dataIscrizione ? corso.dataIscrizione.toDate().toLocaleDateString("it-IT") : "N/D";
      
      card.innerHTML = `
        <h4>${tesserato.anagrafica.cognome} ${tesserato.anagrafica.nome}</h4>
        <p><strong>CF:</strong> ${tesserato.anagrafica.codice_fiscale || 'N/D'}</p>
        <p><strong>Corso:</strong> ${corso.tipo_corso} (Livello ${corso.livello})</p>
        <p><strong>Pacchetti:</strong> ${corso.pacchetti.join(", ")}</p>
        <p><strong>Orario:</strong> ${corso.orario}</p>
        <p><strong>Istruttore:</strong> ${corso.istruttore}</p>
        <p><small>Iscritto il: ${dataIscrizione}</small></p>
      `;
      
      container.appendChild(card);
    });
    
    await Promise.all(promises);
  } catch (error) {
    console.error("Errore nel caricamento dell'anteprima:", error);
    container.innerHTML = '<p class="nessun-risultato">Errore nel caricamento dei dati</p>';
  }
}

// Funzione di utilità per mostrare feedback
function showFeedback(message, type) {
  const feedbackDiv = document.getElementById("feedbackMessage") || document.createElement("div");
  feedbackDiv.id = "feedbackMessage";
  feedbackDiv.className = `feedback-message ${type}`;
  feedbackDiv.innerHTML = message;
  
  if (!document.getElementById("feedbackMessage")) {
    const form = document.getElementById("corsoForm");
    form.prepend(feedbackDiv);
  }
  
  setTimeout(() => {
    feedbackDiv.style.opacity = '0';
    setTimeout(() => feedbackDiv.remove(), 500);
  }, 5000);
}

// Inizializzazione
document.addEventListener("DOMContentLoaded", async () => {
  // Verifica autenticazione
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }
    
    try {
      const idToken = await user.getIdTokenResult();
      if (!idToken.claims.secretary) {
        await firebase.auth().signOut();
        window.location.href = '../index.html';
      } else {
        initApp();
      }
    } catch (error) {
      console.error('Error verifying role:', error);
      window.location.href = '../index.html';
    }
  });
  
  async function initApp() {
    // Imposta l'anno corrente nel footer
    document.getElementById("currentYear").textContent = new Date().getFullYear();
    
    // Popola i select
    await Promise.all([
      populateTesseratiSelect(),
      populatePacchettiSelect(),
      populateIstruttoriList()
    ]);

    // Gestione del form
    document.getElementById("corsoForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const form = e.target;
      const formData = {
        tesserato: form.tesserato.value,
        tipo_corso: form.tipo_corso.value,
        livello: form.livello.value,
        istruttore: form.istruttore.value.trim(),
        pacchetti: Array.from(form.pacchettiSelect.selectedOptions).map(option => option.value),
        orario: form.orario.value,
        note: form.note.value.trim()
      };
      
      if (validateForm(formData)) {
        const success = await salvaIscrizione(formData);
        if (success) {
          form.reset();
          aggiornaAnteprima();
          await populateTesseratiSelect(); // Ricarica i tesserati
        }
      }
    });

    // Aggiorna l'anteprima quando cambiano i campi
    document.getElementById("tipo_corso").addEventListener("change", aggiornaAnteprima);
    document.getElementById("pacchettiSelect").addEventListener("change", aggiornaAnteprima);
    
    // Logout
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      try {
        await firebase.auth().signOut();
        window.location.href = '../index.html';
      } catch (error) {
        showFeedback("Errore durante il logout", "error");
      }
    });
  }
});
