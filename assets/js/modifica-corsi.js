document.addEventListener('DOMContentLoaded', function() {
    const db = firebase.firestore();
    const urlParams = new URLSearchParams(window.location.search);
    const corsoId = urlParams.get('id');
    
    // Carica i dati del corso
    async function caricaCorso() {
        if (!corsoId) {
            alert('Nessun corso selezionato!');
            window.location.href = 'ricerca-dati.html';
            return;
        }

        try {
            const doc = await db.collection("corsi").doc(corsoId).get();
            if (!doc.exists) {
                throw new Error("Corso non trovato");
            }
            
            const corso = doc.data();
            // Popola il form con i dati del corso
            document.getElementById('tesserato').value = corso.iscritti[0];
            // ... popola altri campi ...
            
        } catch (error) {
            console.error("Errore caricamento corso:", error);
            alert("Errore durante il caricamento del corso: " + error.message);
            window.location.href = 'ricerca-dati.html';
        }
    }

    // Salva le modifiche
    async function salvaModifiche(e) {
        e.preventDefault();
        
        const formData = {
            // Recupera i dati dal form
            iscritti: [document.getElementById('tesserato').value],
            // ... altri campi ...
        };

        try {
            await db.collection("corsi").doc(corsoId).update(formData);
            alert('Corso modificato con successo!');
            window.location.href = 'ricerca-dati.html';
        } catch (error) {
            console.error("Errore durante il salvataggio:", error);
            alert("Errore durante il salvataggio: " + error.message);
        }
    }

    // Inizializza la pagina
    document.getElementById('corsoForm').addEventListener('submit', salvaModifiche);
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    caricaCorso();
});