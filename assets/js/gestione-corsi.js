const db = firebase.firestore();
const auth = firebase.auth();

// Abilita persistenza con IndexedDB e sincronizzazione multi-tab
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Errore nella persistenza offline:", err);
});

function getUserClaims() {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        reject(new Error("Utente non autenticato"));
        return;
      }
      try {
        const idTokenResult = await user.getIdTokenResult();
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

    const snapshot = await db.collection("pacchetti").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore nel caricamento dei pacchetti:", error);
    throw error;
  }
}

async function loadTesserati() {
  try {
    await getUserClaims();

    const snapshot = await db.collection("tesserati")
      .where("tesseramento.stato", "==", "attivo")
      .orderBy("anagrafica.cognome")
      .orderBy("anagrafica.nome")
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Errore caricamento tesserati:", error);
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
      const sorted = dateList.slice().sort((a, b) => new Date(a) - new Date(b));
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = `${p.nome} – Dal: ${sorted[0]} al: ${sorted[sorted.length - 1]}`;
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
    select.innerHTML = '<option value="">-- Seleziona --</option>';
    tesserati.forEach(t => {
      const a = t.anagrafica || {};
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`;
      select.appendChild(option);
    });
  } catch (error) {
    select.innerHTML = `<option disabled>Errore caricamento tesserati</option>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await populateTesseratiSelect();
    await populatePacchettiSelect();
  } catch (err) {
    console.error("Errore inizializzazione:", err);
  }
});
