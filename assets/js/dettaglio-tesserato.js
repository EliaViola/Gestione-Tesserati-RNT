document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase non caricato');
        }

        const db = firebase.firestore();
        const auth = firebase.auth();

        const form = document.getElementById('form-tesserato');
        const btnSalva = document.getElementById('btn-salva');
        const btnAnnulla = document.getElementById('btn-annulla');
        const feedback = document.getElementById('feedback-msg');
        const loading = document.getElementById('loading-indicator');
        const corsiContainer = document.getElementById('corsi-attuali');

        const tesseratoId = new URLSearchParams(window.location.search).get('id');
        if (!tesseratoId) throw new Error('ID tesserato mancante');

        await caricaTesserato(tesseratoId);
        await caricaCorsi(tesseratoId);

        window.salvaModificheTesserato = async () => {
            if (!form.checkValidity()) return form.reportValidity();

            mostraLoading(true);
            const dati = leggiDatiForm();
            await db.collection("tesserati").doc(tesseratoId).set({
                ...dati,
                ultimaModifica: new Date(),
                modificatoDa: auth.currentUser?.email || 'admin'
            }, { merge: true });

            mostraFeedback('Modifiche salvate con successo!', 'success');
            mostraLoading(false);
            setTimeout(() => window.location.href = 'ricerca-dati.html', 2000);
        };

        window.annullaModifiche = () => {
            if (confirm('Annullare le modifiche e tornare indietro?')) {
                window.location.href = 'ricerca-dati.html';
            }
        };

        function mostraLoading(visibile) {
            loading.style.display = visibile ? 'block' : 'none';
            btnSalva.disabled = visibile;
            btnAnnulla.disabled = visibile;
        }

        function mostraFeedback(msg, tipo) {
            feedback.textContent = msg;
            feedback.className = `feedback-msg ${tipo}`;
            feedback.style.display = 'block';
            setTimeout(() => feedback.style.display = 'none', 5000);
        }

        function leggiDatiForm() {
            return {
                anagrafica: {
                    nome: form.nome.value.trim(),
                    cognome: form.cognome.value.trim(),
                    codice_fiscale: form['codice-fiscale'].value.trim().toUpperCase(),
                    data_nascita: form['data-nascita'].value,
                    luogo_nascita: form['luogo-nascita'].value.trim(),
                    sesso: form.sesso.value,
                    nazionalita: form.nazionalita.value.trim()
                },
                contatti: {
                    indirizzo: form.indirizzo.value.trim(),
                    citta: form.citta.value.trim(),
                    provincia: form.provincia.value.trim().toUpperCase(),
                    cap: form.cap.value.trim(),
                    telefono: form.telefono.value.trim(),
                    email: form.email.value.trim().toLowerCase()
                },
                documenti: {
                    tipo: form['tipo-documento'].value,
                    numero: form['numero-documento'].value.trim(),
                    rilasciato_da: form['rilasciato-da'].value.trim(),
                    data_rilascio: form['data-rilascio'].value,
                    data_scadenza: form['data-scadenza'].value
                },
                tesseramento: {
                    data: form['data-tesseramento'].value,
                    tipo: form['tipo-tessera'].value,
                    numero: form['numero-tessera'].value.trim(),
                    stato: form['stato-tessera'].value
                },
                medica: {
                    certificato: form['certificato-medico'].value,
                    data_certificato: form['data-certificato'].value,
                    scadenza_certificato: form['scadenza-certificato'].value,
                    note: form['note-mediche'].value.trim()
                },
                pagamenti: {
                    quota_iscrizione: form['quota-iscrizione'].value,
                    data_pagamento: form['data-pagamento'].value,
                    metodo: form['metodo-pagamento'].value,
                    stato: form['stato-pagamento'].value,
                    note: form['note-pagamenti'].value.trim()
                }
            };
        }

        async function caricaTesserato(id) {
            mostraLoading(true);
            const doc = await db.collection("tesserati").doc(id).get();
            if (!doc.exists) throw new Error('Tesserato non trovato');
            const dati = doc.data();
            Object.entries(dati.anagrafica || {}).forEach(([k, v]) => form[k]?.value = v);
            Object.entries(dati.contatti || {}).forEach(([k, v]) => form[k]?.value = v);
            Object.entries(dati.documenti || {}).forEach(([k, v]) => form[k.replace('_', '-')]?.value = v);
            Object.entries(dati.tesseramento || {}).forEach(([k, v]) => form[k.replace('_', '-')]?.value = v);
            Object.entries(dati.medica || {}).forEach(([k, v]) => form[k.replace('_', '-')]?.value = v);
            Object.entries(dati.pagamenti || {}).forEach(([k, v]) => form[k.replace('_', '-')]?.value = v);
            mostraLoading(false);
        }

        async function caricaCorsi(id) {
            const iscrizioni = await db.collection("iscrizioni")
                .where("tesseratoId", "==", id)
                .where("stato", "==", "Attivo")
                .get();

            if (iscrizioni.empty) {
                corsiContainer.innerHTML = "<p>Nessun corso attivo</p>";
                return;
            }

            let html = "<div class='corsi-grid'>";
            for (const doc of iscrizioni.docs) {
                const { corsoId } = doc.data();
                const corsoSnap = await db.collection("corsi").doc(corsoId).get();
                if (!corsoSnap.exists) continue;
                const corso = corsoSnap.data();

                html += `
                    <div class="corso-card">
                        <h3>${corso.nome}</h3>
                        <p><strong>Livello:</strong> ${corso.livello}</p>
                        <p><strong>Giorni:</strong> ${corso.giorni.join(', ')}</p>
                        <p><strong>Orario:</strong> ${corso.orario}</p>
                        <p><strong>Stagione:</strong> ${corso.stagione}</p>
                        <button onclick="location.href='dettaglio-corso.html?id=${corsoId}'">
                            <i class="fas fa-info-circle"></i> Dettaglio Corso
                        </button>
                    </div>`;
            }
            html += "</div>";
            corsiContainer.innerHTML = html;
        }

    } catch (e) {
        console.error('Errore:', e);
        alert(e.message);
    }
});
