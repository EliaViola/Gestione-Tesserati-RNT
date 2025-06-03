document.addEventListener('DOMContentLoaded', () => {
  const session = AuthSystem.getSession();

  if (!session || session.role !== 'admin') {
    alert("Accesso non autorizzato. Solo gli amministratori possono accedere a questa pagina.");
    window.location.href = '../index.html';
    return;
  }

  const profileBox = document.createElement('div');
  profileBox.classList.add('profile-box');
  profileBox.innerHTML = `
    <p>Benvenuto, <strong>${session.name}</strong> (${session.role})</p>
    <p>Ultimo accesso: ${new Date(session.lastLogin).toLocaleString('it-IT')}</p>
  `;
  document.getElementById('userProfile').appendChild(profileBox);

  document.getElementById('logoutButton').addEventListener('click', () => {
    AuthSystem.logout();
    window.location.href = '../index.html';
  });

  const searchInput = document.getElementById('searchInput');
  const tableBody = document.getElementById('usersTableBody');

  const renderAccounts = (filter = '') => {
    const accounts = AuthSystem.getAllAccounts('AdminMaster!2023');
    tableBody.innerHTML = '';

    Object.entries(accounts).forEach(([username, acc]) => {
      if (filter && !username.toLowerCase().includes(filter.toLowerCase())) return;

      const lastLogin = acc.lastLogin ? new Date(acc.lastLogin).toLocaleString('it-IT') : '-';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${username}</td>
        <td>${acc.name}</td>
        <td>${acc.role}</td>
        <td>${lastLogin}</td>
        <td>
          <button class="btn-sm" onclick="alert('Funzione cambio password in sviluppo')">Modifica</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  };

  searchInput.addEventListener('input', () => {
    renderAccounts(searchInput.value.trim());
  });

  renderAccounts();
});
