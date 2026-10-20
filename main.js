const { app, BrowserWindow } = require('electron');
const path = require('path');
function abrir() {
  const win = new BrowserWindow({ width: 1280, height: 800, backgroundColor: '#0a0a0a', autoHideMenuBar: true, title: 'Painel da Loja' });
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
}
app.whenReady().then(abrir);
app.on('window-all-closed', () => app.quit());
