// gestione-pacchetti.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("pacchettoForm");
  const anteprima = document.getElementById("anteprimaPacchetto");
  const anteprimaNome = document.getElementById("anteprimaNome");
  const anteprimaDataInizio = document.getElementById("anteprimaDataInizio");
  const anteprimaDataFine = document.getElementById("anteprimaDataFine");
  const anteprimaNumLezioni = document.getElementById("anteprimaNumLezioni");
  const anteprimaGiorni = document.getElementById("anteprimaGiorni");
  const anteprimaDateEscluse = document.getElementById("anteprimaDateEscluse");
  const anteprimaDateLezioni = document.getElementById("anteprimaDateLezioni");
  const pacchettiTableBody = document.querySelector("#pacchettiTable tbody");

  // Carica pacchetti da localStorage o crea array vuoto
  let pacchetti = JSON.parse(localStorage.getItem("pacchetti")) || [];

  // Funzione per convertire date escluse da stringa a array di Date
  function parseDateEscluse(str) {
    if (!str) return [];
    return str
      .split(",")
      .map(d => d.trim())
      .filter(d => d.length > 0)
      .map(d => {
        // Converte da gg/mm/aaaa a oggetto Date
        const [g, m, a] = d.split("/");
        return new Date(a, m - 1, g);
      });
  }

  // Calcola tutte le date delle lezioni in base ai giorni settimanali, data inizio/fine e date escluse
  function calcolaDateLezioni(dataInizio, dataFine, giorniSettimana, dateEscluse) {
    const dateLezioni = [];
    let currentDate = new Date(dataInizio);

    while (currentDate <= dataFine) {
      // Controlla se il giorno della settimana è uno dei giorni selezionati
      const dayName = currentDate.toLocaleDateString("it-IT", { weekday: "long" });
      const isExcluded = dateEscluse.some(exDate =>
        exDate.getFullYear() === currentDate.getFullYear() &&
        exDate.getMonth() === currentDate.getMonth() &&
        exDate.getDate() === currentDate.getDate()
      );

      if (giorniSettimana.includes(dayName) && !isExcluded) {
        dateLezioni.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dateLezioni;
  }

  // Mostra anteprima del pacchetto
  function mostraAnteprima(pacchetto) {
    anteprimaNome.textContent = pacchetto.nome;
    anteprimaDataInizio.textContent = pacchetto.dataInizio.toLocaleDateString("it-IT");
    anteprimaDataFine.textContent = pacchetto.dataFine.toLocaleDateString("it-IT");
    anteprimaGiorni.textContent = pacchetto.giorni.join(", ");
    anteprimaDateEscluse.textContent = pacchetto.dateEscluse
      .map(d => d.toLocaleDateString("it-IT"))
      .join(", ") || "Nessuna";
    anteprimaNumLezioni.textContent = pacchetto.dateLezioni.length;

    anteprimaDateLezioni.innerHTML = "";
    pacchetto.dateLezioni.forEach(d => {
      const li = document.createElement("li");
      li.textContent = d.toLocaleDateString("it-IT");
      anteprimaDateLezioni.appendChild(li);
    });

    anteprima.style.display = "block";
  }

  // Aggiorna la tabella dei pacchetti
  function aggiornaTabella() {
    pacchettiTableBody.innerHTML = "";

    pacchetti.forEach((pacchetto, index) => {
      const tr = document.createElement("tr");

      const tdNome = document.createElement("td");
      tdNome.textContent = pacchetto.nome;
      tr.appendChild(tdNome);

      const tdDataInizio = document.createElement("td");
      tdDataInizio.textContent = pacchetto.dataInizio.toLocaleDateString("it-IT");
      tr.appendChild(tdDataInizio);

      const tdDataFine = document.createElement("td");
      tdDataFine.textContent = pacchetto.dataFine.toLocaleDateString("it-IT");
      tr.appendChild(tdDataFine);

      const tdGiorni = document.createElement("td");
      tdGiorni.textContent = pacchetto.giorni.join(", ");
      tr.appendChild(tdGiorni);

      const tdLezioni = document.createElement("td");
      tdLezioni.textContent = pacchetto.dateLezioni.length;
      tr.appendChild(tdLezioni);

      const tdAzioni = document.createElement("td");
      const btnElimina = document.createElement("button");
      btnElimina.textContent = "Elimina";
      btnElimina.classList.add("btn", "btn-danger");
      btnElimina.addEventListener("click", () => {
        pacchetti.splice(index, 1);
        salvaPacchetti();
        aggiornaTabella();
        anteprima.style.display = "none";
      });
      tdAzioni.appendChild(btnElimina);
      tr.appendChild(tdAzioni);

      pacchettiTableBody.appendChild(tr);
    });
  }

  // Salva pacchetti su localStorage
  function salvaPacchetti() {
    // Per salvare le Date correttamente, serializziamo manualmente
    const pacchettiSerializzati = pacchetti.map(p => ({
      nome: p.nome,
      dataInizio: p.dataInizio.toISOString(),
      dataFine: p.dataFine.toISOString(),
      giorni: p.giorni,
      dateEscluse: p.dateEscluse.map(d => d.toISOString()),
      dateLezioni: p.dateLezioni.map(d => d.toISOString())
    }));

    localStorage.setItem("pacchetti", JSON.stringify(pacchettiSerializzati));
  }

  // Carica pacchetti da localStorage (con deserializzazione Date)
  function caricaPacchetti() {
    const dati = JSON.parse(localStorage.getItem("pacchetti"));
    if (!dati) return [];

    return dati.map(p => ({
      nome: p.nome,
      dataInizio: new Date(p.dataInizio),
      dataFine: new Date(p.dataFine),
      giorni: p.giorni,
      dateEscluse: p.dateEscluse.map(d => new Date(d)),
      dateLezioni: p.dateLezioni.map(d => new Date(d))
    }));
  }

  // Gestione submit form
  form.addEventListener("submit", e => {
    e.preventDefault();

    const nome = form.nome_pacchetto.value.trim();
    const dataInizio = new Date(form.data_inizio_pacchetto.value);
    const dataFine = new Date(form.data_fine_pacchetto.value);

    // Giorni selezionati
    const giorniSelezionati = Array.from(form.querySelectorAll("input[name='giorni_pacchetto[]']:checked"))
      .map(checkbox => checkbox.value);

    // Date escluse
    const dateEscluse = parseDateEscluse(form.date_escluse.value);

    // Validazioni base
    if (!nome) {
      alert("Inserisci il nome del pacchetto.");
      return;
    }
    if (dataFine < dataInizio) {
      alert("La data di fine deve essere uguale o successiva alla data di inizio.");
      return;
    }
    if (giorniSelezionati.length === 0) {
      alert("Seleziona almeno un giorno settimanale.");
      return;
    }

    const dateLezioni = calcolaDateLezioni(dataInizio, dataFine, giorniSelezionati, dateEscluse);

    const pacchetto = {
      nome,
      dataInizio,
      dataFine,
      giorni: giorniSelezionati,
      dateEscluse,
      dateLezioni,
    };

    pacchetti.push(pacchetto);
    salvaPacchetti();
    aggiornaTabella();
    mostraAnteprima(pacchetto);

    form.reset();
  });

  // Funzione per resettare tutti i pacchetti
  window.resettaPacchetti = function () {
    if (confirm("Sei sicuro di voler resettare tutti i pacchetti?")) {
      pacchetti = [];
      localStorage.removeItem("pacchetti");
      aggiornaTabella();
      anteprima.style.display = "none";
    }
  };

  // Inizializza caricando i pacchetti salvati
  pacchetti = caricaPacchetti();
  aggiornaTabella();
});

