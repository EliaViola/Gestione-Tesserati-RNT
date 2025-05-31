document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('tesseratoForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const tesserato = {
      nome: formData.get('nome'),
      cognome: formData.get('cognome'),
      dataNascita: formData.get('data_nascita'),
      luogoNascita: formData.get('luogo_nascita'),
      codiceFiscale: formData.get('codice_fiscale'),
      genere: formData.get('genere'),
      indirizzo: formData.get('indirizzo'),
      cap: formData.get('cap'),
      citta: formData.get('citta'),
      provincia: formData.get('provincia'),
      telefono: formData.get('telefono'),
      email: formData.get('email'),
      tessera: formData.get('tessera'),
      dataInserimento: new Date().toISOString()
    };

    try {
      await db.collection("tesserati").add(tesserato);
      alert("Tesserato salvato con successo!");
      form.reset();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      alert("Errore durante il salvataggio.");
    }
  });
});
