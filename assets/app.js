// NEXORA — plateforme de gestion du courrier et des documents · ENA Côte d'Ivoire
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { lireCourrier, normaliser } from './lecture.js';

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
  const t = document.createElement('div'); t.className = 'toast' + (erreur ? ' erreur' : ''); t.innerHTML = `<span class="toast-ic">${erreur ? '!' : '✓'}</span><span class="toast-msg">${esc(msg)}</span><span class="toast-barre"></span>`; document.body.appendChild(t);
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

// Signature au trait NEXORA (même construction qu'ORIGEN) : lettres, lumière qui parcourt, trait corail qui traverse le X.
let wmCompteur = 0;
const LETTRES_NEXORA = '<path d="M0 112 V12 L60 112 V12"/><path d="M128 12 H96 V112 H128 M96 62 H122"/><path d="M224 12 L164 112"/><circle cx="307" cy="62" r="47"/><path d="M390 112 V12 H422 a26 26 0 0 1 0 52 H390"/><path d="M416 64 L444 112"/><path d="M480 112 L510 12 L540 112 M492 72 H528"/>';
const TRAIT_NEXORA = 'M-40 -24 H90 Q142 -24 164 12 L224 112 Q246 148 300 148 H580';
function wordmarkNexora(theme = 'clair', largeur) {
  const id = 'wmnx' + (++wmCompteur);
  return `<svg class="wm wm-sig wm-${theme === 'sombre' ? 'sombre' : 'clair'}" viewBox="-60 -48 660 224" role="img" aria-label="NEXORA"${largeur ? ` width="${largeur}" height="${Math.round(largeur * 224 / 660)}"` : ''}><defs><g id="${id}">${LETTRES_NEXORA}</g></defs><use href="#${id}" class="sig"></use><use href="#${id}" class="sig-light"></use><path class="sig-trait" d="${TRAIT_NEXORA}"><animate attributeName="stroke-dashoffset" values="180;-700;-700" keyTimes="0;0.85;1" dur="2.2s" repeatCount="indefinite"/></path></svg>`;
}
const LOGO = (couleur = '#FFFFFF', largeur = 186) => wordmarkNexora(couleur === '#FFFFFF' ? 'sombre' : 'clair', largeur);
function ecranChargement(texte) {
  return `<div class="loading v2"><div class="loading-nom">${wordmarkNexora('clair')}</div><div class="loading-txt">${esc(texte)}</div><div class="loading-barre"><i></i></div><div class="loading-squelette" aria-hidden="true"><div></div><div></div><div></div></div></div>`;
}

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
    sb.from('v_services').select('*').eq('actif', true).order('ordre').order('nom'),
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
const APP_VERSION = '2026-10-18-012';
const SOUS_TITRES = { tableau: 'Vue d\'ensemble du secrétariat', arrivees: 'Registre du courrier arrivée', departs: 'Registre du courrier départ', agenda: 'Échéances, réunions et rappels', archives: 'Tous les documents, par année et par mois', rapports: 'Rapports d\'activité du secrétariat', parametres: 'Compte, référentiels et accès' };
function coque(active, contenu) {
  const p = etat.profil || {};
  const email = etat.session?.user?.email || '';
  app.innerHTML = `
  <div class="coque">
    <nav class="menu${localStorage.getItem('nexora_menu') === 'replie' ? ' replie' : ''}" id="menu" aria-label="Navigation principale">
      <div class="sb-marque"><div class="logo-badge"><img src="assets/ena.jpeg" alt="ENA Côte d'Ivoire"></div><div><div class="brand-name">ENA</div><div class="sb-sous">École nationale d'administration · Côte d'Ivoire</div></div></div>
      ${PAGES.map(([h, l, i]) => `<a class="nav ${active === i ? 'on' : ''}" href="${h}">${ICONES[i]}${l}</a>`).join('')}
      <div class="espace"></div>
      <a class="nav ${active === 'parametres' ? 'on' : ''}" href="#/parametres">${ICONES.parametres}Paramètres</a>
      <button type="button" class="sb-replier" id="sb-replier" title="Replier / déplier le menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span>Replier le menu</span></button>
      <div class="util"><div class="avatar" aria-hidden="true">${initiales(p.nom)}</div><div><div class="nom">${esc(p.nom || '')}</div><div class="role">${ROLES[p.role] || ''}</div></div></div>
    </nav>
    <main class="contenu">
      <div class="top-utility">
        <span class="espace-nom">NEXORA</span>
        <button type="button" class="tb-recherche" id="tb-rech" title="Recherche globale"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span>Rechercher…</span><kbd>Ctrl K</kbd></button>
        <div class="tb-user" id="tb-notif-zone"><button type="button" class="tb-ico" id="tb-notif" title="Notifications" aria-expanded="false">${ICONES.cloche}<span class="tb-pastille" id="tb-pastille" hidden>0</span></button></div>
        <span class="tb-version">v${APP_VERSION}</span>
        <div class="tb-user" id="tb-user-zone"><button type="button" class="user-chip" id="tb-user" aria-expanded="false"><span class="avatar">${initiales(p.nom)}</span><span class="mail">${esc(email)}</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8l4 4 4-4"/></svg></button></div>
      </div>
      <div class="hero">
        <div class="marque"><div>${LOGO('#1F6B3A', 200)}<p>${SOUS_TITRES[active] || 'Gestion du courrier et des documents du secrétariat'}</p></div></div>
        <div class="hero-chips" id="hero-chips"><span class="hero-chip"><i></i>${ROLES[p.role] || ''}</span><span class="hero-chip"><i class="corail"></i>${esc(dateLongue(new Date()))}</span></div>
      </div>
      <div id="vue" class="anim-entree" style="display:flex;flex-direction:column;gap:18px">${contenu}</div>
    </main>
  </div>`;
  brancherBarre();
  return document.getElementById('vue');
}

