import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { getAuth, onAuthStateChanged, getIdTokenResult } from "firebase/auth";

// La tua config Firebase (metti la tua config)
const firebaseConfig = {
  // ...
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Abilita persistenza IndexedDB con multi-tab
enableIndexedDbPersistence(db, { synchronizeTabs: true }).catch((err) => {
  console.warn("Errore nell'abilitare la persistenza:", err);
});

function getUserClaims() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        reject(new Error("Utente non autenticato"));
        return;
      }
      try {
        const idTokenResult = await getIdTokenResult(user);
        resolve({ user, claims: idTokenResult.claims });
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function loadPacchetti() {
  try {
    const { claims } = await getUserClaims();

    if (!claims.secretary && !claims.director) {
      throw new Error("Permessi insufficienti per leggere i pacchetti");
    }

    const pacchettiSnapshot = await getDocs(collection(db, "pacchetti"));
    return pacchettiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  } catch (error) {
    console.error("Errore nel caricamento dei pacchetti:", error);
    throw error;
  }
}

async function loadTesserati() {
  try {
    await getUserClaims();

    const tesseratiQuery = query(
      collection(db, "tesserati"),
      where("tesseramento.stato", "==", "attivo"),
      orderBy("anagrafica.cognome"),
      orderBy("anagrafica.nome")
    );

    const tesseratiSnapshot = await getDocs(tesseratiQuery);
    return tesseratiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  } catch (error) {
    console.error("Errore durante il caricamento dei tesserati:", error);
    throw error;
  }
}

async function populatePacchettiSelect() {
  const select = document.getElementById("pacchettiSelect");
  try {
    const pacchetti = await loadPacchetti();
    select.innerHTML = "";
    pacchetti.forEach(p => {
      const dateList = Array.isArray(p.date) ? p.date : [];
      if (dateList.length === 0) return;

      const sortedDates = dateList.slice().sort((a,b) => new Date(a) - new Date(b));
      const primaData = sortedDates[0];
      const ultimaData = sortedDates[sortedDates.length - 1];

      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = `${p.nome} – Dal: ${primaData} al: ${ultimaData}`;
      select.appendChild(option);
    });
  } catch (error) {
    select.innerHTML = `<option disabled>Errore nel caricamento dei pacchetti</option>`;
  }
}

async function populateTesseratiSelect() {
  const select = document.getElementById("tesserati");
  try {
    const tesserati = await loadTesserati();
    select.innerHTML = "";
    tesserati.forEach(t => {
      const a = t.anagrafica || {};
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`;
      select.appendChild(option);
    });
  } catch (error) {
    select.innerHTML = `<option disabled>Errore nel caricamento dei tesserati</option>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await populateTesseratiSelect();
    await populatePacchettiSelect();
  } catch (e) {
    console.error("Errore inizializzazione dati:", e);
  }
});
