// backup.js - Sistema Completo
class BackupSystem {
  constructor() {
    this.version = "1.0";
    this.initUI();
  }

  initUI() {
    const style = document.createElement('style');
    style.textContent = `
      #backup-float-btn {
        position: fixed;
        bottom: 25px;
        right: 25px;
        z-index: 1000;
        background: #4169E1;
        color: white;
        border: none;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        cursor: pointer;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #backup-float-btn:hover {
        transform: scale(1.1);
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'backup-float-btn';
    btn.innerHTML = '💾';
    btn.title = 'Backup/Ripristino';
    btn.addEventListener('click', () => this.showMenu());
    document.body.appendChild(btn);
  }

  showMenu() {
    const menu = `
      <div style="position:fixed; bottom:90px; right:25px; background:white; padding:15px; border-radius:10px; box-shadow:0 0 15px rgba(0,0,0,0.1); z-index:1000;">
        <button onclick="backupSystem.exportData()" style="display:block; width:100%; margin:5px 0; padding:8px 12px;">Esporta Backup</button>
        <button onclick="backupSystem.importData()" style="display:block; width:100%; margin:5px 0; padding:8px 12px;">Importa Backup</button>
        <input type="file" id="backup-file-input" accept=".json" style="display:none;">
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', menu);
  }

  exportData() {
    const data = {
      meta: {
        app: "Rari Nantes Trento",
        version: this.version,
        date: new Date().toISOString()
      },
      tesserati: JSON.parse(localStorage.getItem('tesserati') || '[]'),
      corsi: JSON.parse(localStorage.getItem('corsi') || '[]'),
      pagamenti: JSON.parse(localStorage.getItem('pagamenti') || '[]')
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_rari_nantes_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  importData() {
    const input = document.getElementById('backup-file-input');
    input.value = '';
    input.click();
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (confirm(`Importare ${data.tesserati.length} tesserati, ${data.corsi.length} corsi e ${data.pagamenti.length} pagamenti?`)) {
            localStorage.setItem('tesserati', JSON.stringify(data.tesserati));
            localStorage.setItem('corsi', JSON.stringify(data.corsi));
            localStorage.setItem('pagamenti', JSON.stringify(data.pagamenti));
            alert('Ripristino completato! La pagina verrà ricaricata.');
            setTimeout(() => location.reload(), 1000);
          }
        } catch (error) {
          alert('Errore: File di backup non valido!');
          console.error(error);
        }
      };
      reader.readAsText(file);
    };
  }
}

// Avvia il sistema
const backupSystem = new BackupSystem();