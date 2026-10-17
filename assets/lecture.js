// NEXORA — lecture automatique d'un courrier scanné, entièrement dans le navigateur.
// 1. PDF avec texte  → pdf.js extrait le texte.
// 2. Image ou PDF scanné → OCR Tesseract (français), sans serveur ni clé.
// 3. Règles de reconnaissance → champs du registre (à vérifier par la secrétaire).

const MOIS_FR = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
const JOURS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (a, m, j) => `${a}-${pad(m)}-${pad(j)}`;

// ---------- Extraction du texte ----------
async function texteDepuisPdf(fichier, progression) {
  const pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc = await pdfjs.getDocument({ data: await fichier.arrayBuffer() }).promise;
  const pages = Math.min(doc.numPages, 4); let texte = '';
  for (let i = 1; i <= pages; i++) { const p = await doc.getPage(i); const c = await p.getTextContent(); texte += lignesDepuisItems(c.items) + '\n'; }
  if (texte.replace(/\s/g, '').length > 80) return { texte, mode: 'pdf', pages: doc.numPages };
  // PDF scanné : OCR page par page
  let ocr = '';
  for (let i = 1; i <= pages; i++) {
    progression?.(`OCR page ${i}/${pages}…`);
    const p = await doc.getPage(i); const vp = p.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
    await p.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    ocr += await ocrImage(canvas, progression) + '\n';
  }
  return { texte: ocr, mode: 'ocr', pages: doc.numPages };
}
function lignesDepuisItems(items) {
  // regroupe les fragments de pdf.js par ligne (même ordonnée)
  const lignes = []; let y = null, cour = [];
  for (const it of items) { const ty = Math.round(it.transform[5]); if (y !== null && Math.abs(ty - y) > 3) { lignes.push(cour.join(' ')); cour = []; } y = ty; cour.push(it.str); }
  if (cour.length) lignes.push(cour.join(' '));
  return lignes.join('\n');
}
async function ocrImage(source, progression) {
  const worker = await Tesseract.createWorker('fra', 1, { logger: (m) => { if (m.status === 'recognizing text') progression?.(`Reconnaissance du texte… ${Math.round(m.progress * 100)} %`); } });
  const { data } = await worker.recognize(source); await worker.terminate();
  return data.text || '';
}

// ---------- Reconnaissance des champs ----------
const nettoyer = (s) => s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

function trouverDates(texte, anneeRef) {
  const res = [];
  const t = texte.replace(/\s+/g, ' ');
  // jj/mm/aaaa ou jj.mm.aa
  for (const m of t.matchAll(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g)) { let a = Number(m[3]); if (a < 100) a += 2000; const mo = Number(m[2]), j = Number(m[1]); if (mo >= 1 && mo <= 12 && j >= 1 && j <= 31) res.push({ iso: isoDate(a, mo, j), brut: m[0], pos: m.index, manuscrit: false }); }
  // 15 octobre 2026 / lundi 19 octobre 2026 à 09 heures
  const reL = new RegExp(`\\b(?:(${JOURS_FR.join('|')})\\s+)?(\\d{1,2})(?:er)?\\s+(${Object.keys(MOIS_FR).join('|')})\\s+(\\d{4})(?:\\s*(?:à|a)\\s*(\\d{1,2})\\s*(?:h|heures?|:)\\s*(\\d{2})?)?`, 'gi');
  for (const m of t.matchAll(reL)) { const mo = MOIS_FR[m[3].toLowerCase()]; const h = m[5] ? `${pad(m[5])}:${pad(m[6] || '00')}` : null; res.push({ iso: isoDate(Number(m[4]), mo, Number(m[2])), brut: m[0], pos: m.index, heure: h, manuscrit: false }); }
  return res.sort((a, b) => a.pos - b.pos);
}

