// firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyBVcNJhXiytEKBtC09T3kbykVzAY0AHZmM",
  authDomain: "rari-nantes-tesserati.firebaseapp.com",
  projectId: "rari-nantes-tesserati",
  storageBucket: "rari-nantes-tesserati.appspot.com",
  messagingSenderId: "435337228811",
  appId: "1:435337228811:web:a5f1fd0fb9e17bfbc00d0e"
};

// Inizializza Firebase solo se non è già stata inizializzata
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);

  // ✅ Attiva la persistenza offline PRIMA di qualsiasi uso di Firestore
  firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("⚠️ Persistence non attivata: più schede aperte.");
    } else if (err.code === 'unimplemented') {
      console.warn("⚠️ Persistence non supportata dal browser.");
    } else {
      console.warn("⚠️ Persistence non attivata:", err.message);
    }
  });
}