function brancherBarre() {
  const fermer = () => document.querySelectorAll('.tb-menu').forEach((m) => m.remove());
  document.getElementById('sb-replier').onclick = () => { const m = document.getElementById('menu'); m.classList.toggle('replie'); localStorage.setItem('nexora_menu', m.classList.contains('replie') ? 'replie' : 'ouvert'); };
  document.getElementById('tb-rech').onclick = () => ouvrirRecherche();
  document.getElementById('tb-user').onclick = (e) => {
    e.stopPropagation(); const deja = document.querySelector('#tb-user-zone .tb-menu'); fermer(); if (deja) return;
    const m = document.createElement('div'); m.className = 'tb-menu';
    m.innerHTML = `<div class="tb-menu-tete"><b>${esc(etat.profil?.nom || '')}</b><span class="hint">${esc(etat.session?.user?.email || '')} · NEXORA v${APP_VERSION}</span></div>
      <button type="button" class="tb-menu-item" data-a="actualiser">⟳ Actualiser les données</button>
      <button type="button" class="tb-menu-item" data-a="mdp">🔑 Changer mon mot de passe</button>
      <div class="tb-menu-sep"></div><button type="button" class="tb-menu-item danger" data-a="sortir">Se déconnecter</button>`;
    document.getElementById('tb-user-zone').appendChild(m);
    m.querySelector('[data-a=actualiser]').onclick = async () => { fermer(); await chargerProfil(); router(); toast('Données actualisées.'); };
    m.querySelector('[data-a=mdp]').onclick = () => { fermer(); naviguer('#/parametres'); };
    m.querySelector('[data-a=sortir]').onclick = () => sb.auth.signOut();
  };
  document.getElementById('tb-notif').onclick = async (e) => {
    e.stopPropagation(); const deja = document.querySelector('#tb-notif-zone .tb-menu'); fermer(); if (deja) return;
    const m = document.createElement('div'); m.className = 'tb-menu'; m.style.minWidth = '320px';
    m.innerHTML = `<div class="tb-menu-tete"><b>À traiter</b><span class="hint">Chargement…</span></div>`;
    document.getElementById('tb-notif-zone').appendChild(m);
    const items = await notifications();
    m.innerHTML = `<div class="tb-menu-tete"><b>À traiter</b><span class="hint">${items.length ? items.length + ' sujet(s)' : 'Rien en attente'}</span></div>` + (items.length ? items.map((i) => `<a class="tb-notif-item" href="${i.href}"><span style="width:18px;height:18px;color:${i.niveau === 'danger' ? 'var(--bordeaux)' : 'var(--ambre)'}">${ICONES.cloche}</span><span style="flex:1"><b>${esc(i.titre)}</b><small>${esc(i.detail)}</small></span><span class="chip ${i.niveau === 'danger' ? 'corail' : 'ambre'}">${i.nb}</span></a>`).join('') : `<div class="tb-notif-vide">✓ Tout est à jour.</div>`);
  };
  document.addEventListener('click', fermer, { once: true });
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ouvrirRecherche(); } }, { once: true });
  notifications().then((items) => { const n = items.reduce((s, i) => s + i.nb, 0); const p = document.getElementById('tb-pastille'); if (!p) return; p.hidden = n === 0; p.textContent = n > 99 ? '99+' : n; });
}

async function notifications() {
  const auj = aujourdhui(); const d7 = iso(ajouterJours(new Date(), 7));
  const [retard, rappels, echeances, brouillons] = await Promise.all([
    sb.from('courriers').select('id', { count: 'exact', head: true }).in('statut', ['recu', 'a_traiter', 'transmis']).lt('echeance', auj),
    sb.from('rappels').select('id', { count: 'exact', head: true }).lte('declenche_le', new Date().toISOString()).is('lu_le', null),
    sb.from('courriers').select('id', { count: 'exact', head: true }).in('statut', ['recu', 'a_traiter', 'transmis']).gte('echeance', auj).lte('echeance', d7),
    sb.from('courriers').select('id', { count: 'exact', head: true }).eq('statut', 'brouillon'),
  ]);
  const items = [];
  if (retard.count) items.push({ titre: 'Courriers en retard', detail: `${retard.count} courrier(s) dont l'échéance est dépassée`, nb: retard.count, niveau: 'danger', href: '#/arrivees' });
  if (rappels.count) items.push({ titre: 'Rappels', detail: `${rappels.count} rappel(s) à consulter`, nb: rappels.count, niveau: 'warn', href: '#/agenda' });
  if (echeances.count) items.push({ titre: 'Échéances sous 7 jours', detail: `${echeances.count} courrier(s) à traiter cette semaine`, nb: echeances.count, niveau: 'warn', href: '#/agenda' });
  if (brouillons.count) items.push({ titre: 'Brouillons non validés', detail: `${brouillons.count} courrier(s) sans numéro d'ordre`, nb: brouillons.count, niveau: 'warn', href: '#/arrivees' });
  return items;
}

