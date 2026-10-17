// NEXORA — plateforme de gestion du courrier et des documents · ENA Côte d'Ivoire
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://namzkpsomphnjoyvdlvr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GVI7tXnGdNgsvOUFlL9oew_UBZJOPFd';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------------------------------------------------------
// État global
// ------------------------------------------------------------------
const etat = { session: null, profil: null, services: [], types: [], categories: [] };
const app = document.getElementById('app');

// ------------------------------------------------------------------
// Utilitaires
// ------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aujourdhui = () => iso(new Date());
const fmtDate = (s) => { if (!s) return '—'; const d = new Date(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtDateHeure = (s) => { if (!s) return '—'; const d = new Date(s); return `${fmtDate(s)} ${pad(d.getHours())}h${pad(d.getMinutes())}`; };
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOURS_C = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateLongue = (d) => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
const ajouterJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const lundiDe = (d) => { const x = new Date(d); const j = (x.getDay() + 6) % 7; x.setDate(x.getDate() - j); x.setHours(0, 0, 0, 0); return x; };

const STATUTS = {
  brouillon: ['Brouillon', 'gris'], recu: ['Reçu', 'vert'], transmis: ['Transmis', 'vert'], a_traiter: ['À traiter', 'ambre'],
  traite: ['Traité', 'vert'], classe: ['Classé', 'gris'], envoye: ['Envoyé', 'vert'], annule: ['Annulé', 'corail'],
};
const URGENCES = { eleve: 'Élevé – réponse rapide', normal: 'Normal', information: 'Information' };
const MODES = { main_propre: 'Main propre', email: 'Email', coursier: 'Coursier', poste: 'Poste', fax: 'Fax', autre: 'Autre' };
const chipStatut = (c) => {
  if (c.statut !== 'annule' && c.echeance && c.echeance < aujourdhui() && !['traite', 'classe', 'envoye'].includes(c.statut)) return `<span class="chip corail">En retard</span>`;
  const [lib, cls] = STATUTS[c.statut] || [c.statut, 'gris'];
  return `<span class="chip ${cls}">${lib}</span>`;
};
const numero = (c) => `<span class="num ${c.sens === 'depart' ? 'dep' : ''}">${esc(c.numero_ordre || 'Brouillon')}</span>`;

let toastTimer;
function toast(msg, erreur = false) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div'); t.className = 'toast' + (erreur ? ' erreur' : ''); t.textContent = msg; document.body.appendChild(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), erreur ? 6000 : 3500);
}

function modale(html) {
  const v = document.createElement('div'); v.className = 'voile'; v.innerHTML = `<div class="modale" role="dialog" aria-modal="true">${html}</div>`;
  v.addEventListener('click', (e) => { if (e.target === v) v.remove(); });
  document.body.appendChild(v); return v;
}

const ICONES = {
  tableau: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  arrivees: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M4 13h5l2 3h2l2-3h5"/></svg>',
  departs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/></svg>',
  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  archives: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18v4H3z"/><path d="M5 11v9h14v-9M10 15h4"/></svg>',
  rapports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  parametres: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  telecharger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
  fichier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
  gauche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  droite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  cloche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M3 12h18"/></svg>',
};

const LOGO = (couleur = '#FFFFFF', largeur = 186) => `<svg viewBox="-60 -48 660 224" width="${largeur}" height="${Math.round(largeur * 224 / 660)}" role="img" aria-label="NEXORA"><g fill="none" stroke="${couleur}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"><path d="M0 112 V12 L60 112 V12"/><path d="M128 12 H96 V112 H128 M96 62 H122"/><path d="M224 12 L164 112"/><circle cx="307" cy="62" r="47"/><path d="M390 112 V12 H422 a26 26 0 0 1 0 52 H390"/><path d="M416 64 L444 112"/><path d="M480 112 L510 12 L540 112 M492 72 H528"/></g><path d="M-40 -24 H90 Q142 -24 164 12 L224 112 Q246 148 300 148 H580" fill="none" stroke="#E8705C" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="180 1000" stroke-dashoffset="180"><animate attributeName="stroke-dashoffset" values="180;-700;-700" keyTimes="0;0.85;1" dur="2.2s" repeatCount="indefinite"/></path></svg>`;

const initiales = (nom) => (nom || 'N').split(/\s+/).map((m) => m[0]).join('').slice(0, 2).toUpperCase();
const ROLES = { secretaire: 'Secrétaire de direction', responsable: 'Responsable de service', direction: 'Direction', admin: 'Administrateur' };
const peutEcrire = () => ['secretaire', 'admin'].includes(etat.profil?.role);

// ------------------------------------------------------------------
// Authentification
// ------------------------------------------------------------------
async function chargerProfil() {
  const { data: profil } = await sb.from('profils').select('*').eq('id', etat.session.user.id).maybeSingle();
  etat.profil = profil;
  const [s, t, k] = await Promise.all([
    sb.from('services').select('*').eq('actif', true).order('nom'),
    sb.from('types_courrier').select('*').eq('actif', true).order('nom'),
    sb.from('categories').select('*').eq('actif', true).order('nom'),
  ]);
  etat.services = s.data || []; etat.types = t.data || []; etat.categories = k.data || [];
}

function vueConnexion(message = '') {
  app.innerHTML = `
  <div class="ecran-connexion">
    <form class="carte-connexion" id="fconn">
      <div class="logo">${LOGO('#1F6B3A', 220)}<div class="sous">Secrétariat · ENA Côte d'Ivoire</div></div>
      ${message ? `<div class="bandeau corail">${esc(message)}</div>` : ''}
      <div class="champ"><label for="email">Adresse email</label><input id="email" type="email" autocomplete="username" required></div>
      <div class="champ"><label for="mdp">Mot de passe</label><input id="mdp" type="password" autocomplete="current-password" required></div>
      <button class="btn principal" type="submit" style="justify-content:center">Se connecter</button>
      <div style="font-size:12px;color:var(--muet);text-align:center">Accès réservé au personnel autorisé.</div>
    </form>
  </div>`;
  document.getElementById('fconn').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Connexion…';
    const f = e.target; const { error } = await sb.auth.signInWithPassword({ email: f.querySelector('#email').value.trim(), password: f.querySelector('#mdp').value });
    if (error) { btn.disabled = false; btn.textContent = 'Se connecter'; vueConnexion('Email ou mot de passe incorrect.'); }
  });
}

function vueChangerMdp() {
  app.innerHTML = `
  <div class="ecran-connexion">
    <form class="carte-connexion" id="fmdp">
      <div class="logo">${LOGO('#1F6B3A', 220)}<div class="sous">Première connexion</div></div>
      <div class="bandeau ambre">Choisissez votre mot de passe personnel pour continuer.</div>
      <div class="champ"><label for="m1">Nouveau mot de passe</label><input id="m1" type="password" minlength="8" autocomplete="new-password" required><span class="aide">8 caractères minimum.</span></div>
      <div class="champ"><label for="m2">Confirmer le mot de passe</label><input id="m2" type="password" minlength="8" autocomplete="new-password" required></div>
      <button class="btn principal" type="submit" style="justify-content:center">Enregistrer et entrer dans NEXORA</button>
    </form>
  </div>`;
  document.getElementById('fmdp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target; const v1 = f.querySelector('#m1').value, v2 = f.querySelector('#m2').value;
    if (v1 !== v2) return toast('Les deux mots de passe ne correspondent pas.', true);
    const { error } = await sb.auth.updateUser({ password: v1 });
    if (error) return toast(error.message, true);
    await sb.from('profils').update({ mdp_a_changer: false }).eq('id', etat.profil.id);
    etat.profil.mdp_a_changer = false; toast('Mot de passe enregistré.'); naviguer('#/tableau');
  });
}

// ------------------------------------------------------------------
// Coque et navigation
// ------------------------------------------------------------------
const PAGES = [
  ['#/tableau', 'Tableau de bord', 'tableau'], ['#/arrivees', 'Arrivées', 'arrivees'], ['#/departs', 'Départs', 'departs'],
  ['#/agenda', 'Agenda et alertes', 'agenda'], ['#/archives', 'Archives', 'archives'], ['#/rapports', 'Rapports', 'rapports'],
];
function coque(active, contenu) {
  const p = etat.profil || {};
  app.innerHTML = `
  <div class="coque">
    <nav class="menu" aria-label="Navigation principale">
      <div class="logo">${LOGO()}<div class="sous">Secrétariat · ENA Côte d'Ivoire</div></div>
      ${PAGES.map(([h, l, i]) => `<a class="nav ${active === i ? 'on' : ''}" href="${h}">${ICONES[i]}${l}</a>`).join('')}
      <div class="espace"></div>
      <a class="nav ${active === 'parametres' ? 'on' : ''}" href="#/parametres">${ICONES.parametres}Paramètres</a>
      <div class="util"><div class="avatar" aria-hidden="true">${initiales(p.nom)}</div><div><div class="nom">${esc(p.nom || '')}</div><div class="role">${ROLES[p.role] || ''}</div></div></div>
    </nav>
    <main class="contenu" id="vue">${contenu}</main>
  </div>`;
  return document.getElementById('vue');
}
const naviguer = (h) => { if (location.hash === h) router(); else location.hash = h; };

async function router() {
  if (!etat.session) return vueConnexion();
  if (!etat.profil) return app.innerHTML = `<div class="ecran-connexion"><div class="carte-connexion"><div class="bandeau corail">Votre compte n'a pas encore de profil NEXORA. Contactez l'administrateur.</div><button class="btn" id="dec">Se déconnecter</button></div></div>`, document.getElementById('dec').onclick = () => sb.auth.signOut();
  if (etat.profil.mdp_a_changer) return vueChangerMdp();
  const h = location.hash || '#/tableau';
  const [, page, param] = h.split('/');
  try {
    switch (page) {
      case 'tableau': return await vueTableau();
      case 'arrivees': return await vueRegistre('arrivee');
      case 'departs': return await vueRegistre('depart');
      case 'enregistrer': return await vueEnregistrer(param === 'depart' ? 'depart' : 'arrivee');
      case 'courrier': return await vueCourrier(param);
      case 'agenda': return await vueAgenda(param);
      case 'archives': return await vueArchives();
      case 'rapports': return await vueRapports();
      case 'parametres': return await vueParametres();
      default: return naviguer('#/tableau');
    }
  } catch (err) { console.error(err); toast('Erreur : ' + (err.message || err), true); }
}
window.addEventListener('hashchange', router);

