// Pembersih dan pemeriksa SVG buatan Claude (karakter + latar). SVG ini nanti dirender di Chrome
// (Remotion) dan ditampilkan di aplikasi, jadi semua yang bisa menjalankan kode atau memuat file luar dibuang.

// arm-l / arm-r wajib sejak 0.8.0 supaya pose (menunjuk, melambai, angkat bahu...) bisa dipakai.
const REQUIRED_PARTS = ['head', 'eyes-open', 'eyes-closed', 'mouth-closed', 'mouth-open', 'arm-l', 'arm-r'];

/** Ambil blok <svg>...</svg> pertama dari jawaban teks Claude. */
function extractSvg(text) {
  const m = String(text || '').match(/<svg\b[\s\S]*<\/svg>/i);
  return m ? m[0] : null;
}

function sanitizeSvg(svg) {
  return String(svg)
    .replace(/<\?xml[^>]*>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|foreignObject|iframe|object|embed|style)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|foreignObject|iframe|object|embed|image|use)\b[^>]*\/?>/gi, (m) => (/^<use\b/i.test(m) && /href="#[^"]+"/.test(m) ? m : ''))
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')(?!#)[^"']*\2/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/url\((?!\s*#)[^)]*\)/gi, 'none')
    .trim();
}

/** Daftar masalah rig karakter (kosong = lolos). */
function checkCharacterSvg(svg) {
  const problems = [];
  if (!/^<svg\b/i.test(svg)) problems.push('Bukan SVG.');
  if (!/viewBox="0 0 600 1200"/.test(svg)) problems.push('viewBox harus "0 0 600 1200".');
  for (const p of REQUIRED_PARTS) if (!new RegExp(`data-part="${p}"`).test(svg)) problems.push(`Bagian data-part="${p}" belum ada.`);
  if (svg.length > 120_000) problems.push(`SVG terlalu besar (${Math.round(svg.length / 1024)} KB, maks 120 KB).`);
  return problems;
}

function checkBackgroundSvg(svg) {
  const problems = [];
  if (!/^<svg\b/i.test(svg)) problems.push('Bukan SVG.');
  if (!/viewBox="0 0 (1080 1920|1920 1080)"/.test(svg)) problems.push('viewBox harus "0 0 1080 1920" (9:16) atau "0 0 1920 1080" (16:9).');
  if (svg.length > 200_000) problems.push(`SVG terlalu besar (${Math.round(svg.length / 1024)} KB, maks 200 KB).`);
  return problems;
}

/** Benda cerita (kereta, peta, ayam...): viewBox bebas, latar transparan. */
function checkPropSvg(svg) {
  const problems = [];
  if (!/^<svg\b/i.test(svg)) problems.push('Bukan SVG.');
  const m = svg.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  if (!m) problems.push('Wajib ada viewBox, mis. "0 0 800 600".');
  else if (Number(m[1]) / Number(m[2]) > 8 || Number(m[2]) / Number(m[1]) > 8) problems.push('Perbandingan lebar/tinggi viewBox terlalu ekstrem.');
  if (svg.length > 120_000) problems.push(`SVG terlalu besar (${Math.round(svg.length / 1024)} KB, maks 120 KB).`);
  return problems;
}

module.exports = { extractSvg, sanitizeSvg, checkCharacterSvg, checkBackgroundSvg, checkPropSvg, REQUIRED_PARTS };
