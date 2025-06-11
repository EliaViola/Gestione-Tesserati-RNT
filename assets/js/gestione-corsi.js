// Assumi che firebase sia già inizializzato

const db = firebase.firestore();

// Abilita la persistenza multi-tab
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    console.error("Errore nell'abilitare la persistenza:", err);
  });

// Funzione per attendere autenticazione e recuperare user custom claims
async function getUserClaims() {
  return new Promise((resolve, reject) => {
    firebase.auth().onAuthStateChanged(async (user) => {
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
    const { user, claims } = await getUserClaims();

    // Controllo custom claims per sicurezza lato client (inutile senza regole, ma utile UX)
    if (!claims.secretary && !claims.director) {
      throw new Error("Permessi insufficienti per leggere i pacchetti");
    }

    const snapshot = await db.collection("pacchetti").get();
    const pacchetti = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return pacchetti;

  } catch (error) {
    console.error("Errore nel caricamento dei pacchetti:", error);
    throw error;
  }
}

async function loadTesserati() {
  try {
    const { user } = await getUserClaims();

    // Lato client: l'utente è autenticato, possiamo fare la query
    const snapshot = await db.collection("tesserati")
      .where("tesseramento.stato", "==", "attivo")
      .orderBy("anagrafica.cognome")
      .orderBy("anagrafica.nome")
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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

// Esempio di uso: al caricamento pagina
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await populateTesseratiSelect();
    await populatePacchettiSelect();
  } catch (e) {
    console.error("Errore inizializzazione dati:", e);
  }
});

