// Anno corrente nel footer
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Gestione errori globale
window.handleError = (message) => {
    const errorEl = document.getElementById('loginError');
    if (!errorEl) return;
    
    errorEl.textContent = message;
    errorEl.hidden = false;
    errorEl.focus();
};