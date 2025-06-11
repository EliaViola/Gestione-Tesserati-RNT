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
      option.textContent = p.nome || "Pacchetto senza nome";
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

