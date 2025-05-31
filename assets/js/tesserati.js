/**
 * Gestione tesserati con backend JSON
 */

const API_URL = '/api/tesserati';

class TesseratiManager {
    constructor() {
        this.tesserati = [];
        this.loadTesserati();
    }

    // Carica i tesserati dal backend
    async loadTesserati() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Errore nel caricamento tesserati');
            this.tesserati = await response.json();
            return this.tesserati;
        } catch (error) {
            console.error('Errore:', error);
            this.showError('Errore nel caricamento dei tesserati');
            return [];
        }
    }

    // Aggiunge un nuovo tesserato
    async addTesserato(tesserato) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(tesserato)
            });

            if (!response.ok) throw new Error('Errore nel salvataggio');

            const newTesserato = await response.json();
            this.tesserati.push(newTesserato);
            this.showSuccess('Tesserato aggiunto con successo!');
            return newTesserato;
        } catch (error) {
            console.error('Errore:', error);
            this.showError('Errore nel salvataggio del tesserato');
            return null;
        }
    }

    // Modifica un tesserato esistente
    async updateTesserato(id, updatedData) {
        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) throw new Error('Errore nell\'aggiornamento');

            const updatedTesserato = await response.json();
            const index = this.tesserati.findIndex(t => t.id === id);
            if (index !== -1) {
                this.tesserati[index] = updatedTesserato;
            }
            this.showSuccess('Tesserato aggiornato con successo!');
            return updatedTesserato;
        } catch (error) {
            console.error('Errore:', error);
            this.showError('Errore nell\'aggiornamento del tesserato');
            return null;
        }
    }

    // Elimina un tesserato
    async deleteTesserato(id) {
        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Errore nell\'eliminazione');

            this.tesserati = this.tesserati.filter(t => t.id !== id);
            this.showSuccess('Tesserato eliminato con successo!');
            return true;
        } catch (error) {
            console.error('Errore:', error);
            this.showError('Errore nell\'eliminazione del tesserato');
            return false;
        }
    }

    // Cerca tesserati
    async searchTesserati(query) {
        try {
            const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Errore nella ricerca');
            return await response.json();
        } catch (error) {
            console.error('Errore:', error);
            this.showError('Errore nella ricerca dei tesserati');
            return [];
        }
    }

    // Mostra messaggio di successo
    showSuccess(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success';
        alertDiv.textContent = message;
        document.body.prepend(alertDiv);
        setTimeout(() => alertDiv.remove(), 5000);
    }

    // Mostra messaggio di errore
    showError(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-error';
        alertDiv.textContent = message;
        document.body.prepend(alertDiv);
        setTimeout(() => alertDiv.remove(), 5000);
    }
}

// Esempio di utilizzo:
document.addEventListener('DOMContentLoaded', () => {
    const tesseratiManager = new TesseratiManager();
    
    // Form di inserimento
    const form = document.getElementById('tesseratoForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const tesserato = {
                nome: formData.get('nome'),
                cognome: formData.get('cognome'),
                dataNascita: formData.get('dataNascita'),
                codiceFiscale: formData.get('codiceFiscale'),
                indirizzo: formData.get('indirizzo'),
                telefono: formData.get('telefono'),
                email: formData.get('email'),
                dataTesseramento: new Date().toISOString().split('T')[0],
                stato: 'attivo'
            };

            await tesseratiManager.addTesserato(tesserato);
            form.reset();
        });
    }
});