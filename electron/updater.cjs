// Update otomatis lewat GitHub Releases (build.publish di package.json).
// Teman cukup buka aplikasi: update dicek, diunduh di latar belakang, lalu muncul tombol "Restart & update".
const { app } = require('electron');

function register({ ipcMain, getWin, version, beforeInstall }) {
  let updateState = { state: 'idle' };
  const sendUpdate = (next) => {
    updateState = { ...updateState, ...next };
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send('update:event', updateState);
  };

  function setupAutoUpdate() {
    if (!app.isPackaged) {
      updateState = { state: 'dev', message: 'Update otomatis hanya aktif di versi yang di-install.' };
      return;
    }
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    // Installer belum bertanda tangan kode: update hanya dipasang setelah pengguna menyetujuinya di dialog
    // (melihat versi + catatan update), tidak diam-diam saat aplikasi ditutup.
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking', error: null }));
    // Catatan rilis dari GitHub (bisa HTML atau daftar per versi) -> teks biasa untuk dialog "Yang baru".
    const plainNotes = (n) => {
      const raw = Array.isArray(n) ? n.map((x) => x.note || '').join('\n') : String(n || '');
      return raw
        .replace(/<\/(li|p|h\d)>|<br\s*\/?>/gi, '\n')
        .replace(/<li>/gi, '- ')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\*\*/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };
    autoUpdater.on('update-available', (i) =>
      sendUpdate({ state: 'downloading', version: i.version, percent: 0, notes: plainNotes(i.releaseNotes) }),
    );
    autoUpdater.on('update-not-available', () => sendUpdate({ state: 'latest', checkedAt: new Date().toISOString() }));
    autoUpdater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (i) =>
      sendUpdate({ state: 'ready', version: i.version, percent: 100, notes: plainNotes(i.releaseNotes) || updateState.notes }),
    );
    autoUpdater.on('error', (err) => {
      const msg = String(err?.message || err);
      // Belum ada release di GitHub = belum ada update, bukan error yang perlu ditampilkan.
      if (/404|Unable to find latest version|No published versions/i.test(msg)) {
        sendUpdate({ state: 'latest', checkedAt: new Date().toISOString() });
      } else if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|net::ERR_/i.test(msg)) {
        sendUpdate({ state: 'error', error: 'Tidak ada koneksi internet.' });
      } else {
        sendUpdate({ state: 'error', error: msg.split('\n')[0].slice(0, 160) });
      }
    });

    const check = () => autoUpdater.checkForUpdates().catch(() => {});
    setTimeout(check, 8000);
    setInterval(check, 4 * 60 * 60 * 1000);

    ipcMain.handle('update:check', () => {
      check();
      return updateState;
    });
    ipcMain.handle('update:install', () => {
      beforeInstall();
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
    });
  }

  ipcMain.handle('update:state', () => ({ ...updateState, current: version }));
  if (!app.isPackaged) {
    ipcMain.handle('update:check', () => updateState);
    ipcMain.handle('update:install', () => {});
  }
  return { start: setupAutoUpdate };
}

module.exports = { register };
