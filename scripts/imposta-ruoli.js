const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const utenti = [
  { uid: "E6PkV0mgelNxGlQ6HuDiMtqMQ", email: "segreteria1@gmail.com", claims: { secretary: true } },
  { uid: "5YBcsDyapaZUZ3r1jyLovdvBcZY2", email: "segreteria2@gmail.com", claims: { secretary: true } },
  { uid: "3kXGr6Afg5PCbgAAYJEkpBnToYN2", email: "segreteria3@gmail.com", claims: { secretary: true } },
  { uid: "Fc1my55Q1EaNexZEyXOyM8WRFhl2", email: "admin@gmail.com", claims: { admin: true } },
  { uid: "nw8uDBzYSccpPMOEz35PirMuhQO2", email: "direttore@gmail.com", claims: { director: true } },
  { uid: "gNzIBuP8tlgSS1RdMvYu2CoY3lW2", email: "coordinatore@gmail.com", claims: { coordinator: true } }
];

(async () => {
  for (const utente of utenti) {
    try {
      await admin.auth().setCustomUserClaims(utente.uid, utente.claims);
      console.log(`✅ Ruolo impostato per ${utente.email}:`, utente.claims);
    } catch (error) {
      console.error(`❌ Errore con ${utente.email}:`, error.message);
    }
  }

  process.exit();
})();
