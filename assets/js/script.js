document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('secretarySetup')) {
        const secretaryAccounts = {
            "segreteria1": {
                password: "Segretaria1!2023",
                name: "Segreteria 1",
                permissions: ["insert", "view", "edit"]
            },
            "segreteria2": {
                password: "Segretaria2!2023",
                name: "Segreteria 2",
                permissions: ["insert", "view", "edit"]
            },
            "coordinatore": {
                password: "Coordinatore!2023",
                name: "Coordinatore",
                permissions: ["view", "edit", "approve", "reports"]
            },
            "direttore": {
                password: "Direttore!2023",
                name: "Direttore",
                permissions: ["view", "reports", "finance", "admin"]
            },
            "admin": {
                password: "AdminMaster!2023",
                name: "Amministratore",
                permissions: ["full"] // Accesso completo
            }
        };
        localStorage.setItem('secretaryAccounts', JSON.stringify(secretaryAccounts));
        localStorage.setItem('secretarySetup', 'true');
    }

    document.getElementById("secretaryLoginForm").addEventListener("submit", function(e) {
        e.preventDefault();
        
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const accounts = JSON.parse(localStorage.getItem('secretaryAccounts')) || {};
        
        if (accounts[username] && accounts[username].password === password) {
            // Salva i dati della sessione
            sessionStorage.setItem('secretaryAuth', JSON.stringify({
                username: username,
                name: accounts[username].name,
                permissions: accounts[username].permissions,
                lastLogin: new Date().toISOString()
            }));
            
            // Reindirizzamento in base al ruolo
            switch(username) {
                case "segreteria1":
                case "segreteria2":
                    window.location.href = 'admin/inserimento-dati-tesserati.html';
                    break;
                case "coordinatore":
                    window.location.href = 'admin/gestione-squadre.html';
                    break;
                case "direttore":
                    window.location.href = 'admin/report-finanziari.html';
                    break;
                case "admin":
                    window.location.href = 'admin/dashboard-completa.html';
                    break;
                default:
                    window.location.href = 'admin/dashboard.html';
            }
        } else {
            const errorElement = document.getElementById("errorMessage");
            errorElement.style.display = "block";
            errorElement.textContent = "Credenziali non valide. Controlla username e password.";
            
            errorElement.style.animation = "shake 0.5s";
            setTimeout(() => {
                errorElement.style.animation = "";
            }, 500);
        }
    });

    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('focus', () => {
            document.getElementById("errorMessage").style.display = "none";
        });
    });
});