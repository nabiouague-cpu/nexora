// NEXORA — lecture automatique d'un courrier scanné, entièrement dans le navigateur.
// 1. PDF avec texte  → pdf.js extrait le texte.
// 2. Image ou PDF scanné → préparation de l'image (échelle, gris, contraste, redressement) puis OCR Tesseract (français).
// 3. Mémoire des expéditeurs + apprentissage des corrections + règles par type → champs du registre.

const MOIS_FR = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
const JOURS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (a, m, j) => `${a}-${pad(m)}-${pad(j)}`;
export const normaliser = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// ---------- Préparation de l'image (avant OCR) ----------
function preparerImage(source) {
  const LARGEUR_MIN = 2000;
  const echelle = Math.max(1, Math.min(3, LARGEUR_MIN / source.width));
  const c = document.createElement('canvas'); c.width = Math.round(source.width * echelle); c.height = Math.round(source.height * echelle);
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(source, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height); const d = img.data;
  // niveaux de gris + histogramme
  const gris = new Uint8ClampedArray(c.width * c.height); const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; gris[p] = g; hist[g]++; }
  // étirement de contraste (2 % – 98 %)
  const total = gris.length; let bas = 0, haut = 255, cum = 0;
  for (let i = 0; i < 256; i++) { cum += hist[i]; if (cum > total * 0.02) { bas = i; break; } } cum = 0;
  for (let i = 255; i >= 0; i--) { cum += hist[i]; if (cum > total * 0.02) { haut = i; break; } }
  const plage = Math.max(1, haut - bas);
  // seuil d'Otsu sur l'image étirée
  const h2 = new Uint32Array(256);
  for (let p = 0; p < total; p++) { const v = Math.max(0, Math.min(255, ((gris[p] - bas) * 255 / plage) | 0)); gris[p] = v; h2[v]++; }
  let somme = 0; for (let i = 0; i < 256; i++) somme += i * h2[i];
  let sB = 0, wB = 0, max = 0, seuil = 128;
  for (let i = 0; i < 256; i++) { wB += h2[i]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += i * h2[i]; const mB = sB / wB, mF = (somme - sB) / wF; const v = wB * wF * (mB - mF) * (mB - mF); if (v > max) { max = v; seuil = i; } }
  // binarisation douce : on garde un peu de nuance pour les traits fins
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { const v = gris[p] > seuil + 10 ? 255 : gris[p] < seuil - 10 ? 0 : gris[p]; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return redresser(c, gris, seuil);
}
// Redressement : on cherche l'angle (±4°) qui maximise le contraste des profils de lignes
function redresser(c, gris, seuil) {
  const w = c.width, h = c.height; const pas = 4; const lignes = [];
  for (let y = 0; y < h; y += pas) { let n = 0; for (let x = 0; x < w; x += pas) if (gris[y * w + x] < seuil) n++; lignes.push(n); }
  const score = (angle) => { const t = Math.tan(angle * Math.PI / 180); const prof = new Float32Array(Math.ceil(h / pas) + Math.ceil(w * Math.abs(t) / pas) + 2); for (let y = 0; y < h; y += pas) for (let x = 0; x < w; x += pas * 2) { if (gris[y * w + x] < seuil) { const yy = Math.round((y + x * t) / pas) + Math.ceil(w * Math.abs(t) / pas); if (yy >= 0 && yy < prof.length) prof[yy]++; } } let s = 0; for (let i = 1; i < prof.length; i++) s += (prof[i] - prof[i - 1]) ** 2; return s; };
  let meilleur = 0, maxS = -1;
  for (let a = -4; a <= 4; a += 0.5) { const s = score(a); if (s > maxS) { maxS = s; meilleur = a; } }
  if (Math.abs(meilleur) < 0.4) return c;
  const r = document.createElement('canvas'); r.width = w; r.height = h; const ctx = r.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2); ctx.rotate(-meilleur * Math.PI / 180); ctx.drawImage(c, -w / 2, -h / 2); return r;
}

