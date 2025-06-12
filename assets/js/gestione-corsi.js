// gestione-corsi.js

const db = firebase.firestore();
const auth = firebase.auth();

// Carica i tesserati con tesseramento attivo
function loadTesserati() {
  return db.collection("tesserati")
    .where("tesseramento.stato", "==", "attivo")
    .orderBy("anagrafica.cognome")
    .orderBy("anagrafica.nome")
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

// Carica i pacchetti salvati da admin (nodo "pacchetti")
function loadPacchetti() {
  return db.collection("pacchetti")
    .orderBy("nome") // opzionale, per ordinare per nome pacchetto
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

// Popola select dei tesserati
function populateTesseratiSelect() {
  const select = document.getElementById("tesserato");
  loadTesserati().then(tesserati => {
    select.innerHTML = "";
    tesserati.forEach(t => {
      const a = t.anagrafica || {};
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`;
      select.appendChild(option);
    });
  }).catch(err => {
    console.error("Errore nel caricamento dei tesserati:", err);
    select.innerHTML = `<option disabled>Errore nel caricamento</option>`;
  });
}

// Popola select dei pacchetti
function populatePacchettiSelect() {
  const select = document.getElementById("pacchettiSelect");
  loadPacchetti().then(pacchetti => {
    select.innerHTML = "";
    pacchetti.forEach(p => {
      const option = document.createElement("option");
      option.value = p.id;
      if (Array.isArray(p.date) && p.date.length > 0) {
  const sortedDates = p.date.slice().sort(); // Ordina le date in ordine crescente
  const primaData = sortedDates[0];
  const ultimaData = sortedDates[sortedDates.length - 1];
  option.textContent = `${p.nome || "Pacchetto"} (${primaData} - ${ultimaData})`;
} else {
  option.textContent = p.nome || "Pacchetto senza nome";
}
      select.appendChild(option);
    });
  }).catch(err => {
    console.error("Errore nel caricamento dei pacchetti:", err);
    select.innerHTML = `<option disabled>Errore nel caricamento</option>`;
  });
}

// Inizializzazione al caricamento della pagina
document.addEventListener("DOMContentLoaded", () => {
  populateTesseratiSelect();
  populatePacchettiSelect();
});

// gestione-corsi.js

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('corsoForm');
  const pacchettoSelect = document.getElementById('pacchettoSelect');
  const tesseratiSelect = document.getElementById('tesseratiSelect');
  const feedback = document.getElementById('feedback');

  // Carica pacchetti disponibili
  const pacchettiSnap = await firebase.firestore().collection('pacchetti').get();
  pacchettiSnap.forEach(doc => {
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = doc.data().nome;
    pacchettoSelect.appendChild(opt);
  });

  // Carica tesserati attivi
  const tesseratiSnap = await firebase.firestore().collection('tesserati').get();
  tesseratiSnap.forEach(doc => {
    const data = doc.data();
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = `${data.anagrafica.nome} ${data.anagrafica.cognome}`;
    tesseratiSelect.appendChild(opt);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const corso = {
      tipologia: formData.get('tipologia'),
      livello: formData.get('livello'),
      orario: formData.get('orario'),
      pacchettoId: formData.get('pacchetto'),
      iscritti: [...formData.getAll('tesserati')],
      creato_il: firebase.firestore.FieldValue.serverTimestamp(),
      creato_da: firebase.auth().currentUser.uid
    };

    try {
      // Salva il corso
      const corsoRef = await firebase.firestore().collection('corsi').add(corso);

      // Aggiorna ogni tesserato con riferimento al corso
      await Promise.all(corso.iscritti.map(async tesseratoId => {
        await firebase.firestore().collection('tesserati')
          .doc(tesseratoId)
          .update({
            corsi: firebase.firestore.FieldValue.arrayUnion(corsoRef.id)
          });
      }));

      feedback.textContent = 'Corso salvato con successo';
      feedback.className = 'success';
      form.reset();
    } catch (error) {
      console.error('Errore salvataggio corso:', error);
      feedback.textContent = 'Errore: ' + error.message;
      feedback.className = 'error';
    }
  });
});