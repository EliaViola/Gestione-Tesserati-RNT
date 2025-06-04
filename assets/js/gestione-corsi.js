// Assicurati che firebase e firestore siano già caricati nello <head> con gli script corretti

const PACCHETTI_ENDPOINT = "/pacchetti.json";

// 🔹 Carica tesserati da Firebase Firestore
async function loadTesserati() {
  try {
    const snapshot = await db.collection('tesserati').get();
    const tesserati = [];
    snapshot.forEach(doc => {
      tesserati.push({ id: doc.id, ...doc.data() });
    });
    return tesserati;
  } catch (e) {
    console.error("Errore caricamento tesserati da Firebase:", e);
    return [];
  }
}

// 🔹 Carica pacchetti da file JSON
async function loadPacchetti() {
  try {
    const res = await fetch(PACCHETTI_ENDPOINT);
    if (!res.ok) throw new Error("Impossibile caricare i pacchetti.");
    return await res.json();
  } catch (e) {
    console.error("Errore pacchetti:", e);
    return [];
  }
}

async function populateTesseratiSelect() {
  const select = document.getElementById("tesserato");
  const tesserati = await loadTesserati();
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  tesserati.forEach(t => {
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = `${t.nome} ${t.cognome} (${t.id})`;
    select.appendChild(option);
  });
}

async function populatePacchettiSelect() {
  const select = document.getElementById("pacchettiSelect");
  const pacchetti = await loadPacchetti();
  select.innerHTML = '';
  pacchetti.forEach(p => {
    const option = document.createElement("option");
    option.value = p.nome;
    option.textContent = p.nome;
    select.appendChild(option);
  });
}

function showError(message) {
  alert(`Errore: ${message}`);
}

function showSuccess(message) {
  alert(`✅ ${message}`);
}

function validateForm(data) {
  if (!data.tesserato) return showError("Seleziona un tesserato.");
  if (!data.tipo_corso) return showError("Seleziona il tipo di corso.");
  if (!data.livello) return showError("Seleziona il livello.");
  if (!data.istruttore.trim()) return showError("Inserisci l'istruttore.");
  if (!data.pacchetti.length) return showError("Seleziona almeno un pacchetto.");
  if (!data.orario) return showError("Seleziona un orario.");
  return true;
}

// 🔹 Salva iscrizione nel campo `corsi` del tesserato
async function salvaIscrizione(data) {
  try {
    const tesseratoRef = db.collection('tesserati').doc(data.tesserato);

    await tesseratoRef.update({
      corsi: firebase.firestore.FieldValue.arrayUnion({
        tipo_corso: data.tipo_corso,
        livello: data.livello,
        istruttore: data.istruttore,
        pacchetti: data.pacchetti,
        orario: data.orario,
        note: data.note,
        dataIscrizione: new Date().toISOString()
      })
    });

    showSuccess("Iscrizione salvata con successo.");
    return true;
  } catch (e) {
    console.error("Errore salvataggio iscrizione:", e);
    showError("Errore salvataggio iscrizione.");
    return false;
  }
}

// 🔹 Mostra anteprima iscritti con corsi filtrati
async function aggiornaAnteprima() {
  const corso = document.getElementById("tipo_corso").value;
  const pacchetti = Array.from(document.getElementById("pacchettiSelect").selectedOptions).map(o => o.value);
  const container = document.getElementById("anteprimaContainer");

  if (!corso || pacchetti.length === 0) {
    container.innerHTML = '<p class="nessun-risultato">Seleziona un corso e un pacchetto</p>';
    return;
  }

  try {
    const snapshot = await db.collection('tesserati').get();
    const iscritti = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const corsi = data.corsi || [];

      corsi.forEach(corsoItem => {
        if (corsoItem.tipo_corso === corso && corsoItem.pacchetti.some(p => pacchetti.includes(p))) {
          iscritti.push({
            nome: data.nome,
            cognome: data.cognome,
            orario: corsoItem.orario,
            pacchetti: corsoItem.pacchetti,
            livello: corsoItem.livello,
          });
        }
      });
    });

    if (iscritti.length === 0) {
      container.innerHTML = '<p class="nessun-risultato">Nessun iscritto trovato</p>';
      return;
    }

    container.innerHTML = '';
    iscritti.forEach(i => {
      const div = document.createElement("div");
      div.classList.add("iscritto-card");
      div.textContent = `${i.nome} ${i.cognome} | Livello: ${i.livello} | Orario: ${i.orario} | Pacchetti: ${i.pacchetti.join(", ")}`;
      container.appendChild(div);
    });
  } catch (e) {
    console.error("Errore anteprima:", e);
    container.innerHTML = '<p class="nessun-risultato">Errore nel caricamento.</p>';
  }
}

// 🔹 Inizializzazione
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("currentYear").textContent = new Date().getFullYear();
  populateTesseratiSelect();
  populatePacchettiSelect();

  const form = document.getElementById("corsoForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
      tesserato: form.tesserato.value,
      tipo_corso: form.tipo_corso.value,
      livello: form.livello.value,
      istruttore: form.istruttore.value.trim(),
      pacchetti: Array.from(form.pacchettiSelect.selectedOptions).map(o => o.value),
      orario: form.orario.value,
      note: form.note.value.trim()
    };

    if (validateForm(formData)) {
      const success = await salvaIscrizione(formData);
      if (success) {
        form.reset();
        aggiornaAnteprima();
      }
    }
  });

  document.getElementById("tipo_corso").addEventListener("change", aggiornaAnteprima);
  document.getElementById("pacchettiSelect").addEventListener("change", aggiornaAnteprima);
});
