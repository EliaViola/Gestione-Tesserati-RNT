const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const utenti = [
  {
    email: "segreteria1@gmail.com",
    uid: "E6PkV0mgelNxGlQ6HuDiMtqMQ",
    claims: { secretary: true },
  },
  {
    email: "segreteria2@gmail.com",
    uid: "5YBcsDyapaZUZ3r1jyLovdvBcZY2",
    claims: { secretary: true },
  },
  {
    email: "segreteria3@gmail.com",
    uid: "3kXGr6Afg5PCbgAAYJEkpBnToYN2",
    claims: { secretary: true },
  },
  {
    email: "admin@gmail.com",
    uid: "Fc1my55Q1EaNexZEyXOyM8WRFhl2",
    claims: { admin: true },
  },
  {
    email: "direttore@gmail.com",
    uid: "nw8uDBzYSccpPMOEz35PirMuhQO2",
    claims: { director: true },
  },
  {
    email: "coordinatore@gmail.com",
    uid: "gNzIBuP8tlgSS1RdMvYu2CoY3lW2",
    claims: { coordinator: true },
  },
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
