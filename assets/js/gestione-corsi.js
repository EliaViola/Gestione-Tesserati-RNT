document.addEventListener("DOMContentLoaded", () => {
  // Inizializzazione Firebase in modalità compat
  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore(app);

  // Elementi dal DOM (verifica che gli ID corrispondano al tuo HTML)
  const form = document.getElementById('corsoForm');
  const tesseratoSelect = document.getElementById('tesserato');
  const pacchettiSelect = document.getElementById('pacchettiSelect');
  const anteprimaContainer = document.getElementById('anteprimaContainer');

  // Limiti per tipologia di corso
  const limiti = {
    avviamento: 6,
    principianti: 7,
    intermedio: 7,
    perfezionamento: 8
  };

  // Carica tesserati e popola il select "tesserato"
  async function loadTesserati() {
    try {
      const snapshot = await db.collection("tesserati")
        .where("tesseramento.stato", "==", "attivo")
        .orderBy("anagrafica.cognome")
        .orderBy("anagrafica.nome")
        .get();
        
      tesseratoSelect.innerHTML = '<option value="">-- Seleziona --</option>';
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const nomeCompleto = `${data.anagrafica?.cognome || ''} ${data.anagrafica?.nome || ''}`.trim();
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = `${nomeCompleto} (${data.anagrafica?.codice_fiscale || 'N/D'})`;
        tesseratoSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Errore nel caricamento dei tesserati:", error);
    }
  }

  // Carica pacchetti e popola il select "pacchettiSelect"
  async function loadPacchetti() {
    try {
      const snapshot = await db.collection("pacchetti")
        .orderBy("nome")
        .get();
        
      pacchettiSelect.innerHTML = '<option value="">-- Seleziona --</option>';
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const dateRange = data.date && data.date.length > 0 ? `${data.date[0]} - ${data.date[data.date.length - 1]}` : "Nessuna data";
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = `${data.nome} (${dateRange})`;
        pacchettiSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Errore nel caricamento dei pacchetti:", error);
    }
  }

  // Aggiorna l'anteprima dei corsi in base a tipo e livello (non filtra per orario)
  async function updateAnteprima() {
    anteprimaContainer.innerHTML = "";

    // Ottieni valori dai select relativi al corso
    const tipoCorso = document.getElementById('tipo_corso').value;
    const livello = document.getElementById('livello').value;

    try {
      const snapshot = await db.collection("corsi").get();
      // Itera su tutti i corsi e filtra quelli in base a tipologia e livello
      snapshot.docs.forEach(async doc => {
        const corso = doc.data();
        if (corso.tipologia !== tipoCorso || corso.livello !== livello) return;

        // Ottieni nomi dei pacchetti associati al corso
        let pacchettiNomi = [];
        if (corso.pacchetti && Array.isArray(corso.pacchetti)) {
          for (const pid of corso.pacchetti) {
            const pacDoc = await db.collection("pacchetti").doc(pid).get();
            if (pacDoc.exists) {
              pacchettiNomi.push(pacDoc.data().nome);
            } else {
              pacchettiNomi.push(pid);
            }
          }
        }

        // Ottieni nomi dei tesserati iscritti
        let tesseratiNomi = [];
        if (corso.iscritti && Array.isArray(corso.iscritti)) {
          for (const tid of corso.iscritti) {
            const tDoc = await db.collection("tesserati").doc(tid).get();
            if (tDoc.exists) {
              const tData = tDoc.data();
              const nome = tData.anagrafica ? `${tData.anagrafica.cognome || ""} ${tData.anagrafica.nome || ""}`.trim() : "";
              tesseratiNomi.push(nome || tid);
            } else {
              tesseratiNomi.push(tid);
            }
          }
        }

        const limiteMax = limiti[corso.tipologia.toLowerCase()] || null;
        const haRaggiuntoLimite = limiteMax !== null && corso.iscritti && corso.iscritti.length >= limiteMax;

        // Aggiunge l'HTML del corso all'anteprima
        anteprimaContainer.innerHTML += `
          <div class="corso-card ${haRaggiuntoLimite ? 'limite-raggiunto' : ''}">
            <div class="corso-header">
              <span class="corso-tipo">${corso.tipologia} - Liv. ${corso.livello}</span>
              <span class="corso-orario"><i class="fas fa-clock"></i> ${corso.orario}</span>
            </div>
            <div class="corso-pacchetti">
              <i class="fas fa-box-open"></i> ${pacchettiNomi.join(', ')}
            </div>
            <div class="corso-tesserati">
              <h4><i class="fas fa-users"></i> Partecipanti (${tesseratiNomi.length}${limiteMax ? ` / ${limiteMax}` : ''})</h4>
              <ul class="tesserati-list">
                ${tesseratiNomi.map(n => `<li>${n}</li>`).join('')}
              </ul>
              ${haRaggiuntoLimite ? `<div class="limite-msg"><i class="fas fa-exclamation-triangle"></i> Limite massimo raggiunto</div>` : ''}
            </div>
          </div>
        `;
      });
    } catch (error) {
      console.error("Errore nell'aggiornamento dell'anteprima:", error);
    }
  }

  // Gestione del submit del form per salvare un nuovo corso
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const tipologia = document.getElementById("tipo_corso").value;
    const livello = document.getElementById("livello").value;
    const orario = document.getElementById("orario").value;

    // Nel tuo form, il tesserato è un select (singolo) e i pacchetti sono un select a scelta multipla
    const pacchetti = Array.from(pacchettiSelect.selectedOptions)
      .filter(opt => opt.value !== "")
      .map(opt => opt.value);
    const tesserato = document.getElementById("tesserato").value;

    const limiteMax = limiti[tipologia.toLowerCase()];
    // Per il form, dal momento che si seleziona un solo tesserato, il check sul numero di iscritti è superfluo
    // (ma in caso di modifiche, puoi implementare il controllo lato form)

    const corso = {
      tipologia,
      livello,
      orario,
      pacchetti,
      iscritti: [tesserato]
    };

    try {
      const docRef = await db.collection("corsi").add(corso);
      // Aggiorna il tesserato aggiungendo il riferimento al corso
      const tDoc = await db.collection("tesserati").doc(tesserato).get();
      if (tDoc.exists) {
        const tData = tDoc.data();
        const corsiAggiornati = tData.corsi || [];
        corsiAggiornati.push(docRef.id);
        await db.collection("tesserati").doc(tesserato).update({ corsi: corsiAggiornati });
      }
      alert("Corso salvato con successo!");
      form.reset();
      updateAnteprima();
    } catch (error) {
      console.error("Errore durante il salvataggio del corso:", error);
    }
  });

  // Aggiorna l'anteprima al variare dei campi (tipo, livello, orario, ecc.)
  form.addEventListener("change", updateAnteprima);

  // Caricamento iniziale di tesserati e pacchetti
  loadTesserati();
  loadPacchetti();
});