function devinerType(texte, types) {
  const t = texte.toLowerCase();
  const regles = [['Convocation', /convocation|convoqu|vous convier|invit(?:e|é)s? à (?:assister|participer)|réunion/], ['Facture', /\bfacture\b|montant\s+(?:ttc|ht)|à payer|échéance de paiement/], ['Invitation', /invitation|cérémonie|avoir l'honneur de vous inviter|vous inviter/], ['Rapport', /\brapport\b/], ['Demande', /demande d|sollicit|prie de bien vouloir|vous saurais gré/], ['Note de service', /note de service/], ['Contrat', /\bcontrat\b|convention/], ['Bordereau', /bordereau/], ['Colis', /\bcolis\b/], ['Lettre', /./]];
  for (const [nom, re] of regles) { if (re.test(t)) { const typ = types.find((x) => x.nom.toLowerCase() === nom.toLowerCase()); if (typ) return typ.nom; } }
  return null;
}
function devinerAction(texte) {
  const t = texte.toLowerCase();
  if (/convocation|convoqu|vous convier|assister|participer|réunion/.test(t)) return 'Assister à la réunion';
  if (/facture|montant|règlement|à payer|paiement/.test(t)) return 'Procéder au paiement';
  if (/réponse|répondre|confirmer|faire parvenir|transmettre|communiquer|nous faire tenir/.test(t)) return 'Répondre / transmettre les éléments demandés';
  if (/invitation|cérémonie/.test(t)) return "Confirmer la participation à l'événement";
  if (/pour information|à titre d'information/.test(t)) return 'Pour information';
  return null;
}
function devinerUrgence(texte, echeance) {
  const t = texte.toLowerCase();
  if (/urgent|urgence|dans les plus brefs délais|sans délai|impérativement|au plus tard/.test(t)) return 'eleve';
  if (echeance) { const d = (new Date(echeance) - new Date()) / 86400000; if (d >= 0 && d <= 5) return 'eleve'; }
  if (/pour information/.test(t)) return 'information';
  return 'normal';
}
function devinerService(texte, services) {
  const t = texte.toLowerCase();
  const regles = [[/finan|comptab|facture|paiement|budget|crédit/, 'SF'], [/ressources humaines|personnel|recrutement|affectation|congé/, 'RH'], [/formation|étudiant|élève|concours|cycle|pédagog|cours/, 'DE'], [/fourniture|matériel|entretien|logistique|véhicule|colis/, 'MG']];
  for (const [re, code] of regles) { if (re.test(t)) { const s = services.find((x) => x.code === code); if (s) return s.nom; } }
  const dg = services.find((x) => x.code === 'DG'); return dg ? dg.nom : null;
}

export async function lireCourrier(fichier, contexte, progression) {
  const { types = [], services = [], sens = 'arrivee' } = contexte;
  progression?.('Extraction du texte…');
  let brut;
  if (fichier.type === 'application/pdf') brut = await texteDepuisPdf(fichier, progression);
  else { progression?.('Reconnaissance du texte…'); const img = await createImageBitmap(fichier); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); brut = { texte: await ocrImage(c, progression), mode: 'ocr', pages: 1 }; }
  const texte = nettoyer(brut.texte); const lignes = texte.split('\n').map((l) => l.trim()).filter(Boolean);
  const champs = {}; const a_verifier = [];
  const fiable = brut.mode === 'pdf';

  // Expéditeur : en-tête (premières lignes en majuscules / mots-clés institutionnels), hors devise de la République
  const enTete = lignes.slice(0, 12).filter((l) => !/république|union\s*[-–]\s*discipline|^\s*$/i.test(l));
  const candidat = enTete.find((l) => /minist|direction|société|cabinet|universit|école|ecole|institut|agence|banque|association|mairie|préfecture|ambassade|office|s\.?a\.?\b|sarl|ong\b/i.test(l)) || enTete.find((l) => l.length > 6 && l === l.toUpperCase() && /[A-ZÉÈ]{4,}/.test(l));
  if (candidat) { champs.contact = candidat.replace(/\s{2,}/g, ' ').trim(); if (!fiable) a_verifier.push('contact'); }

  // Référence : N° 0457/MFPMA/CAB · Réf. : …
  const mRef = texte.match(/(?:n[°º]|réf(?:érence)?\.?\s*:?|ref\.?\s*:?)\s*([A-Z0-9][A-Z0-9\/\-._ ]{2,40})/i);
  if (mRef) { champs.reference = mRef[0].replace(/\s+/g, ' ').trim().replace(/[.,;:]$/, ''); if (!fiable) a_verifier.push('ref'); }

  // Objet
  const mObj = texte.match(/objet\s*:?\s*([^\n]+(?:\n(?![A-ZÉ][a-zé]+\s*:)[^\n]{0,120})?)/i);
  if (mObj) champs.objet = mObj[1].replace(/\s+/g, ' ').trim().replace(/[.;]$/, ''); else { const l = lignes.find((x) => /^(?:convocation|invitation|facture|demande|notification|rapport)/i.test(x)); if (l) champs.objet = l; }
  if (champs.objet && !fiable) a_verifier.push('objet');

  // Dates : la première près de "le" en tête = date du courrier ; les dates dans le corps = échéances / réunions
  const dates = trouverDates(texte);
  const posObjet = mObj ? texte.search(/objet\s*:/i) : Math.min(texte.length, 600);
  const dateCourrier = dates.find((d) => d.pos < posObjet) || (dates[0] && dates[0].pos < 800 ? dates[0] : null);
  if (dateCourrier) { champs.date_courrier = dateCourrier.iso; if (!fiable || /\d{2}[\/.]\d{2}[\/.]\d{2}\b/.test(dateCourrier.brut)) a_verifier.push('dcour'); }
  const corps = dates.filter((d) => d !== dateCourrier && d.pos >= posObjet);
  const evenements = [];
  for (const d of corps) {
    const autour = texte.slice(Math.max(0, d.pos - 160), d.pos + 60).replace(/\s+/g, ' ');
    const estReunion = /réunion|rencontre|séance|cérémonie|atelier|se tiendra|aura lieu|conseil/i.test(autour);
    const estLimite = /avant le|au plus tard|date limite|délai|échéance|jusqu'au|confirmer/i.test(autour);
    if (!estReunion && !estLimite) continue;
    const lieu = (autour.match(/(?:à|au|dans)\s+(?:la\s+|le\s+|l')?(salle[^,.]{0,40}|si[èe]ge[^,.]{0,40}|minist[èe]re[^,.]{0,40}|plateau|cocody|[A-ZÉ][\wéèà' -]{3,30}(?=[,.]))/) || [])[1];
    const titre = estReunion ? (autour.match(/(réunion[^,.]{0,60}|cérémonie[^,.]{0,60}|atelier[^,.]{0,60}|séance[^,.]{0,60}|conseil[^,.]{0,60})/i) || [, 'Réunion'])[1].trim() : `Date limite · ${(champs.objet || 'réponse').slice(0, 60)}`;
    evenements.push({ titre: titre.charAt(0).toUpperCase() + titre.slice(1), type: estReunion ? 'reunion' : 'echeance', debut: `${d.iso}T${d.heure || (estReunion ? '09:00' : '08:00')}:00`, lieu: lieu ? lieu.trim() : null });
    if (estLimite && !champs.echeance) champs.echeance = d.iso;
  }
  if (!champs.echeance && evenements[0]) champs.echeance = evenements[0].debut.slice(0, 10);

  // Résumé : premières phrases du corps après l'objet
  const corpsTexte = texte.slice(posObjet + (champs.objet ? champs.objet.length + 8 : 0)).replace(/\s+/g, ' ');
  const phrases = corpsTexte.match(/[^.!?]{25,220}[.!?]/g) || [];
  const utiles = phrases.filter((p) => !/^\s*(monsieur|madame|veuillez agréer|je vous prie)/i.test(p) && !/considération distinguée|salutations/i.test(p)).slice(0, 3);
  if (utiles.length) champs.resume = utiles.join(' ').trim();

  champs.type = devinerType(texte, types);
  champs.action_demandee = devinerAction(texte);
  champs.urgence = devinerUrgence(texte, champs.echeance);
  if (sens === 'arrivee') champs.service = devinerService(texte, services);

  Object.keys(champs).forEach((k) => { if (champs[k] == null) delete champs[k]; });
  return { champs, a_verifier: [...new Set(a_verifier)], evenements, mode: brut.mode, pages: brut.pages, texte_brut: texte.slice(0, 6000) };
}
