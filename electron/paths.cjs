// Lokasi berkas aplikasi yang dibaca dari LUAR Electron (server MCP dijalankan node milik Claude, folder skill dan
// template Remotion disalin ke folder pengguna). Di installer, kode aplikasi dikemas di app.asar; folder-folder ini
// dikeluarkan ke app.asar.unpacked (lihat "asarUnpack" di package.json) dan harus dirujuk lewat path itu.
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
/** Akar berkas yang tidak dikemas: .../resources/app.asar.unpacked (installer) atau folder repo (dev). */
const UNPACKED_ROOT = ROOT.replace(/([\\/])app\.asar$/, '$1app.asar.unpacked');

/** Path ke berkas/folder aplikasi yang dipakai proses lain (mcp/, shared/, remotion-template/, *-skill/). */
const appFile = (...parts) => path.join(UNPACKED_ROOT, ...parts);

module.exports = { appFile, UNPACKED_ROOT };
