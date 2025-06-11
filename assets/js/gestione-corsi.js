import { initializeApp } from "firebase/app";
import {
  getFirestore,
  enableIndexedDbPersistence,
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  getIdTokenResult
} from "firebase/auth";

// Firebase config (usa quella che hai nel tuo progetto)
const firebaseConfig = {
  // inserisci la tua configurazione
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

enableIndexedDbPersistence(db, { synchronizeTabs: true }).catch((err) => {
  console.warn("Errore nell'abilitare la persistenza:", err);
});

function getUserClaims() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return reject(new Error("Utente non autenticato"));
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
  const { claims } = await getUserClaims();
  if (!claims.secretary && !claims.director) {
    throw new Error("Permessi insufficienti per leggere i pacchetti");
  }

  const snapshot = await getDocs(collection(db, "pacchetti"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function loadTesserati() {
  await getUserClaims();
  const q = query(
    collection(db, "tesserati"),
    where("tesseramento.stato", "==", "attivo"),
    orderBy("anagrafica.cognome"),
    orderBy("anagrafica.nome")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function populatePacchettiSelect() {
  const select = document.getElementById("pacchettiSelect");
  try {
    const pacchetti = await loadPacchetti();
    select.innerHTML = "";
    pacchetti.forEach(p => {
      const dates = Array.isArray(p.date) ? p.date.slice().sort((a, b) => new Date(a) - new Date(b)) : [];
      if (dates.length === 0) return;
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = `${p.nome} – Dal: ${dates[0]} al: ${dates[dates.length - 1]}`;
      select.appendChild(option);
    });
  } catch (error) {
    select.innerHTML = `<option disabled>Errore nel caricamento dei pacchetti</option>`;
  }
}

async function populateTesseratiSelect() {
  const select = document.getElementById("tesserato");
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

    document.getElementById("pacchettiSelect").addEventListener("change", caricaAnteprimaIscritti);
    document.getElementById("tipo_corso").addEventListener("change", caricaAnteprimaIscritti);
    document.getElementById("livello").addEventListener("change", caricaAnteprimaIscritti);
  } catch (e) {
    console.error("Errore inizializzazione dati:", e);
  }
});

async function caricaAnteprimaIscritti() {
  const pacchettiSelect = document.getElementById("pacchettiSelect");
  const tipoCorso = document.getElementById("tipo_corso").value;
  const livello = document.getElementById("livello").value;
  const anteprimaContainer = document.getElementById("anteprimaContainer");

  if (!pacchettiSelect || !tipoCorso || !livello) {
    anteprimaContainer.innerHTML = `<p class="nessun-risultato">Seleziona corso, livello e almeno un pacchetto per vedere gli iscritti</p>`;
    return;
  }

  const pacchettiSelezionati = Array.from(pacchettiSelect.selectedOptions).map(opt => opt.value);
  if (pacchettiSelezionati.length === 0) {
    anteprimaContainer.innerHTML = `<p class="nessun-risultato">Seleziona almeno un pacchetto per vedere gli iscritti</p>`;
    return;
  }

  try {
    const snapshot = await getDocs(collection(db, "corsi"));
    const corsi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const corsiFiltrati = corsi.filter(corso =>
      corso.tipo_corso === tipoCorso &&
      corso.livello === livello &&
      corso.pacchetti &&
      corso.pacchetti.some(p => pacchettiSelezionati.includes(p))
    );

    if (corsiFiltrati.length === 0) {
      anteprimaContainer.innerHTML = `<p class="nessun-risultato">Nessun iscritto trovato per questa combinazione.</p>`;
      return;
    }

    const snapshotTesserati = await getDocs(collection(db, "tesserati"));
    const tesseratiMap = new Map();
    snapshotTesserati.forEach(doc => {
      const data = doc.data();
      tesseratiMap.set(doc.id, `${data.anagrafica?.cognome || ""} ${data.anagrafica?.nome || ""}`);
    });

    const elenco = document.createElement("ul");
    elenco.classList.add("lista-iscritti");

    corsiFiltrati.forEach(corso => {
      const nomeTesserato = tesseratiMap.get(corso.tesseratoId) || "Sconosciuto";
      const item = document.createElement("li");
      item.textContent = `${nomeTesserato} – ${corso.orario}`;
      elenco.appendChild(item);
    });

    anteprimaContainer.innerHTML = "";
    anteprimaContainer.appendChild(elenco);

  } catch (error) {
    console.error("Errore nel recupero iscritti:", error);
    anteprimaContainer.innerHTML = `<p class="nessun-risultato">Errore nel caricamento dei dati.</p>`;
  }
}
