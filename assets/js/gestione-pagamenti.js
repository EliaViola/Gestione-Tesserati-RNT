const db = firebase.firestore();
const auth = firebase.auth();

// Variabile globale per memorizzare i pacchetti del tesserato
let tuttiPacchettiTesserato = [];
let currentTesseratoId = null;

// Carica l'elenco dei tesserati attivi
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
    console.error("Errore nel caricamento tesserati:", error);
    throw new Error("Impossibile caricare l'elenco dei tesserati");
  }
}

// Carica i corsi associati a un tesserato
async function loadCorsiPerTesserato(tesseratoId) {
  try {
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    if (!doc.exists) {
      throw new Error("Tesserato non trovato");
    }

    const corsi = doc.data()?.corsi || [];
    
    // Se non ci sono corsi, restituisci array vuoto immediatamente
    if (!corsi || corsi.length === 0) {
      return [];
    }

    // Firestore limita a 10 elementi negli array per le query 'in'
    // Dividiamo in chunk se necessario
    const MAX_IN_CLAUSE = 10;
    const chunks = [];
    for (let i = 0; i < corsi.length; i += MAX_IN_CLAUSE) {
      chunks.push(corsi.slice(i, i + MAX_IN_CLAUSE));
    }

    // Esegui le query in parallelo
    const promises = chunks.map(chunk => 
      db.collection("corsi")
        .where(firebase.firestore.FieldPath.documentId(), "in", chunk)
        .select("tipologia", "livello", "nome")
        .get()
    );

    const snapshots = await Promise.all(promises);
    const results = snapshots.flatMap(snapshot => 
      snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          nomeCorso: data.tipologia && data.livello 
            ? `${data.tipologia} - ${data.livello}` 
            : (data.nome || `Corso ${doc.id}`)
        };
      })
    );

    return results;
  } catch (error) {
    console.error("Errore nel caricamento corsi:", error);
    throw new Error("Impossibile caricare i corsi del tesserato");
  }
}

// Carica i pacchetti associati a un tesserato
async function loadPacchettiPerTesserato(tesseratoId) {
  try {
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    if (!doc.exists) {
      throw new Error("Tesserato non trovato");
    }

    const pacchetti = doc.data()?.pacchetti || [];
    
    // Se non ci sono pacchetti, restituisci array vuoto immediatamente
    if (!pacchetti || pacchetti.length === 0) {
      return [];
    }

    // Firestore limita a 10 elementi negli array per le query 'in'
    const MAX_IN_CLAUSE = 10;
    const chunks = [];
    for (let i = 0; i < pacchetti.length; i += MAX_IN_CLAUSE) {
      chunks.push(pacchetti.slice(i, i + MAX_IN_CLAUSE));
    }

    // Esegui le query in parallelo
    const promises = chunks.map(chunk => 
      db.collection("pacchetti")
        .where(firebase.firestore.FieldPath.documentId(), "in", chunk)
        .select("nome", "corsoId")
        .get()
    );

    const snapshots = await Promise.all(promises);
    const results = snapshots.flatMap(snapshot => 
      snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        nome: doc.data().nome || `Pacchetto ${doc.id}`
      }))
    );

    return results;
  } catch (error) {
    console.error("Errore nel caricamento pacchetti:", error);
    throw new Error("Impossibile caricare i pacchetti del tesserato");
  }
}

// Aggiorna la lista dei pacchetti in base al corso selezionato
function updatePacchettiList() {
  const corsoSelezionato = document.getElementById("corsiSelect").value;
  const pSelect = document.getElementById("pacchettiSelect");
  
  // Pulisci la select mantenendo le opzioni selezionate
  const selectedOptions = Array.from(pSelect.selectedOptions).map(o => o.value);
  pSelect.innerHTML = "";

  // Gestisci caso in cui non ci sono pacchetti
  if (tuttiPacchettiTesserato.length === 0) {
    pSelect.innerHTML = '<option disabled>Nessun pacchetto associato</option>';
    return;
  }

  // Filtra i pacchetti per corso selezionato
  const pacchettiFiltrati = corsoSelezionato 
    ? tuttiPacchettiTesserato.filter(p => p.corsoId === corsoSelezionato)
    : tuttiPacchettiTesserato;

  // Gestisci caso in cui non ci sono pacchetti per il corso selezionato
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
    op.textContent = p.nome;
    
    // Mantieni le opzioni precedentemente selezionate
    if (selectedOptions.includes(p.id)) {
      op.selected = true;
    }
    
    pSelect.appendChild(op);
  });
}