// ---------- Extraction du texte ----------
async function ocrImage(source, progression) {
  const prep = preparerImage(source);
  const worker = await Tesseract.createWorker('fra', 1, { logger: (m) => { if (m.status === 'recognizing text') progression?.(`Reconnaissance du texte… ${Math.round(m.progress * 100)} %`); } });
  await worker.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' });
  const { data } = await worker.recognize(prep); await worker.terminate();
  return { texte: data.text || '', confiance: data.confidence || 0 };
}
async function texteDepuisPdf(fichier, progression) {
  const pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc = await pdfjs.getDocument({ data: await fichier.arrayBuffer() }).promise;
  const pages = Math.min(doc.numPages, 4); let texte = '';
  for (let i = 1; i <= pages; i++) { const p = await doc.getPage(i); const c = await p.getTextContent(); texte += lignesDepuisItems(c.items) + '\n'; }
  if (texte.replace(/\s/g, '').length > 80) return { texte, mode: 'pdf', pages: doc.numPages, confiance: 100 };
  let ocr = '', conf = 0;
  for (let i = 1; i <= pages; i++) {
    progression?.(`Préparation de la page ${i}/${pages}…`);
    const p = await doc.getPage(i); const vp = p.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
    await p.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const r = await ocrImage(canvas, progression); ocr += r.texte + '\n'; conf += r.confiance;
  }
  return { texte: ocr, mode: 'ocr', pages: doc.numPages, confiance: conf / pages };
}
function lignesDepuisItems(items) {
  const lignes = []; let y = null, cour = [];
  for (const it of items) { const ty = Math.round(it.transform[5]); if (y !== null && Math.abs(ty - y) > 3) { lignes.push(cour.join(' ')); cour = []; } y = ty; cour.push(it.str); }
  if (cour.length) lignes.push(cour.join(' '));
  return lignes.join('\n');
}

// ---------- Mémoire des expéditeurs ----------
function similarite(a, b) {
  const A = new Set(normaliser(a).split(' ').filter((m) => m.length > 2)), B = new Set(normaliser(b).split(' ').filter((m) => m.length > 2));
  if (!A.size || !B.size) return 0; let n = 0; A.forEach((m) => { if (B.has(m)) n++; else for (const x of B) if (x.length > 4 && (x.startsWith(m.slice(0, 5)) || m.startsWith(x.slice(0, 5)))) { n += 0.7; break; } });
  return n / Math.max(A.size, Math.min(B.size, 6));
}
function reconnaitreContact(enTete, contacts) {
  let meilleur = null, score = 0.55;
  for (const c of contacts || []) { for (const l of enTete) { const s = similarite(l, c.nom); if (s > score) { score = s; meilleur = c; } } const sTout = similarite(enTete.slice(0, 6).join(' '), c.nom); if (sTout > score) { score = sTout; meilleur = c; } }
  return meilleur ? { nom: meilleur.nom, score } : null;
}

