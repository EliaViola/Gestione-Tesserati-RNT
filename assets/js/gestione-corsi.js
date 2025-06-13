import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Riferimenti al DOM
const form = document.getElementById('corso-form');
const pacchettiContainer = document.getElementById('pacchettiContainer');
const anteprimaDiv = document.getElementById('anteprima-corsi');

// Carica pacchetti disponibili
async function caricaPacchetti() {
  const pacchettiSnapshot = await getDocs(collection(db, "pacchetti"));
  pacchettiSnapshot.forEach(doc => {
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

// Carica tesserati per selezione
async function caricaTesserati() {
  const tesseratiSnapshot = await getDocs(collection(db, "tesserati"));
  const container = document.getElementById("tesseratiContainer");

  tesseratiSnapshot.forEach(doc => {
    const tesserato = doc.data();
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "tesserati";
    checkbox.value = doc.id;

    const label = document.createElement("label");
    label.textContent = `${tesserato.nome} ${tesserato.cognome}`;

    const div = document.createElement("div");
    div.appendChild(checkbox);
    div.appendChild(label);

    container.appendChild(div);
  });
}

// Limiti per tipologia
const limiti = {
  avviamento: 6,
  principianti: 7,
  intermedio: 7,
  perfezionamento: 8
};

// Funzione anteprima corsi
async function updateAnteprima() {
  anteprimaDiv.innerHTML = "";
  const corsiSnapshot = await getDocs(collection(db, "corsi"));
  const allCorsi = [];
  corsiSnapshot.forEach(doc => {
    allCorsi.push({ id: doc.id, ...doc.data() });
  });

  const tipoCorso = document.getElementById('tipologia').value;
  const livello = document.getElementById('livello').value;

  const corsiFiltrati = allCorsi.filter(corso =>
    corso.tipologia === tipoCorso &&
    corso.livello === livello
  );

  for (const corso of corsiFiltrati) {
    const pacchettiNomi = [];
    for (const pacchettoId of corso.pacchetti || []) {
      const pacchettoDoc = await getDocs(collection(db, "pacchetti"));
      pacchettoDoc.forEach(p => {
        if (p.id === pacchettoId) {
          pacchettiNomi.push(p.data().nome);
        }
      });
    }

    const tesseratiNomi = [];
    for (const id of corso.iscritti || []) {
      const tesseratoDoc = await getDocs(collection(db, "tesserati"));
      tesseratoDoc.forEach(t => {
        if (t.id === id) {
          const d = t.data();
          tesseratiNomi.push(`${d.nome} ${d.cognome}`);
        }
      });
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
            ${tesseratiNomi.map(t => `<li>${t}</li>`).join('')}
          </ul>
          ${haRaggiuntoLimite ? `<div class="limite-msg"><i class="fas fa-exclamation-triangle"></i> Limite massimo raggiunto</div>` : ''}
        </div>
      </div>`;
  }
}

form.addEventListener("change", updateAnteprima);

// Invio dati nuovo corso
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const tipologia = document.getElementById("tipologia").value;
  const livello = document.getElementById("livello").value;
  const orario = document.getElementById("orario").value;

  const pacchetti = Array.from(document.querySelectorAll("input[name='pacchetti']:checked")).map(cb => cb.value);
  const iscritti = Array.from(document.querySelectorAll("input[name='tesserati']:checked")).map(cb => cb.value);

  const limiteMax = limiti[tipologia.toLowerCase()];
  if (limiteMax && iscritti.length > limiteMax) {
    alert(`Attenzione: il limite per ${tipologia} è di ${limiteMax} partecipanti.`);
    return;
  }

  const nuovoCorso = {
    tipologia,
    livello,
    orario,
    pacchetti,
    iscritti
  };

  const docRef = await addDoc(collection(db, "corsi"), nuovoCorso);

  // Aggiorna ogni tesserato con riferimento al corso
  for (const tId of iscritti) {
    const tDoc = doc(db, "tesserati", tId);
    const snapshot = await getDocs(collection(db, "tesserati"));
    snapshot.forEach(async (d) => {
      if (d.id === tId) {
        const tData = d.data();
        const nuoviCorsi = (tData.corsi || []);
        nuoviCorsi.push(docRef.id);
        await updateDoc(tDoc, { corsi: nuoviCorsi });
      }
    });
  }

  alert("Corso aggiunto con successo!");
  form.reset();
  updateAnteprima();
});

caricaPacchetti();
caricaTesserati();
