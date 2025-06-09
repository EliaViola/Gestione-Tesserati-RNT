import { db } from "./firebaseConfig.js";
import { collection, addDoc, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Ottieni l'id del tesserato dalla URL
const urlParams = new URLSearchParams(window.location.search);
const tesseratoId = urlParams.get("id");

// Mostra l'ID per debug (opzionale)
console.log("ID tesserato:", tesseratoId);

// Carica i pacchetti dal database
async function caricaPacchetti() {
  const pacchettiSelect = document.getElementById("pacchetto");
  pacchettiSelect.innerHTML = "";

  try {
    const pacchettiSnapshot = await getDocs(collection(db, "pacchettiLezioni"));

    pacchettiSnapshot.forEach((doc) => {
      const pacchetto = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = pacchetto.nomePacchetto;
      pacchettiSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Errore nel caricamento dei pacchetti:", error);
  }
}

document.getElementById("corsoForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!tesseratoId) {
    alert("Errore: ID tesserato non trovato nell'URL.");
    return;
  }

  const pacchettoId = document.getElementById("pacchetto").value;
  const pacchettoRef = doc(db, "pacchettiLezioni", pacchettoId);

  try {
    const pacchettoSnap = await getDoc(pacchettoRef);

    if (!pacchettoSnap.exists()) {
      alert("Pacchetto non trovato.");
      return;
    }

    const pacchettoData = pacchettoSnap.data();

    const corso = {
      nomePacchetto: pacchettoData.nomePacchetto,
      lezioni: pacchettoData.lezioni,
      timestamp: new Date()
    };

    const corsiCollectionRef = collection(db, `tesserati/${tesseratoId}/corsi`);
    await addDoc(corsiCollectionRef, corso);

    alert("Corso aggiunto con successo!");
    document.getElementById("corsoForm").reset();
  } catch (error) {
    console.error("Errore durante il salvataggio del corso:", error);
    alert("Si è verificato un errore durante il salvataggio del corso.");
  }
});

window.onload = caricaPacchetti;