function ouvrirRecherche() {
  const m = modale(`<h2>Recherche globale</h2><form id="frg" class="champ"><label for="rg" class="sr">Rechercher</label><input id="rg" type="search" placeholder="N°, expéditeur, objet, mot-clé…" autofocus></form><div id="rg-res" style="display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow:auto"></div>`);
  const inp = m.querySelector('#rg'); setTimeout(() => inp.focus(), 0);
  let t; const chercher = async () => {
    const q = inp.value.trim(); if (q.length < 2) { m.querySelector('#rg-res').innerHTML = ''; return; }
    const tt = `%${q.replace(/[%_,]/g, '')}%`;
    const { data } = await sb.from('v_courriers').select('id,numero_ordre,sens,objet,contact_nom,date_evenement,statut,echeance').neq('statut', 'brouillon').or(`objet.ilike.${tt},contact_nom.ilike.${tt},numero_ordre.ilike.${tt},reference_externe.ilike.${tt},resume.ilike.${tt}`).order('date_evenement', { ascending: false }).limit(15);
    m.querySelector('#rg-res').innerHTML = (data || []).length ? data.map((c) => `<a href="#/courrier/${c.id}" class="tb-notif-item" style="border:1px solid var(--bord-leger)">${numero(c)}<span style="flex:1;min-width:0"><b>${esc(c.objet)}</b><small>${esc(c.contact_nom)} · ${fmtDate(c.date_evenement)}</small></span>${chipStatut(c)}</a>`).join('') : `<div class="tb-notif-vide">Aucun résultat.</div>`;
    m.querySelectorAll('a').forEach((a) => a.onclick = () => m.remove());
  };
  inp.oninput = () => { clearTimeout(t); t = setTimeout(chercher, 250); };
  m.querySelector('#frg').onsubmit = (e) => { e.preventDefault(); chercher(); };
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
  const vue = coque('tableau', ecranChargement('Chargement des données…'));
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
      case 'service': return `<td>${esc(c.service_nom_complet || c.service_nom || '')}</td>`;
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
  const vue = coque(estArr ? 'arrivees' : 'departs', ecranChargement('Chargement des données…'));
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
    'Numéro du courrier': c.reference_externe || '', 'Expéditeur / Destinataire': c.contact_nom, 'Objet': c.objet, 'Type': c.type_nom || '', 'Catégorie': c.categorie_nom || '',
    'Service': c.service_nom_complet || c.service_nom || '', 'Signataire': c.signataire || '', 'Mode d\'envoi': MODES[c.mode_envoi] || '', 'Urgence': URGENCES[c.urgence] || '', 'Échéance': fmtDate(c.echeance),
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
        <div class="champ"><label for="ref">Numéro du courrier <span id="d-ref"></span></label><input id="ref" placeholder="N° porté sur le courrier"></div>
        <div class="champ"><label for="dcour">Date du courrier <span id="d-dcour"></span></label><input id="dcour" type="date"></div>
        <div class="champ"><label for="devt">${estArr ? 'Date de réception' : "Date d'envoi"}</label><input id="devt" type="date" value="${aujourdhui()}" required></div>
        <div class="champ span2"><label for="objet">Objet <span id="d-objet"></span></label><input id="objet" required></div>
        <div class="champ"><label for="type">Type de courrier <span id="d-type"></span></label><select id="type"><option value="">—</option>${opt(etat.types.filter((t) => t.sens === 'les_deux' || t.sens === sens))}</select></div>
        <div class="champ"><label for="service">${estArr ? 'Destinataire interne' : 'Service émetteur'} <span id="d-service"></span></label>
          <div style="display:flex;gap:8px;align-items:center"><select id="service" style="flex:1 1 50%"><option value="">—</option>${etat.services.filter((x) => !x.parent_id).map((x) => `<option value="${x.id}" ${x.id === etat.profil.service_id ? 'selected' : ''}>${esc(x.nom)}${etat.services.some((y) => y.parent_id === x.id) ? ' ›' : ''}</option>`).join('')}</select><select id="service2" aria-label="Service de la direction" style="flex:1 1 50%;display:none"></select></div>
          <input type="hidden" id="service_final"></div>
        <div class="champ"><label for="urgence">Niveau d'urgence <span id="d-urgence"></span></label><select id="urgence">${Object.entries(URGENCES).map(([k, l]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="champ"><label for="cat">Catégorie</label><select id="cat"><option value="">—</option>${opt(etat.categories)}</select></div>
        ${estArr ? '' : `<div class="champ"><label for="sign">Signataire</label><input id="sign" placeholder="Qui signe le courrier"></div>
        <div class="champ"><label for="mode">Mode d'envoi</label><select id="mode">${Object.entries(MODES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="champ span2"><label for="lie">En réponse au courrier arrivée</label><select id="lie"><option value="">— Aucun —</option>${(arrivees || []).map((a) => `<option value="${a.id}">${esc(a.numero_ordre)} · ${esc(a.objet).slice(0, 70)}</option>`).join('')}</select></div>`}
        <div class="champ"><label for="echeance">Échéance (facultatif) <span id="d-echeance"></span></label><input id="echeance" type="date"><span class="aide">Si renseignée, une alerte est programmée dans l'agenda 2 jours avant.</span></div>
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

  // Direction → seconde liste déroulante juste à côté (comme un sous-menu)
  const selSrv = vue.querySelector('#service'), selSrv2 = vue.querySelector('#service2'), srvFinal = vue.querySelector('#service_final');
  const majSousListe = (sousId) => {
    const d = etat.services.find((y) => y.id === selSrv.value); const enfants = d ? etat.services.filter((y) => y.parent_id === d.id) : [];
    if (!enfants.length) { selSrv2.style.display = 'none'; selSrv2.innerHTML = ''; srvFinal.value = selSrv.value; return; }
    selSrv2.innerHTML = `<option value="${d.id}">— Choisir le service —</option>` + enfants.map((e) => `<option value="${e.id}" ${e.id === sousId ? 'selected' : ''}>${esc(e.nom)}</option>`).join('');
    selSrv2.style.display = ''; srvFinal.value = sousId || d.id; if (!sousId) selSrv2.focus();
  };
  selSrv.onchange = () => majSousListe(null);
  selSrv2.onchange = () => { srvFinal.value = selSrv2.value || selSrv.value; };
  majSousListe(null);
  vue.querySelector('#sa').onclick = () => naviguer('#/enregistrer/arrivee');
  const reprise = sessionStorage.getItem('nexora_lecture');
  if (reprise) { sessionStorage.removeItem('nexora_lecture'); try { const { lecture: r, nom } = JSON.parse(reprise); lecture = r; setTimeout(() => { appliquerLecture(r); vue.querySelector('#etat-lecture').innerHTML = `<div class="bandeau vert">${ICONES.ok}Lecture reprise (${esc(nom || 'document')}) · pensez à rattacher à nouveau le scan</div>`; }, 50); } catch (e) { /* ignore */ } }
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
      const [{ data: contacts }, { data: apprentissage }] = await Promise.all([sb.from('contacts').select('nom').limit(2000), sb.from('apprentissage').select('*')]);
      const data = await lireCourrier(fichier, { types: etat.types, services: etat.services, sens, contacts: contacts || [], apprentissage: apprentissage || [] }, (msg) => { vue.querySelector('#etat-lecture').innerHTML = `<div class="bandeau ambre">${esc(msg)}</div>`; });
      lecture = data; appliquerLecture(data);
      const n = Object.keys(data.champs || {}).length;
      vue.querySelector('#etat-lecture').innerHTML = n ? `<div class="bandeau vert" title="${esc((data.indices || []).join(' · '))}">${ICONES.ok}Lecture terminée · ${n} champs détectés${data.a_verifier?.length ? ` · ${data.a_verifier.length} à vérifier` : ''}${data.indices?.length ? ' · ' + esc(data.indices.join(' · ')) : ''}</div>` : `<div class="bandeau ambre">Aucun champ reconnu : le scan est peut-être trop flou. Remplissez la fiche à la main.</div>`;
    } catch (err) {
      console.error(err);
      vue.querySelector('#etat-lecture').innerHTML = `<div class="bandeau corail">Lecture impossible sur ce fichier. Remplissez la fiche à la main.</div>`;
    }
    blire.disabled = false; blire.innerHTML = `${ICONES.scan}Relancer la lecture automatique`;
  };
  const marquer = (id, etatC) => { const ch = vue.querySelector('#' + id)?.closest('.champ'); if (!ch) return; ch.classList.remove('ok', 'verif'); ch.classList.add(etatC); const d = vue.querySelector('#d-' + id); if (d) d.innerHTML = etatC === 'ok' ? '<span class="lu-det">détecté</span>' : '<span class="lu-ver">à vérifier</span>'; };
  const appliquerLecture = async (r) => {
    const ch = r.champs || {}; const av = new Set(r.a_verifier || []);
    // Sens suggéré (en-tête de l'ENA → départ)
    if (ch.sens_suggere && ch.sens_suggere !== sens) {
      const b = document.createElement('div'); b.className = 'bandeau ambre'; b.style.marginBottom = '4px';
      b.innerHTML = `Ce document porte l'en-tête de l'ENA : c'est probablement un courrier <b>${ch.sens_suggere === 'depart' ? 'départ' : 'arrivée'}</b>. <button type="button" class="btn petit" id="bsens" style="margin-left:6px">Basculer en ${ch.sens_suggere === 'depart' ? 'départ' : 'arrivée'}</button>`;
      vue.querySelector('#ffiche').prepend(b);
      b.querySelector('#bsens').onclick = () => { sessionStorage.setItem('nexora_lecture', JSON.stringify({ lecture: r, nom: fichier?.name })); naviguer('#/enregistrer/' + ch.sens_suggere); };
    }
    // Réponse à un courrier référencé : on cherche l'arrivée correspondante
    if (ch.reference_liee && vue.querySelector('#lie')) {
      const t = `%${ch.reference_liee.replace(/\s+/g, '').slice(-12)}%`;
      const { data: lies } = await sb.from('courriers').select('id,numero_ordre,objet').eq('sens', 'arrivee').ilike('reference_externe', t).limit(3);
      if (lies?.length) { vue.querySelector('#lie').value = lies[0].id; marquer('lie', 'ok'); }
    }
    if (ch.signataire && vue.querySelector('#sign')) { vue.querySelector('#sign').value = ch.signataire + (ch.fonction_signataire ? ` (${ch.fonction_signataire})` : ''); marquer('sign', av.has('sign') ? 'verif' : 'ok'); }
    if (ch.service_a_creer && !ch.service) { const srvSel = vue.querySelector('#service'); const opt = document.createElement('option'); opt.value = '__nouveau__'; opt.textContent = `Créer : ${ch.service_a_creer}`; opt.dataset.nom = ch.service_a_creer; srvSel.appendChild(opt); srvSel.value = '__nouveau__'; marquer('service', 'verif'); }
    const mettre = (id, val) => { if (val === undefined || val === null || val === '') return; const el = vue.querySelector('#' + id); if (!el) return; el.value = val; marquer(id, av.has(id) ? 'verif' : 'ok'); };
    mettre('contact', ch.contact); mettre('ref', ch.reference); mettre('dcour', ch.date_courrier); mettre('objet', ch.objet); mettre('resume', ch.resume); mettre('action', ch.action_demandee); mettre('echeance', ch.echeance);
    if (ch.urgence && URGENCES[ch.urgence]) mettre('urgence', ch.urgence);
    const typ = etat.types.find((t) => t.nom.toLowerCase() === String(ch.type || '').toLowerCase()); if (typ) mettre('type', typ.id);
    const srv = etat.services.find((s) => s.nom.toLowerCase() === String(ch.service || '').toLowerCase());
    if (srv) { const parent = srv.parent_id ? etat.services.find((y) => y.id === srv.parent_id) : null; mettre('service', parent ? parent.id : srv.id); majSousListe(parent ? srv.id : null); if (parent) marquer('service2', av.has('service') ? 'verif' : 'ok'); }
    if (ch.categorie_id) mettre('cat', ch.categorie_id);
    if (ch.montant && !vue.querySelector('#obs').value) vue.querySelector('#obs').value = `Montant : ${ch.montant}`;
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
      let serviceId = v('service_final') || v('service');
      if (serviceId === '__nouveau__') { const o = vue.querySelector('#service option[value="__nouveau__"]'); const nom = o?.dataset.nom || 'Nouveau service'; const code = nom.split(/\s+/).filter((m) => m.length > 2 && !/^(de|la|le|les|des|et|du|l')$/i.test(m)).map((m) => m[0].toUpperCase()).join('').slice(0, 6) || 'SRV'; const { data: ns, error: es } = await sb.from('services').insert({ code: code + '-' + Math.floor(Math.random() * 90 + 10), nom }).select('id').single(); if (es) throw es; serviceId = ns.id; await chargerProfil(); }
      const ligne = {
        sens, statut: statutFinal, contact_id, contact_nom: v('contact'), reference_externe: v('ref'), date_courrier: v('dcour'), date_evenement: v('devt') || aujourdhui(),
        annee: Number((v('devt') || aujourdhui()).slice(0, 4)), objet: v('objet'), type_id: v('type'), service_id: serviceId, urgence: v('urgence') || 'normal', categorie_id: v('cat'),
        signataire: v('sign'), mode_envoi: v('mode'), courrier_lie_id: v('lie'), echeance: v('echeance'), confidentiel: vue.querySelector('#conf').checked, resume: v('resume'), action_demandee: v('action'),
        observations: v('obs'), cree_par: etat.profil.id, lecture_auto: lecture, lecture_auto_le: lecture ? new Date().toISOString() : null,
      };
      const { data: c, error } = await sb.from('courriers').insert(ligne).select('*').single(); if (error) throw error;
      if (statutFinal !== 'brouillon') apprendre(c).catch(() => {});
      // scan
      if (fichier) {
        const d = new Date(c.date_evenement); const ext = fichier.name.split('.').pop().toLowerCase();
        const chemin = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${sens === 'arrivee' ? 'arrivees' : 'departs'}/${c.id}/scan.${ext}`;
        const { error: eu } = await sb.storage.from('courriers').upload(chemin, fichier, { contentType: fichier.type, upsert: true }); if (eu) throw eu;
        await sb.from('pieces_jointes').insert({ courrier_id: c.id, nom_fichier: fichier.name, chemin_storage: chemin, type_mime: fichier.type, taille_octets: fichier.size, cree_par: etat.profil.id });
      }
      // événements détectés
      const cases = [...vue.querySelectorAll('[data-ev]:checked')];
      for (const cb of cases) { const e = (lecture?.evenements || [])[Number(cb.dataset.ev)]; if (e) await creerEvenement({ courrier_id: c.id, titre: e.titre, type: e.type || 'echeance', debut: e.debut, fin: e.fin || null, lieu: e.lieu || null, description: e.description || null }); }
      if (statutFinal !== 'brouillon' && c.echeance) {
        const dejaCouvert = cases.some((cb) => (lecture?.evenements || [])[Number(cb.dataset.ev)]?.debut?.slice(0, 10) === c.echeance);
        if (!dejaCouvert) await creerEvenement({ courrier_id: c.id, titre: `Échéance · ${c.objet}`.slice(0, 120), type: 'echeance', debut: c.echeance + 'T08:00:00', description: `Alerte automatique : échéance du courrier ${c.numero_ordre || ''}`.trim() }, [2]);
      }
      toast(statutFinal === 'brouillon' ? 'Brouillon enregistré.' : `Courrier enregistré sous le n° ${c.numero_ordre}.`);
      naviguer('#/courrier/' + c.id);
    } catch (err) { console.error(err); toast('Enregistrement impossible : ' + (err.message || err), true); bb.disabled = bv.disabled = false; }
  };
  vue.querySelector('#ffiche').onsubmit = (e) => { e.preventDefault(); enregistrer(estArr ? 'recu' : 'envoye'); };
  vue.querySelector('#bbrouillon').onclick = () => enregistrer('brouillon');
}

// Apprentissage : NEXORA retient ce que la secrétaire associe à un expéditeur (type, service, catégorie, urgence)
async function apprendre(c) {
  if (!c.contact_nom) return;
  const cle = normaliser(c.contact_nom); if (!cle) return;
  const { data: x } = await sb.from('apprentissage').select('nb').eq('cle', cle).maybeSingle();
  await sb.from('apprentissage').upsert({ cle, contact_nom: c.contact_nom, type_id: c.type_id, service_id: c.service_id, categorie_id: c.categorie_id, urgence: c.urgence, nb: (x?.nb || 0) + 1, modifie_le: new Date().toISOString() });
}

async function creerEvenement(e, joursRappel = [7, 2, 1]) {
  const { data: ev, error } = await sb.from('evenements').insert({ ...e, fin: e.fin || null, cree_par: etat.profil.id }).select('id,debut').single(); if (error) throw error;
  const debut = new Date(ev.debut); const rappels = [];
  for (const j of joursRappel) { const r = ajouterJours(debut, -j); r.setHours(8, 0, 0, 0); if (r > new Date()) rappels.push({ evenement_id: ev.id, declenche_le: r.toISOString(), canal: 'app' }); }
  if (rappels.length) await sb.from('rappels').insert(rappels);
  return ev;
}

// ------------------------------------------------------------------
// Fiche d'un courrier
// ------------------------------------------------------------------
async function vueCourrier(id) {
  const vue = coque('arrivees', ecranChargement('Chargement des données…'));
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
    <div class="actions">${peutEcrire() && c.statut !== 'annule' ? `${c.statut === 'brouillon' ? `<button class="btn principal" id="bvalider">Valider et attribuer le n°</button>` : `<select id="sstatut" class="filtre-select" aria-label="Changer le statut">${statutsPossibles.map((s) => `<option value="${s}" ${c.statut === s ? 'selected' : ''}>${STATUTS[s][0]}</option>`).join('')}</select>`}
      ${estArr && c.statut !== 'brouillon' ? `<a class="btn vert" href="#/enregistrer/depart">Répondre (départ)</a>` : ''}<button class="btn danger" id="bannuler">Annuler</button>` : ''}</div></header>
  <div class="grille3">
    <section class="carte span2">
      <div class="tete"><h2>Fiche du registre</h2><span style="font-size:12px;color:var(--muet)">Enregistré le ${fmtDateHeure(c.cree_le)}</span></div>
      <dl class="fiche grille2" style="margin:0">
        ${champ(estArr ? 'Expéditeur' : 'Destinataire', esc(c.contact_nom))}${champ('Numéro du courrier', esc(c.reference_externe))}
        ${champ('Date du courrier', fmtDate(c.date_courrier))}${champ(estArr ? 'Date de réception' : "Date d'envoi", fmtDate(c.date_evenement))}
        ${champ('Type', esc(c.type_nom))}${champ(estArr ? 'Destinataire interne' : 'Service émetteur', esc(c.service_nom_complet || c.service_nom))}
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
    const m = modale(`<h2>Transmettre le courrier</h2><div class="champ"><label for="tsrv">Service</label><select id="tsrv"><option value="">—</option>${etat.services.map((s) => `<option value="${s.id}">${esc(s.nom_complet || s.nom)}</option>`).join('')}</select></div><div class="champ"><label for="tpers">Personne (facultatif)</label><input id="tpers"></div><div class="champ"><label for="tnote">Note</label><input id="tnote"></div><div class="ligne-boutons"><button class="btn" id="mnon">Retour</button><button class="btn principal" id="moui">Transmettre</button></div>`);
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
  const vue = coque('agenda', ecranChargement('Chargement des données…'));
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
  const vue = coque('archives', ecranChargement('Chargement des données…'));
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
  const vue = coque('rapports', ecranChargement('Chargement des données…'));
  const { data: recents } = await sb.from('rapports').select('*').order('genere_le', { ascending: false }).limit(12);
  const liens = await Promise.all((recents || []).map(async (r) => { if (!r.chemin_storage) return r; const { data } = await sb.storage.from('rapports').createSignedUrl(r.chemin_storage, 3600); return { ...r, url: data?.signedUrl }; }));
  const TYPES = [['jour', 'Rapport du jour', 'Courriers reçus et envoyés, transmissions, courriers en attente.'], ['semaine', 'Rapport hebdomadaire', 'Synthèse de la semaine, délais, retards, échéances à venir.'], ['mois', 'Rapport mensuel', 'Statistiques par type et par service, liste complète du mois.'], ['annee', 'Rapport annuel', "Bilan de l'année, tendances mois par mois, liste complète."]];
  const LIB = { jour: 'Journalier', semaine: 'Hebdomadaire', mois: 'Mensuel', trimestre: 'Trimestriel', annee: 'Annuel' };
  vue.innerHTML = `
  <header class="entete"><div class="titre"><div class="fil">Rapports d'activité générés à partir du registre</div><h1>Rapports</h1></div>
    <div class="actions"><label for="rdate" style="font-size:13px;color:var(--muet)">Date de référence</label><input id="rdate" type="date" class="recherche" value="${aujourdhui()}"></div></header>
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
  const p = etat.profil; const admin = p.role === 'admin'; const gere = peutEcrire();
  let profils = []; if (admin) { const { data } = await sb.from('profils').select('*, services(nom)').order('nom'); profils = data || []; }
  const [{ data: tousServices }, { data: tousTypes }, { data: toutesCat }] = await Promise.all([
    sb.from('services').select('*').order('actif', { ascending: false }).order('nom'),
    sb.from('types_courrier').select('*').order('actif', { ascending: false }).order('nom'),
    sb.from('categories').select('*').order('actif', { ascending: false }).order('nom'),
  ]);
  const SENS = { les_deux: 'Arrivée et départ', arrivee: 'Arrivée', depart: 'Départ' };
  const ligneRef = (table, x, detail) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bord-leger);${x.actif ? '' : 'opacity:.55'}">
      <div style="flex:1;min-width:0"><div style="font-weight:600">${esc(x.nom)}</div>${detail ? `<div style="font-size:12px;color:var(--muet)">${detail}</div>` : ''}</div>
      ${gere ? `<button class="ico" data-modif="${table}:${x.id}" aria-label="Modifier ${esc(x.nom)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
      <button class="ico" data-actif="${table}:${x.id}:${x.actif ? 0 : 1}" title="${x.actif ? 'Désactiver' : 'Réactiver'}" aria-label="${x.actif ? 'Désactiver' : 'Réactiver'} ${esc(x.nom)}">${x.actif ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>' : ICONES.ok}</button>` : ''}</div>`;

  vue.innerHTML = `
  <header class="entete"><div class="titre"><div class="fil">Compte, référentiels et accès</div><h1>Paramètres</h1></div><div class="actions"><button class="btn" id="bdec">Se déconnecter</button></div></header>
  <div class="bandeau vert" style="align-self:flex-start">Les directions, services, types de courrier et catégories que vous ajoutez ici alimentent les listes déroulantes de l'enregistrement, les filtres et la recherche.</div>
  <div class="grille3">
    <section class="carte"><div class="tete"><h2>Directions et services internes</h2><span class="chip gris">${(tousServices || []).filter((s) => s.actif).length} actifs</span></div>
      <div>${(tousServices || []).filter((s) => !s.parent_id).sort((a, b) => (a.ordre - b.ordre) || a.nom.localeCompare(b.nom)).map((s) => ligneRef('services', s, `${esc(s.code)}${s.responsable ? ' · ' + esc(s.responsable) : ''}${s.description ? ' · ' + esc(s.description) : ''}`) + (tousServices || []).filter((e) => e.parent_id === s.id).sort((a, b) => a.ordre - b.ordre).map((e) => `<div style="padding-left:22px">${ligneRef('services', e, `${esc(e.code)}${e.responsable ? ' · ' + esc(e.responsable) : ''}`)}</div>`).join('')).join('')}</div>
      ${gere ? `<form id="fsrv" class="grille2" style="gap:10px;margin-top:6px"><div class="champ"><label for="scode">Sigle</label><input id="scode" placeholder="DRH" maxlength="12" required></div><div class="champ"><label for="snom">Nom de la direction / du service</label><input id="snom" placeholder="Direction des ressources humaines" required></div><div class="champ"><label for="sparent">Rattaché à (facultatif)</label><select id="sparent"><option value="">— Direction autonome —</option>${(tousServices || []).filter((x) => !x.parent_id && x.actif).map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select></div><div class="champ"><label for="sresp">Responsable (facultatif)</label><input id="sresp" placeholder="Nom du directeur / chef de service"></div><div class="champ span2"><label for="sdesc">Description (facultatif)</label><input id="sdesc" placeholder="Rôle, mots-clés…"></div><button class="btn petit principal" type="submit" style="align-self:end">${ICONES.plus}Ajouter</button></form>` : ''}</section>
    <section class="carte"><div class="tete"><h2>Types de courrier</h2><span class="chip gris">${(tousTypes || []).filter((t) => t.actif).length} actifs</span></div>
      <div>${(tousTypes || []).map((t) => ligneRef('types_courrier', t, SENS[t.sens])).join('')}</div>
      ${gere ? `<form id="ftyp" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;align-items:flex-end"><div class="champ" style="flex:1 1 160px"><label for="tnom">Nouveau type</label><input id="tnom" placeholder="Ex. Note circulaire" required></div><div class="champ"><label for="tsens">Sens</label><select id="tsens"><option value="les_deux">Arrivée et départ</option><option value="arrivee">Arrivée</option><option value="depart">Départ</option></select></div><button class="btn petit principal" type="submit">${ICONES.plus}Ajouter</button></form>` : ''}</section>
    <section class="carte"><div class="tete"><h2>Catégories</h2><span class="chip gris">${(toutesCat || []).filter((k) => k.actif).length} actives</span></div>
      <div>${(toutesCat || []).map((k) => ligneRef('categories', k, '')).join('')}</div>
      ${gere ? `<form id="fcat" style="display:flex;gap:8px;margin-top:6px;align-items:flex-end"><div class="champ" style="flex:1"><label for="knom">Nouvelle catégorie</label><input id="knom" placeholder="Ex. Scolarité" required></div><button class="btn petit principal" type="submit">${ICONES.plus}Ajouter</button></form>` : ''}
      <div style="font-size:12px;color:var(--muet)">Un élément désactivé disparaît des listes mais reste sur les courriers déjà enregistrés.</div></section>
  </div>
  <div class="grille3">
    <section class="carte"><h2>Mon compte</h2>
      <form id="fnom" class="champ"><label for="pnom">Nom affiché</label><input id="pnom" value="${esc(p.nom)}"><button class="btn petit" type="submit" style="align-self:flex-start;margin-top:4px">Enregistrer</button></form>
      <div class="fiche"><dt>Email</dt><dd>${esc(p.email || etat.session.user.email)}</dd><dt>Rôle</dt><dd>${ROLES[p.role]}</dd></div>
      <form id="fmdp" style="display:flex;flex-direction:column;gap:10px"><h2 style="font-size:14px">Changer le mot de passe</h2><div class="champ"><label for="n1">Nouveau mot de passe</label><input id="n1" type="password" minlength="8" required></div><div class="champ"><label for="n2">Confirmer</label><input id="n2" type="password" minlength="8" required></div><button class="btn petit" type="submit" style="align-self:flex-start">Mettre à jour</button></form>
    </section>
    ${admin ? `<section class="carte plein span2"><div class="tete"><h2>Utilisateurs</h2></div><div class="defile"><table><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Service</th><th>Actif</th></tr></thead><tbody>${profils.map((u) => `<tr><td>${esc(u.nom)}</td><td>${esc(u.email || '')}</td><td>${ROLES[u.role]}</td><td>${esc(u.services?.nom || '—')}</td><td>${u.actif ? '<span class="chip vert">Oui</span>' : '<span class="chip gris">Non</span>'}</td></tr>`).join('')}</tbody></table></div><div class="pied">Les nouveaux comptes sont créés par l'administrateur technique, puis rattachés ici.</div></section>` : `<section class="carte span2"><h2>Accès</h2><div style="font-size:13px;color:var(--muet)">Une seule utilisatrice pour l'instant. Les accès pour la direction et les autres services seront ouverts dans une prochaine étape : la base est déjà prête (rôles secrétaire, responsable, direction, administrateur).</div></section>`}
  </div>`;

  vue.querySelector('#bdec').onclick = () => sb.auth.signOut();
  vue.querySelector('#fnom').onsubmit = async (e) => { e.preventDefault(); const nom = vue.querySelector('#pnom').value.trim(); if (!nom) return; const { error } = await sb.from('profils').update({ nom }).eq('id', p.id); if (error) return toast(error.message, true); etat.profil.nom = nom; toast('Nom enregistré.'); router(); };
  vue.querySelector('#fmdp').onsubmit = async (e) => { e.preventDefault(); if (vue.querySelector('#n1').value !== vue.querySelector('#n2').value) return toast('Les deux mots de passe diffèrent.', true); const { error } = await sb.auth.updateUser({ password: vue.querySelector('#n1').value }); if (error) return toast(error.message, true); toast('Mot de passe mis à jour.'); e.target.reset(); };
  const apres = async (msg) => { await chargerProfil(); toast(msg); router(); };
  vue.querySelector('#fsrv')?.addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.from('services').insert({ code: vue.querySelector('#scode').value.trim().toUpperCase(), nom: vue.querySelector('#snom').value.trim(), parent_id: vue.querySelector('#sparent').value || null, responsable: vue.querySelector('#sresp').value.trim() || null, description: vue.querySelector('#sdesc').value.trim() || null }); if (error) return toast(error.message.includes('duplicate') ? 'Ce sigle existe déjà.' : error.message, true); apres('Direction / service ajouté.'); });
  vue.querySelector('#ftyp')?.addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.from('types_courrier').insert({ nom: vue.querySelector('#tnom').value.trim(), sens: vue.querySelector('#tsens').value }); if (error) return toast(error.message.includes('duplicate') ? 'Ce type existe déjà.' : error.message, true); apres('Type de courrier ajouté.'); });
  vue.querySelector('#fcat')?.addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.from('categories').insert({ nom: vue.querySelector('#knom').value.trim() }); if (error) return toast(error.message.includes('duplicate') ? 'Cette catégorie existe déjà.' : error.message, true); apres('Catégorie ajoutée.'); });
  vue.querySelectorAll('[data-actif]').forEach((b) => b.onclick = async () => { const [table, id, actif] = b.dataset.actif.split(':'); const { error } = await sb.from(table).update({ actif: actif === '1' }).eq('id', id); if (error) return toast(error.message, true); apres(actif === '1' ? 'Réactivé.' : 'Désactivé.'); });
  vue.querySelectorAll('[data-modif]').forEach((b) => b.onclick = () => {
    const [table, id] = b.dataset.modif.split(':'); const x = (table === 'services' ? tousServices : table === 'types_courrier' ? tousTypes : toutesCat).find((y) => y.id === id); if (!x) return;
    const m = modale(`<h2>Modifier</h2>
      ${table === 'services' ? `<div class="grille2"><div class="champ"><label for="mcode">Sigle</label><input id="mcode" value="${esc(x.code)}" maxlength="12"></div><div class="champ"><label for="mnom">Nom</label><input id="mnom" value="${esc(x.nom)}"></div><div class="champ"><label for="mparent">Rattaché à</label><select id="mparent"><option value="">— Direction autonome —</option>${(tousServices || []).filter((y) => !y.parent_id && y.id !== x.id).map((y) => `<option value="${y.id}" ${x.parent_id === y.id ? 'selected' : ''}>${esc(y.nom)}</option>`).join('')}</select></div><div class="champ"><label for="mresp">Responsable</label><input id="mresp" value="${esc(x.responsable || '')}"></div><div class="champ span2"><label for="mdesc">Description</label><input id="mdesc" value="${esc(x.description || '')}"></div></div>` : ''}
      ${table === 'types_courrier' ? `<div class="grille2"><div class="champ"><label for="mnom">Nom</label><input id="mnom" value="${esc(x.nom)}"></div><div class="champ"><label for="msens">Sens</label><select id="msens">${Object.entries(SENS).map(([k, l]) => `<option value="${k}" ${x.sens === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>` : ''}
      ${table === 'categories' ? `<div class="champ"><label for="mnom">Nom</label><input id="mnom" value="${esc(x.nom)}"></div>` : ''}
      <div class="ligne-boutons"><button class="btn" id="mnon">Retour</button><button class="btn principal" id="moui">Enregistrer</button></div>`);
    m.querySelector('#mnon').onclick = () => m.remove();
    m.querySelector('#moui').onclick = async () => {
      const v = (id2) => m.querySelector('#' + id2)?.value?.trim();
      const maj = table === 'services' ? { code: v('mcode').toUpperCase(), nom: v('mnom'), parent_id: m.querySelector('#mparent').value || null, responsable: v('mresp') || null, description: v('mdesc') || null } : table === 'types_courrier' ? { nom: v('mnom'), sens: v('msens') } : { nom: v('mnom') };
      if (!maj.nom) return toast('Le nom est obligatoire.', true);
      const { error } = await sb.from(table).update(maj).eq('id', id); if (error) return toast(error.message, true); m.remove(); apres('Modifié.');
    };
  });
}

// ------------------------------------------------------------------
// Mise à jour de l'application (bannière)
// ------------------------------------------------------------------
async function verifierMiseAJour() {
  try {
    const r = await fetch(`assets/version.json?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) return;
    const { version } = await r.json();
    if (version && version !== APP_VERSION && !document.getElementById('maj-banniere')) {
      const b = document.createElement('div'); b.id = 'maj-banniere';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:60;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;padding:10px 16px;background:#8C2F1F;color:#fff;font-size:14px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.2)';
      b.innerHTML = `<span>Une nouvelle version de NEXORA est disponible (v${esc(version)}).</span><button type="button" id="maj-btn" style="height:36px;padding:0 14px;border-radius:8px;border:none;background:#fff;color:#8C2F1F;font:inherit;font-weight:700;cursor:pointer">Mettre à jour maintenant</button><button type="button" id="maj-plus-tard" style="height:36px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.5);background:none;color:#fff;font:inherit;cursor:pointer">Plus tard</button>`;
      document.body.appendChild(b);
      b.querySelector('#maj-btn').onclick = () => { location.replace(`${location.pathname}?maj=${Date.now()}${location.hash}`); };
      b.querySelector('#maj-plus-tard').onclick = () => b.remove();
    }
  } catch (e) { /* hors ligne : on réessaiera */ }
}
setInterval(verifierMiseAJour, 2 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) verifierMiseAJour(); });
setTimeout(verifierMiseAJour, 4000);

// ------------------------------------------------------------------
// Démarrage
// ------------------------------------------------------------------
sb.auth.onAuthStateChange(async (evt, session) => {
  etat.session = session;
  if (session) { if (!etat.profil || evt === 'SIGNED_IN') await chargerProfil(); }
  else etat.profil = null;
  router();
});
