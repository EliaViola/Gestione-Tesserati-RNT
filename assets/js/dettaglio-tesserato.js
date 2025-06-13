document.addEventListener('DOMContentLoaded', function() {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const urlParams = new URLSearchParams(window.location.search);
    const tesseratoId = urlParams.get('id');
    
    if (!tesseratoId) {
        alert('Nessun tesserato selezionato!');
        window.location.href = 'ricerca-dati.html';
        return;
    }

    // Carica i dati del tesserato
    async function caricaTesserato() {
        try {
            const doc = await db.collection("tesserati").doc(tesseratoId).get();
            if (!doc.exists) {
                throw new Error("Tesserato non trovato");
            }
            
            const tesserato = doc.data();
            mostraDatiAnagrafici(tesserato);
            caricaStoricoCorsi();
            caricaStoricoPagamenti();
            caricaDocumenti();
            
        } catch (error) {
            console.error("Errore caricamento tesserato:", error);
            alert("Errore durante il caricamento del tesserato: " + error.message);
            window.location.href = 'ricerca-dati.html';
        }
    }

    // Mostra i dati anagrafici
    function mostraDatiAnagrafici(tesserato) {
        const anagrafica = tesserato.anagrafica || {};
        const contatti = tesserato.contatti || {};
        const tesseramento = tesserato.tesseramento || {};
        
        document.getElementById('anagraficaInfo').innerHTML = `
            <div class="info-row">
                <span class="info-label">Nome:</span>
                <span class="info-value">${anagrafica.nome || 'N/D'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Cognome:</span>
                <span class="info-value">${anagrafica.cognome || 'N/D'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Codice Fiscale:</span>
                <span class="info-value">${anagrafica.codice_fiscale || 'N/D'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Data Nascita:</span>
                <span class="info-value">${anagrafica.data_nascita ? new Date(anagrafica.data_nascita).toLocaleDateString('it-IT') : 'N/D'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Indirizzo:</span>
                <span class="info-value">${anagrafica.indirizzo || 'N/D'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Telefono:</span>
                <span class="info-value">${contatti.telefono || 'N/D'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${contatti.email || 'N/D'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Stato Tesseramento:</span>
                <span class="info-value ${tesseramento.stato === 'attivo' ? 'status-active' : 'status-inactive'}">
                    ${tesseramento.stato || 'N/D'}
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">Scadenza Certificato:</span>
                <span class="info-value">${tesseramento.scadenza_certificato ? new Date(tesseramento.scadenza_certificato).toLocaleDateString('it-IT') : 'N/D'}</span>
            </div>
        `;
    }

    // Carica lo storico corsi
    async function caricaStoricoCorsi() {
        try {
            const snapshot = await db.collection("corsi")
                .where("iscritti", "array-contains", tesseratoId)
                .orderBy("timestamp", "desc")
                .get();
                
            const storicoCorsi = document.getElementById('storicoCorsi');
            storicoCorsi.innerHTML = '';
            
            if (snapshot.empty) {
                storicoCorsi.innerHTML = `
                    <tr>
                        <td colspan="6" class="nessun-risultato">
                            Nessun corso trovato
                        </td>
                    </tr>`;
                return;
            }
            
            snapshot.forEach(doc => {
                const corso = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${getCorsoName(corso.tipologia)}</td>
                    <td>${corso.livello || 'N/D'}</td>
                    <td>${corso.giorni ? formatGiorni(corso.giorni) : 'N/D'}</td>
                    <td>${corso.orario || 'N/D'}</td>
                    <td>${corso.stagione || 'N/D'}</td>
                    <td><span class="status-badge ${corso.stato || 'inattivo'}">${corso.stato || 'N/D'}</span></td>
                `;
                storicoCorsi.appendChild(row);
            });
            
        } catch (error) {
            console.error("Errore caricamento corsi:", error);
            document.getElementById('storicoCorsi').innerHTML = `
                <tr>
                    <td colspan="6" class="errore-caricamento">
                        Errore nel caricamento dei corsi
                    </td>
                </tr>`;
        }
    }

    // Carica lo storico pagamenti
    async function caricaStoricoPagamenti() {
        try {
            const snapshot = await db.collection("pagamenti")
                .where("tesseratoId", "==", tesseratoId)
                .orderBy("data", "desc")
                .get();
                
            const storicoPagamenti = document.getElementById('storicoPagamenti');
            storicoPagamenti.innerHTML = '';
            
            if (snapshot.empty) {
                storicoPagamenti.innerHTML = `
                    <tr>
                        <td colspan="5" class="nessun-risultato">
                            Nessun pagamento trovato
                        </td>
                    </tr>`;
                return;
            }
            
            snapshot.forEach(doc => {
                const pagamento = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${pagamento.data ? new Date(pagamento.data).toLocaleDateString('it-IT') : 'N/D'}</td>
                    <td>${pagamento.importo ? '€' + pagamento.importo.toFixed(2) : 'N/D'}</td>
                    <td>${pagamento.metodo || 'N/D'}</td>
                    <td>${pagamento.fattura ? `<a href="${pagamento.fattura}" target="_blank">Visualizza</a>` : 'N/D'}</td>
                    <td><span class="status-badge ${pagamento.stato || 'pending'}">${pagamento.stato || 'N/D'}</span></td>
                `;
                storicoPagamenti.appendChild(row);
            });
            
        } catch (error) {
            console.error("Errore caricamento pagamenti:", error);
            document.getElementById('storicoPagamenti').innerHTML = `
                <tr>
                    <td colspan="5" class="errore-caricamento">
                        Errore nel caricamento dei pagamenti
                    </td>
                </tr>`;
        }
    }

    // Carica i documenti
    async function caricaDocumenti() {
        try {
            const snapshot = await db.collection("documenti")
                .where("tesseratoId", "==", tesseratoId)
                .orderBy("dataUpload", "desc")
                .get();
                
            const documentiContainer = document.getElementById('documentiTesserato');
            documentiContainer.innerHTML = '';
            
            if (snapshot.empty) {
                documentiContainer.innerHTML = `
                    <div class="nessun-documento">
                        Nessun documento caricato
                    </div>`;
                return;
            }
            
            snapshot.forEach(doc => {
                const documento = doc.data();
                const docElement = document.createElement('div');
                docElement.className = 'documento-card';
                docElement.innerHTML = `
                    <div class="documento-icon">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="documento-info">
                        <h3>${documento.nome || 'Documento'}</h3>
                        <p>Caricato il: ${documento.dataUpload ? new Date(documento.dataUpload).toLocaleDateString('it-IT') : 'N/D'}</p>
                        <a href="${documento.url}" target="_blank" class="btn btn-small">
                            <i class="fas fa-download"></i> Scarica
                        </a>
                    </div>
                `;
                documentiContainer.appendChild(docElement);
            });
            
        } catch (error) {
            console.error("Errore caricamento documenti:", error);
            document.getElementById('documentiTesserato').innerHTML = `
                <div class="errore-caricamento">
                    Errore nel caricamento dei documenti
                </div>`;
        }
    }

    // Funzioni helper
    function getCorsoName(tipo) {
        const names = {
            'avviamento': 'Avviamento',
            'principianti': 'Principianti',
            'intermedio': 'Intermedio',
            'perfezionamento': 'Perfezionamento',
            'cuffiegb': 'Cuffie Giallo Blu',
            'calottegb': 'Calottine Giallo Blu',
            'propaganda': 'Propaganda',
            'agonisti': 'Agonisti',
            'pallanuoto': 'Pallanuoto'
        };
        return names[tipo] || tipo;
    }

    function formatGiorni(giorni) {
        const giorniMap = {
            'lun': 'Lunedì',
            'mar': 'Martedì',
            'mer': 'Mercoledì',
            'gio': 'Giovedì',
            'ven': 'Venerdì'
        };
        return giorni ? giorni.map(g => giorniMap[g] || g).join(', ') : 'N/D';
    }

    // Funzione per modificare il tesserato
    window.modificaTesserato = function() {
        window.location.href = `inserimento.html?id=${tesseratoId}`;
    };

    // Inizializzazione
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    caricaTesserato();
});