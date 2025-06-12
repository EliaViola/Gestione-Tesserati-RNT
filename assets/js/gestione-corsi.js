const db = firebase.firestore();
const auth = firebase.auth();

// Carica i tesserati con tesseramento attivo
function loadTesserati() {
  return db.collection("tesserati")
    .where("tesseramento.stato", "==", "attivo")
    .orderBy("anagrafica.cognome")
    .orderBy("anagrafica.nome")
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

// Carica i pacchetti salvati da admin
function loadPacchetti() {
  return db.collection("pacchetti")
    .orderBy("nome")
    .get()
    .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("corsoForm");
  const pacchettoSelect = document.getElementById("pacchettiSelect"); // ✅ corretto
  const tesseratiSelect = document.getElementById("tesseratiSelect");
  const feedback = document.getElementById("feedback");

  if (!form || !pacchettoSelect || !tesseratiSelect || !feedback) {
    console.error("Uno o più elementi HTML richiesti non sono presenti nella pagina.");
    return;
  }

  // Caricamento pacchetti
  try {
    const pacchetti = await loadPacchetti();
    pacchettoSelect.innerHTML = "";
    pacchetti.forEach(p => {
      const option = document.createElement("option");
      option.value = p.id;
      if (Array.isArray(p.date) && p.date.length > 0) {
        const sorted = [...p.date].sort();
        option.textContent = `${p.nome || "Pacchetto"} (${sorted[0]} - ${sorted[sorted.length - 1]})`;
      } else {
        option.textContent = p.nome || "Pacchetto senza nome";
      }
      pacchettoSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Errore pacchetti:", error);
    pacchettoSelect.innerHTML = `<option disabled>Errore nel caricamento</option>`;
  }

  // Caricamento tesserati
  try {
    const tesserati = await loadTesserati();
    tesseratiSelect.innerHTML = "";
    tesserati.forEach(t => {
      const a = t.anagrafica || {};
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = `${a.cognome || ''} ${a.nome || ''} (${a.codice_fiscale || 'N/D'})`;
      tesseratiSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Errore tesserati:", error);
    tesseratiSelect.innerHTML = `<option disabled>Errore nel caricamento</option>`;
  }

  // Gestione submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const corso = {
      tipologia: formData.get("tipo_corso"), // ✅ corretto
      livello: formData.get("livello"),
      orario: formData.get("orario"),
      pacchetti: [...formData.getAll("pacchetti")], // ✅ corretto
      iscritti: [...formData.getAll("tesserati")],
      note: formData.get("note_corso") || "",
      creato_il: firebase.firestore.FieldValue.serverTimestamp(),
      creato_da: firebase.auth().currentUser?.uid || "anonimo"
    };

    try {
      const corsoRef = await db.collection("corsi").add(corso);

      await Promise.all(
        corso.iscritti.map(tesseratoId =>
          db.collection("tesserati").doc(tesseratoId).update({
            corsi: firebase.firestore.FieldValue.arrayUnion(corsoRef.id)
          })
        )
      );

      feedback.textContent = "Corso salvato con successo!";
      feedback.className = "success";
      form.reset();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      feedback.textContent = "Errore: " + error.message;
      feedback.className = "error";
    }
  });
});