// ------------------------------------------------------------------
// Tableau de bord
// ------------------------------------------------------------------
async function vueTableau() {
  const vue = coque('tableau', `<div class="chargement">Chargement…</div>`);
  const auj = aujourdhui(); const d7 = iso(ajouterJours(new Date(), -6)); const d8 = iso(ajouterJours(new Date(), 7));
  const [jour, attente, retard, echeances, sept, evs] = await Promise.all([
    sb.from('v_courriers').select('*').eq('date_evenement', auj).neq('statut', 'brouillon').order('cree_le', { ascending: false }),
    sb.from('courriers').select('id', { count: 'exact', head: true }).in('statut', ['recu', 'a_traiter', 'transmis']).eq('sens', 'arrivee'),
    sb.from('courriers').select('id', { count: 'exact', head: true }).in('statut', ['recu', 'a_traiter', 'transmis']).lt('echeance', auj),
    sb.from('courriers').select('id', { count: 'exact', head: true }).gte('echeance', auj).lte('echeance', d8).not('statut', 'in', '(traite,classe,annule,brouillon)'),
    sb.from('courriers').select('sens,date_evenement').gte('date_evenement', d7).lte('date_evenement', auj).neq('statut', 'brouillon'),
    sb.from('evenements').select('*, courriers(numero_ordre)').gte('debut', new Date(auj).toISOString()).lte('debut', new Date(d8 + 'T23:59:59').toISOString()).eq('statut', 'a_venir').order('debut').limit(6),
  ]);
  const lj = jour.data || [];
  const nArr = lj.filter((c) => c.sens === 'arrivee').length, nDep = lj.filter((c) => c.sens === 'depart').length;
  // 7 jours
  const jours = [...Array(7)].map((_, i) => iso(ajouterJours(new Date(), i - 6)));
  const comptes = jours.map((j) => ({ j, a: (sept.data || []).filter((c) => c.date_evenement === j && c.sens === 'arrivee').length, d: (sept.data || []).filter((c) => c.date_evenement === j && c.sens === 'depart').length }));
  const max = Math.max(1, ...comptes.map((c) => Math.max(c.a, c.d)));
  const alertes = (evs.data || []).map((e) => {
    const d = new Date(e.debut); const diff = Math.round((new Date(iso(d)) - new Date(auj)) / 86400000);
    return `<a class="alerte ${diff <= 2 ? 'urgent' : ''}" href="#/agenda/${iso(d)}" style="text-decoration:none;color:inherit"><div class="date"><div class="j">${JOURS_C[d.getDay()].toUpperCase()}</div><div class="n">${d.getDate()}</div></div><div><div class="t">${esc(e.titre)}</div><div class="s">${e.type === 'reunion' ? pad(d.getHours()) + 'h' + pad(d.getMinutes()) + ' · ' : ''}${esc(e.lieu || '')}${e.courriers?.numero_ordre ? ' · ' + e.courriers.numero_ordre : ''}</div>${diff <= 2 ? `<div class="s" style="color:var(--bordeaux);font-weight:600">${diff === 0 ? "Aujourd'hui" : diff === 1 ? 'Demain' : 'Dans 2 jours'}</div>` : ''}</div></a>`;
  }).join('') || `<div class="vide">Aucune alerte dans les 7 prochains jours.</div>`;

  vue.innerHTML = `
  <header class="entete"><div class="titre"><div class="fil">${dateLongue(new Date())}</div><h1>Tableau de bord</h1></div>
    <div class="actions">
      <form id="frech" style="display:flex;gap:8px"><label class="sr" for="q">Rechercher</label><input id="q" class="recherche" type="search" placeholder="Rechercher par n°, expéditeur, objet…" style="width:280px;height:44px"></form>
      ${peutEcrire() ? `<a class="btn principal" href="#/enregistrer/arrivee">${ICONES.plus}Enregistrer un courrier</a>` : ''}
    </div></header>
  <section class="grille4" aria-label="Chiffres du jour">
    <div class="carte kpi"><div class="lib">Arrivées aujourd'hui</div><div class="val">${nArr}</div><div class="det">${lj.filter((c) => c.sens === 'arrivee' && c.statut === 'transmis').length} transmis</div></div>
    <div class="carte kpi"><div class="lib">Départs aujourd'hui</div><div class="val">${nDep}</div><div class="det">${lj.filter((c) => c.sens === 'depart' && c.mode_envoi).map((c) => MODES[c.mode_envoi]).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '—'}</div></div>
    <div class="carte kpi"><div class="lib">En attente de traitement</div><div class="val" style="color:var(--ambre)">${attente.count ?? 0}</div><div class="det">dont ${retard.count ?? 0} en retard</div></div>
    <div class="carte kpi"><div class="lib">Échéances sous 7 jours</div><div class="val" style="color:var(--bordeaux)">${echeances.count ?? 0}</div><div class="det">${(evs.data || [])[0] ? 'prochaine : ' + fmtDate((evs.data || [])[0].debut) : 'rien de prévu'}</div></div>
  </section>
  <div class="grille3">
    <section class="carte plein span2" aria-label="Courriers du jour">
      <div class="tete"><h2>Courriers du jour</h2><a href="#/arrivees" style="font-size:13px;font-weight:500">Voir le registre</a></div>
      <div class="defile">${tableCourriers(lj, ['numero', 'contact', 'objet', 'type', 'statut'])}</div>
    </section>
    <section class="carte" aria-label="Alertes à venir"><div class="tete"><h2>Alertes à venir</h2><a href="#/agenda" style="font-size:13px;font-weight:500">Agenda</a></div>${alertes}</section>
  </div>
  <section class="carte" aria-label="Activité des 7 derniers jours">
    <div class="tete"><h2>Activité des 7 derniers jours</h2><div class="legende"><span><i style="background:var(--vert-fonce)"></i>Arrivées</span><span><i style="background:var(--corail)"></i>Départs</span></div></div>
    <div class="barres" role="img" aria-label="Arrivées et départs par jour sur 7 jours">${comptes.map((c) => { const d = new Date(c.j); return `<div class="col"><div class="duo"><div class="arr" style="height:${Math.round(c.a / max * 100)}%" title="${c.a} arrivée(s)"></div><div class="dep" style="height:${Math.round(c.d / max * 100)}%" title="${c.d} départ(s)"></div></div><div class="lib">${JOURS_C[d.getDay()]} ${d.getDate()}</div></div>`; }).join('')}</div>
  </section>`;
  vue.querySelector('#frech').addEventListener('submit', (e) => { e.preventDefault(); sessionStorage.setItem('nexora_q', vue.querySelector('#q').value); naviguer('#/arrivees'); });
  lierLignes(vue);
}

function tableCourriers(liste, cols) {
  if (!liste.length) return `<div class="vide">Aucun courrier.</div>`;
  const entetes = { numero: "N° d'ordre", date: 'Date', contact: 'Expéditeur / Destinataire', objet: 'Objet', type: 'Type', service: 'Service', echeance: 'Échéance', statut: 'Statut', scan: 'Scan' };
  const cellule = (c, col) => {
    switch (col) {
      case 'numero': return `<td>${numero(c)}</td>`;
      case 'date': return `<td>${fmtDate(c.date_evenement)}</td>`;
      case 'contact': return `<td>${esc(c.contact_nom)}</td>`;
      case 'objet': return `<td>${esc(c.objet)}</td>`;
      case 'type': return `<td>${esc(c.type_nom || '')}</td>`;
      case 'service': return `<td>${esc(c.service_nom || '')}</td>`;
      case 'echeance': return `<td style="${c.echeance && c.echeance < aujourdhui() ? 'color:var(--bordeaux);font-weight:600' : ''}">${fmtDate(c.echeance)}</td>`;
      case 'statut': return `<td>${chipStatut(c)}</td>`;
      case 'scan': return `<td>${c.nb_pieces > 0 ? `<span class="chip gris">${c.nb_pieces} fichier${c.nb_pieces > 1 ? 's' : ''}</span>` : '—'}</td>`;
    }
  };
  return `<table><thead><tr>${cols.map((c) => `<th>${entetes[c]}</th>`).join('')}</tr></thead><tbody>${liste.map((c) => `<tr class="ligne" data-id="${c.id}" tabindex="0">${cols.map((col) => cellule(c, col)).join('')}</tr>`).join('')}</tbody></table>`;
}
function lierLignes(vue) {
  vue.querySelectorAll('tr.ligne').forEach((tr) => {
    const ouvrir = () => naviguer('#/courrier/' + tr.dataset.id);
    tr.addEventListener('click', ouvrir); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') ouvrir(); });
  });
}

