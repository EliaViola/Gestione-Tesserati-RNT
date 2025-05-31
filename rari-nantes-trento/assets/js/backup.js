/**
 * Funzioni per il backup e ripristino dei dati
 */

// Genera un backup di tutti i dati
function generaBackup() {
    const backupData = {
        tesserati: JSON.parse(localStorage.getItem('tesserati') )|| [],
        corsi: JSON.parse(localStorage.getItem('corsi') )|| [],
        pagamenti: JSON.parse(localStorage.getItem('pagamenti') )|| [],
        utenti: JSON.parse(localStorage.getItem('utenti') || '[]'),
        timestamp: new Date().toISOString(),
        versione: '1.0'
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportName = `backup_rari_nantes_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
}

// Ripristina dati da file
function ripristinaBackup(file, callback) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            // Validazione minima del file di backup
            if (!backupData.tesserati || !backupData.corsi || !backupData.pagamenti) {
                throw new Error("Formato file di backup non valido");
            }
            
            // Salva i dati nel localStorage
            localStorage.setItem('tesserati', JSON.stringify(backupData.tesserati));
            localStorage.setItem('corsi', JSON.stringify(backupData.corsi));
            localStorage.setItem('pagamenti', JSON.stringify(backupData.pagamenti));
            
            if (backupData.utenti) {
                localStorage.setItem('utenti', JSON.stringify(backupData.utenti));
            }
            
            if (typeof callback === 'function') {
                callback(null, "Backup ripristinato con successo!");
            }
        } catch (err) {
            console.error("Errore nel ripristino:", err);
            if (typeof callback === 'function') {
                callback(err, null);
            }
        }
    };
    reader.readAsText(file);
}

// Aggiunge pulsanti backup/ripristino all'interfaccia
function aggiungiPulsantiBackup() {
    // Crea il pulsante di backup
    const backupBtn = document.createElement('button');
    backupBtn.className = 'btn btn-secondary';
    backupBtn.innerHTML = '<i class="fas fa-download"></i> Backup Dati';
    backupBtn.onclick = generaBackup;
    
    // Crea il pulsante di ripristino
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn btn-secondary';
    restoreBtn.innerHTML = '<i class="fas fa-upload"></i> Ripristina Backup';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.onchange = (e) => {
        if (confirm("ATTENZIONE: Tutti i dati attuali verranno sovrascritti. Continuare?")) {
            ripristinaBackup(e.target.files[0], (err, success) => {
                if (err) {
                    alert("Errore nel ripristino: " + err.message);
                } else {
                    alert(success);
                    window.location.reload(); // Ricarica la pagina per aggiornare i dati
                }
            });
        }
    };
    
    restoreBtn.onclick = () => fileInput.click();
    
    // Aggiungi i pulsanti al footer
    const footer = document.querySelector('footer');
    if (footer) {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'backup-buttons';
        btnContainer.style.marginTop = '1rem';
        btnContainer.style.textAlign = 'center';
        
        btnContainer.appendChild(backupBtn);
        btnContainer.appendChild(document.createTextNode(' '));
        btnContainer.appendChild(restoreBtn);
        btnContainer.appendChild(fileInput);
        
        footer.insertBefore(btnContainer, footer.firstChild);
    }
}

// Inizializza i pulsanti quando la pagina è pronta
document.addEventListener('DOMContentLoaded', aggiungiPulsantiBackup);