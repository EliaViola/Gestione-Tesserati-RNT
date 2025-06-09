document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('secretaryLoginForm');
  const errorMessage = document.getElementById('errorMessage');
  const loginButton = document.getElementById('loginButton');
  const spinner = document.getElementById('spinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showError('Inserisci email e password.');
      return;
    }

    try {
      toggleLoading(true);

      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      const idToken = await user.getIdTokenResult();

      if (idToken.claims.secretary) {
        window.location.href = 'pages/inserimento.html';
      } else {
        await firebase.auth().signOut();
        showError('Accesso non autorizzato: ruolo mancante.');
      }
    } catch (error) {
      console.error(error);
      showError('Credenziali non valide o errore di rete.');
    } finally {
      toggleLoading(false);
    }
  });

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
      errorMessage.classList.add('hidden');
    }, 5000);
  }

  function toggleLoading(isLoading) {
    loginButton.disabled = isLoading;
    spinner.classList.toggle('hidden', !isLoading);
  }
});
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.setSecretaryRole = functions.https.onCall(async (data, context) => {
  // Solo admin può assegnare ruoli
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo gli admin possono assegnare ruoli'
    );
  }

  const email = data.email;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email mancante');
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { secretary: true });
    return { message: `Ruolo "secretary" assegnato a ${email}` };
  } catch (error) {
    throw new functions.https.HttpsError('unknown', error.message, error);
  }
});
