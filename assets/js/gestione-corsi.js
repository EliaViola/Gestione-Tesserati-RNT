// gestione-corsi.js
import {
  getFirestore, collection, getDocs, addDoc, doc, getDoc, updateDoc, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);
const auth = getAuth(app);

// Attiva la persistenza offline (opzionale)
try {
  enableIndexedDbPersistence(db);
} catch (err) {
  console.warn("Persistence error:", err);
}

// Riempi il menu a tendina con i pacchetti disponibili
async function caricaPacchetti() {
  const pacchettiSelect = document.getElementById("pacchetto");
  pacchettiSelect.innerHTML = "";

  const snapshot = await getDocs(collection(db, "pacchetti"));
  snapshot.forEach(doc => {
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = doc.data().nome || "Senza nome";
    pacchettiSelect.appendChild(option);
  });
}

// Salva corso nel profilo del tesserato
async function salvaCorso(event) {
  event.preventDefault();
  const tesseratoId = document.getElementById("tesseratoId").value.trim();
  const pacchettoId = document.getElementById("pacchetto").value;
  const note = document.getElementById("note").value.trim();
  const esito = document.getElementById("esito");
  esito.textContent = "";

  if (!tesseratoId || !pacchettoId) {
    esito.textContent = "Compila tutti i campi obbligatori.";
    return;
  }

  try {
    const tesseratoRef = doc(db, "tesserati", tesseratoId);
    const tesseratoSnap = await getDoc(tesseratoRef);
    if (!tesseratoSnap.exists()) {
      esito.textContent = "Tesserato non trovato.";
      return;
    }

    const corso = {
      pacchettoId,
      dataAssegnazione: new Date().toISOString(),
      note
    };

    const corsiRef = collection(tesseratoRef, "corsi");
    await addDoc(corsiRef, corso);
    esito.textContent = "Corso assegnato con successo.";
  } catch (error) {
    console.error("Errore nel salvataggio:", error);
    esito.textContent = "Errore durante il salvataggio. Riprova.";
  }
}

// Inizializza pagina solo se autenticato
onAuthStateChanged(auth, user => {
  if (user) {
    caricaPacchetti();
    document.getElementById("corso-form").addEventListener("submit", salvaCorso);
  } else {
    alert("Devi essere autenticato per accedere a questa pagina.");
    window.location.href = "/login.html";
  }
});
