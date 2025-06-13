const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);

// Riferimenti al DOM
const form = document.getElementById('corso-form');
const pacchettiContainer = document.getElementById('pacchettiContainer');
const anteprimaDiv = document.getElementById('anteprima-corsi');

// Limiti per tipologia corso
const limiti = {
  avviamento: 6,
  principianti: 7,
  intermedio: 7,
  perfezionamento: 8
};

// Carica pacchetti disponibili
async function caricaPacchetti() {
  const snapshot = await db.collection("pacchetti").get();
  snapshot.forEach(doc => {
    const pacchetto = doc.data();
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "pacchetti";
    checkbox.value = doc.id;

    const label = document.createElement("label");
    label.textContent = `${pacchetto.nome} (${pacchetto.date.join(', ')})`;

    const div = document.createElement("div");
    div.appendChild(checkbox);
    div.appendChild(label);
    pacchettiContainer.appendChild(div);
  });
}

// Carica tesserati disponibili
async function caricaTesserati() {
  const snapshot = await db.collection("tesserati").get();
  const container = document.getElementById("tesseratiContainer");

  snapshot.forEach(doc => {
    const t = doc.data();
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "tesserati";
    checkbox.value = doc.id;

    const label = document.createElement("label");
    label.textContent = `${t.nome} ${t.cognome}`;

    const div = document.createElement("div");
    div.appendChild(checkbox);
    div.appendChild(label);
    container.appendChild(div);
  });
}

// Aggiorna anteprima corsi esistenti
async function updateAnteprima() {
  anteprimaDiv.innerHTML = "";

  const tipoCorso = document.getElementById('tipologia').value;
  const livello = document.getElementById('livello').value;

  const snapshot = await db.collection("corsi").get();
  for (const doc of snapshot.docs) {
    const corso = doc.data();

    if (corso.tipologia !== tipoCorso || corso.livello !== livello) continue;

    // Pacchetti
    const pacchettiNomi = [];
    for (const pacchettoId of corso.pacchetti || []) {
      const pacchettoDoc = await db.collection("pacchetti").doc(pacchettoId).get();
      if (pacchettoDoc.exists) {
        const pac = pacchettoDoc.data();
        pacchettiNomi.push(pac.nome);
      }
    }

    // Tesserati iscritti
    const tesseratiNomi = [];
    for (const tId of corso.iscritti || []) {
      const tDoc = await db.collection("tesserati").doc(tId).get();
      if (tDoc.exists) {
        const t = tDoc.data();
        tesseratiNomi.push(`${t.nome} ${t.cognome}`);
      }
    }

    const limiteMax = limiti[corso.tipologia.toLowerCase()] || null;
    const haRaggiuntoLimite = limiteMax !== null && corso.iscritti.length >= limiteMax;

    anteprimaDiv.innerHTML += `
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
  }
}

// Salva nuovo corso
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const tipologia = document.getElementById("tipologia").value;
  const livello = document.getElementById("livello").value;
  const orario = document.getElementById("orario").value;

  const pacchetti = Array.from(document.querySelectorAll("input[name='pacchetti']:checked")).map(cb => cb.value);
  const iscritti = Array.from(document.querySelectorAll("input[name='tesserati']:checked")).map(cb => cb.value);

  const limiteMax = limiti[tipologia.toLowerCase()];
  if (limiteMax && iscritti.length > limiteMax) {
    alert(`Limite massimo per ${tipologia}: ${limiteMax} iscritti.`);
    return;
  }

  const corso = {
    tipologia,
    livello,
    orario,
    pacchetti,
    iscritti
  };

  const corsoRef = await db.collection("corsi").add(corso);

  // Aggiorna ciascun tesserato
  for (const tId of iscritti) {
    const tDoc = await db.collection("tesserati").doc(tId).get();
    if (tDoc.exists) {
      const tData = tDoc.data();
      const corsiAggiornati = tData.corsi || [];
      corsiAggiornati.push(corsoRef.id);
      await db.collection("tesserati").doc(tId).update({ corsi: corsiAggiornati });
    }
  }

  alert("Corso salvato con successo!");
  form.reset();
  updateAnteprima();
});

// Cambi nei campi -> aggiorna anteprima
form.addEventListener("change", updateAnteprima);

// Caricamento iniziale
caricaPacchetti();
caricaTesserati();
