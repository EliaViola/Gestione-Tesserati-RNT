// assets/js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyBVcNJhXiytEKBtC09T3kbykVzAY0AHZmM",
  authDomain: "rari-nantes-tesserati.firebaseapp.com",
  projectId: "rari-nantes-tesserati",
  storageBucket: "rari-nantes-tesserati.appspot.com",
  messagingSenderId: "435337228811",
  appId: "1:435337228811:web:a5f1fd0fb9e17bfbc00d0e",
  measurementId: "G-558LQEWD8Z"
};

// Initialize Firebase
const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Export per utilizzo in altri file se necessario

