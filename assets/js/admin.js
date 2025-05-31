document.addEventListener('DOMContentLoaded', () => {
    const ADMIN_PASSWORD = "AdminMaster!2023"; // Sostituisci con la tua password admin
    
    document.getElementById('showPasswordsBtn').addEventListener('click', () => {
        const inputPassword = document.getElementById('adminPassword').value;
        
        if(inputPassword === ADMIN_PASSWORD) {
            const accounts = JSON.parse(localStorage.getItem('rnSecretaryAccounts')) || {};
            const tableBody = document.getElementById('passwordsList');
            tableBody.innerHTML = '';
            
            for(const [username, data] of Object.entries(accounts)) {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${username}</td>
                    <td>${data.name}</td>
                    <td>${data.password}</td>
                    <td>${data.permissions.join(', ')}</td>
                `;
                
                tableBody.appendChild(row);
            }
            
            document.getElementById('passwordTableContainer').style.display = 'block';
        } else {
            alert('Password admin errata!');
        }
    });
});