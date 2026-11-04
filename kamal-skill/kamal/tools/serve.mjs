#!/usr/bin/env node
// Pratinjau: node tools/serve.mjs [port]  -> buka http://127.0.0.1:<port>/<proyek>/index.html (autoplay + loop, ?t=3.5 membekukan)
import { serve, WORK } from './_lib.mjs';

const port = Number(process.argv[2]) || 5190;
const s = await serve(port);
console.log(`HyperForge Studio: ${s.url}/  (folder kerja ${WORK}). Ctrl+C untuk berhenti.`);
