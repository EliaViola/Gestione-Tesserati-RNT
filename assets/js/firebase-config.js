// firebase-config.js (versione corretta)
const firebaseConfig = {
  apiKey: "AIzaSyBVcNJhXiytEKBtC09T3kbykVzAY0AHZmM",
  authDomain: "rari-nantes-tesserati.firebaseapp.com",
  projectId: "rari-nantes-tesserati",
  storageBucket: "rari-nantes-tesserati.appspot.com",
  messagingSenderId: "435337228811",
  appId: "1:435337228811:web:a5f1fd0fb9e17bfbc00d0e",
  measurementId: "G-558LQEWD8Z"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);

// Rendi disponibili le variabili globalmente (senza export)
const db = firebase.firestore();
const auth = firebase.auth();
