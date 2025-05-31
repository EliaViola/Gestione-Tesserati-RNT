const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'tesserati.json');

app.use(bodyParser.json());
app.use(express.static('../assets/public')); // Cartella per i file statici

// Helper per leggere/scrivere il file JSON
async function readTesserati() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Se il file non esiste, crea un array vuoto
            await fs.writeFile(DATA_FILE, '[]');
            return [];
        }
        throw error;
    }
}

// API Endpoints
app.get('/api/tesserati', async (req, res) => {
    try {
        const tesserati = await readTesserati();
        res.json(tesserati);
    } catch (error) {
        res.status(500).json({ error: 'Errore nel server' });
    }
});

app.post('/api/tesserati', async (req, res) => {
    try {
        const tesserati = await readTesserati();
        const newTesserato = {
            id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        tesserati.push(newTesserato);
        await fs.writeFile(DATA_FILE, JSON.stringify(tesserati, null, 2));
        res.status(201).json(newTesserato);
    } catch (error) {
        res.status(500).json({ error: 'Errore nel salvataggio' });
    }
});

app.put('/api/tesserati/:id', async (req, res) => {
    try {
        const tesserati = await readTesserati();
        const index = tesserati.findIndex(t => t.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Tesserato non trovato' });
        }

        const updatedTesserato = {
            ...tesserati[index],
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        tesserati[index] = updatedTesserato;
        await fs.writeFile(DATA_FILE, JSON.stringify(tesserati, null, 2));
        res.json(updatedTesserato);
    } catch (error) {
        res.status(500).json({ error: 'Errore nell\'aggiornamento' });
    }
});

app.delete('/api/tesserati/:id', async (req, res) => {
    try {
        let tesserati = await readTesserati();
        tesserati = tesserati.filter(t => t.id !== req.params.id);
        await fs.writeFile(DATA_FILE, JSON.stringify(tesserati, null, 2));
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: 'Errore nell\'eliminazione' });
    }
});

app.get('/api/tesserati/search', async (req, res) => {
    try {
        const query = req.query.q.toLowerCase();
        const tesserati = await readTesserati();
        const results = tesserati.filter(t => 
            t.nome.toLowerCase().includes(query) || 
            t.cognome.toLowerCase().includes(query) ||
            t.codiceFiscale.toLowerCase().includes(query)
        );
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Errore nella ricerca' });
    }
});

app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});