function parseDate(str) {
  // Formato "gg/mm/aaaa" in Date oggetto
  const [d, m, y] = str.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  // Formatta in "gg/mm/aaaa"
  const d = ("0" + date.getDate()).slice(-2);
  const m = ("0" + (date.getMonth() + 1)).slice(-2);
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function isDateInArray(date, excludedDates) {
  return excludedDates.some(ed => ed.getTime() === date.getTime());
}

function isDateInRange(date, start, end) {
  return date >= start && date <= end;
}

function generaDateLezioni(dataInizio, dataFine, giorniSettimana, dateEscluse, numLezioni) {
  const lezioni = [];
  let current = new Date(dataInizio);
  
  while (lezioni.length < numLezioni && current <= dataFine) {
    const giornoStr = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"][current.getDay()];
    
    if (giorniSettimana.includes(giornoStr) && 
        !isDateInArray(current, dateEscluse)) {
      lezioni.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return lezioni;
}

function generaPacchettiAutomatici() {
  const dataInizioStagione = new Date(2025, 8, 8); // 8 settembre 2025 (mese base 0)
  const dataFineStagione = new Date(2026, 5, 13);  // 13 giugno 2026

  // Date escluse in formato Date
  const dateEscluseStr = [
    "01/11/2025",
    "08/12/2025",
    // dal 24/12/2025 al 06/01/2026
    "24/12/2025", "25/12/2025", "26/12/2025", "27/12/2025", "28/12/2025", "29/12/2025", "30/12/2025", "31/12/2025",
    "01/01/2026", "02/01/2026", "03/01/2026", "04/01/2026", "05/01/2026", "06/01/2026",
    "04/04/2026",
    "25/04/2026",
    "01/05/2026",
    "02/05/2026",
    "02/06/2026"
  ];
  const dateEscluse = dateEscluseStr.map(parseDate);

  // Definizione pacchetti con giorni e numero lezioni richiesti
  const definizionePacchetti = [
    { nomeBase: "Lunedì-Mercoledì", giorni: ["Lunedì", "Mercoledì"], numLezioni: 14 },
    { nomeBase: "Martedì-Giovedì", giorni: ["Martedì", "Giovedì"], numLezioni: 14 },
    { nomeBase: "Venerdì", giorni: ["Venerdì"], numLezioni: 10 },
    { nomeBase: "Sabato", giorni: ["Sabato"], numLezioni: 10 }
  ];

  const pacchetti = [];

  definizionePacchetti.forEach((defPacchetto, index) => {
    // Genera date lezioni
    const dateLezioni = generaDateLezioni(dataInizioStagione, dataFineStagione, defPacchetto.giorni, dateEscluse, defPacchetto.numLezioni);

    // Costruisco il pacchetto con dati
    const pacchetto = {
      nome: `${index + 1} - ${defPacchetto.nomeBase}`,
      data_inizio: formatDate(dateLezioni[0]),
      data_fine: formatDate(dateLezioni[dateLezioni.length - 1]),
      giorni: defPacchetto.giorni,
      date_escluse: dateEscluseStr,
      date_lezioni: dateLezioni.map(d => formatDate(d)),
      num_lezioni: dateLezioni.length
    };
    pacchetti.push(pacchetto);
  });

  // Salvo i pacchetti nel localStorage
  localStorage.setItem('pacchettiLezioni', JSON.stringify(pacchetti));

  // Aggiorna la tabella o la visualizzazione
  aggiornaTabella();
}

// Funzione esempio che aggiorna la tabella pacchetti
function aggiornaTabella() {
  const pacchetti = JSON.parse(localStorage.getItem('pacchettiLezioni') || "[]");
  const tbody = document.querySelector("#pacchettiTable tbody");
  tbody.innerHTML = "";

  pacchetti.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.nome}</td>
      <td>${p.data_inizio}</td>
      <td>${p.data_fine}</td>
      <td>${p.giorni.join(", ")}</td>
      <td>${p.num_lezioni}</td>
      <td>
        <button onclick="mostraAnteprimaPacchetto('${p.nome}')">Anteprima</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Funzione esempio per mostrare l’anteprima (da adattare a seconda della tua UI)
function mostraAnteprimaPacchetto(nomePacchetto) {
  const pacchetti = JSON.parse(localStorage.getItem('pacchettiLezioni') || "[]");
  const pacchetto = pacchetti.find(p => p.nome === nomePacchetto);
  if (!pacchetto) return alert("Pacchetto non trovato");

  document.getElementById("anteprimaPacchetto").style.display = "block";
  document.getElementById("anteprimaNome").textContent = pacchetto.nome;
  document.getElementById("anteprimaDataInizio").textContent = pacchetto.data_inizio;
  document.getElementById("anteprimaDataFine").textContent = pacchetto.data_fine;
  document.getElementById("anteprimaNumLezioni").textContent = pacchetto.num_lezioni;
  document.getElementById("anteprimaGiorni").textContent = pacchetto.giorni.join(", ");
  document.getElementById("anteprimaDateEscluse").textContent = pacchetto.date_escluse.join(", ");

  const ul = document.getElementById("anteprimaDateLezioni");
  ul.innerHTML = "";
  pacchetto.date_lezioni.forEach(data => {
    const li = document.createElement("li");
    li.textContent = data;
    ul.appendChild(li);
  });
}

// Chiamare generaPacchettiAutomatici() all’avvio o al click di un pulsante
// esempio:
 document.getElementById("btnGeneraPacchetti").addEventListener("click", generaPacchettiAutomatici);
