// Assicurati che nel tuo HTML siano già stati caricati questi script Firebase:
// firebase-app.js, firebase-firestore.js (tutti dalla compat)

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Carica i tesserati con tesseramento attivo
function loadTesserati() {
  return db.collection("tesserati")
    .where("tesseramento.stato", "==", "attivo")
    .orderBy("anagrafica.cognome")
    .orderBy("anagrafica.nome")
    .orderBy("corsi")
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

// Caricamento tesserati
  try {
    const tesserati = await loadTesserati();
    tesseratiSelect.innerHTML = "";
    tesserati.forEach(t => {
      const a = t.anagrafica || {};
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`;
      tesseratiSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Errore tesserati:", error);
    tesseratiSelect.innerHTML = `<option disabled>Errore nel caricamento</option>`;
  }
// Caricamento tesserati.corsi
  try {
    const tesserati = await loadTesserati();
    tesseratiSelect.innerHTML = "";
    tesserati.forEach(t => {
      const a = t.corsi || {};
      const option = document.createElement("option");
      option.value = t.id;
      corsiSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Errore tesserati:", error);
    tesseratiSelect.innerHTML = `<option disabled>Errore nel caricamento</option>`;
  }


document
  .getElementById("pagamentoForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const tesseratoId = document.getElementById("tesserato").value;
    const corsoId = document.getElementById("corso").value;
    const importo = parseFloat(document.getElementById("importo").value);
    const metodo = document.getElementById("metodo").value;
    const dataPagamento = document.getElementById("data").value;

    if (!tesseratoId || !corsoId || isNaN(importo) || !metodo || !dataPagamento) {
      alert("Per favore, compila tutti i campi.");
      return;
    }

    try {
      const tesseratoRef = db.collection("tesserati").doc(tesseratoId);
      const corsoRef = db.collection("corsi").doc(corsoId);

      const tesseratoSnap = await tesseratoRef.get();
      const corsoSnap = await corsoRef.get();

      if (!tesseratoSnap.exists) {
        alert("Tesserato non trovato.");
        return;
      }

      if (!corsoSnap.exists) {
        alert("Corso non trovato.");
        return;
      }

      const tesseratoData = tesseratoSnap.data();
      const corsoData = corsoSnap.data();

      const pagamentoData = {
        tesseratoId,
        nomeTesserato: tesseratoData.nome + " " + tesseratoData.cognome,
        corsoId,
        descrizioneCorso: `${corsoData.tipologia} - ${corsoData.livello} - ${corsoData.orario}`,
        importo,
        metodo,
        data: firebase.firestore.Timestamp.fromDate(new Date(dataPagamento))
      };

      // Salva nella raccolta globale 'pagamenti'
      await db.collection("pagamenti").add(pagamentoData);

      // Aggiungi al documento del tesserato
      await tesseratoRef.update({
        pagamenti: firebase.firestore.FieldValue.arrayUnion(pagamentoData)
      });

      alert("Pagamento registrato con successo.");
      document.getElementById("pagamentoForm").reset();
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
      alert("Errore durante il salvataggio del pagamento.");
    }
  });