// ---------- Reconnaissance des champs ----------
const nettoyer = (s) => s.replace(/[|_~¬]+/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
function trouverDates(texte) {
  const res = []; const t = texte.replace(/\s+/g, ' ');
  for (const m of t.matchAll(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g)) { let a = Number(m[3]); if (a < 100) a += 2000; const mo = Number(m[2]), j = Number(m[1]); if (mo >= 1 && mo <= 12 && j >= 1 && j <= 31 && a > 2000 && a < 2100) res.push({ iso: isoDate(a, mo, j), brut: m[0], pos: m.index, court: m[3].length === 2 }); }
  const reL = new RegExp(`\\b(?:(${JOURS_FR.join('|')})\\s+)?(\\d{1,2})(?:er)?\\s+(${Object.keys(MOIS_FR).join('|')})\\s+(\\d{4})(?:\\s*(?:à|a|dès|des)\\s*(\\d{1,2})\\s*(?:h|heures?|:)\\s*(\\d{2})?)?`, 'gi');
  for (const m of t.matchAll(reL)) { const mo = MOIS_FR[m[3].toLowerCase()]; const h = m[5] ? `${pad(m[5])}:${pad(m[6] || '00')}` : null; res.push({ iso: isoDate(Number(m[4]), mo, Number(m[2])), brut: m[0], pos: m.index, heure: h }); }
  return res.sort((a, b) => a.pos - b.pos);
}
const REGLES_TYPE = [
  ['Convocation', /convocation|convoqu|vous convier|invit(?:e|é)s? à (?:assister|participer)|sont priés d'assister|réunion/],
  ['Facture', /\bfacture\b|montant\s+(?:ttc|ht)|à payer|à régler|échéance de paiement|total à payer|avis d'échéance/],
  ['Note de service', /note de service|note circulaire|circulaire/],
  ['Invitation', /invitation|cérémonie|avoir l'honneur de vous inviter|vous inviter|cocktail|vernissage/],
  ['Rapport', /\brapport\b|compte[- ]rendu|procès[- ]verbal/],
  ['Contrat', /\bcontrat\b|convention|protocole d'accord|avenant/],
  ['Bordereau', /bordereau/],
  ['Colis', /\bcolis\b|livraison|bon de livraison/],
  ['Demande', /demande d|sollicit|prie de bien vouloir|vous saurais gré|requête|candidature|stage/],
  ['Réponse', /en réponse à|suite à votre (?:courrier|lettre|demande)|faisant suite/],
  ['Lettre', /./],
];
function devinerType(texte, types) {
  const t = texte.toLowerCase();
  for (const [nom, re] of REGLES_TYPE) if (re.test(t)) { const typ = types.find((x) => normaliser(x.nom) === normaliser(nom)); if (typ) return typ.nom; }
  return null;
}
function devinerAction(texte, type) {
  const t = texte.toLowerCase();
  if (type === 'Facture' || /facture|montant|règlement|à payer|à régler|paiement/.test(t)) return 'Procéder au paiement';
  if (type === 'Convocation' || /convocation|convoqu|vous convier|assister|participer|réunion/.test(t)) return 'Assister à la réunion';
  if (type === 'Invitation' || /invitation|cérémonie/.test(t)) return "Confirmer la participation à l'événement";
  if (/candidature|stage|recrutement/.test(t)) return 'Examiner la candidature';
  if (/réponse|répondre|confirmer|faire parvenir|transmettre|communiquer|nous faire tenir|pièces|justificatif/.test(t)) return 'Répondre / transmettre les éléments demandés';
  if (/pour information|à titre d'information|pour votre information/.test(t)) return 'Pour information';
  if (type === 'Note de service') return 'Diffuser au personnel concerné';
  return null;
}
function devinerUrgence(texte, echeance) {
  const t = texte.toLowerCase();
  if (/urgent|urgence|dans les plus brefs délais|sans délai|impérativement|au plus tard|dernier délai|mise en demeure/.test(t)) return 'eleve';
  if (echeance) { const d = (new Date(echeance) - new Date()) / 86400000; if (d >= 0 && d <= 5) return 'eleve'; }
  if (/pour information|à titre d'information/.test(t)) return 'information';
  return 'normal';
}
function devinerService(texte, services) {
  const t = normaliser(texte);
  const regles = [[/finan|comptab|facture|paiement|budget|credit|tresor|marche public/, ['SF', 'DAF', 'DFC']], [/ressources humaines|personnel|recrutement|affectation|conge|carriere|candidature/, ['RH', 'DRH']], [/formation|etudiant|eleve|concours|cycle|pedagog|cours|scolarite|stage/, ['DE', 'DEP', 'DF']], [/fourniture|materiel|entretien|logistique|vehicule|colis|livraison|maintenance/, ['MG', 'DMG', 'SMG']]];
  for (const [re, codes] of regles) if (re.test(t)) { const s = services.find((x) => codes.includes(x.code)); if (s) return s.nom; }
  // service nommé explicitement dans le texte
  for (const s of services) { if (s.nom.length > 8 && t.includes(normaliser(s.nom))) return s.nom; }
  const dg = services.find((x) => x.code === 'DG'); return dg ? dg.nom : null;
}
function extraireMontant(texte) {
  const m = texte.replace(/\s+/g, ' ').match(/(?:montant|total|net à payer|à payer|à régler)[^\d]{0,30}(\d{1,3}(?:[ .]\d{3})+|\d+)(?:[,.]\d{2})?\s*(f\s?cfa|fcfa|xof|€|eur|\$)/i) || texte.replace(/\s+/g, ' ').match(/(\d{1,3}(?:[ .]\d{3})+)\s*(f\s?cfa|fcfa|xof)/i);
  return m ? `${m[1].replace(/[ .]/g, ' ')} ${m[2].toUpperCase().replace(/\s/g, '')}` : null;
}

export async function lireCourrier(fichier, contexte, progression) {
  const { types = [], services = [], sens = 'arrivee', contacts = [], apprentissage = [] } = contexte;
  progression?.('Extraction du texte…');
  let brut;
  if (fichier.type === 'application/pdf') brut = await texteDepuisPdf(fichier, progression);
  else { progression?.('Préparation de l\'image…'); const img = await createImageBitmap(fichier); const r = await ocrImage(img, progression); brut = { ...r, mode: 'ocr', pages: 1 }; }
  const texte = nettoyer(brut.texte); const lignes = texte.split('\n').map((l) => l.trim()).filter((l) => l.length > 1);
  const champs = {}; const a_verifier = []; const indices = [];
  const fiable = brut.mode === 'pdf' || brut.confiance >= 85;

  // --- Expéditeur : mémoire des contacts d'abord, en-tête ensuite
  const enTete = lignes.slice(0, 14).filter((l) => !/republique|union\s*[-–]?\s*discipline|^\s*$/i.test(normaliser(l)));
  const connu = reconnaitreContact(enTete, contacts);
  if (connu) { champs.contact = connu.nom; indices.push('expéditeur reconnu dans vos contacts'); }
  else {
    const candidat = enTete.find((l) => /minist|direction|societe|cabinet|universit|ecole|institut|agence|banque|association|mairie|prefecture|ambassade|office|\bsa\b|sarl|\bong\b|groupe|compagnie|fondation|centre|conseil|chambre|federation|syndicat/i.test(normaliser(l)))
      || enTete.find((l) => l.length > 6 && l === l.toUpperCase() && /[A-ZÉÈ]{4,}/.test(l));
    if (candidat) { champs.contact = candidat.replace(/\s{2,}/g, ' ').replace(/[.,;:]+$/, '').trim(); if (!fiable) a_verifier.push('contact'); }
  }

  // --- Apprentissage : ce que la secrétaire a déjà associé à cet expéditeur
  const appris = champs.contact ? apprentissage.find((a) => a.cle === normaliser(champs.contact)) : null;

  // --- Référence
  const mRef = texte.match(/(?:n[°º]|réf(?:érence)?\.?\s*:?|ref\.?\s*:?|n\s*°)\s*:?\s*([A-Z0-9][A-Z0-9\/\-._ ]{2,40})/i);
  if (mRef) { champs.reference = mRef[0].replace(/\s+/g, ' ').trim().replace(/[.,;:]$/, ''); if (!fiable) a_verifier.push('ref'); }

  // --- Objet
  const mObj = texte.match(/objet\s*:?\s*([^\n]+(?:\n(?![A-ZÉ][a-zé]+\s*:)[^\n]{0,120})?)/i);
  if (mObj) champs.objet = mObj[1].replace(/\s+/g, ' ').trim().replace(/[.;]$/, '');
  else { const l = lignes.find((x) => /^(?:convocation|invitation|facture|demande|notification|rapport|note|avis|attestation|lettre)/i.test(x)); if (l) champs.objet = l; }
  if (champs.objet && !fiable) a_verifier.push('objet');

  // --- Dates
  const dates = trouverDates(texte);
  const posObjet = mObj ? texte.search(/objet\s*:/i) : Math.min(texte.length, 600);
  const dateCourrier = dates.find((d) => d.pos < posObjet) || (dates[0] && dates[0].pos < 800 ? dates[0] : null);
  if (dateCourrier) { champs.date_courrier = dateCourrier.iso; if (!fiable || dateCourrier.court) a_verifier.push('dcour'); }
  const corps = dates.filter((d) => d !== dateCourrier && d.pos >= posObjet);
  const evenements = [];
  for (const d of corps) {
    const autour = texte.slice(Math.max(0, d.pos - 180), d.pos + 80).replace(/\s+/g, ' ');
    const estReunion = /réunion|rencontre|séance|cérémonie|atelier|se tiendra|aura lieu|conseil|assemblée|session|entretien|audience|formation/i.test(autour);
    const estLimite = /avant le|au plus tard|date limite|délai|échéance|jusqu'au|confirmer|à régler|payable|dernier délai|clôture/i.test(autour);
    if (!estReunion && !estLimite) continue;
    const lieu = (autour.match(/(?:à|au|dans|en)\s+(?:la\s+|le\s+|l')?(salle[^,.]{0,40}|si[èe]ge[^,.]{0,40}|minist[èe]re[^,.]{0,40}|amphith[ée][âa]tre[^,.]{0,30}|plateau|cocody|yopougon|marcory|treichville|abidjan|[A-ZÉ][\wéèà' -]{3,30}(?=[,.]))/) || [])[1];
    const titre = estReunion ? (autour.match(/(réunion[^,.]{0,60}|cérémonie[^,.]{0,60}|atelier[^,.]{0,60}|séance[^,.]{0,60}|conseil[^,.]{0,60}|assemblée[^,.]{0,60}|session[^,.]{0,60}|formation[^,.]{0,60})/i) || [, 'Réunion'])[1].trim() : `Date limite · ${(champs.objet || 'réponse').slice(0, 60)}`;
    evenements.push({ titre: titre.charAt(0).toUpperCase() + titre.slice(1), type: estReunion ? 'reunion' : 'echeance', debut: `${d.iso}T${d.heure || (estReunion ? '09:00' : '08:00')}:00`, lieu: lieu ? lieu.trim() : null });
    if (estLimite && !champs.echeance) champs.echeance = d.iso;
  }
  if (!champs.echeance && evenements[0]) champs.echeance = evenements[0].debut.slice(0, 10);

  // --- Résumé
  const corpsTexte = texte.slice(posObjet + (champs.objet ? champs.objet.length + 8 : 0)).replace(/\s+/g, ' ');
  const phrases = corpsTexte.match(/[^.!?]{25,220}[.!?]/g) || [];
  const utiles = phrases.filter((p) => !/^\s*(monsieur|madame|veuillez agréer|je vous prie|nous vous prions)/i.test(p) && !/considération distinguée|salutations|haute considération/i.test(p)).slice(0, 3);
  if (utiles.length) champs.resume = utiles.join(' ').trim();

  // --- Type, action, urgence, service (apprentissage prioritaire sur les règles)
  const typeDevine = devinerType(texte, types);
  const typeAppris = appris?.type_id ? types.find((t) => t.id === appris.type_id)?.nom : null;
  champs.type = typeAppris || typeDevine;
  const montant = extraireMontant(texte); if (montant) { champs.montant = montant; if (champs.type === 'Facture' && !champs.objet) champs.objet = `Facture ${montant}`; }
  champs.action_demandee = devinerAction(texte, champs.type);
  champs.urgence = appris?.urgence || devinerUrgence(texte, champs.echeance);
  if (sens === 'arrivee') { const sAppris = appris?.service_id ? services.find((s) => s.id === appris.service_id)?.nom : null; champs.service = sAppris || devinerService(texte, services); }
  if (appris?.categorie_id) champs.categorie_id = appris.categorie_id;
  if (appris) indices.push('type et service repris de vos enregistrements précédents');
  if (brut.mode === 'ocr') indices.push(`qualité OCR ${Math.round(brut.confiance)} %`);

  Object.keys(champs).forEach((k) => { if (champs[k] == null) delete champs[k]; });
  return { champs, a_verifier: [...new Set(a_verifier)], evenements, indices, mode: brut.mode, pages: brut.pages, confiance: Math.round(brut.confiance), texte_brut: texte.slice(0, 6000) };
}