// Carica lo storico dei pagamenti per un tesserato
async function caricaStoricoPagamenti(tesseratoId) {
  const storicoPagamentiBody = document.getElementById("storicoPagamentiBody");
  storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Caricamento storico pagamenti...</td></tr>';

  try {
    // Query ottimizzata con limit e ordinamento
    const pagamentiSnapshot = await db.collection("pagamenti")
      .where("tesseratoId", "==", tesseratoId)
      .orderBy("data", "desc")
      .limit(50)
      .get();
    
    if (pagamentiSnapshot.empty) {
      storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Nessun pagamento registrato.</td></tr>';
      return;
    }

    // Prepara i dati per il rendering
    const pagamenti = pagamentiSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dataFormattata: doc.data().data.toDate().toLocaleDateString('it-IT')
    }));

    // Raggruppa le richieste dei corsi per minimizzare le chiamate
    const corsiIds = [...new Set(pagamenti.map(p => p.corsoId))];
    const corsiSnapshot = await db.collection("corsi")
      .where(firebase.firestore.FieldPath.documentId(), "in", corsiIds)
      .select("tipologia", "livello", "nome")
      .get();
    
    const corsiMap = {};
    corsiSnapshot.forEach(doc => {
      const data = doc.data();
      corsiMap[doc.id] = data.tipologia && data.livello 
        ? `${data.tipologia} - ${data.livello}` 
        : (data.nome || doc.id);
    });

    // Genera le righe della tabella
    const rows = pagamenti.map(pagamento => `
      <tr>
        <td>${pagamento.dataFormattata}</td>
        <td>${corsiMap[pagamento.corsoId] || pagamento.corsoId}</td>
        <td>€${pagamento.importo.toFixed(2)}</td>
        <td>${pagamento.metodo}</td>
      </tr>
    `);

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

  // Gestione autenticazione
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }

    try {
      feedback.textContent = "Caricamento tesserati in corso...";
      feedback.classList.remove("error", "success");
      
      const tesserati = await loadTesserati();
      tSelect.innerHTML = '<option value="">-- Seleziona --</option>';
      
      tesserati.forEach(t => {
        const op = document.createElement("option");
        op.value = t.id;
        op.textContent = `${t.nomeCompleto} (${t.anagrafica?.codice_fiscale || 'N/D'})`;
        tSelect.appendChild(op);
      });
      
      feedback.textContent = "";
    } catch (error) {
      feedback.textContent = error.message;
      feedback.classList.add("error");
    }
  });

  // Gestione cambio tesserato
  tSelect.addEventListener("change", async () => {
  const id = tSelect.value;
  if (!id) {
    currentTesseratoId = null;
    // Resetta i campi quando nessun tesserato è selezionato
    cSelect.innerHTML = '<option value="">-- Seleziona --</option>';
    pSelect.innerHTML = '<option value="">Seleziona un tesserato</option>';
    storicoPagamentiBody.innerHTML = '<tr><td colspan="4">Seleziona un tesserato</td></tr>';
    return;
  }
  
  currentTesseratoId = id;

  try {
    feedback.textContent = "Caricamento dati tesserato...";
    feedback.classList.remove("error", "success");
    
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

    // Popola corsi - gestisci caso array vuoto
    if (corsi.length === 0) {
      cSelect.innerHTML = '<option value="" disabled>Nessun corso associato</option>';
      feedback.textContent = "Il tesserato non è iscritto a nessun corso";
      feedback.classList.add("error");
    } else {
      corsi.forEach(c => {
        const op = document.createElement("option");
        op.value = c.id;
        op.textContent = c.nomeCorso;
        cSelect.appendChild(op);
      });
    }

    // Mostra tutti i pacchetti inizialmente
    updatePacchettiList();
    
    // Carica storico
    await caricaStoricoPagamenti(id);
    
    feedback.textContent = "";
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
    const pacchettiSelezionati = Array.from(pSelect.selectedOptions).map(o => o.value).filter(Boolean);

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

    // Validazione data (non futura)
    const today = new Date().toISOString().split('T')[0];
    if (data > today) {
      feedback.textContent = "La data non può essere futura.";
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
      pacchetti: pacchettiSelezionati,
      importo,
      metodo,
      data: firebase.firestore.Timestamp.fromDate(new Date(data)),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      feedback.textContent = "Registrazione pagamento in corso...";
      feedback.classList.remove("error", "success");

      // Esegui operazioni in batch per consistenza dati
      const batch = db.batch();
      const pagamentoRef = db.collection("pagamenti").doc();
      batch.set(pagamentoRef, pagamentoData);

      // Aggiorna il tesserato con il riferimento al pagamento
      const tesseratoRef = db.collection("tesserati").doc(tId);
      batch.update(tesseratoRef, {
        [`pagamenti.${cId}.${pagamentoRef.id}`]: {
          importo,
          data: pagamentoData.data,
          metodo
        }
      });

      // Se sono stati selezionati pacchetti, aggiorna il loro stato
      if (pacchettiSelezionati.length > 0) {
        pacchettiSelezionati.forEach(pId => {
          const pacchettoRef = db.collection("pacchetti").doc(pId);
          batch.update(pacchettoRef, {
            pagato: true,
            dataPagamento: pagamentoData.data
          });
        });
      }

      await batch.commit();

      // Reset form (mantenendo il tesserato selezionato)
      form.reset();
      document.getElementById("data").valueAsDate = new Date();
      feedback.textContent = "Pagamento registrato con successo!";
      feedback.classList.add("success");

      // Ricarica storico e pacchetti
      await Promise.all([
        caricaStoricoPagamenti(tId),
        loadPacchettiPerTesserato(tId).then(pacchetti => {
          tuttiPacchettiTesserato = pacchetti;
          updatePacchettiList();
        })
      ]);
    } catch (err) {
      console.error("Errore:", err);
      feedback.textContent = "Errore durante la registrazione. Riprova più tardi.";
      feedback.classList.add("error");
    }
  });
});