const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const tesseratiSelect = document.getElementById("tesseratiSelect");
const corsiSelect = document.getElementById("corsiSelect");

// Carica i tesserati attivi
async function loadTesserati() {
  try {
    const snapshot = await db.collection("tesserati")
      .where("tesseramento.stato", "==", "attivo")
      .orderBy("anagrafica.cognome")
      .get();

    tesseratiSelect.innerHTML = '<option value="">-- Seleziona --</option>';
    snapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = `${data.anagrafica?.cognome || ''} ${data.anagrafica?.nome || ''}`;
      tesseratiSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Errore nel caricamento dei tesserati:", error);
    tesseratiSelect.innerHTML = '<option disabled>Errore nel caricamento</option>';
  }
}

// Quando selezioni un tesserato, carica i corsi associati
tesseratiSelect.addEventListener("change", async function () {
  const tesseratoId = this.value;
  corsiSelect.innerHTML = '<option value="">-- Seleziona --</option>';

  if (!tesseratoId) return;

  try {
    const doc = await db.collection("tesserati").doc(tesseratoId).get();
    const data = doc.data();

    const corsi = data?.corsi || [];
    for (const corso of corsi) {
      const corsoDoc = await db.collection("corsi").doc(corso.id).get();
      const corsoData = corsoDoc.data();

      const option = document.createElement("option");
      option.value = corso.id;
      option.textContent = `${corsoData.tipologia} - ${corsoData.livello} - ${corsoData.orario}`;
      corsiSelect.appendChild(option);
    }
  } catch (error) {
    console.error("Errore nel caricamento dei corsi:", error);
  }
});

// Gestione invio pagamento
document.getElementById("pagamentoForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const tesseratoId = tesseratiSelect.value;
  const corsoId = corsiSelect.value;
  const importo = parseFloat(document.getElementById("importo").value);
  const metodo = document.getElementById("metodo").value;
  const dataPagamento = document.getElementById("data").value;

  if (!tesseratoId || !corsoId || isNaN(importo) || !metodo || !dataPagamento) {
    alert("Per favore, compila tutti i campi.");
    return;
  }

  try {
    const tesseratoDoc = await db.collection("tesserati").doc(tesseratoId).get();
    const corsoDoc = await db.collection("corsi").doc(corsoId).get();

    const tesseratoData = tesseratoDoc.data();
    const corsoData = corsoDoc.data();

    const pagamentoData = {
      tesseratoId,
      nomeTesserato: `${tesseratoData.anagrafica.nome} ${tesseratoData.anagrafica.cognome}`,
      corsoId,
      descrizioneCorso: `${corsoData.tipologia} - ${corsoData.livello} - ${corsoData.orario}`,
      importo,
      metodo,
      data: firebase.firestore.Timestamp.fromDate(new Date(dataPagamento)),
    };

    await db.collection("pagamenti").add(pagamentoData);

    await db.collection("tesserati").doc(tesseratoId).update({
      pagamenti: firebase.firestore.FieldValue.arrayUnion(pagamentoData),
    });

    alert("Pagamento registrato con successo.");
    this.reset();
  } catch (error) {
    console.error("Errore durante il salvataggio del pagamento:", error);
    alert("Errore durante il salvataggio del pagamento.");
  }
});

// Avvio iniziale
loadTesserati();
