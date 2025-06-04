document.addEventListener('DOMContentLoaded', async () => {
    // Inizializza Firebase
    const db = firebase.firestore();
    const form = document.getElementById('corsoForm');
    const selectTesserato = document.getElementById('tesserato');
    
    // Carica i tesserati dal database
    async function caricaTesserati() {
        try {
            const snapshot = await db.collection('tesserati').get();
            selectTesserato.innerHTML = '<option value="">-- Seleziona --</option>';
            
            snapshot.forEach(doc => {
                const tesserato = doc.data();
                const option = document.createElement('option');
                option.value = doc.id; // Usa l'ID del documento
                option.textContent = `${tesserato.anagrafica?.cognome} ${tesserato.anagrafica?.nome} (${doc.id})`;
                selectTesserato.appendChild(option);
            });
        } catch (error) {
            console.error("Errore caricamento tesserati:", error);
            alert("Errore nel caricamento dei tesserati");
        }
    }

    // Gestione submit form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tesseratoId = form.tesserato.value;
        if (!tesseratoId) {
            alert("Seleziona un tesserato");
            return;
        }

        const nuovoCorso = {
            tipo: form.tipo_corso.value,
            livello: form.livello.value,
            istruttore: form.istruttore.value,
            orario: form.orario.value,
            pacchetti: Array.from(form.pacchetti.selectedOptions).map(o => o.value),
            note: form.note.value,
            data_iscrizione: new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
            stato: "attivo"
        };

        try {
            // Aggiungi il corso all'array "corsi" del tesserato
            await db.collection('tesserati').doc(tesseratoId).update({
                corsi: firebase.firestore.FieldValue.arrayUnion(nuovoCorso)
            });
            
            alert("Corso assegnato con successo!");
            form.reset();
            aggiornaAnteprima(tesseratoId);
        } catch (error) {
            console.error("Errore salvataggio corso:", error);
            alert(`Errore: ${error.message}`);
        }
    });

    // Funzione per aggiornare l'anteprima
    async function aggiornaAnteprima(tesseratoId) {
        const container = document.getElementById('anteprimaContainer');
        const doc = await db.collection('tesserati').doc(tesseratoId).get();
        
        if (!doc.exists) {
            container.innerHTML = '<p class="nessun-risultato">Tesserato non trovato</p>';
            return;
        }

        const tesserato = doc.data();
        let html = `<h3>${tesserato.anagrafica?.cognome} ${tesserato.anagrafica?.nome}</h3>`;
        
        if (tesserato.corsi && tesserato.corsi.length > 0) {
            html += '<ul class="lista-corsi">';
            tesserato.corsi.forEach(corso => {
                html += `
                <li>
                    <strong>${corso.tipo}</strong> (Liv. ${corso.livello})<br>
                    ${corso.orario} - ${corso.istruttore}<br>
                    Pacchetti: ${corso.pacchetti?.join(', ')}
                </li>`;
            });
            html += '</ul>';
        } else {
            html += '<p>Nessun corso assegnato</p>';
        }
        
        container.innerHTML = html;
    }

    // Inizializzazione
    caricaTesserati();
    document.getElementById('currentYear').textContent = new Date().getFullYear();
});
