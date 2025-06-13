// dettaglio-tesserato.js - Gestione dettaglio e modifica tesserato

// Definizioni globali
window.salvaModificheTesserato = function() {};
window.annullaModifiche = function() {};

document.addEventListener('DOMContentLoaded', function() {
    try {
        // Inizializza Firebase
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase non è stato caricato correttamente');
        }
        
        const db = firebase.firestore();
        const auth = firebase.auth();
        
        // Elementi UI
        const formTesserato = document.getElementById('form-tesserato');
        const btnSalva = document.getElementById('btn-salva');
        const btnAnnulla = document.getElementById('btn-annulla');
        const loadingIndicator = document.getElementById('loading-indicator');
        const feedbackMsg = document.getElementById('feedback-msg');
        
        // Ottieni ID tesserato dall'URL
        const urlParams = new URLSearchParams(window.location.search);
        const tesseratoId = urlParams.get('id');
        
        if (!tesseratoId) {
            throw new Error('ID tesserato non specificato');
        }
        
        // Carica i dati del tesserato
        async function caricaDatiTesserato() {
            try {
                showLoading(true);
                
                const doc = await db.collection("tesserati").doc(tesseratoId).get();
                
                if (!doc.exists) {
                    throw new Error('Tesserato non trovato');
                }
                
                const tesserato = doc.data();
                popolaForm(tesserato);
                showLoading(false);
                
            } catch (error) {
                console.error("Errore caricamento tesserato:", error);
                showFeedback("Errore nel caricamento del tesserato", 'error');
                throw error;
            }
        }
        
        // Popola il form con i dati del tesserato
        function popolaForm(tesserato) {
            // Sezione Anagrafica
            const anagrafica = tesserato.anagrafica || {};
            document.getElementById('nome').value = anagrafica.nome || '';
            document.getElementById('cognome').value = anagrafica.cognome || '';
            document.getElementById('codice-fiscale').value = anagrafica.codice_fiscale || '';
            document.getElementById('data-nascita').value = anagrafica.data_nascita || '';
            document.getElementById('luogo-nascita').value = anagrafica.luogo_nascita || '';
            document.getElementById('sesso').value = anagrafica.sesso || '';
            document.getElementById('nazionalita').value = anagrafica.nazionalita || '';
            
            // Sezione Contatti
            const contatti = tesserato.contatti || {};
            document.getElementById('indirizzo').value = contatti.indirizzo || '';
            document.getElementById('citta').value = contatti.citta || '';
            document.getElementById('provincia').value = contatti.provincia || '';
            document.getElementById('cap').value = contatti.cap || '';
            document.getElementById('telefono').value = contatti.telefono || '';
            document.getElementById('email').value = contatti.email || '';
            
            // Sezione Documenti
            const documenti = tesserato.documenti || {};
            document.getElementById('tipo-documento').value = documenti.tipo || '';
            document.getElementById('numero-documento').value = documenti.numero || '';
            document.getElementById('rilasciato-da').value = documenti.rilasciato_da || '';
            document.getElementById('data-rilascio').value = documenti.data_rilascio || '';
            document.getElementById('data-scadenza').value = documenti.data_scadenza || '';
            
            // Sezione Tesseramento
            const tesseramento = tesserato.tesseramento || {};
            document.getElementById('data-tesseramento').value = tesseramento.data || '';
            document.getElementById('tipo-tessera').value = tesseramento.tipo || '';
            document.getElementById('numero-tessera').value = tesseramento.numero || '';
            document.getElementById('stato-tessera').value = tesseramento.stato || '';
            
            // Sezione Medica
            const medica = tesserato.medica || {};
            document.getElementById('certificato-medico').value = medica.certificato || '';
            document.getElementById('data-certificato').value = medica.data_certificato || '';
            document.getElementById('scadenza-certificato').value = medica.scadenza_certificato || '';
            document.getElementById('note-mediche').value = medica.note || '';
            
            // Sezione Pagamenti
            const pagamenti = tesserato.pagamenti || {};
            document.getElementById('quota-iscrizione').value = pagamenti.quota_iscrizione || '';
            document.getElementById('data-pagamento').value = pagamenti.data_pagamento || '';
            document.getElementById('metodo-pagamento').value = pagamenti.metodo || '';
            document.getElementById('stato-pagamento').value = pagamenti.stato || '';
            document.getElementById('note-pagamenti').value = pagamenti.note || '';
        }
        
        // Salva le modifiche al tesserato
        async function salvaModificheTesserato() {
            try {
                if (!formTesserato.checkValidity()) {
                    formTesserato.reportValidity();
                    return;
                }
                
                showLoading(true);
                
                // Prepara l'oggetto tesserato con i dati del form
                const tesserato = {
                    anagrafica: {
                        nome: document.getElementById('nome').value.trim(),
                        cognome: document.getElementById('cognome').value.trim(),
                        codice_fiscale: document.getElementById('codice-fiscale').value.trim().toUpperCase(),
                        data_nascita: document.getElementById('data-nascita').value,
                        luogo_nascita: document.getElementById('luogo-nascita').value.trim(),
                        sesso: document.getElementById('sesso').value,
                        nazionalita: document.getElementById('nazionalita').value.trim()
                    },
                    contatti: {
                        indirizzo: document.getElementById('indirizzo').value.trim(),
                        citta: document.getElementById('citta').value.trim(),
                        provincia: document.getElementById('provincia').value.trim().toUpperCase(),
                        cap: document.getElementById('cap').value.trim(),
                        telefono: document.getElementById('telefono').value.trim(),
                        email: document.getElementById('email').value.trim().toLowerCase()
                    },
                    documenti: {
                        tipo: document.getElementById('tipo-documento').value,
                        numero: document.getElementById('numero-documento').value.trim().toUpperCase(),
                        rilasciato_da: document.getElementById('rilasciato-da').value.trim(),
                        data_rilascio: document.getElementById('data-rilascio').value,
                        data_scadenza: document.getElementById('data-scadenza').value
                    },
                    tesseramento: {
                        data: document.getElementById('data-tesseramento').value,
                        tipo: document.getElementById('tipo-tessera').value,
                        numero: document.getElementById('numero-tessera').value.trim(),
                        stato: document.getElementById('stato-tessera').value
                    },
                    medica: {
                        certificato: document.getElementById('certificato-medico').value,
                        data_certificato: document.getElementById('data-certificato').value,
                        scadenza_certificato: document.getElementById('scadenza-certificato').value,
                        note: document.getElementById('note-mediche').value.trim()
                    },
                    pagamenti: {
                        quota_iscrizione: document.getElementById('quota-iscrizione').value,
                        data_pagamento: document.getElementById('data-pagamento').value,
                        metodo: document.getElementById('metodo-pagamento').value,
                        stato: document.getElementById('stato-pagamento').value,
                        note: document.getElementById('note-pagamenti').value.trim()
                    },
                    ultimaModifica: new Date(),
                    modificatoDa: auth.currentUser?.email || 'admin'
                };
                
                // Salva su Firestore
                await db.collection("tesserati").doc(tesseratoId).set(tesserato, { merge: true });
                
                showFeedback("Modifiche salvate con successo!", 'success');
                showLoading(false);
                
                // Torna alla pagina di ricerca dopo 2 secondi
                setTimeout(() => {
                    window.location.href = 'ricerca.html';
                }, 2000);
                
            } catch (error) {
                console.error("Errore durante il salvataggio:", error);
                showFeedback("Errore durante il salvataggio delle modifiche", 'error');
                showLoading(false);
            }
        }
        
        // Annulla le modifiche e torna alla ricerca
        function annullaModifiche() {
            if (confirm('Annullare tutte le modifiche e tornare alla pagina di ricerca?')) {
                window.location.href = 'ricerca.html';
            }
        }
        
        // Mostra/nascondi loading indicator
        function showLoading(show) {
            if (loadingIndicator) {
                loadingIndicator.style.display = show ? 'block' : 'none';
            }
            if (btnSalva) {
                btnSalva.disabled = show;
            }
            if (btnAnnulla) {
                btnAnnulla.disabled = show;
            }
        }
        
        // Mostra messaggio di feedback
        function showFeedback(message, type = 'success') {
            if (feedbackMsg) {
                feedbackMsg.textContent = message;
                feedbackMsg.className = `feedback-msg ${type}`;
                feedbackMsg.style.display = 'block';
                
                setTimeout(() => {
                    feedbackMsg.style.display = 'none';
                }, 5000);
            }
        }
        
        // Sovrascrivi funzioni globali
        window.salvaModificheTesserato = salvaModificheTesserato;
        window.annullaModifiche = annullaModifiche;
        
        // Aggiungi event listener
        btnSalva?.addEventListener('click', salvaModificheTesserato);
        btnAnnulla?.addEventListener('click', annullaModifiche);
        
        // Carica i dati iniziali
        caricaDatiTesserato();
        
    } catch (error) {
        console.error('Errore inizializzazione:', error);
        alert('Errore: ' + error.message);
    }
});