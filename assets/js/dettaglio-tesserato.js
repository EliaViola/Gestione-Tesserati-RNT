// dettaglio-tesserato.js - Gestione completa tesserato con corsi attuali e storico

document.addEventListener('DOMContentLoaded', function() {
    try {
        // 1. INIZIALIZZAZIONE FIREBASE
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase non è stato caricato correttamente');
        }
        
        const db = firebase.firestore();
        const auth = firebase.auth();
        
        // 2. ELEMENTI UI
        const elements = {
            form: document.getElementById('form-tesserato'),
            btnSalva: document.getElementById('btn-salva'),
            btnAnnulla: document.getElementById('btn-annulla'),
            loadingIndicator: document.getElementById('loading-indicator'),
            feedbackMsg: document.getElementById('feedback-msg'),
            currentYear: document.getElementById('currentYear'),
            corsiAttualiBody: document.getElementById('corsi-attuali-body'),
            storicoCorsiBody: document.getElementById('storico-corsi-body')
        };

        // 3. PARAMETRI URL
        const urlParams = new URLSearchParams(window.location.search);
        const tesseratoId = urlParams.get('id');
        
        if (!tesseratoId) {
            throw new Error('ID tesserato non specificato');
        }
        
        // 4. IMPOSTA ANNO CORRENTE
        elements.currentYear.textContent = new Date().getFullYear();
        
        // 5. CARICAMENTO INIZIALE
        caricaDatiTesserato();

        // 6. FUNZIONI PRINCIPALI
        async function caricaDatiTesserato() {
            try {
                showLoading(true);
                
                // Carica dati anagrafici
                const tesseratoDoc = await db.collection("tesserati").doc(tesseratoId).get();
                
                if (!tesseratoDoc.exists) {
                    throw new Error('Tesserato non trovato');
                }
                
                popolaForm(tesseratoDoc.data());
                
                // Carica corsi (attuali e storico)
                await caricaCorsiTesserato();
                
            } catch (error) {
                console.error("Errore caricamento dati:", error);
                showFeedback("Errore nel caricamento dei dati", 'error');
            } finally {
                showLoading(false);
            }
        }

        function popolaForm(tesserato) {
            // Mappatura campi del form
            const fieldsMapping = {
                // Anagrafica
                'nome': tesserato.anagrafica?.nome || '',
                'cognome': tesserato.anagrafica?.cognome || '',
                'codice-fiscale': tesserato.anagrafica?.codice_fiscale || '',
                'data-nascita': tesserato.anagrafica?.data_nascita || '',
                'luogo-nascita': tesserato.anagrafica?.luogo_nascita || '',
                'sesso': tesserato.anagrafica?.sesso || 'M',
                'nazionalita': tesserato.anagrafica?.nazionalita || '',
                
                // Contatti
                'indirizzo': tesserato.contatti?.indirizzo || '',
                'citta': tesserato.contatti?.citta || '',
                'provincia': tesserato.contatti?.provincia || '',
                'cap': tesserato.contatti?.cap || '',
                'telefono': tesserato.contatti?.telefono || '',
                'email': tesserato.contatti?.email || '',
                
                // Documenti
                'tipo-documento': tesserato.documenti?.tipo || '',
                'numero-documento': tesserato.documenti?.numero || '',
                'rilasciato-da': tesserato.documenti?.rilasciato_da || '',
                'data-rilascio': tesserato.documenti?.data_rilascio || '',
                'data-scadenza': tesserato.documenti?.data_scadenza || '',
                
                // Tesseramento
                'data-tesseramento': tesserato.tesseramento?.data || '',
                'tipo-tessera': tesserato.tesseramento?.tipo || '',
                'numero-tessera': tesserato.tesseramento?.numero || '',
                'stato-tessera': tesserato.tesseramento?.stato || 'Attiva'
            };

            // Popola tutti i campi
            for (const [id, value] of Object.entries(fieldsMapping)) {
                const element = document.getElementById(id);
                if (element) {
                    element.value = value;
                }
            }
        }

        async function caricaCorsiTesserato() {
            try {
                // Query per ottenere tutte le iscrizioni ordinate per data
                const iscrizioniSnapshot = await db.collection("iscrizioni")
                    .where("tesseratoId", "==", tesseratoId)
                    .orderBy("dataIscrizione", "desc")
                    .get();

                if (iscrizioniSnapshot.empty) {
                    setTabellaVuota();
                    return;
                }

                // Processa le iscrizioni
                const { corsiAttuali, storicoCorsi } = await processaIscrizioni(iscrizioniSnapshot);
                
                // Aggiorna l'UI
                aggiornaTabellaCorsi(corsiAttuali, storicoCorsi);
                
            } catch (error) {
                console.error("Errore caricamento corsi:", error);
                setTabellaErrore();
            }
        }

        async function processaIscrizioni(iscrizioniSnapshot) {
            const corsiAttuali = [];
            const storicoCorsi = [];
            const promises = [];
            
            iscrizioniSnapshot.forEach(doc => {
                const iscrizione = doc.data();
                promises.push(
                    db.collection("corsi").doc(iscrizione.corsoId).get()
                        .then(corsoDoc => {
                            if (corsoDoc.exists) {
                                const corso = {
                                    ...corsoDoc.data(),
                                    id: corsoDoc.id,
                                    iscrizioneId: doc.id,
                                    pacchetto: iscrizione.pacchetto,
                                    stato: iscrizione.stato,
                                    dataIscrizione: iscrizione.dataIscrizione
                                };
                                
                                if (iscrizione.stato === 'Attivo') {
                                    corsiAttuali.push(corso);
                                } else {
                                    storicoCorsi.push(corso);
                                }
                            }
                        })
                );
            });
            
            await Promise.all(promises);
            return { corsiAttuali, storicoCorsi };
        }

        function aggiornaTabellaCorsi(corsiAttuali, storicoCorsi) {
            // Corsi attuali
            elements.corsiAttualiBody.innerHTML = corsiAttuali.length > 0 
                ? corsiAttuali.map(corso => `
                    <tr>
                        <td>${corso.nome}</td>
                        <td>${corso.livello}</td>
                        <td>${corso.giorni.join(', ')}</td>
                        <td>${corso.orario}</td>
                        <td>${corso.pacchetto || 'N/A'}</td>
                        <td>
                            <button class="btn btn-small" 
                                onclick="location.href='dettaglio-corso.html?id=${corso.id}'">
                                <i class="fas fa-info-circle"></i> Dettagli
                            </button>
                            <button class="btn btn-small btn-warning" 
                                onclick="disattivaCorso('${corso.iscrizioneId}')">
                                <i class="fas fa-times"></i> Disattiva
                            </button>
                        </td>
                    </tr>
                `).join('')
                : '<tr><td colspan="6" class="text-center">Nessun corso attivo</td></tr>';

            // Storico corsi
            elements.storicoCorsiBody.innerHTML = storicoCorsi.length > 0
                ? storicoCorsi.map(corso => `
                    <tr>
                        <td>${corso.nome}</td>
                        <td>${corso.livello}</td>
                        <td>${corso.giorni.join(', ')}</td>
                        <td>${corso.stagione}</td>
                        <td>${corso.pacchetto || 'N/A'}</td>
                        <td>
                            <span class="badge ${getBadgeClass(corso.stato)}">${corso.stato}</span>
                            <button class="btn btn-small btn-success" 
                                onclick="riattivaCorso('${corso.iscrizioneId}')">
                                <i class="fas fa-redo"></i> Riattiva
                            </button>
                        </td>
                    </tr>
                `).join('')
                : '<tr><td colspan="6" class="text-center">Nessun storico corsi</td></tr>';
        }

        function getBadgeClass(stato) {
            switch(stato) {
                case 'Completato': return 'badge-success';
                case 'Disattivo': return 'badge-warning';
                case 'Cancellato': return 'badge-danger';
                default: return 'badge-secondary';
            }
        }

        function setTabellaVuota() {
            elements.corsiAttualiBody.innerHTML = 
                '<tr><td colspan="6" class="text-center">Nessun corso attivo</td></tr>';
            elements.storicoCorsiBody.innerHTML = 
                '<tr><td colspan="6" class="text-center">Nessun storico corsi</td></tr>';
        }

        function setTabellaErrore() {
            elements.corsiAttualiBody.innerHTML = 
                '<tr><td colspan="6" class="text-center error">Errore caricamento corsi</td></tr>';
            elements.storicoCorsiBody.innerHTML = 
                '<tr><td colspan="6" class="text-center error">Errore caricamento storico</td></tr>';
        }

        // 7. FUNZIONI DI GESTIONE CORSI
        async function disattivaCorso(iscrizioneId) {
            if (confirm('Disattivare questo corso per il tesserato?')) {
                try {
                    showLoading(true);
                    await db.collection("iscrizioni").doc(iscrizioneId).update({
                        stato: 'Disattivo',
                        dataDisattivazione: new Date()
                    });
                    showFeedback("Corso disattivato con successo", 'success');
                    await caricaCorsiTesserato();
                } catch (error) {
                    console.error("Errore disattivazione corso:", error);
                    showFeedback("Errore durante la disattivazione", 'error');
                } finally {
                    showLoading(false);
                }
            }
        }

        async function riattivaCorso(iscrizioneId) {
            if (confirm('Riattivare questo corso per il tesserato?')) {
                try {
                    showLoading(true);
                    await db.collection("iscrizioni").doc(iscrizioneId).update({
                        stato: 'Attivo',
                        dataRiattivazione: new Date()
                    });
                    showFeedback("Corso riattivato con successo", 'success');
                    await caricaCorsiTesserato();
                } catch (error) {
                    console.error("Errore riattivazione corso:", error);
                    showFeedback("Errore durante la riattivazione", 'error');
                } finally {
                    showLoading(false);
                }
            }
        }

        // 8. FUNZIONI UTILITY
        function showLoading(show) {
            elements.loadingIndicator.classList.toggle('hidden', !show);
            elements.btnSalva.disabled = show;
            elements.btnAnnulla.disabled = show;
        }

        function showFeedback(message, type = 'success') {
            elements.feedbackMsg.textContent = message;
            elements.feedbackMsg.className = `feedback-msg ${type}`;
            elements.feedbackMsg.classList.remove('hidden');
            
            setTimeout(() => {
                elements.feedbackMsg.classList.add('hidden');
            }, 5000);
        }

        // 9. ESPORTAZIONE FUNZIONI GLOBALI
        window.salvaModificheTesserato = async function() {
            try {
                if (!elements.form.checkValidity()) {
                    elements.form.reportValidity();
                    return;
                }
                
                showLoading(true);
                
                const tesserato = {
                    anagrafica: getSectionData('anagrafica'),
                    contatti: getSectionData('contatti'),
                    documenti: getSectionData('documenti'),
                    tesseramento: getSectionData('tesseramento'),
                    ultimaModifica: new Date(),
                    modificatoDa: auth.currentUser?.email || 'admin'
                };
                
                await db.collection("tesserati").doc(tesseratoId).set(tesserato, { merge: true });
                showFeedback("Modifiche salvate con successo!", 'success');
                
                setTimeout(() => {
                    window.location.href = 'ricerca-dati.html';
                }, 2000);
                
            } catch (error) {
                console.error("Errore salvataggio:", error);
                showFeedback("Errore durante il salvataggio", 'error');
            } finally {
                showLoading(false);
            }
        };

        function getSectionData(section) {
            const fields = {
                anagrafica: ['nome', 'cognome', 'codice_fiscale', 'data_nascita', 'luogo_nascita', 'sesso', 'nazionalita'],
                contatti: ['indirizzo', 'citta', 'provincia', 'cap', 'telefono', 'email'],
                documenti: ['tipo', 'numero', 'rilasciato_da', 'data_rilascio', 'data_scadenza'],
                tesseramento: ['data', 'tipo', 'numero', 'stato']
            };
            
            return fields[section].reduce((acc, field) => {
                const element = document.getElementById(`${section === 'tesseramento' ? 'stato-tessera' : field}`);
                if (element) {
                    acc[field] = element.value.trim();
                    if (field === 'email') acc[field] = acc[field].toLowerCase();
                    if (field === 'provincia') acc[field] = acc[field].toUpperCase();
                }
                return acc;
            }, {});
        }

        window.annullaModifiche = function() {
            if (confirm('Annullare tutte le modifiche?')) {
                window.location.href = 'ricerca-dati.html';
            }
        };

        window.disattivaCorso = disattivaCorso;
        window.riattivaCorso = riattivaCorso;

    } catch (error) {
        console.error('Errore inizializzazione:', error);
        alert('Errore: ' + error.message);
    }
});