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
const CORRECTIONS_OCR = [[/ao[dtiîu]{1,3}t\b/gi, 'août'], [/a[o0]ut\b/gi, 'août'], [/f[ée]vr?\./gi, 'fév.'], [/([a-z])¢([a-z])/g, '$1è$2'], [/([a-z])€([a-z])/g, '$1è$2'], [/(\d)°(?=\s)/g, '$1e'], [/\bl[’']ENA\b/g, "l'ENA"], [/\bN[o0]t?\s*\//g, 'N° /'], [/\baupr[ée]s\b/gi, 'auprès'], [/\bapr[ée]s\b/gi, 'après'], [/\bd[ée]s\s+(?=\d)/gi, 'dès '], [/\bdipl[o06]mes?\b/gi, (m) => m.replace(/[o06]/, 'ô')]];
const nettoyer = (s) => { let t = s.replace(/[|_~¬]+/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim(); for (const [re, rep] of CORRECTIONS_OCR) t = t.replace(re, rep); return t; };
const MOIS_ABR = { janv: 1, jan: 1, fev: 2, fév: 2, fevr: 2, févr: 2, mars: 3, mar: 3, avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juill: 7, aout: 8, août: 8, sept: 9, sep: 9, oct: 10, nov: 11, dec: 12, déc: 12 };
function trouverDates(texte) {
  const res = []; const t = texte.replace(/\s+/g, ' ');
  for (const m of t.matchAll(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g)) { let a = Number(m[3]); if (a < 100) a += 2000; const mo = Number(m[2]), j = Number(m[1]); if (mo >= 1 && mo <= 12 && j >= 1 && j <= 31 && a > 2000 && a < 2100) res.push({ iso: isoDate(a, mo, j), brut: m[0], pos: m.index, court: m[3].length === 2 }); }
  // 15 octobre 2026 · lundi 03 août 2026, à partir de 7 heures 30 minutes · du 03 au 14 août 2026
  const reL = new RegExp(`\\b(?:(${JOURS_FR.join('|')})\\s+)?(?:du\\s+(\\d{1,2})\\s+au\\s+)?(\\d{1,2})(?:er)?\\s+(${Object.keys(MOIS_FR).join('|')})\\s+(\\d{4})(?:\\s*,?\\s*(?:à partir de|a partir de|à|a|dès|des)\\s*(\\d{1,2})\\s*(?:h\\b|heures?|:)\\s*(\\d{2})?)?`, 'gi');
  for (const m of t.matchAll(reL)) { const mo = MOIS_FR[m[4].toLowerCase()]; const h = m[6] ? `${pad(m[6])}:${pad(m[7] || '00')}` : null; const a = Number(m[5]); if (m[2]) res.push({ iso: isoDate(a, mo, Number(m[2])), brut: m[0], pos: m.index, debutPeriode: true, finIso: isoDate(a, mo, Number(m[3])) }); res.push({ iso: isoDate(a, mo, Number(m[3])), brut: m[0], pos: m.index, heure: h, finPeriode: !!m[2] }); }
  // tampon dateur : "27 JUIL 2026", "2 7 JUIL. 2026", "27/JUIL/2026"
  const reT = new RegExp(`\\b(\\d(?:\\s?\\d)?)\\s*[\\/.-]?\\s*(${Object.keys(MOIS_ABR).join('|')})\\.?\\s*[\\/.-]?\\s*(\\d{4})\\b`, 'gi');
  for (const m of t.matchAll(reT)) { const j = Number(m[1].replace(/\s/g, '')); const mo = MOIS_ABR[m[2].toLowerCase()]; if (!(j >= 1 && j <= 31 && mo)) continue; const iso = isoDate(Number(m[3]), mo, j); if (res.some((r) => Math.abs(r.pos - m.index) < 30 && (r.iso === iso || r.finIso === iso))) continue; res.push({ iso, brut: m[0], pos: m.index, tampon: true }); }
  return res.sort((a, b) => a.pos - b.pos);
}
const REGLES_TYPE = [
  ['Convocation', /convocation|convoqu|vous convier|invit(?:e|é)s? à (?:assister|participer)|sont priés d'assister/],
  ['Facture', /\bfacture\b|montant\s+(?:ttc|ht)|à payer|à régler|échéance de paiement|total à payer|avis d'échéance/],
  ['Note de service', /note de service|note circulaire|circulaire/],
  ['Invitation', /invitation|cérémonie|avoir l'honneur de vous inviter|vous inviter|cocktail|vernissage/],
  ['Rapport', /\brapport\b|compte[- ]rendu|procès[- ]verbal/],
  ['Contrat', /\bcontrat\b|convention|protocole d'accord|avenant/],
  ['Bordereau', /bordereau/],
  ['Colis', /\bcolis\b|bon de livraison/],
  ['Réponse', /accuser réception|en réponse à|suite à votre (?:courrier|lettre|demande|correspondance)|faisant suite|comme suite à/],
  ['Demande', /demande d|sollicit|prie de bien vouloir|vous saurais? gré|requête|candidature|stage/],
  ['Lettre', /./],
];
function devinerType(texte, types, sens) {
  const t = texte.toLowerCase();
  for (const [nom, re] of REGLES_TYPE) if (re.test(t)) { const typ = types.find((x) => normaliser(x.nom) === normaliser(nom) && (x.sens === 'les_deux' || x.sens === sens)); if (typ) return typ.nom; }
  const l = types.find((x) => normaliser(x.nom) === 'lettre'); return l ? l.nom : null;
}
// Liste à puces qui suit « ci-après », « ci-dessous », « suivants » : les éléments sont restitués un par un
function extraireListe(texte) {
  const m = texte.match(/(?:ci-apr[èe]s|ci-dessous|suivant(?:e)?s?)\s*[;:.]?\s*\n((?:\s*[-–•*·]\s*[^\n]+\n?){2,})/i);
  if (!m) return null;
  const items = m[1].split('\n').map((l) => l.replace(/^\s*[-–•*·]\s*/, '').replace(/\s*[;.,]\s*$/, '').trim()).filter((l) => l.length > 2);
  return items.length >= 2 ? items.map((x) => x.charAt(0).toUpperCase() + x.slice(1)) : null;
}
function devinerAction(texte, type) {
  const t = texte.replace(/\s+/g, ' ');
  const tl = t.toLowerCase();
  const liste = extraireListe(texte);
  if (liste) {
    const avant = (t.match(/(?:solliciter|demander|prie de bien vouloir|saurai[s]? gré de bien vouloir|bien vouloir)[^.;]{0,80}?(mise à disposition|transmission|communication|envoi|fourniture|production)[^.;]{0,60}?(?:ci-apr[èe]s|ci-dessous|suivant)/i) || [])[1];
    const tete = avant ? avant.charAt(0).toUpperCase() + avant.slice(1) + ' de' : 'Transmettre';
    return `${tete} : ${liste.join(' ; ')}`;
  }
  // ce que le courrier demande explicitement
  const m = t.match(/(?:vous saurai[s]? gré de bien vouloir|vous prie de bien vouloir|voudrais?-je[^.;]{0,40}solliciter[^.;]{0,30}|prière de bien vouloir|bien vouloir|solliciter aupr[èé]s de vous)\s+([^.;]{8,140})/i);
  if (m) { let a = m[1].trim().replace(/^(?:la |le |l'|les |de |d')/, '').replace(/\bvotre\b/gi, 'sa').replace(/\bvous\b/gi, 'lui'); a = a.charAt(0).toUpperCase() + a.slice(1); if (/^(mise|liste|transmission|communication)/i.test(a)) a = 'Transmettre : ' + a.charAt(0).toLowerCase() + a.slice(1); if (a.length > 110) a = a.slice(0, 110).replace(/\s+\S*$/, '') + '…'; return a; }
  if (type === 'Facture' || /facture|montant|règlement|à payer|à régler|paiement/.test(tl)) return 'Procéder au paiement';
  if (type === 'Convocation' || /convocation|convoqu|vous convier|assister|participer/.test(tl)) return 'Assister à la réunion';
  if (type === 'Invitation' || /invitation|cérémonie/.test(tl)) return "Confirmer la participation à l'événement";
  if (/candidature|stage|recrutement/.test(tl)) return 'Examiner la candidature';
  if (/réponse|répondre|confirmer|faire parvenir|transmettre|communiquer|nous faire tenir|pièces|justificatif/.test(tl)) return 'Répondre / transmettre les éléments demandés';
  if (/pour information|à titre d'information|pour votre information/.test(tl)) return 'Pour information';
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
function serviceDansTexte(texte, services) {
  const t = normaliser(texte);
  for (const s of services) { if (s.nom.length > 8 && t.includes(normaliser(s.nom))) return s; }
  for (const s of services) { if (s.code && s.code.length >= 3 && new RegExp(`\\b${normaliser(s.code)}\\b`).test(t)) return s; }
  return null;
}
function devinerService(texte, services) {
  const t = normaliser(texte);
  const nomme = serviceDansTexte(texte, services); if (nomme) return nomme.nom;
  const regles = [[/ressources humaines|personnel|recrutement|affectation|conge|carriere|candidature/, ['DFA-RH', 'RH', 'DRH']], [/comptab|facture|paiement|budget|credit|tresor|marche public|reglement|devis/, ['DFA-COMPTA', 'SF', 'DAF']], [/fourniture|materiel|entretien|logistique|vehicule|colis|livraison|maintenance|batiment/, ['DFA-MG', 'MG', 'SMG']], [/concours|candidat|inscription|epreuve|admission/, ['SCONC']], [/informatique|logiciel|reseau|ordinateur|serveur|site web|numerique/, ['SI']], [/communication|presse|media|journaliste|evenement|ceremonie|invitation/, ['SCOM']], [/qualite|audit|certification|iso|procedure/, ['SQ']], [/ecole des finances|finances publiques|tresor public|impots|douane/, ['DGEF']], [/secretariat general|secretaire general/, ['SG']], [/formation|etudiant|eleve|cycle|pedagog|cours|scolarite|stage|filiere|promotion/, ['DE', 'DEP']]];
  for (const [re, codes] of regles) if (re.test(t)) { const s = services.find((x) => codes.includes(x.code)); if (s) return s.nom; }
  const dg = services.find((x) => x.code === 'DG'); return dg ? dg.nom : null;
}
function extraireMontant(texte) {
  const t = texte.replace(/\s+/g, ' ');
  const m = t.match(/(?:montant|total|net à payer|à payer|à régler)[^\d]{0,30}(\d{1,3}(?:[ .]\d{3})+|\d+)(?:[,.]\d{2})?\s*(f\s?cfa|fcfa|xof|€|eur|\$)/i) || t.match(/(\d{1,3}(?:[ .]\d{3})+)\s*(f\s?cfa|fcfa|xof)/i);
  return m ? `${m[1].replace(/[ .]/g, ' ')} ${m[2].toUpperCase().replace(/\s/g, '')}` : null;
}

// Analyse du texte (indépendante de l'OCR, testable)
export function analyserTexte(texteBrut, contexte, meta = {}) {
  const { types = [], services = [], contacts = [], apprentissage = [] } = contexte; let { sens = 'arrivee' } = contexte;
  const mode = meta.mode || 'pdf', confiance = meta.confiance ?? 100;
  const texte = nettoyer(texteBrut); const lignes = texte.split('\n').map((l) => l.trim()).filter((l) => l.length > 1);
  const champs = {}; const a_verifier = []; const indices = [];
  const fiable = mode === 'pdf' || confiance >= 85;
  const posObjet = (() => { const i = texte.search(/\bobjet\s*:/i); return i >= 0 ? i : Math.min(texte.length, 700); })();
  const enTeteTexte = texte.slice(0, posObjet);
  const enTete = lignes.filter((l) => texte.indexOf(l) < posObjet).filter((l) => !/republique de cote d ivoire|union\s*discipline\s*travail/i.test(normaliser(l)));

  // --- En-tête de l'ENA elle-même → c'est un courrier qui part (ou interne)
  const enaEmet = /ecole nationale d administration|\bena\b/.test(normaliser(enTeteTexte.slice(0, 400)));
  if (enaEmet && sens === 'arrivee') { champs.sens_suggere = 'depart'; indices.push("en-tête de l'ENA : ce courrier semble être un départ"); }
  const serviceEmetteur = enaEmet ? serviceDansTexte(enTeteTexte, services) : null;

  // --- Destinataire (après « à » / « A ») ou expéditeur (en-tête)
  const mDest = enTeteTexte.match(/(?:^|\n)\s*(?:à|a|A)\s*\n((?:[^\n]+\n){1,4})/) || enTeteTexte.match(/(?:^|\n)\s*(?:à|a)\s+((?:monsieur|madame|mme|m\.|mr|mademoiselle)[^\n]+(?:\n[^\n]+){0,3})/i);
  let destinataire = null;
  if (mDest) { destinataire = mDest[1].split('\n').map((l) => l.trim()).filter((l) => l && !/^[A-ZÉÈ' -]{4,}$/.test(l) && !/objet/i.test(l)).join(' ').replace(/\s+/g, ' ').trim(); }
  if (!destinataire) {
    const i = enTete.findIndex((l) => /^(?:monsieur|madame|mesdames|messieurs|mme|m\.|mr|mademoiselle|son excellence)\b/i.test(l) && !/,\s*$/.test(l));
    if (i >= 0) { const bloc = [enTete[i]]; for (let k = i + 1; k < Math.min(enTete.length, i + 4); k++) { const l = enTete[k]; if (/^[A-ZÉÈ' -]{4,}$/.test(l) || /objet|réf/i.test(l) || /^(?:n[°º]|le |la )/i.test(l)) break; bloc.push(l); } destinataire = bloc.join(' ').replace(/\s+/g, ' ').trim(); }
  }
  const connu = reconnaitreContact(enTete.filter((l) => !/ministere de la fonction publique|modernisation de l administration/.test(normaliser(l)) || !enaEmet), contacts);
  if (enaEmet || champs.sens_suggere === 'depart' || sens === 'depart') {
    if (destinataire) { champs.contact = destinataire; if (!fiable) a_verifier.push('contact'); }
    else if (connu) champs.contact = connu.nom;
  } else {
    if (connu) { champs.contact = connu.nom; indices.push('expéditeur reconnu dans vos contacts'); }
    else {
      const candidat = enTete.find((l) => /minist|direction|societe|cabinet|universit|ecole|institut|agence|banque|association|mairie|prefecture|ambassade|office|\bsa\b|sarl|\bong\b|groupe|compagnie|fondation|centre|conseil|chambre|federation|syndicat/i.test(normaliser(l)))
        || enTete.find((l) => l.length > 6 && l === l.toUpperCase() && /[A-ZÉÈ]{4,}/.test(l));
      if (candidat) { champs.contact = candidat.replace(/\s{2,}/g, ' ').replace(/[.,;:]+$/, '').trim(); if (!fiable) a_verifier.push('contact'); }
    }
  }
  const appris = champs.contact ? apprentissage.find((a) => a.cle === normaliser(champs.contact)) : null;

  // --- Références : la nôtre (N° …/ENA/…) et celle du courrier auquel on répond (Réf : V/L n° …)
  const mRefLiee = texte.match(/réf(?:érence)?\.?\s*:?\s*(?:v\/l|votre lettre|votre courrier|v\/c)?\s*n?[°º]?\s*:?\s*([A-Z0-9][A-Z0-9\/\-._ ]{3,40}?)(?:\s+du\s+([^\n]{6,30}))?(?=\n|$)/im);
  const mNum = enTeteTexte.match(/\bn[°ºo]?\s*t?\s*:?\s*([0-9OoIl]{0,6}\s*\/\s*[A-Z]{2,}(?:\s*\/\s*[A-Z0-9]{2,})+)/i) || enTeteTexte.match(/\bn[°º]\s*:?\s*([A-Z0-9][A-Z0-9\/\-._ ]{2,40}?)(?=\s*\n|\s{2,}|$)/im);
  if (mNum) { let num = mNum[1].replace(/\s*\/\s*/g, '/').trim(); num = num.replace(/^([0-9OoIl]+)(?=\/)/, (d) => d.replace(/[Oo]/g, '0').replace(/[Il]/g, '1')); champs.reference = ('N° ' + num).replace(/\s+/g, ' ').replace(/[.,;:]$/, ''); if (!fiable || /^\//.test(num)) a_verifier.push('ref'); }
  if (mRefLiee && (!mNum || mRefLiee[1].trim() !== mNum[1].trim())) { champs.reference_liee = mRefLiee[1].trim().replace(/\s+/g, ' '); if (mRefLiee[2]) champs.reference_liee_date = mRefLiee[2].trim(); indices.push('réponse à un courrier référencé'); }
  if (!champs.reference && mRefLiee && sens !== 'depart' && !enaEmet) champs.reference = mRefLiee[1].trim();

  // --- Objet
  const mObj = texte.match(/objet\s*:?\s*([^\n]+(?:\n(?!(?:réf|ref|r[ée]f[ée]rence|p\.?j|madame|monsieur|mesdames|messieurs)\b)[^\n]{0,120})?)/i);
  if (mObj) champs.objet = mObj[1].replace(/\s+/g, ' ').trim().replace(/[.;]$/, '');
  else { const l = lignes.find((x) => /^(?:convocation|invitation|facture|demande|notification|rapport|note|avis|attestation|lettre)/i.test(x)); if (l) champs.objet = l; }
  if (champs.objet) { champs.objet = champs.objet.charAt(0).toUpperCase() + champs.objet.slice(1); if (!fiable) a_verifier.push('objet'); }

  // --- Dates
  const dates = trouverDates(texte);
  const dateCourrier = dates.find((d) => d.tampon && d.pos < posObjet) || dates.find((d) => d.pos < posObjet && !d.debutPeriode) || null;
  if (dateCourrier) { champs.date_courrier = dateCourrier.iso; if (!fiable || dateCourrier.court || dateCourrier.tampon) a_verifier.push('dcour'); }
  const refDate = mRefLiee && mRefLiee[2] ? trouverDates(mRefLiee[2])[0] : null;
  const corps = dates.filter((d) => d !== dateCourrier && d.pos >= posObjet && !(refDate && d.iso === refDate.iso));
  const evenements = []; const vus = new Set();
  for (const d of corps) {
    const autour = texte.slice(Math.max(0, d.pos - 200), d.pos + 90).replace(/\s+/g, ' ');
    const passe = /comme suite à ma lettre|ma lettre|votre lettre|votre correspondance|en date du|du \d{1,2}/i.test(texte.slice(Math.max(0, d.pos - 40), d.pos)) && !d.debutPeriode;
    if (passe) continue;
    const estReunion = /réunion|rencontre|séance|cérémonie|atelier|se tiendra|aura lieu|conseil|assemblée|session|entretien|audience|formation|débuteront|débutera|commenceront|rentrée|cours/i.test(autour);
    const estLimite = /avant le|au plus tard|date limite|délai|échéance|jusqu'au|à régler|payable|dernier délai|clôture|disponibilité|période du/i.test(autour);
    if (!estReunion && !estLimite) continue;
    if (d.debutPeriode) {
      const cle = 'p' + d.iso; if (vus.has(cle)) continue; vus.add(cle);
      evenements.push({ titre: `Période · ${(champs.objet || 'présentation').slice(0, 60)}`, type: 'echeance', debut: `${d.iso}T08:00:00`, fin: `${d.finIso}T18:00:00`, lieu: null });
      if (!champs.echeance) champs.echeance = d.finIso; continue;
    }
    if (d.finPeriode) continue;
    if (vus.has(d.iso + (d.heure || ''))) continue; vus.add(d.iso + (d.heure || ''));
    const lieu = (autour.match(/(?:à|au|dans|en)\s+(?:la\s+|le\s+|l')?(salle[^,.]{0,40}|si[èe]ge[^,.]{0,40}|minist[èe]re[^,.]{0,40}|amphith[ée][âa]tre[^,.]{0,30}|plateau|cocody|yopougon|marcory|treichville|abidjan|[A-ZÉ][\wéèà' -]{3,30}(?=[,.]))/) || [])[1];
    let titre;
    if (estReunion) {
      const avant = texte.slice(Math.max(0, d.pos - 200), d.pos).replace(/\s+/g, ' ');
      let clause = avant.split(/[.;:]/).pop().replace(/^[\s,\-–]+|,?\s*(?:le|la|les|l')?\s*$/g, '').trim();
      clause = clause.replace(/^(?:par ailleurs|à cet effet|a cet effet|en effet|aussi|toutefois|enfin|en outre)\s*,?\s*/i, '').replace(/^(?:je|nous)\s+(?:voudrais?|souhaite|souhaitons|tiens|tenons|vous informe|vous informons)\s+(?:vous\s+)?(?:porter à votre connaissance|porter a votre connaissance|informer|signaler|rappeler|préciser)?\s*(?:que|qu')?\s*/i, '').replace(/^(?:j'ai|nous avons) l'honneur de (?:vous )?(?:informer|porter à votre connaissance)\s*(?:que|qu')?\s*/i, '').trim();
      clause = clause.charAt(0).toUpperCase() + clause.slice(1);
      titre = clause.length >= 12 ? clause : (autour.match(/(réunion[^,.]{0,60}|cérémonie[^,.]{0,60}|atelier[^,.]{0,60}|séance[^,.]{0,60}|conseil[^,.]{0,60}|assemblée[^,.]{0,60}|session[^,.]{0,60}|formation[^,.]{0,60}|rentrée[^,.]{0,60})/i) || [, 'Réunion'])[1].trim();
      if (titre.length > 90) titre = titre.slice(0, 90).replace(/\s+\S*$/, '') + '…';
    } else titre = `Date limite · ${(champs.objet || 'réponse').slice(0, 60)}`;
    evenements.push({ titre: titre.charAt(0).toUpperCase() + titre.slice(1), type: estReunion ? 'reunion' : 'echeance', debut: `${d.iso}T${d.heure || (estReunion ? '09:00' : '08:00')}:00`, lieu: lieu ? lieu.trim() : null });
    if (estLimite && !champs.echeance) champs.echeance = d.iso;
  }
  if (!champs.echeance && evenements[0]) champs.echeance = evenements[0].debut.slice(0, 10);

  // --- Résumé
  const corpsTexte = texte.slice(posObjet).replace(/\s+/g, ' ');
  const phrases = (corpsTexte.match(/[^.!?;]{25,420}[.!?;]/g) || []).map((p) => p.trim().replace(/^(?:madame|monsieur|mesdames|messieurs)[^,]{0,60},\s*/i, ''));
  const utiles = phrases.filter((p) => !/^\s*(objet|réf|veuillez agréer|je vous prie de croire|nous vous prions)/i.test(p) && !/considération distinguée|salutations|haute considération/i.test(p)).slice(0, 3);
  if (utiles.length) { let r = utiles.join(' ').replace(/^(?:réf\s*:[^.]*\.\s*)/i, '').trim(); if (r.length > 380) r = r.slice(0, 380).replace(/\s+\S*$/, '') + '…'; champs.resume = r; }

  // --- Signataire et fonction (départ)
  const fin = lignes.slice(-10);
  const sig = fin.find((l) => /^[A-ZÉÈÀ][A-ZÉÈÀ' -]{2,}\s+[A-ZÉ][a-zéèàï' -]{2,}$/.test(l.trim())) || fin.find((l) => /^[A-ZÉ][a-zéè]+\s+[A-ZÉÈÀ' -]{3,}$/.test(l.trim()));
  if (sig) champs.signataire = sig.trim();
  const fonction = (enTeteTexte.match(/\b(le directeur général|la directrice générale|le directeur|la directrice|le chef de service|la chef de service|le secrétaire général|le coordonnateur|la coordonnatrice|le doyen|le président|le ministre)\b[^\n]{0,40}/i) || [])[0];
  if (fonction) champs.fonction_signataire = fonction.trim();

  // --- Type, action, urgence, service
  const sensEffectif = champs.sens_suggere || sens;
  const typeDevine = devinerType(texte, types, sensEffectif);
  const typeAppris = appris?.type_id ? types.find((t) => t.id === appris.type_id)?.nom : null;
  champs.type = typeAppris || typeDevine;
  const montant = extraireMontant(texte); if (montant) { champs.montant = montant; if (champs.type === 'Facture' && !champs.objet) champs.objet = `Facture ${montant}`; }
  champs.action_demandee = devinerAction(texte, champs.type);
  champs.urgence = appris?.urgence || devinerUrgence(texte, champs.echeance);
  if (sensEffectif === 'depart') { const egad = services.find((x) => x.code === 'EGAD'); if (egad) champs.service = egad.nom; else if (serviceEmetteur) champs.service = serviceEmetteur.nom; }
  else { const sAppris = appris?.service_id ? services.find((s) => s.id === appris.service_id)?.nom : null; champs.service = sAppris || devinerService(texte, services); }
  if (appris?.categorie_id) champs.categorie_id = appris.categorie_id;
  if (appris) indices.push('type et service repris de vos enregistrements précédents');
  if (mode === 'ocr') indices.push(`qualité OCR ${Math.round(confiance)} %`);

  Object.keys(champs).forEach((k) => { if (champs[k] == null) delete champs[k]; });
  return { champs, a_verifier: [...new Set(a_verifier)], evenements, indices, mode, pages: meta.pages || 1, confiance: Math.round(confiance), texte_brut: texte.slice(0, 6000) };
}

export async function lireCourrier(fichier, contexte, progression) {
  progression?.('Extraction du texte…');
  let brut;
  if (fichier.type === 'application/pdf') brut = await texteDepuisPdf(fichier, progression);
  else { progression?.('Préparation de l\'image…'); const img = await createImageBitmap(fichier); const r = await ocrImage(img, progression); brut = { ...r, mode: 'ocr', pages: 1 }; }
  return analyserTexte(brut.texte, contexte, { mode: brut.mode, confiance: brut.confiance, pages: brut.pages });
}
