// gestione-corsi.js (riscritto completamente per usare backend e file JSON)

const CORSI_ENDPOINT = "/api/corsi";
const PACCHETTI_ENDPOINT = "/pacchetti.json";

function formatDate(date) {
  return new Date(date).toLocaleDateString("it-IT");
}

function showError(message) {
  alert(`Errore: ${message}`);
}

function showSuccess(message) {
  alert(`Successo: ${message}`);
}

async function loadTesserati() {
  try {
    return JSON.parse(localStorage.getItem("tesserati") || "[]");
  } catch (e) {
    console.error("Errore nel caricamento dei tesserati:", e);
    return [];
  }
}

async function loadPacchetti() {
  try {
    const res = await fetch(PACCHETTI_ENDPOINT);
    if (!res.ok) throw new Error("Impossibile caricare i pacchetti.");
    return await res.json();
  } catch (e) {
    console.error("Errore nel caricamento dei pacchetti:", e);
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

function validateForm(data) {
  if (!data.tesserato) return showError("Seleziona un tesserato.");
  if (!data.tipo_corso) return showError("Seleziona il tipo di corso.");
  if (!data.livello) return showError("Seleziona il livello.");
  if (!data.istruttore.trim()) return showError("Inserisci l'istruttore.");
  if (!data.pacchetti.length) return showError("Seleziona almeno un pacchetto.");
  if (!data.orario) return showError("Seleziona un orario.");
  return true;
}

async function salvaIscrizione(data) {
  try {
    const res = await fetch(CORSI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (res.ok) {
      showSuccess("Iscrizione salvata con successo.");
      return true;
    } else {
      showError(result.message || "Errore salvataggio.");
      return false;
    }
  } catch (e) {
    console.error("Errore salvataggio corso:", e);
    showError("Errore nella comunicazione con il server.");
    return false;
  }
}

async function aggiornaAnteprima() {
  const corso = document.getElementById("tipo_corso").value;
  const pacchetti = Array.from(document.getElementById("pacchettiSelect").selectedOptions).map(o => o.value);
  const container = document.getElementById("anteprimaContainer");

  if (!corso || pacchetti.length === 0) {
    container.innerHTML = '<p class="nessun-risultato">Seleziona un corso e un pacchetto</p>';
    return;
  }

  try {
    const res = await fetch("/corsi.json");
    const corsi = await res.json();
    const iscritti = corsi.filter(c => c.tipo_corso === corso && c.pacchetti.some(p => pacchetti.includes(p)));

    if (iscritti.length === 0) {
      container.innerHTML = '<p class="nessun-risultato">Nessun iscritto trovato</p>';
      return;
    }

    container.innerHTML = '';
    iscritti.forEach(i => {
      const div = document.createElement("div");
      div.classList.add("iscritto-card");
      div.textContent = `Tesserato: ${i.tesserato}, Corso: ${i.tipo_corso}, Pacchetti: ${i.pacchetti.join(", ")}, Orario: ${i.orario}`;
      container.appendChild(div);
    });
  } catch (e) {
    console.error("Errore anteprima:", e);
    container.innerHTML = '<p class="nessun-risultato">Errore nel caricamento.</p>';
  }
}

// Inizializzazione

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
