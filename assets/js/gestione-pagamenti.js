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
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("corsoForm");
  const tesseratiSelect = document.getElementById("tesseratiSelect");
  const feedback = document.getElementById("feedback");

  if (!form || !tesseratiSelect || !feedback) {
    console.error("Uno o più elementi HTML richiesti non sono presenti nella pagina.");
    return;
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

});