// ------------------------------------------------------------------
// Registre (arrivées / départs)
// ------------------------------------------------------------------
const filtres = { periode: 'semaine', q: '', type: '', statut: '', page: 0 };
async function vueRegistre(sens) {
  const estArr = sens === 'arrivee';
  const q0 = sessionStorage.getItem('nexora_q'); if (q0 !== null) { filtres.q = q0; filtres.periode = 'tout'; filtres.page = 0; sessionStorage.removeItem('nexora_q'); }
  const vue = coque(estArr ? 'arrivees' : 'departs', `<div class="chargement">Chargement…</div>`);
  const annee = new Date().getFullYear();
  const total = await sb.from('courriers').select('id', { count: 'exact', head: true }).eq('sens', sens).eq('annee', annee).neq('statut', 'brouillon');

  const rendre = async () => {
    const auj = new Date(); let debut = null, fin = null, libelle = '';
    if (filtres.periode === 'jour') { debut = fin = aujourdhui(); libelle = dateLongue(auj); }
    else if (filtres.periode === 'semaine') { const l = lundiDe(auj); debut = iso(l); fin = iso(ajouterJours(l, 6)); libelle = `Semaine du ${fmtDate(debut)} au ${fmtDate(fin)}`; }
    else if (filtres.periode === 'mois') { debut = `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}-01`; fin = iso(new Date(auj.getFullYear(), auj.getMonth() + 1, 0)); libelle = `${MOIS[auj.getMonth()]} ${auj.getFullYear()}`; }
    else if (filtres.periode === 'annee') { debut = `${annee}-01-01`; fin = `${annee}-12-31`; libelle = `Année ${annee}`; }
    else libelle = 'Toutes les périodes';
    const taille = 15;
    let req = sb.from('v_courriers').select('*', { count: 'exact' }).eq('sens', sens).order('date_evenement', { ascending: false }).order('cree_le', { ascending: false }).range(filtres.page * taille, filtres.page * taille + taille - 1);
    if (debut) req = req.gte('date_evenement', debut).lte('date_evenement', fin);
    if (filtres.type) req = req.eq('type_id', filtres.type);
    if (filtres.statut) req = req.eq('statut', filtres.statut); else req = req.neq('statut', 'brouillon');
    if (filtres.q) { const t = `%${filtres.q.replace(/[%_]/g, '')}%`; req = req.or(`objet.ilike.${t},contact_nom.ilike.${t},numero_ordre.ilike.${t},reference_externe.ilike.${t},resume.ilike.${t}`); }
    const { data, count, error } = await req; if (error) throw error;
    const liste = data || [];
    const nAttente = liste.filter((c) => ['recu', 'a_traiter', 'transmis'].includes(c.statut)).length;
    const nRetard = liste.filter((c) => c.echeance && c.echeance < aujourdhui() && !['traite', 'classe', 'envoye', 'annule'].includes(c.statut)).length;
    const nbPages = Math.max(1, Math.ceil((count || 0) / taille));

    vue.innerHTML = `
    <header class="entete"><div class="titre"><div class="fil">Registre officiel · ${total.count ?? 0} ${estArr ? 'arrivées' : 'départs'} enregistré${(total.count ?? 0) > 1 ? 's' : ''} en ${annee}</div><h1>${estArr ? 'Courrier arrivée' : 'Courrier départ'}</h1></div>
      <div class="actions"><button class="btn" id="bexcel" type="button">${ICONES.telecharger}Exporter Excel</button>${peutEcrire() ? `<a class="btn principal" href="#/enregistrer/${sens}">${ICONES.plus}Enregistrer ${estArr ? 'une arrivée' : 'un départ'}</a>` : ''}</div></header>
    <form class="carte" id="ffiltres" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 16px" aria-label="Filtres">
      <div class="seg" role="group" aria-label="Période">${[['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['annee', 'Année'], ['tout', 'Tout']].map(([v, l]) => `<button type="button" data-p="${v}" class="${filtres.periode === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="sr" for="fq">Rechercher</label><input id="fq" class="recherche" type="search" placeholder="Rechercher par n°, expéditeur, objet, mot-clé…" value="${esc(filtres.q)}" style="flex:1 1 240px">
      <label for="ft" style="font-size:13px;color:var(--muet)">Type</label><select id="ft" class="filtre-select"><option value="">Tous</option>${etat.types.filter((t) => t.sens === 'les_deux' || t.sens === sens).map((t) => `<option value="${t.id}" ${filtres.type === t.id ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select>
      <label for="fs" style="font-size:13px;color:var(--muet)">Statut</label><select id="fs" class="filtre-select"><option value="">Tous</option>${Object.entries(STATUTS).filter(([k]) => k !== 'brouillon').map(([k, [l]]) => `<option value="${k}" ${filtres.statut === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn petit" type="submit">Filtrer</button>
    </form>
    <div class="resume-ligne"><span>${esc(libelle)}</span><span>·</span><span><strong style="color:var(--vert-fonce)">${count ?? 0}</strong> courrier${(count ?? 0) > 1 ? 's' : ''}</span><span>·</span><span><strong style="color:var(--ambre)">${nAttente}</strong> à traiter</span><span>·</span><span><strong style="color:var(--bordeaux)">${nRetard}</strong> en retard</span></div>
    <section class="carte plein"><div class="defile">${tableCourriers(liste, ['numero', 'date', 'contact', 'objet', 'type', 'service', 'echeance', 'statut', 'scan'])}</div>
      <div class="pied"><span>Page ${filtres.page + 1} sur ${nbPages}</span><div style="display:flex;gap:6px"><button class="ico" id="pprec" type="button" aria-label="Page précédente" ${filtres.page === 0 ? 'disabled' : ''}>${ICONES.gauche}</button><button class="ico" id="psuiv" type="button" aria-label="Page suivante" ${filtres.page + 1 >= nbPages ? 'disabled' : ''}>${ICONES.droite}</button></div></div></section>`;

    vue.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { filtres.periode = b.dataset.p; filtres.page = 0; rendre(); });
    vue.querySelector('#ffiltres').onsubmit = (e) => { e.preventDefault(); filtres.q = vue.querySelector('#fq').value.trim(); filtres.type = vue.querySelector('#ft').value; filtres.statut = vue.querySelector('#fs').value; filtres.page = 0; rendre(); };
    vue.querySelector('#pprec').onclick = () => { filtres.page--; rendre(); };
    vue.querySelector('#psuiv').onclick = () => { filtres.page++; rendre(); };
    vue.querySelector('#bexcel').onclick = async () => {
      let r = sb.from('v_courriers').select('*').eq('sens', sens).neq('statut', 'brouillon').order('date_evenement');
      if (debut) r = r.gte('date_evenement', debut).lte('date_evenement', fin);
      const { data: tout } = await r;
      exporterExcel(tout || [], `NEXORA_${estArr ? 'arrivees' : 'departs'}_${(libelle || 'tout').replace(/[^\w]+/g, '_')}.xlsx`);
    };
    lierLignes(vue);
  };
  await rendre();
}

function exporterExcel(liste, nomFichier) {
  const lignes = liste.map((c) => ({
    'N° d\'ordre': c.numero_ordre, 'Sens': c.sens === 'arrivee' ? 'Arrivée' : 'Départ', 'Date': fmtDate(c.date_evenement), 'Date du courrier': fmtDate(c.date_courrier),
    'Référence': c.reference_externe || '', 'Expéditeur / Destinataire': c.contact_nom, 'Objet': c.objet, 'Type': c.type_nom || '', 'Catégorie': c.categorie_nom || '',
    'Service': c.service_nom || '', 'Signataire': c.signataire || '', 'Mode d\'envoi': MODES[c.mode_envoi] || '', 'Urgence': URGENCES[c.urgence] || '', 'Échéance': fmtDate(c.echeance),
    'Statut': (STATUTS[c.statut] || [c.statut])[0], 'Résumé': c.resume || '', 'Action demandée': c.action_demandee || '', 'Observations': c.observations || '', 'Pièces jointes': c.nb_pieces || 0,
  }));
  const ws = XLSX.utils.json_to_sheet(lignes); ws['!cols'] = Object.keys(lignes[0] || { a: 1 }).map((k) => ({ wch: Math.min(60, Math.max(12, k.length + 4)) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Registre'); XLSX.writeFile(wb, nomFichier);
  toast('Export Excel généré.');
}

// ------------------------------------------------------------------
// Enregistrer un courrier
// ------------------------------------------------------------------
async function vueEnregistrer(sens) {
  if (!peutEcrire()) return naviguer('#/tableau');
  const estArr = sens === 'arrivee';
  const vue = coque(estArr ? 'arrivees' : 'departs', '');
  let fichier = null; let lecture = null;
  const opt = (liste, val) => liste.map((x) => `<option value="${x.id}" ${x.id === val ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
  const { data: arrivees } = estArr ? { data: [] } : await sb.from('courriers').select('id,numero_ordre,objet').eq('sens', 'arrivee').neq('statut', 'brouillon').order('cree_le', { ascending: false }).limit(200);

  vue.innerHTML = `
  <header class="entete"><div class="titre"><div class="fil"><a href="#/${estArr ? 'arrivees' : 'departs'}" style="text-decoration:none">${estArr ? 'Arrivées' : 'Départs'}</a> · Nouvel enregistrement</div><h1>Enregistrer un courrier ${estArr ? 'arrivée' : 'départ'}</h1></div>
    <div class="actions"><div class="seg" role="group" aria-label="Sens"><button type="button" class="${estArr ? 'on' : ''}" id="sa">Arrivée</button><button type="button" class="${estArr ? '' : 'on'}" id="sd">Départ</button></div><div id="etat-lecture"></div></div></header>
  <div style="display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:20px;align-items:start" class="deux-col">
    <section class="carte" aria-label="Document scanné">
      <div class="tete"><h2>Scan du courrier</h2></div>
      <label class="zone-depot" id="zone" for="fich"><input id="fich" type="file" accept="application/pdf,image/*" class="sr"><div>${ICONES.scan}</div><div><strong>Cliquez pour choisir le fichier</strong> ou déposez-le ici</div><div style="font-size:12px;margin-top:4px">PDF, JPEG ou PNG · 25 Mo max</div></label>
      <div id="fichier-info"></div>
      <button class="btn vert" type="button" id="blire" disabled style="justify-content:center">${ICONES.scan}Lecture automatique du courrier</button>
      <div style="font-size:12px;color:var(--muet)">La lecture automatique préremplit la fiche. Vous vérifiez, puis vous validez : le numéro d'ordre n'est attribué qu'à la validation.</div>
      <div id="apercu"></div>
    </section>
    <form class="carte" id="ffiche" aria-label="Fiche du courrier">
      <div class="tete"><h2>Fiche du registre</h2><div style="font-size:13px;color:var(--muet)">N° d'ordre attribué à la validation</div></div>
      <div class="grille2">
        <div class="champ"><label for="contact">${estArr ? 'Expéditeur' : 'Destinataire'} <span id="d-contact"></span></label><input id="contact" required list="lcontacts"><datalist id="lcontacts"></datalist></div>
        <div class="champ"><label for="ref">Référence du courrier <span id="d-ref"></span></label><input id="ref" placeholder="N° chez l'expéditeur"></div>
        <div class="champ"><label for="dcour">Date du courrier <span id="d-dcour"></span></label><input id="dcour" type="date"></div>
        <div class="champ"><label for="devt">${estArr ? 'Date de réception' : "Date d'envoi"}</label><input id="devt" type="date" value="${aujourdhui()}" required></div>
        <div class="champ span2"><label for="objet">Objet <span id="d-objet"></span></label><input id="objet" required></div>
        <div class="champ"><label for="type">Type de courrier <span id="d-type"></span></label><select id="type"><option value="">—</option>${opt(etat.types.filter((t) => t.sens === 'les_deux' || t.sens === sens))}</select></div>
        <div class="champ"><label for="service">${estArr ? 'Destinataire interne' : 'Service émetteur'} <span id="d-service"></span></label><select id="service"><option value="">—</option>${opt(etat.services, etat.profil.service_id)}</select></div>
        <div class="champ"><label for="urgence">Niveau d'urgence <span id="d-urgence"></span></label><select id="urgence">${Object.entries(URGENCES).map(([k, l]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="champ"><label for="cat">Catégorie</label><select id="cat"><option value="">—</option>${opt(etat.categories)}</select></div>
        ${estArr ? '' : `<div class="champ"><label for="sign">Signataire</label><input id="sign" placeholder="Qui signe le courrier"></div>
        <div class="champ"><label for="mode">Mode d'envoi</label><select id="mode">${Object.entries(MODES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="champ span2"><label for="lie">En réponse au courrier arrivée</label><select id="lie"><option value="">— Aucun —</option>${(arrivees || []).map((a) => `<option value="${a.id}">${esc(a.numero_ordre)} · ${esc(a.objet).slice(0, 70)}</option>`).join('')}</select></div>`}
        <div class="champ"><label for="echeance">Échéance <span id="d-echeance"></span></label><input id="echeance" type="date"></div>
        <div class="champ"><label><input type="checkbox" id="conf" style="width:18px;height:18px;accent-color:var(--vert-fonce)"> Courrier confidentiel</label><span class="aide">Exclu de la lecture automatique.</span></div>
      </div>
      <div class="champ"><label for="resume">Résumé <span id="d-resume"></span></label><textarea id="resume" rows="3"></textarea></div>
      <div class="champ"><label for="action">Action demandée <span id="d-action"></span></label><input id="action" placeholder="Répondre, payer, assister, transmettre…"></div>
      <fieldset id="fevs" style="border:1px solid var(--bord);border-radius:12px;padding:14px 16px;margin:0;display:none;flex-direction:column;gap:10px"><legend style="font-size:13px;font-weight:600;padding:0 6px">Dates détectées · ajouter à l'agenda</legend></fieldset>
      <div class="champ"><label for="obs">Observations</label><input id="obs" placeholder="Remarque libre, instruction de la direction…"></div>
      <div class="ligne-boutons"><button class="btn discret" type="button" id="bbrouillon">Enregistrer comme brouillon</button><button class="btn principal" type="submit" id="bvalider">Valider et attribuer le n° d'ordre</button></div>
    </form>
  </div>
  <style>@media (max-width:980px){.deux-col{grid-template-columns:1fr !important}}</style>`;

  vue.querySelector('#sa').onclick = () => naviguer('#/enregistrer/arrivee');
  vue.querySelector('#sd').onclick = () => naviguer('#/enregistrer/depart');
  // contacts pour l'autocomplétion
  sb.from('contacts').select('nom').order('nom').limit(500).then(({ data }) => { vue.querySelector('#lcontacts').innerHTML = (data || []).map((c) => `<option value="${esc(c.nom)}">`).join(''); });

  const zone = vue.querySelector('#zone'), inputF = vue.querySelector('#fich'), info = vue.querySelector('#fichier-info'), blire = vue.querySelector('#blire'), apercu = vue.querySelector('#apercu');
  const prendreFichier = (f) => {
    if (!f) return; if (f.size > 25 * 1024 * 1024) return toast('Fichier trop volumineux (25 Mo max).', true);
    fichier = f; blire.disabled = false;
    info.innerHTML = `<div class="fichier">${ICONES.fichier}<div style="min-width:0"><div class="n">${esc(f.name)}</div><div class="s">${(f.size / 1024 / 1024).toFixed(2)} Mo</div></div></div>`;
    apercu.innerHTML = f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="Aperçu du scan" style="width:100%;border-radius:10px;border:1px solid var(--bord)">` : f.type === 'application/pdf' ? `<iframe src="${URL.createObjectURL(f)}" title="Aperçu du PDF" style="width:100%;height:560px;border:1px solid var(--bord);border-radius:10px"></iframe>` : '';
  };
  inputF.onchange = () => prendreFichier(inputF.files[0]);
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('actif'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('actif'); }));
  zone.addEventListener('drop', (e) => prendreFichier(e.dataTransfer.files[0]));

  // Lecture automatique (Edge Function "lire-courrier")
  blire.onclick = async () => {
    if (!fichier) return;
    if (vue.querySelector('#conf').checked) return toast('Courrier confidentiel : lecture automatique désactivée.', true);
    blire.disabled = true; blire.innerHTML = `${ICONES.scan}Lecture en cours…`;
    vue.querySelector('#etat-lecture').innerHTML = `<div class="bandeau ambre">Lecture du document en cours…</div>`;
    try {
      const fd = new FormData(); fd.append('fichier', fichier); fd.append('sens', sens);
      fd.append('services', JSON.stringify(etat.services.map((s) => s.nom))); fd.append('types', JSON.stringify(etat.types.map((t) => t.nom)));
      const { data, error } = await sb.functions.invoke('lire-courrier', { body: fd });
      if (error) throw error;
      lecture = data; appliquerLecture(data);
      vue.querySelector('#etat-lecture').innerHTML = `<div class="bandeau vert">${ICONES.ok}Lecture terminée · ${data.champs ? Object.keys(data.champs).length : 0} champs détectés${data.a_verifier?.length ? ` · ${data.a_verifier.length} à vérifier` : ''}</div>`;
    } catch (err) {
      console.error(err);
      vue.querySelector('#etat-lecture').innerHTML = `<div class="bandeau corail">Lecture automatique indisponible pour le moment. Remplissez la fiche à la main.</div>`;
    }
    blire.disabled = false; blire.innerHTML = `${ICONES.scan}Relancer la lecture automatique`;
  };
  const marquer = (id, etatC) => { const ch = vue.querySelector('#' + id)?.closest('.champ'); if (!ch) return; ch.classList.remove('ok', 'verif'); ch.classList.add(etatC); const d = vue.querySelector('#d-' + id); if (d) d.innerHTML = etatC === 'ok' ? '<span class="det">détecté</span>' : '<span class="ver">à vérifier</span>'; };
  const appliquerLecture = (r) => {
    const ch = r.champs || {}; const av = new Set(r.a_verifier || []);
    const mettre = (id, val) => { if (val === undefined || val === null || val === '') return; const el = vue.querySelector('#' + id); if (!el) return; el.value = val; marquer(id, av.has(id) ? 'verif' : 'ok'); };
    mettre('contact', ch.contact); mettre('ref', ch.reference); mettre('dcour', ch.date_courrier); mettre('objet', ch.objet); mettre('resume', ch.resume); mettre('action', ch.action_demandee); mettre('echeance', ch.echeance);
    if (ch.urgence && URGENCES[ch.urgence]) mettre('urgence', ch.urgence);
    const typ = etat.types.find((t) => t.nom.toLowerCase() === String(ch.type || '').toLowerCase()); if (typ) mettre('type', typ.id);
    const srv = etat.services.find((s) => s.nom.toLowerCase() === String(ch.service || '').toLowerCase()); if (srv) mettre('service', srv.id);
    const fs = vue.querySelector('#fevs'); const evs = r.evenements || [];
    if (evs.length) { fs.style.display = 'flex'; fs.innerHTML = `<legend style="font-size:13px;font-weight:600;padding:0 6px">Dates détectées · ajouter à l'agenda</legend>` + evs.map((e, i) => `<label style="display:flex;align-items:center;gap:12px;font-size:14px;cursor:pointer"><input type="checkbox" data-ev="${i}" checked style="width:18px;height:18px;accent-color:var(--vert-fonce)"><span style="flex:1"><strong>${fmtDateHeure(e.debut)}</strong> — ${esc(e.titre)}${e.lieu ? ' · ' + esc(e.lieu) : ''}</span><span style="font-size:12px;color:var(--muet)">Rappels J-7, J-2, J-1</span></label>`).join(''); }
  };

  const enregistrer = async (statutFinal) => {
    const v = (id) => vue.querySelector('#' + id)?.value?.trim() || null;
    if (!v('contact') || !v('objet')) return toast("L'expéditeur et l'objet sont obligatoires.", true);
    const bb = vue.querySelector('#bbrouillon'), bv = vue.querySelector('#bvalider'); bb.disabled = bv.disabled = true;
    try {
      // contact
      let contact_id = null; const { data: cx } = await sb.from('contacts').select('id').ilike('nom', v('contact')).maybeSingle();
      if (cx) contact_id = cx.id; else { const { data: nc } = await sb.from('contacts').insert({ nom: v('contact') }).select('id').single(); contact_id = nc?.id; }
      const ligne = {
        sens, statut: statutFinal, contact_id, contact_nom: v('contact'), reference_externe: v('ref'), date_courrier: v('dcour'), date_evenement: v('devt') || aujourdhui(),
        annee: Number((v('devt') || aujourdhui()).slice(0, 4)), objet: v('objet'), type_id: v('type'), service_id: v('service'), urgence: v('urgence') || 'normal', categorie_id: v('cat'),
        signataire: v('sign'), mode_envoi: v('mode'), courrier_lie_id: v('lie'), echeance: v('echeance'), confidentiel: vue.querySelector('#conf').checked, resume: v('resume'), action_demandee: v('action'),
        observations: v('obs'), cree_par: etat.profil.id, lecture_auto: lecture, lecture_auto_le: lecture ? new Date().toISOString() : null,
      };
      const { data: c, error } = await sb.from('courriers').insert(ligne).select('*').single(); if (error) throw error;
      // scan
      if (fichier) {
        const d = new Date(c.date_evenement); const ext = fichier.name.split('.').pop().toLowerCase();
        const chemin = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${sens === 'arrivee' ? 'arrivees' : 'departs'}/${c.id}/scan.${ext}`;
        const { error: eu } = await sb.storage.from('courriers').upload(chemin, fichier, { contentType: fichier.type, upsert: true }); if (eu) throw eu;
        await sb.from('pieces_jointes').insert({ courrier_id: c.id, nom_fichier: fichier.name, chemin_storage: chemin, type_mime: fichier.type, taille_octets: fichier.size, cree_par: etat.profil.id });
      }
      // événements détectés
      const cases = [...vue.querySelectorAll('[data-ev]:checked')];
      for (const cb of cases) { const e = (lecture?.evenements || [])[Number(cb.dataset.ev)]; if (e) await creerEvenement({ courrier_id: c.id, titre: e.titre, type: e.type || 'echeance', debut: e.debut, lieu: e.lieu || null, description: e.description || null }); }
      if (statutFinal !== 'brouillon' && c.echeance && !cases.length) await creerEvenement({ courrier_id: c.id, titre: `Échéance · ${c.objet}`.slice(0, 120), type: 'echeance', debut: c.echeance + 'T08:00:00' });
      toast(statutFinal === 'brouillon' ? 'Brouillon enregistré.' : `Courrier enregistré sous le n° ${c.numero_ordre}.`);
      naviguer('#/courrier/' + c.id);
    } catch (err) { console.error(err); toast('Enregistrement impossible : ' + (err.message || err), true); bb.disabled = bv.disabled = false; }
  };
  vue.querySelector('#ffiche').onsubmit = (e) => { e.preventDefault(); enregistrer(estArr ? 'recu' : 'envoye'); };
  vue.querySelector('#bbrouillon').onclick = () => enregistrer('brouillon');
}

async function creerEvenement(e) {
  const { data: ev, error } = await sb.from('evenements').insert({ ...e, cree_par: etat.profil.id }).select('id,debut').single(); if (error) throw error;
  const debut = new Date(ev.debut); const rappels = [];
  for (const j of [7, 2, 1]) { const r = ajouterJours(debut, -j); r.setHours(8, 0, 0, 0); if (r > new Date()) rappels.push({ evenement_id: ev.id, declenche_le: r.toISOString(), canal: 'app' }); }
  if (rappels.length) await sb.from('rappels').insert(rappels);
  return ev;
}

// ------------------------------------------------------------------
// Fiche d'un courrier
// ------------------------------------------------------------------
async function vueCourrier(id) {
  const vue = coque('arrivees', `<div class="chargement">Chargement…</div>`);
  const [{ data: c }, { data: pjs }, { data: trs }, { data: evs }] = await Promise.all([
    sb.from('v_courriers').select('*').eq('id', id).maybeSingle(),
    sb.from('pieces_jointes').select('*').eq('courrier_id', id).order('cree_le'),
    sb.from('transmissions').select('*, services(nom)').eq('courrier_id', id).order('transmis_le'),
    sb.from('evenements').select('*').eq('courrier_id', id).order('debut'),
  ]);
  if (!c) { vue.innerHTML = `<div class="vide">Courrier introuvable.</div>`; return; }
  const estArr = c.sens === 'arrivee';
  let lie = null; if (c.courrier_lie_id) { const { data } = await sb.from('courriers').select('id,numero_ordre,objet').eq('id', c.courrier_lie_id).maybeSingle(); lie = data; }
  const { data: reponses } = await sb.from('courriers').select('id,numero_ordre,objet,date_evenement').eq('courrier_lie_id', id);
  const liens = await Promise.all((pjs || []).map(async (p) => { const { data } = await sb.storage.from('courriers').createSignedUrl(p.chemin_storage, 3600); return { ...p, url: data?.signedUrl }; }));
  const champ = (lib, val) => `<dt>${lib}</dt><dd>${val || '—'}</dd>`;
  const statutsPossibles = estArr ? ['recu', 'transmis', 'a_traiter', 'traite', 'classe'] : ['envoye', 'classe'];

  vue.innerHTML = `
  <header class="entete"><div class="titre"><div class="fil"><a href="#/${estArr ? 'arrivees' : 'departs'}" style="text-decoration:none">${estArr ? 'Arrivées' : 'Départs'}</a> · ${c.numero_ordre || 'Brouillon'}</div><h1 style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">${esc(c.numero_ordre || 'Brouillon')} ${chipStatut(c)}${c.confidentiel ? '<span class="chip corail">Confidentiel</span>' : ''}</h1><div style="font-size:15px;margin-top:4px">${esc(c.objet)}</div></div>
    <div class="actions">${peutEcrire() && c.statut !== 'annule' ? `${c.statut === 'brouillon' ? `<button class="btn principal" id="bvalider">Valider et attribuer le n°</button>` : `<select id="sstatut" class="filtre-select" style="height:44px" aria-label="Changer le statut">${statutsPossibles.map((s) => `<option value="${s}" ${c.statut === s ? 'selected' : ''}>${STATUTS[s][0]}</option>`).join('')}</select>`}
      ${estArr && c.statut !== 'brouillon' ? `<a class="btn vert" href="#/enregistrer/depart">Répondre (départ)</a>` : ''}<button class="btn danger" id="bannuler">Annuler</button>` : ''}</div></header>
  <div class="grille3">
    <section class="carte span2">
      <div class="tete"><h2>Fiche du registre</h2><span style="font-size:12px;color:var(--muet)">Enregistré le ${fmtDateHeure(c.cree_le)}</span></div>
      <dl class="fiche grille2" style="margin:0">
        ${champ(estArr ? 'Expéditeur' : 'Destinataire', esc(c.contact_nom))}${champ('Référence du courrier', esc(c.reference_externe))}
        ${champ('Date du courrier', fmtDate(c.date_courrier))}${champ(estArr ? 'Date de réception' : "Date d'envoi", fmtDate(c.date_evenement))}
        ${champ('Type', esc(c.type_nom))}${champ(estArr ? 'Destinataire interne' : 'Service émetteur', esc(c.service_nom))}
        ${champ('Catégorie', esc(c.categorie_nom))}${champ('Urgence', URGENCES[c.urgence])}
        ${estArr ? '' : champ('Signataire', esc(c.signataire)) + champ("Mode d'envoi", MODES[c.mode_envoi])}
        ${champ('Échéance', fmtDate(c.echeance))}${champ('Action demandée', esc(c.action_demandee))}
        ${lie ? champ('En réponse à', `<a href="#/courrier/${lie.id}">${esc(lie.numero_ordre)}</a> · ${esc(lie.objet)}`) : ''}
        ${(reponses || []).length ? champ('Réponses', reponses.map((r) => `<a href="#/courrier/${r.id}">${esc(r.numero_ordre)}</a> (${fmtDate(r.date_evenement)})`).join('<br>')) : ''}
      </dl>
      ${c.resume ? `<div><div class="fiche"><dt>Résumé</dt></div><div style="padding:10px 12px;background:var(--fond);border-radius:10px">${esc(c.resume)}</div></div>` : ''}
      ${c.observations ? `<div class="fiche"><dt>Observations</dt><dd>${esc(c.observations)}</dd></div>` : ''}
      ${c.statut === 'annule' ? `<div class="bandeau corail">Annulé le ${fmtDateHeure(c.annule_le)} · ${esc(c.annule_motif)}</div>` : ''}
    </section>
    <div style="display:flex;flex-direction:column;gap:20px">
      <section class="carte"><div class="tete"><h2>Scans</h2>${peutEcrire() ? `<label class="btn petit" for="ajpj" style="cursor:pointer">${ICONES.plus}Ajouter</label><input id="ajpj" type="file" class="sr" accept="application/pdf,image/*">` : ''}</div>
        ${liens.length ? liens.map((p) => `<a class="fichier" href="${p.url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">${ICONES.fichier}<div style="min-width:0"><div class="n">${esc(p.nom_fichier)}</div><div class="s">${p.taille_octets ? (p.taille_octets / 1024 / 1024).toFixed(2) + ' Mo · ' : ''}${fmtDate(p.cree_le)}</div></div></a>`).join('') : `<div class="vide" style="padding:14px">Aucun scan.</div>`}</section>
      <section class="carte"><div class="tete"><h2>Circuit</h2>${peutEcrire() && c.statut !== 'annule' && c.statut !== 'brouillon' ? `<button class="btn petit" id="btrans">${ICONES.plus}Transmettre</button>` : ''}</div>
        ${(trs || []).length ? trs.map((t) => `<div style="padding:10px 12px;background:var(--fond);border-radius:10px;font-size:13px"><div style="font-weight:600">${esc(t.services?.nom || t.vers_personne || '—')}${t.vers_personne && t.services ? ' · ' + esc(t.vers_personne) : ''}</div><div style="color:var(--muet)">Transmis le ${fmtDateHeure(t.transmis_le)}${t.decharge_le ? ' · décharge le ' + fmtDateHeure(t.decharge_le) : ''}</div>${t.note ? `<div>${esc(t.note)}</div>` : ''}${!t.decharge_le && peutEcrire() ? `<button class="btn petit" data-decharge="${t.id}" style="margin-top:6px">Confirmer la décharge</button>` : ''}</div>`).join('') : `<div class="vide" style="padding:14px">Aucune transmission.</div>`}</section>
      <section class="carte"><div class="tete"><h2>Agenda</h2>${peutEcrire() && c.statut !== 'annule' ? `<button class="btn petit" id="bev">${ICONES.plus}Événement</button>` : ''}</div>
        ${(evs || []).length ? evs.map((e) => `<a class="ev ${e.type} ${e.statut === 'fait' ? 'fait' : ''}" href="#/agenda/${iso(new Date(e.debut))}" style="text-decoration:none"><b>${esc(e.titre)}</b>${fmtDateHeure(e.debut)}${e.lieu ? ' · ' + esc(e.lieu) : ''}</a>`).join('') : `<div class="vide" style="padding:14px">Aucun événement lié.</div>`}</section>
    </div>
  </div>`;

  vue.querySelector('#bvalider')?.addEventListener('click', async () => { const { error } = await sb.from('courriers').update({ statut: estArr ? 'recu' : 'envoye' }).eq('id', id); if (error) return toast(error.message, true); toast('Courrier validé.'); router(); });
  vue.querySelector('#sstatut')?.addEventListener('change', async (e) => { const { error } = await sb.from('courriers').update({ statut: e.target.value }).eq('id', id); if (error) return toast(error.message, true); toast('Statut mis à jour.'); router(); });
  vue.querySelector('#bannuler')?.addEventListener('click', () => {
    const m = modale(`<h2>Annuler ce courrier</h2><p style="margin:0;color:var(--muet);font-size:13px">Le courrier reste dans le registre avec la mention « annulé » : un registre ne s'efface pas.</p><div class="champ"><label for="motif">Motif de l'annulation</label><input id="motif" required></div><div class="ligne-boutons"><button class="btn" id="mnon">Retour</button><button class="btn danger" id="moui">Confirmer l'annulation</button></div>`);
    m.querySelector('#mnon').onclick = () => m.remove();
    m.querySelector('#moui').onclick = async () => { const motif = m.querySelector('#motif').value.trim(); if (!motif) return toast('Indiquez le motif.', true); const { error } = await sb.from('courriers').update({ statut: 'annule', annule_motif: motif, annule_le: new Date().toISOString() }).eq('id', id); if (error) return toast(error.message, true); m.remove(); toast('Courrier annulé.'); router(); };
  });
  vue.querySelector('#ajpj')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; const d = new Date(c.date_evenement); const ext = f.name.split('.').pop().toLowerCase();
    const chemin = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${estArr ? 'arrivees' : 'departs'}/${c.id}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('courriers').upload(chemin, f, { contentType: f.type }); if (error) return toast(error.message, true);
    await sb.from('pieces_jointes').insert({ courrier_id: c.id, nom_fichier: f.name, chemin_storage: chemin, type_mime: f.type, taille_octets: f.size, principal: false, cree_par: etat.profil.id });
    toast('Fichier ajouté.'); router();
  });
  vue.querySelector('#btrans')?.addEventListener('click', () => {
    const m = modale(`<h2>Transmettre le courrier</h2><div class="champ"><label for="tsrv">Service</label><select id="tsrv"><option value="">—</option>${etat.services.map((s) => `<option value="${s.id}">${esc(s.nom)}</option>`).join('')}</select></div><div class="champ"><label for="tpers">Personne (facultatif)</label><input id="tpers"></div><div class="champ"><label for="tnote">Note</label><input id="tnote"></div><div class="ligne-boutons"><button class="btn" id="mnon">Retour</button><button class="btn principal" id="moui">Transmettre</button></div>`);
    m.querySelector('#mnon').onclick = () => m.remove();
    m.querySelector('#moui').onclick = async () => {
      const { error } = await sb.from('transmissions').insert({ courrier_id: id, vers_service_id: m.querySelector('#tsrv').value || null, vers_personne: m.querySelector('#tpers').value.trim() || null, note: m.querySelector('#tnote').value.trim() || null, cree_par: etat.profil.id });
      if (error) return toast(error.message, true);
      if (['recu', 'a_traiter'].includes(c.statut)) await sb.from('courriers').update({ statut: 'transmis' }).eq('id', id);
      m.remove(); toast('Courrier transmis.'); router();
    };
  });
  vue.querySelectorAll('[data-decharge]').forEach((b) => b.onclick = async () => { await sb.from('transmissions').update({ decharge_le: new Date().toISOString() }).eq('id', b.dataset.decharge); toast('Décharge confirmée.'); router(); });
  vue.querySelector('#bev')?.addEventListener('click', () => modaleEvenement({ courrier_id: id, titre: c.objet }, () => router()));
}

function modaleEvenement(pre = {}, apres) {
  const m = modale(`<h2>${pre.id ? "Modifier l'événement" : 'Nouvel événement'}</h2>
    <div class="champ"><label for="etitre">Titre</label><input id="etitre" value="${esc(pre.titre || '')}" required></div>
    <div class="grille2"><div class="champ"><label for="etype">Type</label><select id="etype">${[['reunion', 'Réunion'], ['echeance', 'Échéance'], ['rappel', 'Rappel'], ['autre', 'Autre']].map(([k, l]) => `<option value="${k}" ${pre.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="champ"><label for="edate">Date et heure</label><input id="edate" type="datetime-local" value="${pre.debut ? pre.debut.slice(0, 16) : ''}" required></div></div>
    <div class="champ"><label for="elieu">Lieu</label><input id="elieu" value="${esc(pre.lieu || '')}"></div>
    <div class="champ"><label for="edesc">Description</label><textarea id="edesc" rows="2">${esc(pre.description || '')}</textarea></div>
    ${pre.id ? '' : '<div style="font-size:12px;color:var(--muet)">Rappels automatiques : J-7, J-2 et J-1 à 8h.</div>'}
    <div class="ligne-boutons">${pre.id ? `<button class="btn discret" id="mfait">${pre.statut === 'fait' ? 'Remettre à venir' : 'Marquer comme fait'}</button><button class="btn danger" id="msuppr">Supprimer</button>` : ''}<button class="btn" id="mnon">Retour</button><button class="btn principal" id="moui">Enregistrer</button></div>`);
  m.querySelector('#mnon').onclick = () => m.remove();
  m.querySelector('#moui').onclick = async () => {
    const e = { titre: m.querySelector('#etitre').value.trim(), type: m.querySelector('#etype').value, debut: new Date(m.querySelector('#edate').value).toISOString(), lieu: m.querySelector('#elieu').value.trim() || null, description: m.querySelector('#edesc').value.trim() || null };
    if (!e.titre || !m.querySelector('#edate').value) return toast('Titre et date obligatoires.', true);
    try { if (pre.id) { const { error } = await sb.from('evenements').update(e).eq('id', pre.id); if (error) throw error; } else await creerEvenement({ ...e, courrier_id: pre.courrier_id || null }); m.remove(); toast('Événement enregistré.'); apres?.(); } catch (err) { toast(err.message, true); }
  };
  m.querySelector('#mfait')?.addEventListener('click', async () => { await sb.from('evenements').update({ statut: pre.statut === 'fait' ? 'a_venir' : 'fait' }).eq('id', pre.id); m.remove(); apres?.(); });
  m.querySelector('#msuppr')?.addEventListener('click', async () => { if (!confirm('Supprimer cet événement ?')) return; await sb.from('evenements').delete().eq('id', pre.id); m.remove(); toast('Événement supprimé.'); apres?.(); });
}

// ------------------------------------------------------------------
// Agenda et alertes
// ------------------------------------------------------------------
async function vueAgenda(dateParam) {
  const vue = coque('agenda', `<div class="chargement">Chargement…</div>`);
  const ref = dateParam ? new Date(dateParam) : new Date(); const lundi = lundiDe(ref); const dim = ajouterJours(lundi, 6);
  const [{ data: evs }, { data: rappels }] = await Promise.all([
    sb.from('evenements').select('*, courriers(numero_ordre)').gte('debut', lundi.toISOString()).lt('debut', ajouterJours(lundi, 7).toISOString()).neq('statut', 'annule').order('debut'),
    sb.from('rappels').select('*, evenements(titre,debut,type,statut)').lte('declenche_le', new Date().toISOString()).is('lu_le', null).order('declenche_le', { ascending: false }).limit(20),
  ]);
  const ouverts = (rappels || []).filter((r) => r.evenements && r.evenements.statut === 'a_venir');
  const auj = aujourdhui();
  const jours = [...Array(7)].map((_, i) => { const d = ajouterJours(lundi, i); const j = iso(d); return { d, j, evs: (evs || []).filter((e) => iso(new Date(e.debut)) === j) }; });
  const diff = (s) => Math.round((new Date(iso(new Date(s))) - new Date(auj)) / 86400000);
  const libDiff = (n) => n < 0 ? `Il y a ${-n} j` : n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : `Dans ${n} jours`;

  vue.innerHTML = `
  <header class="entete"><div class="titre"><div class="fil">Semaine du ${fmtDate(lundi)} au ${fmtDate(dim)}</div><h1>Agenda et alertes</h1></div>
    <div class="actions"><a class="ico" href="#/agenda/${iso(ajouterJours(lundi, -7))}" aria-label="Semaine précédente" style="width:38px;height:38px;border-radius:10px">${ICONES.gauche}</a><a class="btn petit" href="#/agenda">Aujourd'hui</a><a class="ico" href="#/agenda/${iso(ajouterJours(lundi, 7))}" aria-label="Semaine suivante" style="width:38px;height:38px;border-radius:10px">${ICONES.droite}</a>
    ${peutEcrire() ? `<button class="btn principal" id="bnouv">${ICONES.plus}Nouvel événement</button>` : ''}</div></header>
  <div style="display:grid;grid-template-columns:minmax(0,8fr) minmax(0,3fr);gap:20px;align-items:start" class="deux-col">
    <section class="carte plein semaine" aria-label="Semaine">${jours.map(({ d, j, evs: le }) => `<div class="jour ${j === auj ? 'auj' : ''}"><div class="dh">${JOURS_C[d.getDay()]}<b>${d.getDate()}</b></div>${le.map((e) => `<div class="ev ${e.type} ${e.statut === 'fait' ? 'fait' : ''} ${e.type !== 'reunion' && diff(e.debut) <= 2 && e.statut === 'a_venir' ? 'urgent' : ''}" data-ev="${e.id}" tabindex="0"><b>${e.type === 'reunion' ? pad(new Date(e.debut).getHours()) + 'h' + pad(new Date(e.debut).getMinutes()) + ' · ' : ''}${esc(e.titre)}</b>${e.lieu ? esc(e.lieu) + '<br>' : ''}${e.courriers?.numero_ordre ? `<span style="font-size:11px;opacity:.8">${e.courriers.numero_ordre}</span>` : ''}</div>`).join('')}</div>`).join('')}</section>
    <aside style="display:flex;flex-direction:column;gap:16px">
      <section class="carte"><div class="tete"><h2>Rappels actifs</h2>${ouverts.length ? `<button class="btn petit discret" id="btoutlu">Tout marquer lu</button>` : ''}</div>
        ${ouverts.length ? ouverts.map((r) => { const n = diff(r.evenements.debut); return `<div class="alerte ${n <= 2 ? 'urgent' : ''}" style="align-items:center"><span style="color:${n <= 2 ? 'var(--bordeaux)' : 'var(--vert-fonce)'};width:18px;height:18px;flex:none">${ICONES.cloche}</span><div style="flex:1"><div class="t" style="font-size:13px">${libDiff(n)} · ${esc(r.evenements.titre)}</div><div class="s">${fmtDateHeure(r.evenements.debut)}</div></div><button class="ico" data-lu="${r.id}" aria-label="Marquer comme lu">${ICONES.ok}</button></div>`; }).join('') : `<div class="vide" style="padding:14px">Aucun rappel en attente.</div>`}</section>
      <section class="carte"><h2>Règles des rappels</h2><div style="font-size:13px;color:var(--muet)">Chaque échéance ou réunion génère des rappels à J-7, J-2 et J-1 (8h). Les rappels apparaissent ici et sur le tableau de bord. L'envoi par email sera activé dans une prochaine étape.</div></section>
    </aside>
  </div>
  <style>@media (max-width:980px){.deux-col{grid-template-columns:1fr !important}}</style>`;
  vue.querySelector('#bnouv')?.addEventListener('click', () => modaleEvenement({ debut: iso(ref) + 'T09:00' }, () => router()));
  vue.querySelectorAll('[data-ev]').forEach((el) => { const ouvrir = () => { const e = (evs || []).find((x) => x.id === el.dataset.ev); if (!e) return; if (!peutEcrire()) return; modaleEvenement({ ...e, debut: localISO(e.debut) }, () => router()); }; el.onclick = ouvrir; el.onkeydown = (k) => { if (k.key === 'Enter') ouvrir(); }; });
  vue.querySelectorAll('[data-lu]').forEach((b) => b.onclick = async () => { await sb.from('rappels').update({ lu_le: new Date().toISOString() }).eq('id', b.dataset.lu); router(); });
  vue.querySelector('#btoutlu')?.addEventListener('click', async () => { await sb.from('rappels').update({ lu_le: new Date().toISOString() }).in('id', ouverts.map((r) => r.id)); router(); });
}
const localISO = (s) => { const d = new Date(s); return `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// ------------------------------------------------------------------
// Archives
// ------------------------------------------------------------------
async function vueArchives() {
  const vue = coque('archives', `<div class="chargement">Chargement…</div>`);
  const { data: annees } = await sb.from('courriers').select('annee').neq('statut', 'brouillon').order('annee', { ascending: false });
  const listeAnnees = [...new Set((annees || []).map((a) => a.annee))]; if (!listeAnnees.length) listeAnnees.push(new Date().getFullYear());
  const sel = { annee: listeAnnees[0], mois: '', sens: '' };
  const rendre = async () => {
    let req = sb.from('v_courriers').select('*').eq('annee', sel.annee).neq('statut', 'brouillon').order('date_evenement', { ascending: false }).limit(500);
    if (sel.mois) { const fin = new Date(sel.annee, Number(sel.mois), 0); req = req.gte('date_evenement', `${sel.annee}-${pad(sel.mois)}-01`).lte('date_evenement', iso(fin)); }
    if (sel.sens) req = req.eq('sens', sel.sens);
    const { data } = await req; const liste = data || [];
    const parMois = {}; liste.forEach((c) => { const k = c.date_evenement.slice(0, 7); (parMois[k] ||= []).push(c); });
    vue.innerHTML = `
    <header class="entete"><div class="titre"><div class="fil">Tous les documents enregistrés, classés par année et par mois</div><h1>Archives</h1></div>
      <div class="actions"><button class="btn" id="bexcel">${ICONES.telecharger}Registre Excel ${sel.annee}</button></div></header>
    <div class="carte" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 16px">
      <label for="aa" style="font-size:13px;color:var(--muet)">Année</label><select id="aa" class="filtre-select">${listeAnnees.map((a) => `<option ${a === sel.annee ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <label for="am" style="font-size:13px;color:var(--muet)">Mois</label><select id="am" class="filtre-select"><option value="">Tous</option>${MOIS.map((m, i) => `<option value="${i + 1}" ${String(i + 1) === sel.mois ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <div class="seg" role="group" aria-label="Sens"><button type="button" data-s="" class="${sel.sens === '' ? 'on' : ''}">Tout</button><button type="button" data-s="arrivee" class="${sel.sens === 'arrivee' ? 'on' : ''}">Arrivées</button><button type="button" data-s="depart" class="${sel.sens === 'depart' ? 'on' : ''}">Départs</button></div>
      <span style="font-size:13px;color:var(--muet);margin-left:auto">${liste.length} document${liste.length > 1 ? 's' : ''}</span></div>
    ${Object.keys(parMois).length ? Object.entries(parMois).map(([k, l]) => `<section class="carte plein"><div class="tete"><h2>${MOIS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}</h2><span style="font-size:13px;color:var(--muet)">${l.filter((c) => c.sens === 'arrivee').length} arrivées · ${l.filter((c) => c.sens === 'depart').length} départs</span></div><div class="defile">${tableCourriers(l, ['numero', 'date', 'contact', 'objet', 'type', 'statut', 'scan'])}</div></section>`).join('') : `<div class="carte vide">Aucun document pour cette sélection.</div>`}`;
    vue.querySelector('#aa').onchange = (e) => { sel.annee = Number(e.target.value); rendre(); };
    vue.querySelector('#am').onchange = (e) => { sel.mois = e.target.value; rendre(); };
    vue.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { sel.sens = b.dataset.s; rendre(); });
    vue.querySelector('#bexcel').onclick = async () => { const { data: tout } = await sb.from('v_courriers').select('*').eq('annee', sel.annee).neq('statut', 'brouillon').order('date_evenement'); exporterExcel(tout || [], `NEXORA_registre_${sel.annee}.xlsx`); };
    lierLignes(vue);
  };
  await rendre();
}

// ------------------------------------------------------------------
// Rapports
// ------------------------------------------------------------------
function bornes(type, ref = new Date()) {
  const d = new Date(ref);
  if (type === 'jour') return [iso(d), iso(d), dateLongue(d)];
  if (type === 'semaine') { const l = lundiDe(d); return [iso(l), iso(ajouterJours(l, 6)), `Semaine du ${fmtDate(l)} au ${fmtDate(ajouterJours(l, 6))}`]; }
  if (type === 'mois') return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)), `${MOIS[d.getMonth()]} ${d.getFullYear()}`];
  if (type === 'trimestre') { const t = Math.floor(d.getMonth() / 3); return [`${d.getFullYear()}-${pad(t * 3 + 1)}-01`, iso(new Date(d.getFullYear(), t * 3 + 3, 0)), `${t + 1}${t === 0 ? 'er' : 'e'} trimestre ${d.getFullYear()}`]; }
  return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`, `Année ${d.getFullYear()}`];
}

async function vueRapports() {
  const vue = coque('rapports', `<div class="chargement">Chargement…</div>`);
  const { data: recents } = await sb.from('rapports').select('*').order('genere_le', { ascending: false }).limit(12);
  const liens = await Promise.all((recents || []).map(async (r) => { if (!r.chemin_storage) return r; const { data } = await sb.storage.from('rapports').createSignedUrl(r.chemin_storage, 3600); return { ...r, url: data?.signedUrl }; }));
  const TYPES = [['jour', 'Rapport du jour', 'Courriers reçus et envoyés, transmissions, courriers en attente.'], ['semaine', 'Rapport hebdomadaire', 'Synthèse de la semaine, délais, retards, échéances à venir.'], ['mois', 'Rapport mensuel', 'Statistiques par type et par service, liste complète du mois.'], ['annee', 'Rapport annuel', "Bilan de l'année, tendances mois par mois, liste complète."]];
  const LIB = { jour: 'Journalier', semaine: 'Hebdomadaire', mois: 'Mensuel', trimestre: 'Trimestriel', annee: 'Annuel' };
  vue.innerHTML = `
  <header class="entete"><div class="titre"><div class="fil">Rapports d'activité générés à partir du registre</div><h1>Rapports</h1></div>
    <div class="actions"><label for="rdate" style="font-size:13px;color:var(--muet)">Date de référence</label><input id="rdate" type="date" class="recherche" value="${aujourdhui()}" style="height:44px"></div></header>
  <section class="grille4">${TYPES.map(([t, l, d]) => `<div class="carte rc"><h2>${l}</h2><p>${d}</p><div class="bas"><button class="btn petit principal" data-pdf="${t}">${ICONES.telecharger}Générer le PDF</button>${t === 'annee' ? `<button class="btn petit" data-xlsx="annee">Registre Excel</button>` : ''}</div></div>`).join('')}</section>
  <section class="carte plein"><div class="tete"><h2>Rapports générés</h2></div><div class="defile">${liens.length ? `<table><thead><tr><th>Rapport</th><th>Période</th><th>Généré le</th><th><span class="sr">Télécharger</span></th></tr></thead><tbody>${liens.map((r) => `<tr><td style="font-weight:600">${LIB[r.type]}</td><td>${fmtDate(r.periode_debut)} – ${fmtDate(r.periode_fin)}</td><td>${fmtDateHeure(r.genere_le)}</td><td>${r.url ? `<a class="ico" href="${r.url}" target="_blank" rel="noopener" aria-label="Télécharger">${ICONES.telecharger}</a>` : '—'}</td></tr>`).join('')}</tbody></table>` : `<div class="vide">Aucun rapport généré pour l'instant.</div>`}</div></section>`;
  vue.querySelectorAll('[data-pdf]').forEach((b) => b.onclick = async () => { b.disabled = true; try { await genererRapport(b.dataset.pdf, new Date(vue.querySelector('#rdate').value || aujourdhui())); router(); } catch (e) { console.error(e); toast('Génération impossible : ' + e.message, true); b.disabled = false; } });
  vue.querySelector('[data-xlsx]')?.addEventListener('click', async () => { const a = new Date(vue.querySelector('#rdate').value || aujourdhui()).getFullYear(); const { data } = await sb.from('v_courriers').select('*').eq('annee', a).neq('statut', 'brouillon').order('date_evenement'); exporterExcel(data || [], `NEXORA_registre_${a}.xlsx`); });
}

async function genererRapport(type, ref) {
  const [debut, fin, libelle] = bornes(type, ref);
  const { data } = await sb.from('v_courriers').select('*').gte('date_evenement', debut).lte('date_evenement', fin).neq('statut', 'brouillon').order('date_evenement');
  const liste = data || [];
  const { data: attente } = await sb.from('v_courriers').select('*').in('statut', ['recu', 'a_traiter', 'transmis']).order('echeance', { ascending: true, nullsFirst: false }).limit(50);
  const { data: evs } = await sb.from('evenements').select('*').eq('statut', 'a_venir').gte('debut', new Date(fin).toISOString()).lte('debut', ajouterJours(new Date(fin), 14).toISOString()).order('debut').limit(20);
  const arr = liste.filter((c) => c.sens === 'arrivee'), dep = liste.filter((c) => c.sens === 'depart');
  const compter = (l, cle) => { const m = {}; l.forEach((c) => { const k = c[cle] || 'Non renseigné'; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const traites = arr.filter((c) => ['traite', 'classe'].includes(c.statut)); const delai = traites.length ? (traites.reduce((s, c) => s + Math.max(0, (new Date(c.modifie_le) - new Date(c.date_evenement)) / 86400000), 0) / traites.length).toFixed(1) : '—';
  const retard = attente?.filter((c) => c.echeance && c.echeance < aujourdhui()).length || 0;

  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const V = [31, 107, 58], B = [140, 47, 31], G = [95, 111, 102];
  doc.setFillColor(...V); doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('NEXORA', 14, 12); doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text("Secrétariat · École nationale d'administration de Côte d'Ivoire", 14, 18);
  doc.setFontSize(9); doc.text(`Généré le ${fmtDateHeure(new Date())} par ${etat.profil.nom}`, 196, 12, { align: 'right' });
  doc.setTextColor(...B); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(`Rapport ${type === 'jour' ? 'du jour' : type === 'semaine' ? 'hebdomadaire' : type === 'mois' ? 'mensuel' : type === 'trimestre' ? 'trimestriel' : 'annuel'} · ${libelle}`, 14, 40);
  doc.setTextColor(...G); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`Période du ${fmtDate(debut)} au ${fmtDate(fin)}`, 14, 46);
  // chiffres clés
  const kpis = [['Courriers arrivée', arr.length], ['Courriers départ', dep.length], ['En attente (total)', attente?.length || 0], ['En retard', retard], ['Délai moyen (j)', delai]];
  kpis.forEach(([l, v], i) => { const x = 14 + i * 37; doc.setFillColor(244, 247, 242); doc.roundedRect(x, 52, 34, 18, 2, 2, 'F'); doc.setTextColor(...V); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(String(v), x + 3, 61); doc.setTextColor(...G); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(l, x + 3, 67); });
  let y = 78;
  const section = (titre) => { doc.setTextColor(...B); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(titre, 14, y); y += 3; };
  const tableau = (head, body) => { doc.autoTable({ startY: y, head: [head], body, styles: { fontSize: 8, cellPadding: 2, textColor: [30, 43, 41] }, headStyles: { fillColor: V, textColor: 255, fontSize: 8 }, alternateRowStyles: { fillColor: [247, 250, 246] }, margin: { left: 14, right: 14 } }); y = doc.lastAutoTable.finalY + 10; };
  section('Répartition des arrivées par type'); tableau(['Type', 'Nombre'], compter(arr, 'type_nom').map(([k, v]) => [k, v]).concat(arr.length ? [] : [['—', 0]]));
  section('Répartition par service destinataire'); tableau(['Service', 'Arrivées', 'Départs'], (() => { const s = {}; liste.forEach((c) => { const k = c.service_nom || 'Non renseigné'; s[k] ||= [0, 0]; s[k][c.sens === 'arrivee' ? 0 : 1]++; }); return Object.entries(s).map(([k, [a, d]]) => [k, a, d]); })().concat(liste.length ? [] : [['—', 0, 0]]));
  section('Répartition par statut'); tableau(['Statut', 'Nombre'], compter(liste.map((c) => ({ s: (STATUTS[c.statut] || [c.statut])[0] })), 's').map(([k, v]) => [k, v]).concat(liste.length ? [] : [['—', 0]]));
  if (attente?.length) { if (y > 230) { doc.addPage(); y = 20; } section('Courriers en attente de traitement'); tableau(['N°', 'Reçu le', 'Expéditeur', 'Objet', 'Échéance', 'Statut'], attente.map((c) => [c.numero_ordre, fmtDate(c.date_evenement), c.contact_nom, c.objet, fmtDate(c.echeance), (STATUTS[c.statut] || [c.statut])[0]])); }
  if (evs?.length) { if (y > 230) { doc.addPage(); y = 20; } section('Échéances à venir (14 jours)'); tableau(['Date', 'Événement', 'Lieu'], evs.map((e) => [fmtDateHeure(e.debut), e.titre, e.lieu || ''])); }
  doc.addPage(); y = 20; section(`Liste des courriers de la période (${liste.length})`);
  tableau(['N°', 'Date', 'Expéditeur / Destinataire', 'Objet', 'Type', 'Service', 'Statut'], liste.map((c) => [c.numero_ordre, fmtDate(c.date_evenement), c.contact_nom, c.objet, c.type_nom || '', c.service_nom || '', (STATUTS[c.statut] || [c.statut])[0]]).concat(liste.length ? [] : [['—', '', '', 'Aucun courrier sur la période', '', '', '']]));
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...G); doc.text(`NEXORA · ${libelle} · page ${i}/${n}`, 105, 290, { align: 'center' }); }
  const nom = `NEXORA_rapport_${type}_${debut}_${fin}.pdf`; const blob = doc.output('blob');
  const chemin = `${debut.slice(0, 4)}/${type}/${nom}`;
  const { error } = await sb.storage.from('rapports').upload(chemin, blob, { contentType: 'application/pdf', upsert: true }); if (error) throw error;
  await sb.from('rapports').insert({ type, periode_debut: debut, periode_fin: fin, format: 'pdf', chemin_storage: chemin, genere_par: etat.profil.id });
  doc.save(nom); toast('Rapport généré et archivé.');
}

// ------------------------------------------------------------------
// Paramètres
// ------------------------------------------------------------------
async function vueParametres() {
  const vue = coque('parametres', '');
  const p = etat.profil; const admin = p.role === 'admin';
  let profils = []; if (admin) { const { data } = await sb.from('profils').select('*, services(nom)').order('nom'); profils = data || []; }
  vue.innerHTML = `
  <header class="entete"><div class="titre"><div class="fil">Compte, référentiels et accès</div><h1>Paramètres</h1></div><div class="actions"><button class="btn" id="bdec">Se déconnecter</button></div></header>
  <div class="grille3">
    <section class="carte"><h2>Mon compte</h2>
      <form id="fnom" class="champ"><label for="pnom">Nom affiché</label><input id="pnom" value="${esc(p.nom)}"><button class="btn petit" type="submit" style="align-self:flex-start;margin-top:4px">Enregistrer</button></form>
      <div class="fiche"><dt>Email</dt><dd>${esc(p.email || etat.session.user.email)}</dd><dt>Rôle</dt><dd>${ROLES[p.role]}</dd></div>
      <form id="fmdp" style="display:flex;flex-direction:column;gap:10px"><h2 style="font-size:14px">Changer le mot de passe</h2><div class="champ"><label for="n1">Nouveau mot de passe</label><input id="n1" type="password" minlength="8" required></div><div class="champ"><label for="n2">Confirmer</label><input id="n2" type="password" minlength="8" required></div><button class="btn petit" type="submit" style="align-self:flex-start">Mettre à jour</button></form>
    </section>
    <section class="carte"><h2>Services</h2>${etat.services.map((s) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bord-leger)"><span>${esc(s.nom)}</span><span class="chip gris">${esc(s.code)}</span></div>`).join('')}
      ${admin ? `<form id="fsrv" style="display:flex;gap:8px;margin-top:6px"><input class="recherche" id="scode" placeholder="Code" style="width:80px" required><input class="recherche" id="snom" placeholder="Nom du service" style="flex:1" required><button class="btn petit" type="submit">Ajouter</button></form>` : ''}</section>
    <section class="carte"><h2>Types de courrier</h2><div style="display:flex;flex-wrap:wrap;gap:6px">${etat.types.map((t) => `<span class="chip ${t.sens === 'arrivee' ? 'vert' : t.sens === 'depart' ? 'corail' : 'gris'}">${esc(t.nom)}</span>`).join('')}</div>
      <h2 style="margin-top:8px">Catégories</h2><div style="display:flex;flex-wrap:wrap;gap:6px">${etat.categories.map((k) => `<span class="chip gris">${esc(k.nom)}</span>`).join('')}</div>
      ${admin ? `<form id="ftyp" style="display:flex;gap:8px;margin-top:6px"><input class="recherche" id="tnom" placeholder="Nouveau type" style="flex:1" required><select class="filtre-select" id="tsens"><option value="les_deux">Les deux</option><option value="arrivee">Arrivée</option><option value="depart">Départ</option></select><button class="btn petit" type="submit">Ajouter</button></form>` : '<div style="font-size:12px;color:var(--muet)">Modifiables par un administrateur.</div>'}</section>
  </div>
  ${admin ? `<section class="carte plein"><div class="tete"><h2>Utilisateurs</h2></div><div class="defile"><table><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Service</th><th>Actif</th></tr></thead><tbody>${profils.map((u) => `<tr><td>${esc(u.nom)}</td><td>${esc(u.email || '')}</td><td>${ROLES[u.role]}</td><td>${esc(u.services?.nom || '—')}</td><td>${u.actif ? '<span class="chip vert">Oui</span>' : '<span class="chip gris">Non</span>'}</td></tr>`).join('')}</tbody></table></div><div class="pied">Les nouveaux comptes sont créés par l'administrateur technique (Supabase), puis rattachés ici.</div></section>` : ''}`;
  vue.querySelector('#bdec').onclick = () => sb.auth.signOut();
  vue.querySelector('#fnom').onsubmit = async (e) => { e.preventDefault(); const nom = vue.querySelector('#pnom').value.trim(); if (!nom) return; const { error } = await sb.from('profils').update({ nom }).eq('id', p.id); if (error) return toast(error.message, true); etat.profil.nom = nom; toast('Nom enregistré.'); router(); };
  vue.querySelector('#fmdp').onsubmit = async (e) => { e.preventDefault(); if (vue.querySelector('#n1').value !== vue.querySelector('#n2').value) return toast('Les deux mots de passe diffèrent.', true); const { error } = await sb.auth.updateUser({ password: vue.querySelector('#n1').value }); if (error) return toast(error.message, true); toast('Mot de passe mis à jour.'); e.target.reset(); };
  vue.querySelector('#fsrv')?.addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.from('services').insert({ code: vue.querySelector('#scode').value.trim().toUpperCase(), nom: vue.querySelector('#snom').value.trim() }); if (error) return toast(error.message, true); await chargerProfil(); router(); });
  vue.querySelector('#ftyp')?.addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.from('types_courrier').insert({ nom: vue.querySelector('#tnom').value.trim(), sens: vue.querySelector('#tsens').value }); if (error) return toast(error.message, true); await chargerProfil(); router(); });
}

// ------------------------------------------------------------------
// Démarrage
// ------------------------------------------------------------------
sb.auth.onAuthStateChange(async (evt, session) => {
  etat.session = session;
  if (session) { if (!etat.profil || evt === 'SIGNED_IN') await chargerProfil(); }
  else etat.profil = null;
  router();
});
