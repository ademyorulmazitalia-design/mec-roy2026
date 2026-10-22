// ============================================
// MEC-ROY — script.js (VERSIONE CORRETTA)
// ============================================
// ✅ FIX #8: Fallback per t() e tGiorniSettimana()
// ✅ FIX #3: Rimosse tutte le override duplicate
// ✅ FIX #4: caricaDati legge correttamente le notifiche
// ✅ FIX #37: Uniformato tutto su sottocollezioni
// ============================================

// ─────────────────────────────────────────────
// ✅ FIX #8: FALLBACK TRADUZIONI (in cima)
// ─────────────────────────────────────────────
if (typeof window.t !== 'function') {
  window.t = function (chiave) { return chiave; };
  console.warn('⚠️ lingue.js non caricato — traduzioni disabilitate');
}
if (typeof window.tGiorniSettimana !== 'function') {
  window.tGiorniSettimana = () => ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
}

// ============================================
// CONFIGURAZIONE FIREBASE
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyCjVygYWWtq3FoARPQN_PufBXoUtZy1Z8g",
  authDomain: "mec-roy-2026.firebaseapp.com",
  projectId: "mec-roy-2026",
  storageBucket: "mec-roy-2026.firebasestorage.app",
  messagingSenderId: "236947448329",
  appId: "1:236947448329:web:57776a8a00011adb9fced8",
  measurementId: "G-1WHW3Z3RT6"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ✅ Nuova sintassi Firebase v10 (rimuove l'avviso di deprecazione)
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  ignoreUndefinedProperties: true,
  merge: true  // <--- AGGIUNGI QUESTA RIGA
});

// ============================================
// VARIABILI GLOBALI
// ============================================
let dati = {
  utenti: [],
  commesse: [],
  aziende: [{ id: 1, nome: 'MEC-ROY srls' }],
  registrazioni: [],
  richieste: [],
  notifiche: []
};
let utenteCorrente = null;
let prossimoId = 1;
let commessaCorrenteDettaglio = null;
let datiCaricati = false;

// ✅ FIX #21: variabile foto dichiarata globalmente in cima
window._fotoNuovoDipendenteBase64 = null;
window._fotoModaleBase64 = null;
window._usernameModaleFoto = null;
window._idRichiestaProtocollo = null;
window._nmNumeriCorrenti = [];
window._nmHistoryState = 'commesse';
window._timerBenvenuto = null;

// Realtime
let _stoSalvando = false;
let _unsubscribeSnapshot = null;
let _unsubReg = null;
let _unsubRich = null;
let _unsubNot = null;
let _unsubUt = null;

// Filtri
let filtriCommessa = { dataInizio: '', dataFine: '', ricerca: '', dipendenti: [] };
let dipendenteCorrenteDettaglio = null;
let filtriDipendente = {
  vista: 'mese',
  giorno: '',
  mese: new Date().getMonth() + 1,
  anno: new Date().getFullYear()
};

// Numeri Mancanti
const NM_CARTELLE_LABEL = {
  filo: 'FILO',
  cavo: 'CAVO',
  adesive: 'ADESIVE',
  targhette: 'TARGHETTE GIALLE',
  morsetti: 'MORSETTI'
};
const NM_CARTELLE_COLONNE = {
  filo: 3, cavo: 2, adesive: 4, targhette: 6, morsetti: 6
};

let nmCommessaCorrente = null;
let nmCartellaCorrente = null;
let nmCommessaDaCancellare = null;
let nmCommesseCache = {};

function nmGetCollection() {
  return db.collection('numeri_mancanti_commesse');
}

// ============================================
// ✅ FIX #37: HELPER FIRESTORE PUNTUALI
// (unica fonte di verità: sottocollezioni)
// ============================================
function _dbFirestore() {
  return firebase.firestore();
}

// ─── REGISTRAZIONI ─────────────────────────
async function regAggiungi(reg) {
  const id = String(reg.id || (Date.now() * 1000 + Math.floor(Math.random() * 1000)));
  const doc = { ...reg, id };
  await _dbFirestore().collection('registrazioni').doc(id).set(doc);
  return doc;
}
async function regAggiorna(id, datiNuovi) {
  await _dbFirestore().collection('registrazioni').doc(String(id)).update(datiNuovi);
}
async function regCancella(id) {
  await _dbFirestore().collection('registrazioni').doc(String(id)).delete();
}
function regAscolta(callback) {
  return _dbFirestore().collection('registrazioni').onSnapshot(snap => {
    const arr = [];
    snap.forEach(d => arr.push(d.data()));
    callback(arr);
  });
}

// ─── RICHIESTE ─────────────────────────────
async function richAggiungi(rich) {
  const id = String(rich.id || (Date.now() * 1000 + Math.floor(Math.random() * 1000)));
  const doc = { ...rich, id };
  await _dbFirestore().collection('richieste').doc(id).set(doc);
  return doc;
}
async function richAggiorna(id, datiNuovi) {
  await _dbFirestore().collection('richieste').doc(String(id)).update(datiNuovi);
}
function richAscolta(callback) {
  return _dbFirestore().collection('richieste').onSnapshot(snap => {
    const arr = [];
    snap.forEach(d => arr.push(d.data()));
    callback(arr);
  });
}

// ─── NOTIFICHE ─────────────────────────────
async function notAggiungi(not) {
  const id = String(not.id || (Date.now() * 1000 + Math.floor(Math.random() * 1000)));
  const doc = { ...not, id };
  await _dbFirestore().collection('notifiche').doc(id).set(doc);
  return doc;
}
async function notAggiorna(id, datiNuovi) {
  await _dbFirestore().collection('notifiche').doc(String(id)).update(datiNuovi);
}
function notAscolta(callback) {
  return _dbFirestore().collection('notifiche').onSnapshot(snap => {
    const arr = [];
    snap.forEach(d => arr.push(d.data()));
    callback(arr);
  });
}

// ─── UTENTI ────────────────────────────────
async function utenteSalva(utente) {
  if (!utente.username) throw new Error('username mancante');
  await _dbFirestore().collection('utenti').doc(utente.username).set(utente);
}
async function utenteAggiorna(username, datiNuovi) {
  await _dbFirestore().collection('utenti').doc(username).update(datiNuovi);
}
async function utenteCancella(username) {
  await _dbFirestore().collection('utenti').doc(username).delete();
}
function utentiAscolta(callback) {
  return _dbFirestore().collection('utenti').onSnapshot(snap => {
    const arr = [];
    snap.forEach(d => arr.push(d.data()));
    callback(arr);
  });
}

// ============================================
// CARICAMENTO / SALVATAGGIO DATI
// ============================================

// ✅ FIX #4: caricaDati legge correttamente le notifiche
// ✅ FIX #37: legge solo da sottocollezioni (niente array vecchi)
async function caricaDati() {
  // 1. dati/main → aziende e commesse
  let mainData = null;
  try {
    const snap = await _dbFirestore().collection('dati').doc('main').get();
    if (snap.exists) mainData = snap.data();
  } catch (e) {
    console.warn('⚠️ Errore lettura dati/main:', e);
  }

  if (!mainData) {
    // Fallback localStorage
    const saved = localStorage.getItem('datiLavoroV2');
    if (saved) {
      try {
        dati = JSON.parse(saved);
        if (!dati.aziende) dati.aziende = [{ id: 1, nome: 'MEC-ROY srls' }];
        if (!dati.commesse) dati.commesse = [];
        if (!dati.utenti) dati.utenti = [];
        if (!dati.registrazioni) dati.registrazioni = [];
        if (!dati.richieste) dati.richieste = [];
        if (!dati.notifiche) dati.notifiche = [];
        return dati;
      } catch (e) {
        console.warn('⚠️ localStorage corrotto:', e);
      }
    }
    // Default
    dati = {
      utenti: [{ username: 'admin', password: 'admin123', nome: 'Admin', cognome: 'Sistema', ruolo: 'admin' }],
      commesse: [], registrazioni: [], richieste: [], notifiche: [],
      aziende: [{ id: 1, nome: 'MEC-ROY srls' }]
    };
    return dati;
  }

  // 2. Copia base
  dati.aziende = mainData.aziende || [{ id: 1, nome: 'MEC-ROY srls' }];
  dati.commesse = mainData.commesse || [];
  dati.registrazioni = [];
  dati.richieste = [];
  dati.notifiche = [];
  dati.utenti = [];

  // 3. Leggi TUTTE le collezioni in parallelo (fix #4)
  try {
    const [regSnap, richSnap, notSnap, utSnap] = await Promise.all([
      _dbFirestore().collection('registrazioni').get(),
      _dbFirestore().collection('richieste').get(),
      _dbFirestore().collection('notifiche').get(),   // ✅ CORRETTO
      _dbFirestore().collection('utenti').get()
    ]);

    regSnap.forEach(d => dati.registrazioni.push(d.data()));
    richSnap.forEach(d => dati.richieste.push(d.data()));
    notSnap.forEach(d => dati.notifiche.push(d.data()));
    utSnap.forEach(d => dati.utenti.push(d.data()));
  } catch (e) {
    console.warn('⚠️ Errore lettura sottocollezioni:', e);
  }

  // 4. Calcola prossimoId
  let maxId = 0;
  dati.registrazioni.forEach(r => { if (Number(r.id) > maxId) maxId = Number(r.id); });
  dati.richieste.forEach(r => { if (Number(r.id) > maxId) maxId = Number(r.id); });
  dati.notifiche.forEach(n => { if (Number(n.id) > maxId) maxId = Number(n.id); });
  prossimoId = maxId + 1;

  datiCaricati = true; // ✅ AGGIUNTO: i dati sono pronti!
  return dati;
}

// ✅ FIX #7: salvaDati imposta correttamente _stoSalvando
// ✅ FIX #37: salva solo aziende/commesse in dati/main
async function salvaDati() {
  _stoSalvando = true;
  try {
    const daSalvare = {
      aziende: dati.aziende || [],
      commesse: dati.commesse || []
    };
    await _dbFirestore().collection('dati').doc('main').set(daSalvare, { merge: true });
    try { localStorage.setItem('datiLavoroV2', JSON.stringify(dati)); } catch (e) {}
  } catch (err) {
    console.warn('⚠️ Errore salvataggio dati/main:', err);
  } finally {
    setTimeout(() => { _stoSalvando = false; }, 1500);
  }
}

// ============================================
// ASCOLTO REALTIME
// ✅ FIX #37: solo sottocollezioni + dati/main
// ============================================
function attivaAscoltoRealtime() {
  // Ferma i listener precedenti
  [_unsubscribeSnapshot, _unsubReg, _unsubRich, _unsubNot, _unsubUt].forEach(fn => {
    if (typeof fn === 'function') { try { fn(); } catch (e) {} }
  });

  console.log('🔄 Attivo ascolti realtime...');

  // 1. dati/main → aziende, commesse
  _unsubscribeSnapshot = _dbFirestore().collection('dati').doc('main').onSnapshot(snap => {
    if (!snap.exists || _stoSalvando) return;
    const remoto = snap.data();
    dati.aziende = remoto.aziende || dati.aziende || [];
    dati.commesse = remoto.commesse || dati.commesse || [];
    if (utenteCorrente) aggiornaUIDopoRealtime();
  });

  // 2. registrazioni
  _unsubReg = regAscolta(arr => {
    dati.registrazioni = arr;
    if (utenteCorrente) aggiornaUIDopoRealtime();
  });

  // 3. richieste
  _unsubRich = richAscolta(arr => {
    dati.richieste = arr;
    if (utenteCorrente) aggiornaUIDopoRealtime();
  });

  // 4. notifiche
  _unsubNot = notAscolta(arr => {
    dati.notifiche = arr;
    if (utenteCorrente) aggiornaBadgeNotifiche();
  });

  // 5. utenti
  _unsubUt = utentiAscolta(arr => {
    dati.utenti = arr;
    if (utenteCorrente) aggiornaUIDopoRealtime();
  });
}

function aggiornaUIDopoRealtime() {
  if (!utenteCorrente) return;
  aggiornaBadgeRichieste();
  aggiornaBadgeNotifiche();

  const panelAttivo = document.querySelector('.panel.active');
  if (!panelAttivo) return;
  const id = panelAttivo.id;

  if (id === 'panel-richieste' && utenteCorrente.ruolo === 'admin') caricaRichiesteAdmin();
  if (id === 'panel-richiedi') caricaRichiesteDipendente();
  if (id === 'panel-dipendenti' && utenteCorrente.ruolo === 'admin') caricaListaDipendenti();
  if (id === 'panel-commesse' && utenteCorrente.ruolo === 'admin') caricaListaCommesse();
  if (id === 'panel-calendario') caricaCalendario();
}

// ============================================
// HELPER
// ============================================
function isWeekendOggi() {
  const giorno = new Date().getDay();
  return giorno === 0 || giorno === 6;
}

function isOltre20() {
  return new Date().getHours() >= 20;
}

// ✅ FIX #9: controlloSovrapposizioni completo
function controllaSovrapposizioni(username, data, ora_inizio, ora_fine, tipo) {
  const isRecupero = (tipo === 'recupero_ore');

  // 1. Controllo su registrazioni esistenti (lavoro)
  if (ora_inizio && ora_fine) {
    const oreEsistenti = dati.registrazioni.filter(r =>
      r.utente_id === username &&
      r.data === data &&
      r.tipo === 'lavoro' &&
      r.ora_inizio && r.ora_fine &&
      !(ora_fine <= r.ora_inizio || ora_inizio >= r.ora_fine)
    );
    if (oreEsistenti.length > 0) {
      const r = oreEsistenti[0];
      return {
        tipo: 'ore',
        messaggio: `Hai già ore registrate il ${data} dalle ${r.ora_inizio} alle ${r.ora_fine}. Correggi l'orario.`
      };
    }
  }

  // 2. Controllo su richieste pendenti/approvate
  const richiesteEsistenti = dati.richieste.filter(r => {
    if (r.utente_id !== username) return false;
    if (r.stato === 'rifiutata' || r.stato === 'annullata') return false;

    if (r.tipo === 'recupero_ore' && isRecupero) {
      return r.data === data &&
        r.ora_inizio && r.ora_fine &&
        ora_inizio && ora_fine &&
        !(ora_fine <= r.ora_inizio || ora_inizio >= r.ora_fine);
    }

    if (r.tipo !== 'recupero_ore') {
      if (data >= r.data_inizio && data <= r.data_fine) {
        return true;
      }
    }
    return false;
  });

  if (richiesteEsistenti.length > 0) {
    const r = richiesteEsistenti[0];
    const tipoLabel = r.tipo.replace('_', ' ');
    if (r.tipo === 'recupero_ore') {
      return {
        tipo: 'richiesta',
        messaggio: `Hai già una richiesta in attesa per ${r.data} dalle ${r.ora_inizio} alle ${r.ora_fine}. Attendi la risposta dell'admin.`
      };
    }
    return {
      tipo: 'richiesta',
      messaggio: `Hai già una richiesta di ${tipoLabel} dal ${r.data_inizio} al ${r.data_fine}. Correggi le date.`
    };
  }

  return null;
}

// ============================================
// LOGIN
// ============================================
function login() {
  // ✅ PROTEZIONE: Blocca il click se i dati non sono ancora arrivati da Firebase
  if (!dati || !dati.utenti || dati.utenti.length === 0) {
    const erroreDiv = document.getElementById('errore');
    erroreDiv.innerHTML = "⏳ Connessione in corso... attendi 2 secondi e riprova.";
    erroreDiv.style.display = 'block';
    return;
  }

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const ricordami = document.getElementById('ricordami').checked;

  const utente = dati.utenti.find(u => u.username === username && u.password === password);

  if (utente) {
    utenteCorrente = utente;
    salvaSessione(utente.username);
    caricaLinguaSalvata(utente.username);

    if (ricordami) {
      localStorage.setItem('ricordami_username', username);
      localStorage.setItem('ricordami_password', password);
      localStorage.setItem('ricordami_attivo', 'true');
    } else {
      localStorage.removeItem('ricordami_username');
      localStorage.removeItem('ricordami_password');
      localStorage.removeItem('ricordami_attivo');
    }

    const loginBox = document.querySelector('.login-box');
    if (loginBox) {
      loginBox.classList.add('fade-out');
      setTimeout(() => {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('main-page').style.display = 'block';
        document.getElementById('errore').style.display = 'none';
        loginBox.classList.remove('fade-out');
      }, 220);
    } else {
      document.getElementById('login-page').style.display = 'none';
      document.getElementById('main-page').style.display = 'block';
      document.getElementById('errore').style.display = 'none';
    }

    const ruoloBadge = document.getElementById('user-ruolo');
    ruoloBadge.textContent = utente.ruolo === 'admin' ? t('dip_admin') : t('dip_dipendente');
    ruoloBadge.className = 'badge ' + utente.ruolo;

    configuraUIUtente(utente);
    inizializzaAppPerUtente(utente);

    attivaAscoltoRealtime();
    mostraSchermataBenvenuto(utente);

    setTimeout(() => {
      applicaTraduzioni();
      popolaTendinaLingua();
    }, 300);

    // Attivazione biometrica post-login (se richiesta)
    const checkboxAttiva = document.getElementById('attiva-impronta');
    if (checkboxAttiva && checkboxAttiva.checked && typeof bioSupportato === 'function' && bioSupportato()) {
      setTimeout(async () => {
        if (utenteCorrente && bioSupportato()) {
          const risultato = await attivaBiometrico(utenteCorrente.username);
          if (risultato.ok) {
            if (typeof aggiornaUILoginBiometrico === 'function') aggiornaUILoginBiometrico();
          } else {
            alert('⚠️ ' + risultato.errore);
          }
        }
      }, 500);
    }

  } else {
    const loginBox = document.querySelector('.login-box');
    if (loginBox) {
      loginBox.classList.remove('shake');
      void loginBox.offsetWidth;
      loginBox.classList.add('shake');
      setTimeout(() => loginBox.classList.remove('shake'), 550);
    }
    // ✅ Ripristina il testo dell'errore standard se le credenziali sono sbagliate
    document.getElementById('errore').innerHTML = "Credenziali errate";
    document.getElementById('errore').style.display = 'block';
  }
}

// Estrae la logica di configurazione UI (usata anche dal login biometrico)
function configuraUIUtente(utente) {
  if (utente.ruolo === 'admin') {
    document.getElementById('tab-registra').style.display = 'none';
    document.getElementById('tab-richiedi').style.display = 'none';
    document.getElementById('dropdown-gestione').style.display = 'inline-block';
    document.getElementById('dropdown-operativita').style.display = 'inline-block';
    document.getElementById('tab-calendario').style.display = 'inline-block';
    document.getElementById('tab-numeri-mancanti').style.display = 'inline-block';
    document.getElementById('cal-filtro-dipendente').style.display = 'block';
    document.getElementById('btn-password').style.display = 'flex';
    document.getElementById('azienda-container').style.display = 'inline-block';
    document.getElementById('cal-vista-selector').style.display = 'flex';

    caricaSelectAziende();
    caricaSelectAziendeCommesse();
    caricaSelectDipendentiModifica();
    caricaSelectDipendentiCalendario();
    caricaRichiesteAdmin();
    caricaListaDipendenti();
    aggiornaBadgeRichieste();
    showTab('calendario');
  } else {
    document.getElementById('tab-registra').style.display = 'inline-block';
    document.getElementById('tab-richiedi').style.display = 'inline-block';
    document.getElementById('dropdown-gestione').style.display = 'none';
    document.getElementById('dropdown-operativita').style.display = 'none';
    document.getElementById('tab-calendario').style.display = 'inline-block';
    document.getElementById('tab-numeri-mancanti').style.display = 'inline-block';
    document.getElementById('cal-filtro-dipendente').style.display = 'none';
    document.getElementById('btn-password').style.display = 'none';
    document.getElementById('azienda-container').style.display = 'none';
    document.getElementById('cal-vista-selector').style.display = 'flex';
    showTab('registra');
  }

  document.getElementById('notifiche-container').style.display = 'inline-block';
  aggiornaBadgeNotifiche();
  caricaDarkMode();
}

// Inizializza date, select, listener comuni
function inizializzaAppPerUtente(utente) {
  const oggi = new Date().toISOString().split('T')[0];
  const dataReg = document.getElementById('data-reg');
  if (dataReg) {
    dataReg.value = oggi;
    dataReg.disabled = true;
    dataReg.style.backgroundColor = '#f0f0f0';
    dataReg.style.cursor = 'not-allowed';
  }

  const adesso = new Date();
  const calMese = document.getElementById('cal-mese');
  const calAnno = document.getElementById('cal-anno');
  if (calMese) calMese.value = adesso.getMonth() + 1;
  if (calAnno) calAnno.value = adesso.getFullYear();

  ['richiesta-data-inizio', 'richiesta-data-fine', 'modifica-data', 'recupero-data'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = oggi;
  });

  caricaSelectRecuperoCommesse();

  const tipoRichiesta = document.getElementById('tipo-richiesta');
  if (tipoRichiesta) {
    tipoRichiesta.addEventListener('change', function () {
      const tipo = this.value;
      document.getElementById('gruppo-certificato').style.display = tipo === 'malattia' ? 'block' : 'none';
      document.getElementById('gruppo-recupero').style.display = tipo === 'recupero_ore' ? 'block' : 'none';
      document.getElementById('campi-standard').style.display = (tipo === 'recupero_ore') ? 'none' : 'block';
      const mostraOrari = (tipo === 'ferie' || tipo === 'permesso');
      document.getElementById('riga-orari-opzionali').style.display = mostraOrari ? 'flex' : 'none';
      document.getElementById('hint-orari-opzionali').style.display = mostraOrari ? 'block' : 'none';
    });
  }

  if (utente.ruolo === 'dipendente') {
    const oraInizio = document.getElementById('ora-inizio');
    if (oraInizio) {
      const ora = new Date();
      oraInizio.value = ora.getHours().toString().padStart(2, '0') + ':00';
    }
    const straord = document.getElementById('straordinario');
    if (straord) {
      straord.addEventListener('change', function () {
        const oraInizio = document.getElementById('ora-inizio');
        if (this.checked) {
          oraInizio.disabled = false;
          oraInizio.style.backgroundColor = 'white';
          oraInizio.style.cursor = 'text';
          document.getElementById('info-registrazione').innerHTML = `
            <div class="info-msg" style="background:#ffebee;border-color:#d32f2f;color:#d32f2f;">
              ⏰ <strong>Modalità Straordinario attivata!</strong> Le ore oltre le 8 verranno segnate come straordinario.
            </div>`;
        } else {
          caricaUltimaRegistrazione();
        }
      });
    }
    caricaUltimaRegistrazione();
  }

  const menuC = document.getElementById('commesse-menu');
  const aggC = document.getElementById('commesse-aggiungi');
  const anaC = document.getElementById('commesse-analizza');
  if (menuC) menuC.style.display = 'block';
  if (aggC) aggC.style.display = 'none';
  if (anaC) anaC.style.display = 'none';

  caricaSelectCommesse();
  caricaListaCommesse();
  caricaRichiesteDipendente();

  setTimeout(() => {
    if (typeof chiediPermessoNotifiche === 'function') chiediPermessoNotifiche();
    if (typeof ascoltaRinnovoToken === 'function') ascoltaRinnovoToken();
  }, 1500);

  // Init smart time
  ['ora-inizio', 'ora-fine', 'recupero-ora-inizio', 'recupero-ora-fine',
    'richiesta-ora-inizio', 'richiesta-ora-fine'].forEach(id => {
    const el = document.getElementById(id);
    if (el && typeof initSmartTime === 'function') initSmartTime(el);
  });
}

// ============================================
// SHOW TAB
// ============================================
function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.dropdown-btn').forEach(b => b.classList.remove('active'));

  const tabButton = document.querySelector(`.tab[onclick="showTab('${tab}')"]`);
  if (tabButton) tabButton.classList.add('active');

  if (tab === 'dipendenti' || tab === 'commesse') {
    const btn = document.querySelector('#dropdown-gestione .dropdown-btn');
    if (btn) btn.classList.add('active');
  }
  if (tab === 'modifica' || tab === 'richieste') {
    const btn = document.querySelector('#dropdown-operativita .dropdown-btn');
    if (btn) btn.classList.add('active');
  }

  const panel = document.getElementById('panel-' + tab);
  if (panel) panel.classList.add('active');

  if (tab === 'modifica') caricaRegistrazioniModifica();
  if (tab === 'commesse') caricaListaCommesse();
  if (tab === 'dipendenti') caricaListaDipendenti();
  if (tab === 'richieste') { caricaRichiesteAdmin(); aggiornaBadgeRichieste(); }
  if (tab === 'richiedi') caricaRichiesteDipendente();
  if (tab === 'numeri-mancanti') {
    nmMostraSchermataCommesse();
    nmCommessaCorrente = null;
    nmCartellaCorrente = null;
    nmCaricaListaCommesse();
  }
  if (tab === 'calendario') {
    const adesso = new Date();
    const meseSelect = document.getElementById('cal-mese');
    const annoInput = document.getElementById('cal-anno');
    if (meseSelect) meseSelect.value = adesso.getMonth() + 1;
    if (annoInput) annoInput.value = adesso.getFullYear();
    caricaCalendario();
  }
}

// ============================================
// DARK MODE
// ============================================
function toggleDarkMode() {
  const container = document.getElementById('app-container');
  const body = document.body;
  container.classList.toggle('dark-mode');
  body.classList.toggle('dark-mode');
  const btn = document.getElementById('btn-darkmode');
  const isDark = container.classList.contains('dark-mode');
  if (isDark) {
    btn.innerHTML = '<i class="fas fa-sun"></i>';
    localStorage.setItem('darkMode_' + (utenteCorrente?.username || 'default'), 'true');
  } else {
    btn.innerHTML = '<i class="fas fa-moon"></i>';
    localStorage.setItem('darkMode_' + (utenteCorrente?.username || 'default'), 'false');
  }
}
function caricaDarkMode() {
  if (!utenteCorrente) return;
  const saved = localStorage.getItem('darkMode_' + utenteCorrente.username);
  if (saved === 'true') {
    document.getElementById('app-container').classList.add('dark-mode');
    document.body.classList.add('dark-mode');
    document.getElementById('btn-darkmode').innerHTML = '<i class="fas fa-sun"></i>';
  }
}

// ============================================
// AZIENDE
// ============================================
function caricaSelectAziende() {
  const select = document.getElementById('select-azienda');
  if (!select) return;
  const val = select.value;
  select.innerHTML = `<option value="0">${t('header_tutte')}</option>`;
  (dati.aziende || []).forEach(a => {
    select.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
  });
  if (val) select.value = val;
}

function caricaSelectAziendeCommesse() {
  const select = document.getElementById('commessa-azienda');
  if (!select) return;
  select.innerHTML = '<option value="0">-- Seleziona Azienda --</option>';
  (dati.aziende || []).forEach(a => {
    select.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
  });
}

function caricaSelectRecuperoCommesse() {
  const select = document.getElementById('recupero-commessa');
  if (!select) return;
  if (!dati || !Array.isArray(dati.commesse)) {
    setTimeout(caricaSelectRecuperoCommesse, 300);
    return;
  }
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  dati.commesse.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
  });
}

function cambiaAzienda() {
  caricaCalendario();
  caricaListaDipendenti();
}

function apriModalAziende() {
  if (utenteCorrente?.ruolo !== 'admin') { alert('Solo gli amministratori possono gestire le aziende'); return; }
  const modal = document.getElementById('modal-aziende');
  if (modal) { modal.classList.add('active'); caricaListaAziende(); }
}
function chiudiModalAziende() {
  document.getElementById('modal-aziende')?.classList.remove('active');
}
function aggiungiAzienda() {
  const nome = document.getElementById('azienda-nome').value.trim();
  const msg = document.getElementById('msg-azienda');
  if (!nome) { msg.innerHTML = '<div class="error">❌ Inserisci il nome dell\'azienda</div>'; return; }
  if (!dati.aziende) dati.aziende = [];
  const maxId = dati.aziende.reduce((max, a) => a.id > max ? a.id : max, 0);
  dati.aziende.push({ id: maxId + 1, nome });
  salvaDati();
  document.getElementById('azienda-nome').value = '';
  msg.innerHTML = '<div class="success">✅ Azienda aggiunta con successo!</div>';
  caricaListaAziende();
  caricaSelectAziende();
  caricaSelectAziendeCommesse();
}
function caricaListaAziende() {
  const div = document.getElementById('lista-aziende');
  if (!div) return;
  if (!dati.aziende || dati.aziende.length === 0) {
    div.innerHTML = '<p class="text-muted">Nessuna azienda</p>';
    return;
  }
  let html = '<div class="table-wrapper"><table><thead><tr><th>ID</th><th>Nome</th><th>Azioni</th></tr></thead><tbody>';
  dati.aziende.forEach(a => {
    const canDelete = dati.aziende.length > 1;
    html += `<tr><td>${a.id}</td><td><strong>${a.nome}</strong></td><td>${canDelete ? `<button class="btn-danger" onclick="eliminaAzienda(${a.id})"><i class="fas fa-trash"></i></button>` : '<span style="color:#999;font-size:0.8em;">(ultima)</span>'}</td></tr>`;
  });
  html += '</tbody></table></div>';
  div.innerHTML = html;
}
function eliminaAzienda(id) {
  if (!confirm('Eliminare questa azienda? Verranno eliminati anche i dipendenti associati.')) return;
  const usernames = dati.utenti.filter(u => u.azienda_id === id).map(u => u.username);
  dati.utenti = dati.utenti.filter(u => u.azienda_id !== id);
  dati.registrazioni = dati.registrazioni.filter(r => !usernames.includes(r.utente_id));
  dati.richieste = dati.richieste.filter(r => !usernames.includes(r.utente_id));
  dati.notifiche = dati.notifiche.filter(n => !usernames.includes(n.utente_id));
  dati.aziende = dati.aziende.filter(a => a.id !== id);
  salvaDati();
  caricaListaAziende();
  caricaSelectAziende();
  caricaSelectAziendeCommesse();
  caricaListaDipendenti();
  alert('🗑️ Azienda eliminata');
}

// ============================================
// ULTIMA REGISTRAZIONE
// ============================================
function caricaUltimaRegistrazione() {
  if (utenteCorrente?.ruolo === 'admin') return;

  const oraInizioEl = document.getElementById('ora-inizio');
  const oraFineEl = document.getElementById('ora-fine');
  const straordEl = document.getElementById('straordinario');
  const infoDiv = document.getElementById('info-registrazione');
  if (!oraInizioEl || !oraFineEl || !infoDiv) return;

  oraInizioEl.disabled = false;
  oraInizioEl.style.backgroundColor = 'white';

  if (isOltre20()) {
    infoDiv.innerHTML = `
      <div class="error" style="background:#ffebee;border-color:#d32f2f;color:#d32f2f;font-weight:bold;">
        ⛔ <strong>Ore 20:00 superate!</strong> Non è più possibile registrare ore per oggi.
        <br><small>Contatta l'amministratore per eventuali recuperi.</small>
      </div>`;
    oraInizioEl.disabled = true;
    oraFineEl.disabled = true;
    if (straordEl) straordEl.disabled = true;
    return;
  }

  const oggi = new Date().toISOString().split('T')[0];
  const oraCorrente = new Date();
  const oreCorrente = oraCorrente.getHours();
  const isPomeriggio = oreCorrente >= 13;

  const registrazioniOggi = dati.registrazioni.filter(r =>
    r.utente_id === utenteCorrente.username && r.data === oggi && r.tipo === 'lavoro'
  );

  if (straordEl && straordEl.checked) return;

  let ultima = null;
  if (registrazioniOggi.length > 0) {
    ultima = registrazioniOggi.reduce((max, r) => r.ora_fine > max.ora_fine ? r : max, registrazioniOggi[0]);
  }

  if (isPomeriggio) {
    oraInizioEl.disabled = false;
    oraInizioEl.style.backgroundColor = 'white';
    oraFineEl.disabled = false;
    oraFineEl.style.backgroundColor = 'white';

    if (ultima) {
      const h = parseInt(ultima.ora_fine.split(':')[0]);
      oraInizioEl.value = h < 13 ? '13:00' : ultima.ora_fine;
    } else {
      const oreOra = oreCorrente.toString().padStart(2, '0') + ':00';
      oraInizioEl.value = (oreCorrente <= 23) ? oreOra : '13:00';
    }

    const oraCorrenteMinuti = oraCorrente.getHours() * 60 + oraCorrente.getMinutes();
    const inizioMinuti = parseInt(oraInizioEl.value.split(':')[0]) * 60 + parseInt(oraInizioEl.value.split(':')[1] || 0);
    if (inizioMinuti > oraCorrenteMinuti) {
      oraInizioEl.value = oreCorrente.toString().padStart(2, '0') + ':00';
    }
    const hFine = (parseInt(oraInizioEl.value.split(':')[0]) + 1).toString().padStart(2, '0');
    oraFineEl.value = hFine + ':00';
    infoDiv.innerHTML = `<div class="info-msg" style="background:#fff3cd;border-color:#ffc107;color:#856404;">⏰ <strong>Pomeriggio</strong> - Ora inizio e fine sono modificabili.</div>`;
    return;
  }

  if (!ultima) {
    oraInizioEl.disabled = false;
    oraInizioEl.value = oreCorrente.toString().padStart(2, '0') + ':00';
    oraFineEl.disabled = false;
    const hFine = (parseInt(oraInizioEl.value.split(':')[0]) + 1).toString().padStart(2, '0');
    oraFineEl.value = hFine + ':00';
    infoDiv.innerHTML = `<div class="info-msg">⏱️ Prima registrazione - Inserisci gli orari.</div>`;
    return;
  }

  oraInizioEl.value = ultima.ora_fine;
  oraInizioEl.disabled = true;
  oraInizioEl.style.backgroundColor = '#f0f0f0';
  oraFineEl.disabled = false;
  oraFineEl.style.backgroundColor = 'white';
  const hFine = (parseInt(ultima.ora_fine.split(':')[0]) + 1).toString().padStart(2, '0');
  oraFineEl.value = hFine + ':00';
  infoDiv.innerHTML = `<div class="info-msg">⏱️ <strong>Ora inizio:</strong> ${ultima.ora_fine} (bloccata) - Puoi modificare l'ora fine.</div>`;
}

// ============================================
// SELECT COMMESSE
// ============================================
function caricaSelectCommesse() {
  const select = document.getElementById('commessa');
  if (!select) return;
  if (!dati || !Array.isArray(dati.utenti)) {
    setTimeout(caricaSelectCommesse, 300);
    return;
  }
  const valCorrente = select.value;
  select.innerHTML = `<option value="">${t('reg_commessa_ph')}</option>`;
  if (!dati.commesse || dati.commesse.length === 0) {
    select.innerHTML = `<option value="">${t('reg_commessa_nessuna')}</option>`;
    return;
  }
  dati.commesse.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
  });
  if (valCorrente) select.value = valCorrente;
}

// ============================================
// COMMESSE CRUD
// ============================================
function aggiungiCommessa() {
  const nome = document.getElementById('commessa-nome').value.trim();
  const azienda_id = parseInt(document.getElementById('commessa-azienda').value);
  const msg = document.getElementById('msg-commessa');
  if (!nome) { msg.innerHTML = '<div class="error">Inserisci il nome della commessa</div>'; return; }
  if (!azienda_id || azienda_id === 0) { msg.innerHTML = '<div class="error">Seleziona un\'azienda</div>'; return; }
  const maxId = dati.commesse.reduce((max, c) => c.id > max ? c.id : max, 0);
  dati.commesse.push({
    id: maxId + 1, nome, azienda_id, attivo: true,
    data_creazione: new Date().toISOString()
  });
  salvaDati();
  document.getElementById('commessa-nome').value = '';
  document.getElementById('commessa-azienda').value = '0';
  msg.innerHTML = '<div class="success">✅ Commessa aggiunta!</div>';
  caricaSelectCommesse();
  caricaListaCommesse();
  caricaSelectRecuperoCommesse();
}

function caricaListaCommesse() {
  const div = document.getElementById('lista-commesse');
  if (!div) return;
  if (!dati.commesse || dati.commesse.length === 0) {
    div.innerHTML = '<p class="text-muted">📭 Nessuna commessa creata</p>';
    return;
  }
  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += `<th>${t('com_nome').replace(' *', '')}</th><th>${t('com_azienda').replace(' *', '')}</th><th>Azioni</th>`;
  html += '</tr></thead><tbody>';
  dati.commesse.forEach(c => {
    const azienda = dati.aziende.find(a => a.id === c.azienda_id);
    html += '<tr>';
    html += '<td><strong>' + c.nome + '</strong></td>';
    html += '<td>' + (azienda ? azienda.nome : '-') + '</td>';
    html += '<td>';
    html += '<button class="btn-warning" onclick="apriModificaCommessa(' + c.id + ')" style="margin-right:5px;" title="Modifica"><i class="fas fa-edit"></i></button>';
    html += '<button class="btn-danger" onclick="eliminaCommessa(' + c.id + ')" title="Elimina"><i class="fas fa-trash"></i></button>';
    html += '</td></tr>';
  });
  html += '</tbody></table></div>';
  div.innerHTML = html;
}

function apriModificaCommessa(id) {
  const commessa = dati.commesse.find(c => c.id === id);
  if (!commessa) return;
  const nuovoNome = prompt('Inserisci il nuovo nome della commessa:', commessa.nome);
  if (nuovoNome && nuovoNome.trim() !== '') {
    commessa.nome = nuovoNome.trim();
    salvaDati();
    caricaListaCommesse();
    caricaSelectCommesse();
    alert('✅ Commessa modificata con successo!');
  }
}

function eliminaCommessa(id) {
  if (!confirm('Eliminare questa commessa? Verranno eliminate anche tutte le ore registrate su di essa.')) return;
  dati.commesse = dati.commesse.filter(c => c.id !== id);
  dati.registrazioni = dati.registrazioni.filter(r => r.commessa_id !== id);
  salvaDati();
  caricaListaCommesse();
  caricaSelectCommesse();
  caricaSelectRecuperoCommesse();
  alert('🗑️ Commessa eliminata');
}

// ============================================
// SALVA REGISTRAZIONE
// ✅ FIX #13: ID univoci (Date.now + random)
// ✅ FIX #37: scrittura puntuale su collezione
// ============================================
async function salvaRegistrazione() {
  if (utenteCorrente?.ruolo === 'admin') { alert('Gli amministratori non possono registrare ore qui'); return; }

  if (isOltre20()) {
    document.getElementById('msg-registra').innerHTML = `
      <div class="error" style="background:#ffebee;border-color:#d32f2f;color:#d32f2f;font-weight:bold;">
        ⛔ <strong>Ore 20:00 superate!</strong> Non è più possibile registrare ore per oggi.
      </div>`;
    return;
  }

  const commessa_id = parseInt(document.getElementById('commessa').value);
  const data = document.getElementById('data-reg').value;
  const ora_inizio = document.getElementById('ora-inizio').value;
  const ora_fine = document.getElementById('ora-fine').value;
  const descrizione = document.getElementById('descrizione').value.trim();
  const straordinario = document.getElementById('straordinario').checked;
  const msg = document.getElementById('msg-registra');

  if (!commessa_id) { msg.innerHTML = '<div class="error">❌ Seleziona una commessa</div>'; return; }
  if (!data) { msg.innerHTML = '<div class="error">❌ Data non valida</div>'; return; }
  if (!ora_inizio) { msg.innerHTML = '<div class="error">❌ Inserisci l\'ora di inizio</div>'; return; }
  if (!ora_fine) { msg.innerHTML = '<div class="error">❌ Inserisci l\'ora di fine</div>'; return; }
  if (!descrizione) { msg.innerHTML = '<div class="error">❌ Inserisci una descrizione del lavoro svolto</div>'; return; }
  if (ora_inizio >= ora_fine) { msg.innerHTML = '<div class="error">L\'ora fine deve essere dopo l\'ora inizio</div>'; return; }

  const adesso = new Date();
  const minutiAdesso = adesso.getHours() * 60 + adesso.getMinutes();
  const minutiInizio = parseInt(ora_inizio.split(':')[0]) * 60 + parseInt(ora_inizio.split(':')[1] || 0);
  if (minutiInizio > minutiAdesso) {
    msg.innerHTML = `<div class="error">❌ Non puoi segnare un orario nel futuro! L'ora attuale è ${adesso.getHours()}:${String(adesso.getMinutes()).padStart(2, '0')}.</div>`;
    return;
  }

  if (!straordinario) {
    const isPomeriggio = adesso.getHours() >= 13;
    const oraInizioNum = parseInt(ora_inizio.split(':')[0]);
    if (isPomeriggio && oraInizioNum < 13) {
      msg.innerHTML = `<div class="error">❌ Non puoi segnare ore mattutine dopo le 13:00.<br><small>Se hai dimenticato di segnare le ore, usa <strong>"Richiedi Recupero Ore"</strong>.</small></div>`;
      return;
    }
  }

  const esistente = dati.registrazioni.find(r =>
    r.utente_id === utenteCorrente.username &&
    r.data === data &&
    ((ora_inizio >= r.ora_inizio && ora_inizio < r.ora_fine) ||
      (ora_fine > r.ora_inizio && ora_fine <= r.ora_fine) ||
      (ora_inizio <= r.ora_inizio && ora_fine >= r.ora_fine))
  );
  if (esistente) {
    msg.innerHTML = '<div class="error">❌ Orario in sovrapposizione (' + esistente.ora_inizio + ' - ' + esistente.ora_fine + ')</div>';
    return;
  }

  const [h1, m1] = ora_inizio.split(':').map(Number);
  const [h2, m2] = ora_fine.split(':').map(Number);
  let oreLavorate = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  let isStraordinario = false;
  const maxOre = 8;

  if (straordinario) {
    isStraordinario = (oreLavorate > maxOre);
  } else if (oreLavorate > maxOre) {
    oreLavorate = maxOre;
    msg.innerHTML = `
      <div class="success">✅ Registrazione salvata!</div>
      <div class="info-msg" style="background:#fff3cd;border-color:#ffc107;color:#856404;margin-top:10px;">
        ⚠️ Le ore totali superavano 8h. Sono state arrotondate a 8h (straordinario non pagato).<br>
        <small>Per segnare straordinario, attiva il flag "Straordinario" prima di salvare.</small>
      </div>`;
  }

  const nuovaReg = {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    utente_id: utenteCorrente.username,
    commessa_id: commessa_id,
    data: data,
    ora_inizio: ora_inizio,
    ora_fine: ora_fine,
    descrizione: descrizione + (isStraordinario ? ' (STRAORDINARIO)' : ''),
    tipo: 'lavoro',
    straordinario: isStraordinario,
    ore: oreLavorate
  };

  try {
    await regAggiungi(nuovaReg);
    if (!dati.registrazioni.some(r => r.id === nuovaReg.id)) dati.registrazioni.push(nuovaReg);
    if (!msg.innerHTML.includes('arrotondate')) {
      msg.innerHTML = '<div class="success">✅ Registrazione salvata!</div>';
    }
    document.getElementById('ora-fine').value = '';
    document.getElementById('descrizione').value = '';
    document.getElementById('straordinario').checked = false;
    caricaUltimaRegistrazione();
  } catch (err) {
    console.error('❌ Errore salvataggio:', err);
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

// ============================================
// INVIA RICHIESTA
// ✅ FIX #13: ID univoci
// ✅ FIX #37: scrittura puntuale
// ============================================
async function inviaRichiesta() {
  if (utenteCorrente?.ruolo === 'admin') { alert('Gli amministratori non possono fare richieste'); return; }

  const tipo = document.getElementById('tipo-richiesta').value;
  const msg = document.getElementById('msg-richiesta');

  try {
    if (tipo === 'recupero_ore') {
      const data = document.getElementById('recupero-data').value;
      const ora_inizio = document.getElementById('recupero-ora-inizio').value;
      const ora_fine = document.getElementById('recupero-ora-fine').value;
      const commessa_id = parseInt(document.getElementById('recupero-commessa').value) || null;
      const descrizione_lavoro = document.getElementById('recupero-motivo').value.trim();

      if (!data || !ora_inizio || !ora_fine || !descrizione_lavoro) {
        msg.innerHTML = '<div class="error">Compila tutti i campi obbligatori</div>'; return;
      }
      if (ora_inizio >= ora_fine) {
        msg.innerHTML = '<div class="error">L\'ora fine deve essere dopo l\'ora inizio</div>'; return;
      }
      const oggi = new Date().toISOString().split('T')[0];
      if (data > oggi) { msg.innerHTML = '<div class="error">Non puoi richiedere recupero per date future</div>'; return; }

      const sovrapposizione = controllaSovrapposizioni(utenteCorrente.username, data, ora_inizio, ora_fine, 'recupero_ore');
      if (sovrapposizione) { msg.innerHTML = '<div class="error">❌ ' + sovrapposizione.messaggio + '</div>'; return; }

      const richiesta = {
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        utente_id: utenteCorrente.username,
        tipo, data, ora_inizio, ora_fine, commessa_id, descrizione_lavoro,
        stato: 'pending',
        data_richiesta: new Date().toISOString()
      };

      await richAggiungi(richiesta);
      dati.richieste.push(richiesta);
      await inviaTriggerRichiesta(richiesta);

      msg.innerHTML = '<div class="success">✅ Richiesta di recupero ore inviata! Attendi l\'approvazione.</div>';
      document.getElementById('recupero-data').value = '';
      document.getElementById('recupero-ora-inizio').value = '';
      document.getElementById('recupero-ora-fine').value = '';
      document.getElementById('recupero-motivo').value = '';
      aggiornaBadgeRichieste();
      caricaRichiesteDipendente();
      return;
    }

    // Ferie / permesso / malattia
    const data_inizio = document.getElementById('richiesta-data-inizio').value;
    const data_fine = document.getElementById('richiesta-data-fine').value;
    const note = document.getElementById('richiesta-note').value.trim();

    if (!data_inizio || !data_fine) { msg.innerHTML = '<div class="error">Inserisci le date</div>'; return; }
    if (data_inizio > data_fine) { msg.innerHTML = '<div class="error">La data inizio deve essere prima della data fine</div>'; return; }

    const ora_inizio_richiesta = document.getElementById('richiesta-ora-inizio').value.trim();
    const ora_fine_richiesta = document.getElementById('richiesta-ora-fine').value.trim();
    const oraInizioCheck = (ora_inizio_richiesta && ora_fine_richiesta) ? ora_inizio_richiesta : null;
    const oraFineCheck = (ora_inizio_richiesta && ora_fine_richiesta) ? ora_fine_richiesta : null;

    let dataCorrente = new Date(data_inizio);
    const dataFine = new Date(data_fine);
    const giorniDaControllare = [];
    while (dataCorrente <= dataFine) {
      giorniDaControllare.push(dataCorrente.toISOString().split('T')[0]);
      dataCorrente.setDate(dataCorrente.getDate() + 1);
    }

    for (const giorno of giorniDaControllare) {
      const sovr = controllaSovrapposizioni(utenteCorrente.username, giorno, oraInizioCheck, oraFineCheck, tipo);
      if (sovr) { msg.innerHTML = '<div class="error">❌ ' + sovr.messaggio + '</div>'; return; }
    }

    let protocollo = '';
    if (tipo === 'malattia') {
      protocollo = nmLeggiProtocollo();
      if (protocollo.length !== 9 || !/^\d{9}$/.test(protocollo)) {
        msg.innerHTML = '<div class="error">❌ Inserisci tutte e 9 le cifre del protocollo</div>'; return;
      }
    }

    const richiesta = {
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      utente_id: utenteCorrente.username,
      tipo, data_inizio, data_fine, note,
      stato: 'pending',
      data_richiesta: new Date().toISOString()
    };
    if (tipo === 'malattia') richiesta.protocollo = protocollo;

    await richAggiungi(richiesta);
    dati.richieste.push(richiesta);
    await inviaTriggerRichiesta(richiesta);

    msg.innerHTML = '<div class="success">✅ Richiesta inviata! Attendi la risposta.</div>';
    document.getElementById('richiesta-note').value = '';
    if (tipo === 'malattia') nmSvuotaProtocollo();
    caricaRichiesteDipendente();
    aggiornaBadgeRichieste();
  } catch (err) {
    console.error('❌ Errore invio richiesta:', err);
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

async function inviaTriggerRichiesta(richiesta) {
  if (isWeekendOggi()) { console.log('📵 Weekend: notifica push NON inviata'); return; }
  try {
    await _dbFirestore().collection('richieste_trigger').add({
      richiesta_id: richiesta.id,
      utente_id: richiesta.utente_id,
      tipo: richiesta.tipo,
      data: richiesta.data || null,
      ora_inizio: richiesta.ora_inizio || null,
      ora_fine: richiesta.ora_fine || null,
      data_inizio: richiesta.data_inizio || null,
      data_fine: richiesta.data_fine || null,
      commessa_id: richiesta.commessa_id || null,
      descrizione_lavoro: richiesta.descrizione_lavoro || null,
      note: richiesta.note || null,
      creato_il: new Date().toISOString()
    });
    console.log('✅ Trigger richiesta inviato');
  } catch (err) {
    console.warn('⚠️ Errore trigger:', err);
  }
}

// ============================================
// LISTE RICHIESTE
// ============================================
function caricaRichiesteDipendente() {
  const div = document.getElementById('lista-richieste-dipendente');
  if (!div) return;
  const richieste = dati.richieste.filter(r => r.utente_id === utenteCorrente.username);
  if (richieste.length === 0) {
    div.innerHTML = '<p class="text-muted">' + t('rich_mie') + ': 0</p>';
    return;
  }
  const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
  const statoMap = { pending: '⏳ In attesa', approvata: '✅ APPROVATA', rifiutata: '❌ RIFIUTATA', annullata: '⛔ ANNULLATA' };
  const statoColor = { pending: '#ffc107', approvata: '#28a745', rifiutata: '#dc3545', annullata: '#999' };

  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += `<th>${t('rich_tipo')}</th><th>${t('mod_data')}</th><th>${t('rich_note')}</th><th>Stato</th>`;
  html += '</tr></thead><tbody>';

  richieste.forEach(r => {
    const colore = statoColor[r.stato] || '#666';
    let periodo = '';
    if (r.tipo === 'recupero_ore') {
      periodo = r.data + ' (' + r.ora_inizio + ' - ' + r.ora_fine + ')';
    } else {
      periodo = r.data_inizio + ' → ' + r.data_fine;
    }
    if (r.tipo === 'malattia' && r.protocollo) {
      periodo += '<br><small style="color:#00695C;">📄 Protocollo: <strong>' + r.protocollo + '</strong></small>';
    }
    html += '<tr>';
    html += '<td>' + (emoji[r.tipo] || '📌') + ' ' + r.tipo.replace('_', ' ') + '</td>';
    html += '<td>' + periodo + '</td>';
    html += '<td>' + (r.tipo === 'recupero_ore' ? r.descrizione_lavoro || '-' : (r.note || '-')) + '</td>';
    html += '<td style="font-weight:bold;color:' + colore + ';">' + (statoMap[r.stato] || r.stato) + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  div.innerHTML = html;
}

function caricaRichiesteAdmin() {
  const div = document.getElementById('lista-richieste-admin');
  if (!div) return;
  const richieste = dati.richieste.filter(r => r.stato === 'pending');
  if (richieste.length === 0) {
    div.innerHTML = '<p class="text-muted">' + t('radm_nessuna') + '</p>';
    return;
  }
  const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
  let html = '';
  richieste.forEach(r => {
    const utente = dati.utenti.find(u => u.username === r.utente_id);
    const nome = utente ? utente.nome + ' ' + utente.cognome : r.utente_id;

    let dettagli = '';
    if (r.tipo === 'recupero_ore') {
      dettagli = `
        <small>Data: ${r.data} (${r.ora_inizio} - ${r.ora_fine})</small>
        <br><small>Lavoro svolto: ${r.descrizione_lavoro || 'N/D'}</small>
        ${r.commessa_id ? `<br><small>Commessa: ${dati.commesse.find(c => c.id === r.commessa_id)?.nome || '-'}</small>` : ''}`;
    } else {
      dettagli = `
        <small>Dal ${r.data_inizio} al ${r.data_fine}</small>
        ${r.note ? `<br><small>📝 ${r.note}</small>` : ''}
        ${r.tipo === 'malattia' && r.protocollo ? `<br><small style="color:#00695C;font-weight:bold;">📄 Protocollo: ${r.protocollo}</small>` : ''}`;
    }

    const labelApprova = r.tipo === 'malattia' ? 'Malattia' : 'Approva';
    const labelAnnulla = r.tipo === 'malattia' ? 'Annulla malattia' : 'Rifiuta';

    html += `<div class="richiesta-card ${r.stato}">
      <div class="info">
        <strong>${emoji[r.tipo] || '📌'} ${r.tipo.replace('_', ' ')} - ${nome}</strong>
        ${dettagli}
        <small style="display:block;color:#999;">Richiesto il: ${new Date(r.data_richiesta).toLocaleDateString('it-IT')}</small>
      </div>
      <div class="azioni">
        <div class="dropdown-richiesta">
          <button class="btn-azioni-richiesta" onclick="toggleTendinaRichiesta(event, ${r.id})">
            <i class="fas fa-ellipsis-v"></i> Azioni <i class="fas fa-chevron-down" style="font-size:0.7em;"></i>
          </button>
          <div class="dropdown-richiesta-menu" id="dropdown-richiesta-${r.id}">
            <button class="dropdown-richiesta-item approva" onclick="approvaRichiesta(${r.id})">✅ ${labelApprova}</button>
            <button class="dropdown-richiesta-item annulla" onclick="annullaRichiesta(${r.id})">❌ ${labelAnnulla}</button>
          </div>
        </div>
      </div>
    </div>`;
  });
  div.innerHTML = html;
}

function toggleTendinaRichiesta(event, idRichiesta) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('dropdown-richiesta-' + idRichiesta);
  if (!menu) return;
  document.querySelectorAll('.dropdown-richiesta-menu').forEach(m => {
    if (m.id !== 'dropdown-richiesta-' + idRichiesta) m.classList.remove('aperto');
  });
  menu.classList.toggle('aperto');
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('.dropdown-richiesta')) {
    document.querySelectorAll('.dropdown-richiesta-menu').forEach(m => m.classList.remove('aperto'));
  }
});

// ============================================
// APPROVA RICHIESTA — CON TRANSAZIONE (FIX #5)
// ============================================
async function approvaRichiesta(id) {
  const richiesta = dati.richieste.find(r => String(r.id) === String(id));
  if (!richiesta) { alert('❌ Richiesta non trovata'); return; }
  if (richiesta.stato !== 'pending') { alert('⚠️ Questa richiesta è già stata processata.'); return; }

  // Controllo sovrapposizioni (FIX #9)
  if (richiesta.tipo === 'recupero_ore') {
    const sovr = controllaSovrapposizioni(
      richiesta.utente_id, richiesta.data,
      richiesta.ora_inizio, richiesta.ora_fine, 'recupero_ore'
    );
    // Escludi la richiesta stessa dal controllo
    if (sovr && sovr.tipo === 'richiesta') {
      // verifica se è proprio questa richiesta
      const conflitto = dati.richieste.find(r =>
        r.id !== richiesta.id &&
        r.utente_id === richiesta.utente_id &&
        r.tipo === 'recupero_ore' &&
        r.data === richiesta.data &&
        r.ora_inizio === richiesta.ora_inizio &&
        r.ora_fine === richiesta.ora_fine &&
        (r.stato === 'pending' || r.stato === 'approvata')
      );
      if (conflitto) { alert('❌ ' + sovr.messaggio); return; }
    } else if (sovr) {
      alert('❌ ' + sovr.messaggio);
      return;
    }
  }

  // Prepara nuove registrazioni
  const nuoveRegs = [];
  if (richiesta.tipo === 'recupero_ore') {
    const [h1, m1] = richiesta.ora_inizio.split(':').map(Number);
    const [h2, m2] = richiesta.ora_fine.split(':').map(Number);
    const oreLav = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    if (oreLav <= 0 || oreLav > 12) {
      alert('❌ ERRORE DATI: Orario non valido.');
      return;
    }
    nuoveRegs.push({
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      utente_id: richiesta.utente_id,
      commessa_id: richiesta.commessa_id || null,
      data: richiesta.data,
      ora_inizio: richiesta.ora_inizio,
      ora_fine: richiesta.ora_fine,
      descrizione: richiesta.descrizione_lavoro || 'Recupero ore',
      tipo: 'lavoro',
      recupero: true,
      ore: oreLav
    });
  } else {
    nuoveRegs.push({
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      utente_id: richiesta.utente_id,
      commessa_id: null,
      data: richiesta.data_inizio,
      ora_inizio: '00:00',
      ora_fine: '00:00',
      descrizione: richiesta.tipo + ' (approvata)',
      tipo: richiesta.tipo,
      richiesta_id: richiesta.id
    });
    if (richiesta.data_inizio !== richiesta.data_fine) {
      let dc = new Date(richiesta.data_inizio);
      const df = new Date(richiesta.data_fine);
      while (dc < df) {
        dc.setDate(dc.getDate() + 1);
        nuoveRegs.push({
          id: Date.now() * 1000 + Math.floor(Math.random() * 1000) + nuoveRegs.length,
          utente_id: richiesta.utente_id,
          commessa_id: null,
          data: dc.toISOString().split('T')[0],
          ora_inizio: '00:00',
          ora_fine: '00:00',
          descrizione: richiesta.tipo + ' (approvata)',
          tipo: richiesta.tipo,
          richiesta_id: richiesta.id
        });
      }
    }
  }

  // ✅ TRANSAZIONE ATOMICA
  try {
    await _dbFirestore().runTransaction(async (transaction) => {
      const richRef = _dbFirestore().collection('richieste').doc(String(id));
      const richSnap = await transaction.get(richRef);
      if (!richSnap.exists) throw new Error('Richiesta non trovata nel DB');
      if (richSnap.data().stato !== 'pending') throw new Error('Richiesta già processata');

      transaction.update(richRef, { stato: 'approvata' });
      for (const reg of nuoveRegs) {
        const ref = _dbFirestore().collection('registrazioni').doc(String(reg.id));
        transaction.set(ref, reg);
      }
    });

    // Commit OK → aggiorna locale
    richiesta.stato = 'approvata';
    nuoveRegs.forEach(r => { if (!dati.registrazioni.some(x => x.id === r.id)) dati.registrazioni.push(r); });

    // Trigger push
    if (!isWeekendOggi()) {
      try {
        await _dbFirestore().collection('richieste_trigger').add({
          richiesta_id: richiesta.id,
          utente_id: richiesta.utente_id,
          tipo: richiesta.tipo,
          azione: 'approvata',
          data_inizio: richiesta.data_inizio || null,
          data_fine: richiesta.data_fine || null,
          data: richiesta.data || null,
          ora_inizio: richiesta.ora_inizio || null,
          ora_fine: richiesta.ora_fine || null,
          creato_il: new Date().toISOString()
        });
      } catch (err) { console.warn('Trigger:', err); }
    }

    // Notifica
    const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
    const msgNot = richiesta.tipo === 'recupero_ore'
      ? `✅ Le tue ore del ${richiesta.data} sono state APPROVATE!`
      : `${emoji[richiesta.tipo] || '📌'} Richiesta APPROVATA ✅`;
    await aggiungiNotifica(richiesta.utente_id, 'approvazione', msgNot, '#');

    caricaRichiesteAdmin();
    aggiornaBadgeRichieste();
    caricaRichiesteDipendente();
    aggiornaBadgeNotifiche();
    alert('✅ Richiesta approvata!');
  } catch (err) {
    console.error('❌ Errore approvazione:', err);
    alert('❌ Errore: ' + err.message);
  }
}

// ============================================
// ANNULLA RICHIESTA
// ============================================
async function annullaRichiesta(id) {
  const richiesta = dati.richieste.find(r => String(r.id) === String(id));
  if (!richiesta) { alert('❌ Richiesta non trovata'); return; }

  const eraApprovata = richiesta.stato === 'approvata';
  const messaggioConferma = eraApprovata
    ? '⚠️ Questa richiesta è GIÀ APPROVATA.\nAnnullandola verranno eliminate anche le registrazioni collegate.\nProcedere?'
    : '❌ Annullare questa richiesta?';
  if (!confirm(messaggioConferma)) return;

  try {
    // Se era approvata, cancella registrazioni collegate
    if (eraApprovata) {
      const daCancellare = [];
      if (richiesta.tipo !== 'recupero_ore') {
        dati.registrazioni.forEach(r => {
          if (r.richiesta_id === richiesta.id) daCancellare.push(r.id);
        });
      } else {
        dati.registrazioni.forEach(r => {
          if (r.utente_id === richiesta.utente_id &&
            r.data === richiesta.data &&
            r.tipo === 'lavoro' &&
            r.recupero === true &&
            r.ora_inizio === richiesta.ora_inizio &&
            r.ora_fine === richiesta.ora_fine) {
            daCancellare.push(r.id);
          }
        });
      }
      const BATCH = 500;
      for (let i = 0; i < daCancellare.length; i += BATCH) {
        const batch = _dbFirestore().batch();
        daCancellare.slice(i, i + BATCH).forEach(idReg =>
          batch.delete(_dbFirestore().collection('registrazioni').doc(String(idReg)))
        );
        await batch.commit();
      }
      dati.registrazioni = dati.registrazioni.filter(r => !daCancellare.includes(r.id));
    }

    // Stato → annullata
    const dataAnnullamento = new Date().toISOString();
    await richAggiorna(id, { stato: 'annullata', data_annullamento: dataAnnullamento });
    richiesta.stato = 'annullata';
    richiesta.data_annullamento = dataAnnullamento;

    // Notifica
    const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
    const tipoLabel = richiesta.tipo === 'recupero_ore' ? 'recupero ore' : richiesta.tipo;
    await aggiungiNotifica(
      richiesta.utente_id, 'annullamento',
      `${emoji[richiesta.tipo] || '📌'} La tua richiesta di ${tipoLabel} è stata ANNULLATA ❌`, '#'
    );

    // Trigger push
    if (!isWeekendOggi()) {
      try {
        await _dbFirestore().collection('richieste_trigger').add({
          richiesta_id: richiesta.id, utente_id: richiesta.utente_id,
          tipo: richiesta.tipo, azione: 'annullata',
          data_inizio: richiesta.data_inizio || null, data_fine: richiesta.data_fine || null,
          data: richiesta.data || null, ora_inizio: richiesta.ora_inizio || null,
          ora_fine: richiesta.ora_fine || null,
          creato_il: new Date().toISOString()
        });
      } catch (err) { console.warn('Trigger:', err); }
    }

    caricaRichiesteAdmin();
    aggiornaBadgeRichieste();
    caricaRichiesteDipendente();
    aggiornaBadgeNotifiche();
    alert('✅ Richiesta annullata!');
  } catch (err) {
    console.error('❌ Errore annullamento:', err);
    alert('❌ Errore: ' + err.message);
  }
}

function aggiornaBadgeRichieste() {
  const pending = dati.richieste.filter(r => r.stato === 'pending').length;
  const badge = document.getElementById('badge-richieste');
  if (!badge) return;
  if (pending > 0) { badge.style.display = 'inline-block'; badge.textContent = pending; }
  else { badge.style.display = 'none'; }
}

function mostraRichieste() { showTab('richieste'); }

// ============================================
// NOTIFICHE
// ============================================
async function aggiungiNotifica(utente_id, tipo, messaggio, link) {
  const not = {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    utente_id, tipo, messaggio,
    link: link || '#', letto: false,
    data: new Date().toISOString()
  };
  try {
    await notAggiungi(not);
    if (!dati.notifiche.some(n => n.id === not.id)) dati.notifiche.push(not);
    aggiornaBadgeNotifiche();
  } catch (err) { console.error('❌ Errore notifica:', err); }
}

function aggiornaBadgeNotifiche() {
  if (!utenteCorrente) return;
  const nonLette = dati.notifiche.filter(n => n.utente_id === utenteCorrente.username && !n.letto).length;
  const badge = document.getElementById('badge-notifiche');
  const btn = document.getElementById('btn-notifica');
  const container = document.getElementById('notifiche-container');
  if (!badge) return;
  if (nonLette > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = nonLette;
    if (btn) btn.style.color = '#dc3545';
    if (container) container.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
    if (btn) btn.style.color = '#555';
  }
}

function mostraNotifiche() {
  const modal = document.getElementById('modal-notifiche');
  if (modal) modal.classList.add('active');
  const div = document.getElementById('notifiche-lista');
  if (!div) return;
  const notifiche = dati.notifiche
    .filter(n => n.utente_id === utenteCorrente.username)
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  if (notifiche.length === 0) { div.innerHTML = '<p class="text-muted">' + t('mod_nessuna_notifica') + '</p>'; return; }
  let html = '';
  notifiche.forEach(n => {
    const data = new Date(n.data).toLocaleDateString('it-IT') + ' ' + new Date(n.data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const classe = n.letto ? 'notifica-item letto' : 'notifica-item non letto';
    html += `<div class="${classe}" onclick="segnaLetta(${n.id})">
      <span class="notifica-testo">${n.messaggio}</span>
      <span class="notifica-data">${data}</span>
    </div>`;
  });
  div.innerHTML = html;
}

async function segnaLetta(id) {
  const notifica = dati.notifiche.find(n => n.id === id);
  if (!notifica) return;
  try {
    await notAggiorna(id, { letto: true });
    notifica.letto = true;
    aggiornaBadgeNotifiche();
    mostraNotifiche();
  } catch (err) { console.error('❌ Errore segna letta:', err); }
}

function chiudiNotifiche() {
  document.getElementById('modal-notifiche')?.classList.remove('active');
}

// ============================================
// PASSWORD ADMIN
// ============================================
function apriModificaPassword() {
  if (utenteCorrente?.ruolo !== 'admin') { alert('Solo gli amministratori possono cambiare la password'); return; }
  document.getElementById('modal-password').classList.add('active');
  document.getElementById('nuova-password').value = '';
  document.getElementById('conferma-password').value = '';
  document.getElementById('msg-password').innerHTML = '';
}
function chiudiModificaPassword() {
  document.getElementById('modal-password')?.classList.remove('active');
}
async function salvaNuovaPassword() {
  const nuova = document.getElementById('nuova-password').value.trim();
  const conferma = document.getElementById('conferma-password').value.trim();
  const msg = document.getElementById('msg-password');
  if (!nuova || nuova.length < 4) { msg.innerHTML = '<div class="error">La password deve essere almeno di 4 caratteri</div>'; return; }
  if (nuova !== conferma) { msg.innerHTML = '<div class="error">Le password non coincidono</div>'; return; }
  const utente = dati.utenti.find(u => u.username === utenteCorrente.username);
  if (!utente) return;
  try {
    utente.password = nuova;
    await utenteSalva(utente);
    msg.innerHTML = '<div class="success">✅ Password cambiata con successo!</div>';
    setTimeout(() => chiudiModificaPassword(), 1500);
  } catch (err) {
    msg.innerHTML = '<div class="error">❌ ' + err.message + '</div>';
  }
}

// ============================================
// EXPORT ORE MESE (CSV)
// ✅ FIX #30: opzione formato Excel EN
// ============================================
function esportaOreMese() {
  if (utenteCorrente?.ruolo !== 'admin') { alert('Solo gli amministratori possono esportare'); return; }

  const mese = prompt('Inserisci il mese (1-12):', new Date().getMonth() + 1);
  if (!mese) return;
  const meseNum = parseInt(mese);
  if (meseNum < 1 || meseNum > 12) { alert('Mese non valido'); return; }

  const anno = prompt('Inserisci l\'anno (es. 2026):', new Date().getFullYear());
  if (!anno) return;
  const annoNum = parseInt(anno);
  if (annoNum < 2000 || annoNum > 2100) { alert('Anno non valido'); return; }

  const formato = confirm('Formato Excel italiano (virgola decimale)?\n\nOK = Italiano (1.234,56)\nAnnulla = Excel EN (1,234.56)') ? 'it' : 'en';
  const decSep = formato === 'it' ? ',' : '.';

  const giorniMese = new Date(annoNum, meseNum, 0).getDate();
  const dipendenti = dati.utenti.filter(u => u.ruolo === 'dipendente');
  if (dipendenti.length === 0) { alert('Nessun dipendente trovato'); return; }

  let header = 'DIPENDENTE';
  for (let g = 1; g <= giorniMese; g++) {
    const giornoSett = new Date(annoNum, meseNum - 1, g).getDay();
    const giornoNome = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'][giornoSett];
    header += `;${g} (${giornoNome})`;
  }
  header += ';TOTALE ORE';

  let csv = `MESE: ${mese}/${annoNum}\nDATA ESPORTAZIONE: ${new Date().toLocaleDateString('it-IT')}\n\n${header}\n`;

  dipendenti.forEach(dip => {
    let riga = dip.nome + ' ' + dip.cognome;
    let totaleOre = 0;
    for (let g = 1; g <= giorniMese; g++) {
      const data = `${annoNum}-${String(meseNum).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
      const giornoSett = new Date(annoNum, meseNum - 1, g).getDay();
      const isWeekend = giornoSett === 0 || giornoSett === 6;
      const registrazioni = dati.registrazioni.filter(r => r.utente_id === dip.username && r.data === data);
      let simbolo = '';
      let oreGiorno = 0;
      if (registrazioni.length > 0) {
        const haFerie = registrazioni.some(r => r.tipo === 'ferie');
        const haPermesso = registrazioni.some(r => r.tipo === 'permesso');
        const haMalattia = registrazioni.some(r => r.tipo === 'malattia');
        const haLavoro = registrazioni.some(r => r.tipo === 'lavoro');
        if (haFerie) simbolo = 'F';
        else if (haPermesso) simbolo = 'P';
        else if (haMalattia) simbolo = 'M';
        else if (haLavoro) {
          registrazioni.forEach(r => {
            if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
              const [h1, m1] = r.ora_inizio.split(':').map(Number);
              const [h2, m2] = r.ora_fine.split(':').map(Number);
              oreGiorno += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
            }
          });
          simbolo = oreGiorno.toFixed(2).replace('.', decSep);
        }
      } else {
        if (isWeekend) simbolo = '/';
        else {
          const haRichiestaApprovata = dati.richieste.some(r =>
            r.utente_id === dip.username && r.stato === 'approvata' &&
            r.data_inizio <= data && r.data_fine >= data
          );
          if (haRichiestaApprovata) {
            const richiesta = dati.richieste.find(r =>
              r.utente_id === dip.username && r.stato === 'approvata' &&
              r.data_inizio <= data && r.data_fine >= data
            );
            if (richiesta) {
              if (richiesta.tipo === 'ferie') simbolo = 'F';
              else if (richiesta.tipo === 'permesso') simbolo = 'P';
              else if (richiesta.tipo === 'malattia') simbolo = 'M';
            }
          } else simbolo = 'A';
        }
      }
      totaleOre += oreGiorno;
      riga += ';' + simbolo;
    }
    riga += ';' + totaleOre.toFixed(2).replace('.', decSep);
    csv += riga + '\n';
  });

  const meseNome = t('mese_' + meseNum);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ORE_${meseNome}_${annoNum}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  alert('✅ File esportato con successo!');
}

// ============================================
// ✅ FIX #6: PDF MULTIPAGINA CORRETTO
// (sostituisce il vecchio metodo con rotation)
// ============================================
async function generaPDFMultipagina(pdf, container, pageW, pageH, margin, orientation = 'landscape') {
  const canvas = await html2canvas(container, {
    scale: 2, useCORS: true, allowTaint: true,
    backgroundColor: '#ffffff', logging: false
  });

  const imgW = pageW - margin * 2;
  const altezzaPaginaMm = pageH - margin * 2;
  // Quanti pixel canvas stanno in una pagina (in mm)
  const altezzaPaginaPx = (altezzaPaginaMm * canvas.width) / imgW;

  const numPagine = Math.ceil(canvas.height / altezzaPaginaPx);

  for (let p = 0; p < numPagine; p++) {
    if (p > 0) pdf.addPage();

    const yInizioPx = p * altezzaPaginaPx;
    const altezzaPx = Math.min(altezzaPaginaPx, canvas.height - yInizioPx);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = Math.round(altezzaPx);
    const ctx = pageCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0, yInizioPx, canvas.width, altezzaPx,
      0, 0, canvas.width, altezzaPx
    );

    const pageImg = pageCanvas.toDataURL('image/jpeg', 0.92);
    const altezzaMm = (altezzaPx * imgW) / canvas.width;
    pdf.addImage(pageImg, 'JPEG', margin, margin, imgW, altezzaMm, undefined, 'FAST');
  }

  return pdf;
}

async function scaricaOCondividiPDF(pdf, nomeFile) {
  const pdfBlob = pdf.output('blob');
  const file = new File([pdfBlob], nomeFile, { type: 'application/pdf' });
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nomeFile.replace('.pdf', ''), text: 'MEC-ROY' });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeFile;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================
// EXPORT PDF CALENDARIO
// ============================================
async function esportaPDF() {
  const output = document.getElementById('calendario-output');
  if (!output) return;
  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);

  const clone = output.cloneNode(true);

  // ✅ FIX #16: selettore basato su classe (non su stile inline)
  clone.querySelector('.box-totale-mese')?.remove();
  const h4Titolo = clone.querySelector('h4');
  if (h4Titolo && /^\s*\w+\s+\d{4}\s*$/.test(h4Titolo.textContent)) h4Titolo.remove();

  const content = clone.innerHTML;
  const sezioneMalattieHTML = costruisciSezioneMalattie(mese, anno);
  if (!content || content.trim() === '') { alert('⚠️ Prima genera il report nel calendario'); return; }

  const logoHTML = document.querySelector('.logo-small')?.outerHTML || '<h2>MEC-ROY srls</h2>';
  const meseAnnoLabel = `${t('mese_' + mese).toUpperCase()} ${anno}`;

  const btnEsporta = document.querySelector('#panel-calendario button.btn-primary');
  const testoOriginale = btnEsporta ? btnEsporta.innerHTML : '';
  if (btnEsporta) { btnEsporta.disabled = true; btnEsporta.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generazione PDF...'; }

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-99999px;top:0;width:1600px;background:white;padding:20px;font-family:Arial,sans-serif;';
  container.innerHTML = `
    <style>
      .intestazione-report { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding-bottom:12px; margin-bottom:15px; border-bottom:3px solid #00695C; }
      .intestazione-sinistra { display:flex; align-items:center; gap:10px; flex-shrink:0; }
      .intestazione-sinistra h2 { color:#00695C; margin:0; font-size:18px; }
      .intestazione-centro { flex:1; text-align:center; align-self:center; }
      .intestazione-centro .mese-grande { font-size:20px; font-weight:700; color:#00695C; letter-spacing:1px; }
      .intestazione-destra { text-align:right; font-size:10px; color:#333; line-height:1.5; flex-shrink:0; margin-right:38px; }
      .intestazione-destra .commercialista-nome { font-weight:700; font-size:11px; color:#00695C; }
      table { width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; table-layout:fixed; }
      th, td { border:1px solid #ddd; padding:3px 2px; text-align:center; word-wrap:break-word; }
      th { background:#00695C; color:white; font-weight:bold; }
      table th:first-child, table td:first-child { width:110px; text-align:left; padding-left:5px; }
      table th:last-child, table td:last-child { width:50px; }
      .sezione-malattie { margin-top:25px; }
      .sezione-malattie h3 { color:#00695C; font-size:13px; margin:0 0 10px 0; border-bottom:2px solid #00695C; padding-bottom:4px; }
      .sezione-malattie table { font-size:11px; table-layout:auto; }
      .sezione-malattie th { background:#b71c1c; color:white; padding:8px 12px; text-align:left; }
      .sezione-malattie td { padding:8px 12px; text-align:left; }
      .sezione-malattie tr:nth-child(even) td { background:#fce8eb; }
      .sezione-malattie .col-dip { width:35%; font-weight:600; }
      .sezione-malattie .col-prot { width:65%; font-family:'Courier New',monospace; }
    </style>
    <div class="intestazione-report">
      <div class="intestazione-sinistra">${logoHTML}</div>
      <div class="intestazione-centro"><div class="mese-grande">${meseAnnoLabel}</div></div>
      <div class="intestazione-destra">
        <div class="commercialista-nome">Dott.ssa ELENA ROBERTI</div>
        <div>Studio Elaborazione Paghe</div>
        <div>Piazza I.Alpi, 1 42019 Scandiano (RE)</div>
        <div>Tel 0522 856515</div>
        <div>elenaroberti@studiocostetti.com</div>
      </div>
    </div>
    <div>${content}</div>
    ${sezioneMalattieHTML}
    <div style="text-align:center;padding:8px;font-size:10px;color:#888;margin-top:15px;border-top:1px solid #ddd;">
      MEC-ROY srls - Generato il ${new Date().toLocaleDateString('it-IT')}
    </div>`;
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 300));
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    await generaPDFMultipagina(pdf, container, 297, 210, 8, 'landscape');
    document.body.removeChild(container);

    const nomeFile = `Report_${meseAnnoLabel.replace(/\s+/g, '_')}_MEC-ROY.pdf`;
    await scaricaOCondividiPDF(pdf, nomeFile);
  } catch (err) {
    console.error('❌ Errore PDF:', err);
    if (document.body.contains(container)) document.body.removeChild(container);
    alert('❌ Errore: ' + err.message);
  } finally {
    if (btnEsporta) { btnEsporta.disabled = false; btnEsporta.innerHTML = testoOriginale; }
  }
}

// ✅ FIX #31: costruisciSezioneMalattie considera anche data_fine
function costruisciSezioneMalattie(mese, anno) {
  const mesePadded = String(mese).padStart(2, '0');
  const inizioMese = `${anno}-${mesePadded}-01`;
  const fineMese = `${anno}-${mesePadded}-${String(new Date(anno, mese, 0).getDate()).padStart(2, '0')}`;

  const richiesteMalattia = (dati.richieste || []).filter(r =>
    r.tipo === 'malattia' &&
    r.stato === 'approvata' &&
    r.data_inizio && r.data_fine &&
    !(r.data_fine < inizioMese || r.data_inizio > fineMese)  // ✅ overlap mese
  );
  if (richiesteMalattia.length === 0) return '';

  const perDipendente = {};
  richiesteMalattia.forEach(r => {
    if (!perDipendente[r.utente_id]) perDipendente[r.utente_id] = [];
    if (r.protocollo) perDipendente[r.utente_id].push(r.protocollo);
  });

  const dipendentiConProtocollo = Object.keys(perDipendente).filter(u => perDipendente[u].length > 0);
  if (dipendentiConProtocollo.length === 0) return '';

  let righe = '';
  dipendentiConProtocollo.forEach(username => {
    const utente = (dati.utenti || []).find(u => u.username === username);
    const nomeCompleto = utente ? `${utente.nome} ${utente.cognome}` : username;
    const protocolli = perDipendente[username].join(', ');
    righe += `<tr><td class="col-dip">${nomeCompleto}</td><td class="col-prot">MALATTIA - PROTOCOLLO ${protocolli}</td></tr>`;
  });

  return `<div class="sezione-malattie">
    <h3>📄 Certificati di Malattia del mese</h3>
    <table><thead><tr><th class="col-dip">DIPENDENTE</th><th class="col-prot">MALATTIA - PROTOCOLLO</th></tr></thead>
    <tbody>${righe}</tbody></table></div>`;
}

// ============================================
// DIPENDENTI CRUD
// ✅ FIX #21: usa window._fotoNuovoDipendenteBase64
// ============================================
async function aggiungiDipendente() {
  const nome = document.getElementById('dip-nome').value.trim();
  const cognome = document.getElementById('dip-cognome').value.trim();
  const username = document.getElementById('dip-username').value.trim();
  const password = document.getElementById('dip-password').value.trim();
  const ruolo = document.getElementById('dip-ruolo').value;
  const msg = document.getElementById('msg-dipendente');

  if (!nome || !cognome || !username || !password) { msg.innerHTML = '<div class="error">Compila tutti i campi obbligatori</div>'; return; }
  if (dati.utenti.some(u => u.username === username)) { msg.innerHTML = '<div class="error">❌ Username già esistente</div>'; return; }

  const nuovoUtente = { username, password, nome, cognome, ruolo };
  if (window._fotoNuovoDipendenteBase64) nuovoUtente.foto = window._fotoNuovoDipendenteBase64;

  try {
    await utenteSalva(nuovoUtente);
    if (!dati.utenti.some(u => u.username === username)) dati.utenti.push(nuovoUtente);
    document.getElementById('dip-nome').value = '';
    document.getElementById('dip-cognome').value = '';
    document.getElementById('dip-username').value = '';
    document.getElementById('dip-password').value = '';
    if (typeof rimuoviFotoNuovoDipendente === 'function') rimuoviFotoNuovoDipendente();
    msg.innerHTML = '<div class="success">✅ Dipendente aggiunto con successo!</div>';
    caricaListaDipendenti();
    caricaSelectDipendentiModifica();
    caricaSelectDipendentiCalendario();
  } catch (err) {
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

function caricaListaDipendenti() {
  const div = document.getElementById('lista-dipendenti');
  if (!div) return;
  if (dati.utenti.length === 0) { div.innerHTML = '<p class="text-muted">📭 Nessun dipendente</p>'; return; }
  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += '<th style="width:60px;text-align:center;">📷</th>';
  html += `<th>${t('dip_username')}</th><th>${t('dip_nome')}</th><th>${t('dip_cognome')}</th><th>${t('dip_password')}</th><th>${t('dip_ruolo')}</th><th>Azioni</th>`;
  html += '</tr></thead><tbody>';
  dati.utenti.forEach(u => {
    const isSelf = u.username === utenteCorrente.username;
    html += `<tr id="row-${u.username}" style="cursor:pointer;" onclick="apriDettaglioDipendente('${u.username}')">`;
    html += '<td class="lista-dip-foto-cell">' + htmlAvatar(u, 'sm') + '</td>';
    html += '<td><strong>' + u.username + '</strong></td>';
    html += '<td>' + u.nome + '</td>';
    html += '<td>' + u.cognome + '</td>';
    html += '<td><code class="password-cell">' + (u.password || '-') + '</code></td>';
    html += '<td><span class="badge ' + u.ruolo + '">' + (u.ruolo === 'admin' ? t('dip_admin') : t('dip_dipendente')) + '</span></td>';
    html += '<td>';
    html += '<button class="btn-foto-dip" onclick="event.stopPropagation(); apriModaleFoto(\'' + u.username + '\')" title="Foto"><i class="fas fa-camera"></i></button>';
    if (!isSelf) {
      html += '<button class="btn-warning" onclick="event.stopPropagation(); apriModificaDipendente(\'' + u.username + '\')" style="margin-right:5px;"><i class="fas fa-edit"></i></button>';
      html += '<button class="btn-danger" onclick="event.stopPropagation(); eliminaDipendente(\'' + u.username + '\')"><i class="fas fa-trash"></i></button>';
    } else {
      html += '<span style="color:#999;font-size:0.8em;">(tu)</span>';
    }
    html += '</td></tr>';
  });
  html += '</tbody></table></div>';
  div.innerHTML = html;
}

function apriModificaDipendente(username) {
  const utente = dati.utenti.find(u => u.username === username);
  if (!utente) return;
  const row = document.getElementById('row-' + username);
  if (!row) return;
  row.onclick = null;
  row.style.cursor = 'default';
  row.innerHTML = `
    <td><input type="text" id="edit-username-${username}" value="${utente.username}" class="edit-input" /></td>
    <td><input type="text" id="edit-nome-${username}" value="${utente.nome}" class="edit-input" /></td>
    <td><input type="text" id="edit-cognome-${username}" value="${utente.cognome}" class="edit-input" /></td>
    <td><input type="text" id="edit-password-${username}" value="${utente.password || ''}" class="edit-input" /></td>
    <td><select id="edit-ruolo-${username}" class="edit-input">
      <option value="dipendente" ${utente.ruolo === 'dipendente' ? 'selected' : ''}>Dipendente</option>
      <option value="admin" ${utente.ruolo === 'admin' ? 'selected' : ''}>Admin</option>
    </select></td>
    <td>
      <button class="btn-success" onclick="salvaModificaDipendente('${username}')" style="margin-right:5px;"><i class="fas fa-save"></i></button>
      <button class="btn-danger" onclick="annullaModificaDipendente('${username}')"><i class="fas fa-times"></i></button>
    </td>`;
}

async function salvaModificaDipendente(oldUsername) {
  const nuovoUsername = document.getElementById('edit-username-' + oldUsername).value.trim();
  const nome = document.getElementById('edit-nome-' + oldUsername).value.trim();
  const cognome = document.getElementById('edit-cognome-' + oldUsername).value.trim();
  const password = document.getElementById('edit-password-' + oldUsername).value.trim();
  const ruolo = document.getElementById('edit-ruolo-' + oldUsername).value;

  if (!nuovoUsername || !nome || !cognome) { alert('Compila tutti i campi obbligatori'); return; }
  if (!password || password.length < 4) { alert('❌ La password deve essere almeno di 4 caratteri'); return; }
  if (nuovoUsername !== oldUsername && dati.utenti.some(u => u.username === nuovoUsername)) { alert('❌ Username già esistente'); return; }

  const utente = dati.utenti.find(u => u.username === oldUsername);
  if (!utente) return;
  const utenteAggiornato = { ...utente, username: nuovoUsername, nome, cognome, password, ruolo };

  try {
    if (nuovoUsername !== oldUsername) await utenteCancella(oldUsername);
    await utenteSalva(utenteAggiornato);

    const idx = dati.utenti.findIndex(u => u.username === oldUsername);
    if (idx !== -1) dati.utenti[idx] = utenteAggiornato;
    if (nuovoUsername !== oldUsername) {
      dati.registrazioni.forEach(r => { if (r.utente_id === oldUsername) r.utente_id = nuovoUsername; });
      dati.richieste.forEach(r => { if (r.utente_id === oldUsername) r.utente_id = nuovoUsername; });
      dati.notifiche.forEach(n => { if (n.utente_id === oldUsername) n.utente_id = nuovoUsername; });
    }
    caricaListaDipendenti();
    caricaSelectDipendentiModifica();
    caricaSelectDipendentiCalendario();
    alert('✅ Dipendente modificato con successo!');
  } catch (err) {
    alert('❌ Errore: ' + err.message);
  }
}

function annullaModificaDipendente(username) { caricaListaDipendenti(); }

async function eliminaDipendente(username) {
  const regCount = dati.registrazioni.filter(r => r.utente_id === username).length;
  const richCount = dati.richieste.filter(r => r.utente_id === username).length;
  let msg = '⚠️ Eliminare il dipendente "' + username + '"?\n\n';
  if (regCount > 0 || richCount > 0) {
    msg += `⚠️ Ha ${regCount} registrazioni e ${richCount} richieste.\nVerranno eliminate.\n\n`;
  }
  msg += 'Procedere?';
  if (!confirm(msg)) return;

  try {
    await utenteCancella(username);

    const regs = dati.registrazioni.filter(r => r.utente_id === username);
    const rich = dati.richieste.filter(r => r.utente_id === username);
    const nots = dati.notifiche.filter(n => n.utente_id === username);

    const BATCH = 500;
    for (let i = 0; i < regs.length; i += BATCH) {
      const batch = _dbFirestore().batch();
      regs.slice(i, i + BATCH).forEach(r => batch.delete(_dbFirestore().collection('registrazioni').doc(String(r.id))));
      await batch.commit();
    }
    for (let i = 0; i < rich.length; i += BATCH) {
      const batch = _dbFirestore().batch();
      rich.slice(i, i + BATCH).forEach(r => batch.delete(_dbFirestore().collection('richieste').doc(String(r.id))));
      await batch.commit();
    }
    for (let i = 0; i < nots.length; i += BATCH) {
      const batch = _dbFirestore().batch();
      nots.slice(i, i + BATCH).forEach(n => batch.delete(_dbFirestore().collection('notifiche').doc(String(n.id))));
      await batch.commit();
    }

    dati.utenti = dati.utenti.filter(u => u.username !== username);
    dati.registrazioni = dati.registrazioni.filter(r => r.utente_id !== username);
    dati.richieste = dati.richieste.filter(r => r.utente_id !== username);
    dati.notifiche = dati.notifiche.filter(n => n.utente_id !== username);
    caricaListaDipendenti();
    caricaSelectDipendentiModifica();
    caricaSelectDipendentiCalendario();
    alert('🗑️ Dipendente eliminato');
  } catch (err) {
    alert('❌ Errore: ' + err.message);
  }
}

function caricaSelectDipendentiModifica() {
  const select = document.getElementById('modifica-dipendente');
  if (!select) return;
  if (!dati || !Array.isArray(dati.utenti)) { setTimeout(caricaSelectDipendentiModifica, 300); return; }
  const val = select.value;
  select.innerHTML = `<option value="">${t('mod_dipendente')}</option>`;
  dati.utenti.filter(u => u.ruolo === 'dipendente').forEach(u => {
    select.innerHTML += '<option value="' + u.username + '">' + u.nome + ' ' + u.cognome + '</option>';
  });
  if (val) select.value = val;
}

function caricaSelectDipendentiCalendario() {
  const select = document.getElementById('cal-dipendente');
  if (!select) return;
  if (!dati || !dati.utenti || !Array.isArray(dati.utenti)) { setTimeout(caricaSelectDipendentiCalendario, 300); return; }
  const val = select.value;
  select.innerHTML = `<option value="">${t('cal_tutti')}</option>`;
  dati.utenti.filter(u => u.ruolo === 'dipendente').forEach(u => {
    select.innerHTML += '<option value="' + u.username + '">' + u.nome + ' ' + u.cognome + '</option>';
  });
  if (val) select.value = val;
}

// ============================================
// MODIFICA REGISTRAZIONI (admin)
// ✅ FIX #13: ID univoci
// ============================================
function caricaRegistrazioniModifica() {
  const username = document.getElementById('modifica-dipendente').value;
  const data = document.getElementById('modifica-data').value;
  const div = document.getElementById('modifica-lista');
  if (!div) return;
  if (!username || !data) { div.innerHTML = '<p class="text-muted">Seleziona dipendente e data</p>'; return; }

  const registrazioni = dati.registrazioni.filter(r => r.utente_id === username && r.data === data);
  if (registrazioni.length === 0) { div.innerHTML = '<p class="text-muted">Nessuna registrazione per questo dipendente in questa data</p>'; return; }

  const totaleGiornata = registrazioni.filter(r => r.tipo === 'lavoro').reduce((s, r) => s + (r.ore || 0), 0);
  const isOltre8 = totaleGiornata > 8;

  const opzioniCommesse = (dati.commesse || []).map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += `<th>${t('com_nome').replace(' *', '')}</th><th>${t('reg_ora_inizio').replace(' *', '')}</th><th>${t('reg_ora_fine').replace(' *', '')}</th><th>${t('cal_ore_lavorate')}</th><th>${t('rich_tipo').replace(' *', '')}</th><th>${t('reg_desc').replace(' *', '')}</th><th>Azioni</th>`;
  html += '</tr></thead><tbody>';

  registrazioni.forEach(r => {
    const commessa = dati.commesse.find(c => c.id === r.commessa_id);
    const tipoCorrente = r.tipo || 'lavoro';
    let ore = 0;
    if (r.ora_inizio && r.ora_fine && r.ora_inizio !== '00:00') {
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    }
    const isStraordinario = r.straordinario || false;
    html += '<tr' + (isOltre8 ? ' class="ore-straordinario"' : '') + '>';
    html += `<td><select id="mod-commessa-${r.id}" class="edit-input"><option value="">-- Nessuna --</option>${opzioniCommesse}</select></td>`;
    html += `<td><input type="time" id="mod-inizio-${r.id}" value="${r.ora_inizio || ''}" class="edit-input" /></td>`;
    html += `<td><input type="time" id="mod-fine-${r.id}" value="${r.ora_fine || ''}" class="edit-input" /></td>`;
    html += '<td>' + ore.toFixed(2) + 'h' + (isStraordinario ? ' ⭐' : '') + '</td>';
    html += `<td><select id="mod-tipo-${r.id}" class="edit-input">
      <option value="lavoro"${tipoCorrente === 'lavoro' ? ' selected' : ''}>Lavoro</option>
      <option value="ferie"${tipoCorrente === 'ferie' ? ' selected' : ''}>Ferie</option>
      <option value="permesso"${tipoCorrente === 'permesso' ? ' selected' : ''}>Permesso</option>
      <option value="malattia"${tipoCorrente === 'malattia' ? ' selected' : ''}>Malattia</option>
      <option value="recupero_ore"${tipoCorrente === 'recupero_ore' ? ' selected' : ''}>Recupero ore</option>
    </select></td>`;
    html += `<td><input type="text" id="mod-desc-${r.id}" value="${(r.descrizione || '').replace(/"/g, '&quot;')}" class="edit-input" /></td>`;
    html += `<td><button class="btn-success" onclick="salvaModifica(${r.id})" style="margin-right:5px;"><i class="fas fa-save"></i></button>`;
    html += `<button class="btn-danger" onclick="eliminaRegistrazione(${r.id})"><i class="fas fa-trash"></i></button></td>`;
    html += '</tr>';

    if (commessa) {
      setTimeout(() => {
        const sel = document.getElementById('mod-commessa-' + r.id);
        if (sel) sel.value = commessa.id;
      }, 0);
    }
  });

  const bg = isOltre8 ? '#ffebee' : '#e8f5e9';
  const txt = isOltre8 ? '#d32f2f' : '#2e7d32';
  html += `<tr style="font-weight:bold;">
    <td colspan="3" style="text-align:right;background:${bg};color:${txt};">TOTALE GIORNATA (lavoro):</td>
    <td colspan="4" style="background:${bg};color:${txt};">${totaleGiornata.toFixed(2)}h ${isOltre8 ? '⚠️ > 8h' : ''}</td>
  </tr>`;
  html += '</tbody></table></div>';
  div.innerHTML = html;
}

async function salvaModifica(id) {
  const registro = dati.registrazioni.find(r => r.id === id);
  if (!registro) return;
  const nuovoTipo = document.getElementById('mod-tipo-' + id).value;
  const nuovaCommessa = document.getElementById('mod-commessa-' + id).value;
  const nuovaInizio = document.getElementById('mod-inizio-' + id).value;
  const nuovaFine = document.getElementById('mod-fine-' + id).value;
  const nuovaDesc = document.getElementById('mod-desc-' + id).value.trim();

  if (nuovoTipo === 'lavoro' || nuovoTipo === 'recupero_ore') {
    if (!nuovaInizio || !nuovaFine) { alert('❌ Inserisci ora inizio e ora fine'); return; }
    if (nuovaInizio >= nuovaFine) { alert('❌ L\'ora fine deve essere dopo l\'ora inizio'); return; }
  }

  const datiNuovi = {
    commessa_id: nuovaCommessa ? parseInt(nuovaCommessa) : null,
    tipo: nuovoTipo, ora_inizio: nuovaInizio, ora_fine: nuovaFine, descrizione: nuovaDesc
  };
  if (nuovaInizio && nuovaFine && nuovaInizio !== '00:00') {
    const [h1, m1] = nuovaInizio.split(':').map(Number);
    const [h2, m2] = nuovaFine.split(':').map(Number);
    datiNuovi.ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  } else datiNuovi.ore = 0;

  try {
    await regAggiorna(id, datiNuovi);
    Object.assign(registro, datiNuovi);
    caricaRegistrazioniModifica();
    caricaCalendario();
    alert('✅ Registrazione modificata!');
  } catch (err) {
    alert('❌ Errore: ' + err.message);
  }
}

async function eliminaRegistrazione(id) {
  if (!confirm('Eliminare questa registrazione?')) return;
  try {
    await regCancella(id);
    dati.registrazioni = dati.registrazioni.filter(r => r.id !== id);
    caricaRegistrazioniModifica();
    caricaCalendario();
    alert('🗑️ Registrazione eliminata');
  } catch (err) {
    alert('❌ Errore: ' + err.message);
  }
}

console.log('✅ script.js — PARTE 1/2 caricata');

// ============================================
// CALENDARIO (vista mensile)
// ============================================
function caricaCalendario() {
  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);
  const output = document.getElementById('calendario-output');
  if (!output) return;
  if (!anno) { output.innerHTML = '<p class="text-muted">Inserisci un anno valido</p>'; return; }

  const vistaScelta = document.querySelector('input[name="cal-vista"]:checked');
  if (vistaScelta && vistaScelta.value === 'dettagliato') { caricaCalendarioDettagliato(); return; }

  const isAdmin = utenteCorrente.ruolo === 'admin';
  const utenteFilter = isAdmin ? document.getElementById('cal-dipendente').value : utenteCorrente.username;
  const giorniMese = new Date(anno, mese, 0).getDate();

  let dipendentiDaMostrare = [];
  if (isAdmin) {
    dipendentiDaMostrare = utenteFilter
      ? dati.utenti.filter(u => u.username === utenteFilter)
      : dati.utenti.filter(u => u.ruolo === 'dipendente');
  } else {
    dipendentiDaMostrare = dati.utenti.filter(u => u.username === utenteCorrente.username);
  }

  const meseNome = t('mese_' + mese);
  let html = `<h4 style="margin-bottom:15px;color:#333;">${meseNome} ${anno}</h4>`;

  html += `
    <div style="margin-bottom:15px;padding:10px 15px;background:#f8f9fa;border-radius:8px;border:1px solid #ddd;display:flex;gap:15px;flex-wrap:wrap;font-size:0.85em;">
      <span><span style="display:inline-block;width:16px;height:16px;background:#E8F5E9;border:1px solid #4CAF50;border-radius:3px;"></span> ${t('cal_legend_lavorato')}</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#E3F2FD;border:1px solid #2196F3;border-radius:3px;"></span> ${t('cal_legend_ferie')}</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#FFF3E0;border:1px solid #FF9800;border-radius:3px;"></span> ${t('cal_legend_permesso')}</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#FFEBEE;border:1px solid #f44336;border-radius:3px;"></span> ${t('cal_legend_malattia')}</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#fff3cd;border:1px solid #ffc107;border-radius:3px;"></span> ${t('cal_legend_recupero')}</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#ffebee;border:1px solid #d32f2f;border-radius:3px;"></span> ${t('cal_legend_straordinario')}</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#f5f5f5;border:1px solid #999;border-radius:3px;border-style:dashed;"></span> ${t('cal_legend_assente')}</span>
    </div>`;

  if (dipendentiDaMostrare.length === 0) {
    html += '<p class="text-muted">Nessun dipendente trovato</p>';
    output.innerHTML = html;
    return;
  }

  html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.85em;"><thead><tr>';
  html += `<th rowspan="2" style="padding:8px;border:1px solid #ddd;background:#00695C;color:white;min-width:120px;vertical-align:middle;">${t('cal_dipendente')}</th>`;
  const giorniSett = tGiorniSettimana();
  for (let g = 1; g <= giorniMese; g++) {
    const gs = new Date(anno, mese - 1, g).getDay();
    const wk = gs === 0 || gs === 6;
    html += `<th style="padding:4px;border:1px solid #ddd;text-align:center;background:${wk ? '#f5f5f5' : 'white'};min-width:35px;font-size:0.85em;font-weight:bold;color:#00695C;">${g}</th>`;
  }
  html += `<th rowspan="2" style="padding:8px;border:1px solid #ddd;background:#00695C;color:white;min-width:60px;vertical-align:middle;">${t('cal_totale')}</th>`;
  html += '</tr><tr>';
  for (let g = 1; g <= giorniMese; g++) {
    const gs = new Date(anno, mese - 1, g).getDay();
    const wk = gs === 0 || gs === 6;
    html += `<th style="padding:4px;border:1px solid #ddd;text-align:center;background:${wk ? '#f5f5f5' : 'white'};min-width:35px;font-size:0.7em;font-weight:normal;color:#888;">${giorniSett[gs]}</th>`;
  }
  html += '</tr></thead><tbody>';

  // ⭐ Filtro anti-doppione: ignora i doppioni creati dall'approvazione di un recupero ore
  const registrazioniPulite = dati.registrazioni.filter(r => !(r.richiesta_id && r.tipo === 'lavoro'));

  dipendentiDaMostrare.forEach(dip => {
    html += `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:600;background:#f8f9fa;"><strong>${dip.nome} ${dip.cognome}</strong></td>`;
    let totaleOre = 0;

    for (let g = 1; g <= giorniMese; g++) {
      const data = `${anno}-${String(mese).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
      const gs = new Date(anno, mese - 1, g).getDay();
      const wk = gs === 0 || gs === 6;
      const registrazioni = registrazioniPulite.filter(r => r.utente_id === dip.username && r.data === data);

      let cella = '';
      let bg = 'white';

      if (registrazioni.length > 0) {
        const haFerie = registrazioni.some(r => r.tipo === 'ferie');
        const haPermesso = registrazioni.some(r => r.tipo === 'permesso');
        const haMalattia = registrazioni.some(r => r.tipo === 'malattia');
        const haRecupero = registrazioni.some(r => r.recupero === true);
        const haStraordinario = registrazioni.some(r => r.straordinario === true);
        const haLavoro = registrazioni.some(r => r.tipo === 'lavoro');

        if (haFerie) { cella = 'F'; bg = '#E3F2FD'; }
        else if (haPermesso) {
          let oreLav = 0;
          registrazioni.forEach(r => {
            if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
              const [h1, m1] = r.ora_inizio.split(':').map(Number);
              const [h2, m2] = r.ora_fine.split(':').map(Number);
              oreLav += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
            }
          });
          if (oreLav > 0) { cella = 'P/' + oreLav.toFixed(1) + 'h'; totaleOre += oreLav; }
          else cella = 'P';
          bg = '#FFF3E0';
        }
        else if (haMalattia) { cella = 'M'; bg = '#FFEBEE'; }
        else if (haRecupero) {
          let oreG = 0;
          registrazioni.forEach(r => {
            if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
              const [h1, m1] = r.ora_inizio.split(':').map(Number);
              const [h2, m2] = r.ora_fine.split(':').map(Number);
              oreG += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
            }
          });
          cella = oreG.toFixed(1) + 'h'; bg = '#fff3cd'; totaleOre += oreG;
        }
        else if (haLavoro) {
          let oreG = 0;
          registrazioni.forEach(r => {
            if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
              const [h1, m1] = r.ora_inizio.split(':').map(Number);
              const [h2, m2] = r.ora_fine.split(':').map(Number);
              oreG += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
            }
          });
          if (haStraordinario) { cella = oreG.toFixed(1) + 'h ⭐'; bg = '#ffebee'; }
          else { cella = oreG.toFixed(1) + 'h'; bg = '#E8F5E9'; }
          totaleOre += oreG;
        }
      } else {
        if (wk) { cella = '/'; bg = '#f5f5f5'; }
        else {
          const haRichiestaApprovata = dati.richieste.some(r =>
            r.utente_id === dip.username && r.stato === 'approvata' &&
            r.data_inizio <= data && r.data_fine >= data
          );
          if (haRichiestaApprovata) {
            const richiesta = dati.richieste.find(r =>
              r.utente_id === dip.username && r.stato === 'approvata' &&
              r.data_inizio <= data && r.data_fine >= data
            );
            if (richiesta) {
              if (richiesta.tipo === 'ferie') { cella = 'F'; bg = '#E3F2FD'; }
              else if (richiesta.tipo === 'permesso') { cella = 'P'; bg = '#FFF3E0'; }
              else if (richiesta.tipo === 'malattia') { cella = 'M'; bg = '#FFEBEE'; }
              else if (richiesta.tipo === 'recupero_ore') {
                const [h1, m1] = richiesta.ora_inizio.split(':').map(Number);
                const [h2, m2] = richiesta.ora_fine.split(':').map(Number);
                const oreRec = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
                cella = oreRec.toFixed(1) + 'h'; bg = '#fff3cd';
              }
            }
          } else {
            const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
            const dataGiorno = new Date(data + 'T00:00:00');
            if (dataGiorno > oggi) { cella = ''; bg = 'white'; }
            else { cella = 'A'; bg = '#f5f5f5'; }
          }
        }
      }

      if (wk && cella === '') { cella = '/'; bg = '#f5f5f5'; }
      const border = cella === 'A' ? '2px dashed #999' : '1px solid #ddd';
      html += `<td style="padding:6px;border:${border};text-align:center;background:${bg};font-weight:${cella === 'A' ? 'bold' : 'normal'};color:${cella === 'A' ? '#d32f2f' : '#333'};">${cella}</td>`;
    }

    const isOltre8 = totaleOre > 8;
    html += `<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold;background:${isOltre8 ? '#ffebee' : '#e8f5e9'};color:${isOltre8 ? '#d32f2f' : '#2e7d32'};">${totaleOre.toFixed(1)}h${isOltre8 ? ' ⚠️' : ''}</td></tr>`;
  });

  html += '</tbody></table></div>';
  output.innerHTML = html;

  setTimeout(() => {
    if (output && !output.innerHTML.includes(t('cal_totale_mese'))) mostraTotaliMese();
  }, 50);
}

function mostraTotaliMese() {
  if (!utenteCorrente) return;
  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);
  if (!mese || !anno) return;

  const meseNome = t('mese_' + mese);
  let totaleGenerale = 0;
  let dipendentiDaContare = 0;

  if (utenteCorrente.ruolo === 'admin') {
    dati.registrazioni.forEach(r => {
      if (r.tipo === 'lavoro' && r.data && r.data.startsWith(`${anno}-${String(mese).padStart(2, '0')}`)) {
        totaleGenerale += r.ore || 0;
      }
    });
    dipendentiDaContare = dati.utenti.filter(u => u.ruolo === 'dipendente').length;
  } else {
    dati.registrazioni.forEach(r => {
      if (r.utente_id === utenteCorrente.username && r.tipo === 'lavoro' &&
          r.data && r.data.startsWith(`${anno}-${String(mese).padStart(2, '0')}`)) {
        totaleGenerale += r.ore || 0;
      }
    });
    dipendentiDaContare = 1;
  }

  const container = document.getElementById('calendario-output');
  if (container) {
    const label = utenteCorrente.ruolo === 'admin'
      ? `${t('cal_dipendenti_attivi')}: ${dipendentiDaContare}`
      : t('cal_le_tue_ore');
    // ✅ FIX #16: classe .box-totale-mese per rimozione selettiva nel PDF
    const totaliHTML = `
      <div class="box-totale-mese" style="background:#e8f5e9;border:2px solid #4CAF50;border-radius:10px;padding:15px;margin-bottom:20px;text-align:center;">
        <h4 style="color:#2e7d32;margin:0;">${t('cal_totale_mese')}: ${meseNome} ${anno}</h4>
        <p style="margin:5px 0;font-size:1.2em;"><strong>${totaleGenerale.toFixed(2)} ${t('cal_ore_lavorate')}</strong></p>
        <small style="color:#666;">${label}</small>
      </div>`;
    container.innerHTML = totaliHTML + container.innerHTML;
  }
}

function cambiaVistaCalendario() { caricaCalendario(); }

// ============================================
// CALENDARIO DETTAGLIATO
// ============================================
function caricaCalendarioDettagliato() {
  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);
  const output = document.getElementById('calendario-output');
  if (!mese || !anno) { output.innerHTML = '<p class="text-muted">Seleziona mese e anno</p>'; return; }

  const isAdmin = utenteCorrente.ruolo === 'admin';
  let dipendentiDaMostrare = [];
  if (isAdmin) {
    const filtroDip = document.getElementById('cal-dipendente').value;
    dipendentiDaMostrare = filtroDip
      ? dati.utenti.filter(u => u.username === filtroDip)
      : dati.utenti.filter(u => u.ruolo === 'dipendente');
  } else {
    dipendentiDaMostrare = dati.utenti.filter(u => u.username === utenteCorrente.username);
  }

  if (dipendentiDaMostrare.length === 0) { output.innerHTML = '<p class="text-muted">Nessun dipendente trovato</p>'; return; }

  const giorniMese = new Date(anno, mese, 0).getDate();
  const mesePadded = String(mese).padStart(2, '0');
  const meseNome = t('mese_' + mese);
  const giorniSett = tGiorniSettimana();

  let html = '';
  let totaleMese = 0, registrazioniTotali = 0, giorniLavorati = 0;
  const registrazioniPulite = dati.registrazioni.filter(r => !(r.richiesta_id && r.tipo === 'lavoro'));

  dipendentiDaMostrare.forEach((dip, idxDip) => {
    let htmlDip = '';
    let totaleMeseDip = 0, registrazioniDip = 0, giorniLavoratiDip = 0;

    for (let g = 1; g <= giorniMese; g++) {
      const data = `${anno}-${mesePadded}-${String(g).padStart(2, '0')}`;
      const dataObj = new Date(data + 'T00:00:00');
      const gs = dataObj.getDay();
      const wk = gs === 0 || gs === 6;

      const registrazioni = registrazioniPulite.filter(r => r.utente_id === dip.username && r.data === data);
      const richiesta = dati.richieste.find(r =>
        r.utente_id === dip.username && r.stato === 'approvata' &&
        r.data_inizio <= data && r.data_fine >= data
      );

      if (wk && registrazioni.length === 0 && !richiesta) continue;

      if (!wk && registrazioni.length === 0 && !richiesta) {
        const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
        if (dataObj < oggi) {
          htmlDip += `<div class="giorno-dettaglio"><div class="giorno-dettaglio-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${giorniSett[gs]})</span></h4><span class="giorno-totale">⬜ ASSENTE</span></div></div>`;
        }
        continue;
      }

      // ✅ FIX: Mostra il permesso SOLO se non ci sono già ore registrate per quel giorno
      const haLavoro = registrazioni.some(r => r.tipo === 'lavoro');
      
      if (richiesta && richiesta.tipo !== 'permesso' && !haLavoro) {
        const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
        const tipo = richiesta.tipo === 'recupero_ore' ? 'RECUPERO ORE' : richiesta.tipo.toUpperCase();
        const emojiChar = emoji[richiesta.tipo] || '📌';
        const protocolloHTML = (richiesta.tipo === 'malattia' && richiesta.protocollo)
          ? `<br><span style="font-size:0.85em;color:#00695C;font-weight:bold;">📄 Protocollo: ${richiesta.protocollo}</span>` : '';
        htmlDip += `<div class="giorno-dettaglio"><div class="giorno-dettaglio-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${giorniSett[gs]})</span></h4><span class="giorno-totale">${emojiChar} ${tipo}</span></div><div class="table-wrapper" style="margin-top:0;border:none;"><table><tbody><tr class="riga-speciale-giorno ${richiesta.tipo}"><td>${emojiChar} <strong>${tipo}</strong>${richiesta.note ? ' - ' + richiesta.note : ''}${protocolloHTML}</td></tr></tbody></table></div></div>`;
        continue;
      }

      // ⭐ FIX: Se c'è un permesso/ferie/malattia ma non ci sono ore di lavoro, mostra solo la riga speciale
      const regSpeciale = registrazioni.find(r => 
        (r.tipo === 'malattia' || r.tipo === 'ferie' || r.tipo === 'permesso')
      );

      if (regSpeciale && !haLavoro) {
        const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒' };
        const tipo = regSpeciale.tipo.toUpperCase();
        const emojiChar = emoji[regSpeciale.tipo] || '📌';
        
        const richiestaCollegata = dati.richieste.find(r =>
          r.utente_id === dip.username &&
          r.stato === 'approvata' &&
          r.tipo === regSpeciale.tipo &&
          r.data_inizio <= data && r.data_fine >= data
        );
        
        const protocolloHTML = (regSpeciale.tipo === 'malattia' && richiestaCollegata && richiestaCollegata.protocollo) 
          ? `<br><span style="font-size:0.9em;color:#00695C;font-weight:bold;">📄 Protocollo: ${richiestaCollegata.protocollo}</span>` 
          : '';
        
        htmlDip += `<div class="giorno-dettaglio">`;
        htmlDip += `<div class="giorno-dettaglio-header">`;
        htmlDip += `<h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${giorniSett[gs]})</span></h4>`;
        htmlDip += `<span class="giorno-totale">${emojiChar} ${tipo}</span>`;
        htmlDip += `</div>`;
        htmlDip += `<div class="table-wrapper" style="margin-top:0;border:none;">`;
        htmlDip += `<table><tbody>`;
        htmlDip += `<tr class="riga-speciale-giorno ${regSpeciale.tipo}">`;
        htmlDip += `<td><span class="icona-tipo">${emojiChar}</span> <strong>${tipo}</strong>`;
        if (regSpeciale.descrizione) htmlDip += ` - ${regSpeciale.descrizione}`;
        htmlDip += `${protocolloHTML}`;
        htmlDip += `</td></tr>`;
        htmlDip += `</tbody></table></div>`;
        htmlDip += `</div>`;
        continue;
      }
      
      let totaleGiorno = 0;
      registrazioni.sort((a, b) => (a.ora_inizio || '').localeCompare(b.ora_inizio || ''));
      registrazioni.forEach(r => {
        if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
          const [h1, m1] = r.ora_inizio.split(':').map(Number);
          const [h2, m2] = r.ora_fine.split(':').map(Number);
          totaleGiorno += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
        }
      });

      registrazioniDip += registrazioni.length;
      totaleMeseDip += totaleGiorno;
      if (totaleGiorno > 0) giorniLavoratiDip++;

      const isOltre8 = totaleGiorno > 8;
      const bgHeader = isOltre8 ? '#b71c1c' : '#00695C';
      htmlDip += `<div class="giorno-dettaglio"><div class="giorno-dettaglio-header" style="background:${bgHeader};"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${giorniSett[gs]})</span></h4><span class="giorno-totale">${totaleGiorno.toFixed(2)}h${isOltre8 ? ' ⚠️' : ''}</span></div>`;
      htmlDip += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><thead><tr><th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;
      registrazioni.forEach(r => {
        const commessa = dati.commesse.find(c => c.id === r.commessa_id);
        const [h1, m1] = r.ora_inizio.split(':').map(Number);
        const [h2, m2] = r.ora_fine.split(':').map(Number);
        const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
        const isStr = r.straordinario ? ' ⭐' : '';
        const isRec = r.recupero ? ' ⏰' : '';
        htmlDip += `<tr><td><strong>${commessa?.nome || 'N/A'}</strong></td><td>${r.ora_inizio || '-'}</td><td>${r.ora_fine || '-'}</td><td><strong>${ore.toFixed(2)}h${isStr}${isRec}</strong></td><td>${r.descrizione || '-'}</td></tr>`;
      });
      htmlDip += `</tbody></table></div></div>`;
    }

    if (isAdmin) {
      html += `<div class="calendario-dettagliato-info" style="margin-top:${idxDip > 0 ? '30px' : '0'};">
        <h3><i class="fas fa-user"></i> ${dip.nome} ${dip.cognome}</h3>
        <div class="info-totali">
          <span>📊 ${registrazioniDip} registrazioni</span>
          <span>📅 ${giorniLavoratiDip} giorni lavorati</span>
          <span>⏱️ Totale: ${totaleMeseDip.toFixed(2)}h</span>
        </div>
      </div>`;
    }

    if (htmlDip === '') {
      html += `<p class="text-muted" style="margin-bottom:20px;">Nessuna registrazione per ${dip.nome} ${dip.cognome} in questo mese.</p>`;
    } else html += htmlDip;

    totaleMese += totaleMeseDip;
    registrazioniTotali += registrazioniDip;
    giorniLavorati += giorniLavoratiDip;
  });

  let headerHTML = '';
  if (!isAdmin) {
    headerHTML = `<div class="calendario-dettagliato-info"><h3><i class="fas fa-chart-bar"></i> Riepilogo ${meseNome} ${anno}</h3><div class="info-totali"><span>📊 ${registrazioniTotali} registrazioni</span><span>📅 ${giorniLavorati} giorni lavorati</span><span>⏱️ Totale: ${totaleMese.toFixed(2)}h</span></div></div>`;
  } else {
    headerHTML = `<div class="calendario-dettagliato-info"><h3><i class="fas fa-chart-bar"></i> Riepilogo ${meseNome} ${anno} — ${dipendentiDaMostrare.length} dipendenti</h3><div class="info-totali"><span>📊 ${registrazioniTotali} registrazioni totali</span><span>⏱️ Totale: ${totaleMese.toFixed(2)}h</span></div></div>`;
  }
  output.innerHTML = headerHTML + html;
}

// ============================================
// COMMESSE — analisi dettaglio
// ============================================
function mostraAggiungiCommessa() {
  document.getElementById('commesse-menu').style.display = 'none';
  document.getElementById('commesse-aggiungi').style.display = 'block';
  document.getElementById('commesse-analizza').style.display = 'none';
  caricaListaCommesse();
}
function mostraAnalizzaCommessa() {
  document.getElementById('commesse-menu').style.display = 'none';
  document.getElementById('commesse-aggiungi').style.display = 'none';
  document.getElementById('commesse-analizza').style.display = 'block';
  const select = document.getElementById('analizza-commessa-select');
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  dati.commesse.forEach(c => { select.innerHTML += '<option value="' + c.id + '">' + c.nome + '</option>'; });
}
function tornaMenuCommesse() {
  document.getElementById('commesse-menu').style.display = 'block';
  document.getElementById('commesse-aggiungi').style.display = 'none';
  document.getElementById('commesse-analizza').style.display = 'none';
}
function caricaAnalisiCommessa() {
  const id = parseInt(document.getElementById('analizza-commessa-select').value);
  if (!id) return;
  apriDettaglioCommessa(id);
}
function apriDettaglioCommessa(id) {
  const commessa = dati.commesse.find(c => c.id === id);
  if (!commessa) { alert('❌ Commessa non trovata'); return; }
  commessaCorrenteDettaglio = id;
  filtriCommessa = { dataInizio: '', dataFine: '', ricerca: '', dipendenti: [] };
  document.getElementById('dettaglio-commessa-nome').textContent = commessa.nome;
  const dataCreazione = commessa.data_creazione ? new Date(commessa.data_creazione).toLocaleDateString('it-IT') : 'N/D';
  document.getElementById('dettaglio-commessa-data').textContent = 'Creata il ' + dataCreazione;
  document.getElementById('filtro-data-inizio').value = '';
  document.getElementById('filtro-data-fine').value = '';
  document.getElementById('filtro-ricerca').value = '';
  popolaFiltroDipendenti();
  document.getElementById('modal-dettaglio-commessa').classList.add('active');
  applicaFiltriCommessa();
}
function popolaFiltroDipendenti() {
  const container = document.getElementById('filtro-dipendenti');
  container.innerHTML = '';
  const utentiConReg = [...new Set(dati.registrazioni.filter(r => r.commessa_id === commessaCorrenteDettaglio).map(r => r.utente_id))];
  if (utentiConReg.length === 0) { container.innerHTML = '<p class="text-muted" style="margin:0;">Nessun dipendente con registrazioni</p>'; return; }
  utentiConReg.forEach(username => {
    const utente = dati.utenti.find(u => u.username === username);
    if (!utente) return;
    const item = document.createElement('div');
    item.className = 'filtro-dipendente-item';
    item.dataset.username = username;
    item.innerHTML = `<i class="fas fa-user"></i> <span>${utente.nome} ${utente.cognome}</span>`;
    item.onclick = function () {
      const idx = filtriCommessa.dipendenti.indexOf(username);
      if (idx > -1) { filtriCommessa.dipendenti.splice(idx, 1); this.classList.remove('attivo'); }
      else { filtriCommessa.dipendenti.push(username); this.classList.add('attivo'); }
      applicaFiltriCommessa();
    };
    container.appendChild(item);
  });
}
function applicaFiltriCommessa() {
  if (!commessaCorrenteDettaglio) return;
  filtriCommessa.dataInizio = document.getElementById('filtro-data-inizio').value;
  filtriCommessa.dataFine = document.getElementById('filtro-data-fine').value;
  filtriCommessa.ricerca = document.getElementById('filtro-ricerca').value.toLowerCase().trim();

  let registrazioni = dati.registrazioni.filter(r => r.commessa_id === commessaCorrenteDettaglio && r.tipo === 'lavoro');
  if (filtriCommessa.dataInizio) registrazioni = registrazioni.filter(r => r.data >= filtriCommessa.dataInizio);
  if (filtriCommessa.dataFine) registrazioni = registrazioni.filter(r => r.data <= filtriCommessa.dataFine);
  if (filtriCommessa.dipendenti.length > 0) registrazioni = registrazioni.filter(r => filtriCommessa.dipendenti.includes(r.utente_id));
  if (filtriCommessa.ricerca) {
    registrazioni = registrazioni.filter(r => {
      const utente = dati.utenti.find(u => u.username === r.utente_id);
      const nome = utente ? (utente.nome + ' ' + utente.cognome).toLowerCase() : '';
      return nome.includes(filtriCommessa.ricerca) ||
             (r.descrizione || '').toLowerCase().includes(filtriCommessa.ricerca) ||
             (r.data || '').includes(filtriCommessa.ricerca);
    });
  }
  registrazioni.sort((a, b) => b.data.localeCompare(a.data));

  document.getElementById('dettaglio-contatore').textContent = `📊 ${registrazioni.length} registrazioni visualizzate`;
  const perDipendente = {};
  registrazioni.forEach(r => { if (!perDipendente[r.utente_id]) perDipendente[r.utente_id] = []; perDipendente[r.utente_id].push(r); });
  const output = document.getElementById('dettaglio-commessa-output');
  if (registrazioni.length === 0) { output.innerHTML = '<p class="text-muted">Nessuna registrazione trovata con i filtri applicati.</p>'; return; }

  let html = '';
  let totaleGenerale = 0;
  Object.keys(perDipendente).forEach(username => {
    const utente = dati.utenti.find(u => u.username === username);
    const nome = utente ? utente.nome + ' ' + utente.cognome : username;
    let tot = 0;
    html += `<div class="gruppo-dipendente"><div class="gruppo-dipendente-header"><h4><i class="fas fa-user"></i> ${nome}</h4>`;
    perDipendente[username].forEach(r => { tot += r.ore || 0; });
    html += `<span class="subtotale">${tot.toFixed(2)}h</span></div>`;
    html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><thead><tr><th>Data</th><th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;
    perDipendente[username].forEach(r => {
      const c = dati.commesse.find(c => c.id === r.commessa_id);
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
      const isStr = r.straordinario ? ' ⭐' : '';
      const isRec = r.recupero ? ' ⏰' : '';
      html += `<tr><td>${r.data}</td><td><strong>${c?.nome || 'N/A'}</strong></td><td>${r.ora_inizio}</td><td>${r.ora_fine}</td><td><strong>${ore.toFixed(2)}h${isStr}${isRec}</strong></td><td>${r.descrizione || '-'}</td></tr>`;
    });
    html += `</tbody></table></div></div>`;
    totaleGenerale += tot;
  });
  html += `<div class="totale-generale"><i class="fas fa-calculator"></i> TOTALE GENERALE: ${totaleGenerale.toFixed(2)}h</div>`;
  output.innerHTML = html;
}
function resetFiltriCommessa() {
  filtriCommessa = { dataInizio: '', dataFine: '', ricerca: '', dipendenti: [] };
  document.getElementById('filtro-data-inizio').value = '';
  document.getElementById('filtro-data-fine').value = '';
  document.getElementById('filtro-ricerca').value = '';
  document.querySelectorAll('.filtro-dipendente-item').forEach(item => item.classList.remove('attivo'));
  applicaFiltriCommessa();
}
function chiudiDettaglioCommessa() {
  document.getElementById('modal-dettaglio-commessa').classList.remove('active');
  commessaCorrenteDettaglio = null;
}

// ============================================
// EXPORT PDF COMMESSA — FIX #6
// ============================================
async function esportaPDFCommessa() {
  if (!commessaCorrenteDettaglio) { alert('❌ Nessuna commessa selezionata'); return; }
  const commessa = dati.commesse.find(c => c.id === commessaCorrenteDettaglio);
  if (!commessa) return;
  const content = document.getElementById('dettaglio-commessa-output').innerHTML;
  if (!content || content.includes('Nessuna registrazione')) { alert('⚠️ Nessuna registrazione da esportare'); return; }

  let infoFiltri = '';
  if (filtriCommessa.dataInizio || filtriCommessa.dataFine) {
    infoFiltri += `Periodo: `;
    if (filtriCommessa.dataInizio) infoFiltri += `dal ${filtriCommessa.dataInizio} `;
    if (filtriCommessa.dataFine) infoFiltri += `al ${filtriCommessa.dataFine}`;
    infoFiltri += ' · ';
  }
  if (filtriCommessa.dipendenti.length > 0) {
    infoFiltri += `Dipendenti: ${filtriCommessa.dipendenti.map(u => {
      const ut = dati.utenti.find(x => x.username === u);
      return ut ? ut.nome + ' ' + ut.cognome : u;
    }).join(', ')} · `;
  }
  if (filtriCommessa.ricerca) infoFiltri += `Ricerca: "${filtriCommessa.ricerca}"`;
  infoFiltri = infoFiltri.replace(/·\s*$/, '').trim();

  const dataCreazione = commessa.data_creazione ? new Date(commessa.data_creazione).toLocaleDateString('it-IT') : 'N/D';
  const logoHTML = document.querySelector('.logo-small')?.outerHTML || '<h2 style="color:#00695C;">MEC-ROY srls</h2>';
  const btnEsporta = event?.target?.closest('button');
  const testoOrig = btnEsporta ? btnEsporta.innerHTML : '';
  if (btnEsporta) { btnEsporta.disabled = true; btnEsporta.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generazione...'; }

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-99999px;top:0;width:1200px;background:white;padding:25px;font-family:Arial,sans-serif;';
  container.innerHTML = `
    <style>
      table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:15px; }
      th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; }
      th { background:#00695C; color:white; font-weight:bold; }
      tr:nth-child(even) td { background:#f9f9f9; }
      .header { display:flex; align-items:center; justify-content:space-between; padding-bottom:12px; border-bottom:3px solid #00695C; margin-bottom:18px; }
      .header-left { display:flex; align-items:center; gap:10px; }
      .header-left h2 { color:#00695C; margin:0; font-size:20px; }
      .header-right { text-align:right; font-size:10px; line-height:1.5; color:#333; }
      .header-right .commercialista-nome { font-weight:700; font-size:11px; color:#00695C; }
      .titolo-report { text-align:center; margin:15px 0; }
      .titolo-report h2 { color:#00695C; margin:0; font-size:18px; }
      .titolo-report h3 { color:#333; margin:5px 0 0 0; font-size:14px; }
      .titolo-report p { color:#888; font-size:11px; margin:5px 0; }
      .info-filtri { background:#f8f9fa; padding:10px; border-radius:6px; margin-bottom:15px; font-size:11px; color:#555; }
      .footer { text-align:center; padding:10px 0; border-top:2px solid #ddd; margin-top:20px; color:#888; font-size:10px; }
      .gruppo-dipendente { margin-bottom:20px; }
      .gruppo-dipendente-header { background:#00695C; color:white; padding:8px 12px; border-radius:6px 6px 0 0; display:flex; justify-content:space-between; }
      .gruppo-dipendente-header h4 { margin:0; color:white; font-size:13px; }
      .subtotale { background:rgba(255,255,255,0.2); padding:2px 10px; border-radius:10px; font-weight:bold; font-size:12px; }
      .totale-generale { background:#fff3cd; border:2px solid #ffc107; padding:12px; text-align:center; font-weight:bold; border-radius:8px; color:#856404; font-size:14px; }
    </style>
    <div class="header">
      <div class="header-left">${logoHTML}</div>
      <div class="header-right">
        <div class="commercialista-nome">Dott.ssa ELENA ROBERTI</div>
        <div>Studio Elaborazione Paghe</div>
        <div>Piazza I.Alpi, 1 42019 Scandiano (RE)</div>
        <div>Tel 0522 856515</div>
        <div>elenaroberti@studiocostetti.com</div>
      </div>
    </div>
    <div class="titolo-report">
      <h2>REPORT COMMESSA</h2>
      <h3>${commessa.nome}</h3>
      <p>Data creazione: ${dataCreazione} · Generato il ${new Date().toLocaleDateString('it-IT')}</p>
    </div>
    ${infoFiltri ? `<div class="info-filtri"><strong>🔍 Filtri applicati:</strong> ${infoFiltri}</div>` : ''}
    <div>${content}</div>
    <div class="footer">MEC-ROY srls - Documento generato automaticamente</div>`;
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 300));
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    await generaPDFMultipagina(pdf, container, 210, 297, 8, 'portrait');
    document.body.removeChild(container);
    await scaricaOCondividiPDF(pdf, `Report_Commessa_${commessa.nome.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error('❌ Errore PDF Commessa:', err);
    if (document.body.contains(container)) document.body.removeChild(container);
    alert('❌ Errore: ' + err.message);
  } finally {
    if (btnEsporta) { btnEsporta.disabled = false; btnEsporta.innerHTML = testoOrig; }
  }
}

// ============================================
// DETTAGLIO DIPENDENTE (admin)
// ============================================
function apriDettaglioDipendente(username) {
  const utente = dati.utenti.find(u => u.username === username);
  if (!utente) { alert('❌ Dipendente non trovato'); return; }
  dipendenteCorrenteDettaglio = username;
  const oggi = new Date();
  filtriDipendente = { vista: 'mese', giorno: oggi.toISOString().split('T')[0], mese: oggi.getMonth() + 1, anno: oggi.getFullYear() };
  document.getElementById('dettaglio-dipendente-nome').textContent = utente.nome + ' ' + utente.cognome;
  document.getElementById('dettaglio-dipendente-ruolo').textContent = 'Ruolo: ' + utente.ruolo + ' | Username: ' + utente.username;
  document.getElementById('filtro-vista-dipendente').value = 'mese';
  document.getElementById('filtro-giorno').value = filtriDipendente.giorno;
  document.getElementById('filtro-mese').value = filtriDipendente.mese;
  document.getElementById('filtro-anno').value = filtriDipendente.anno;
  cambiaVistaDipendente();
  document.getElementById('modal-dettaglio-dipendente').classList.add('active');
  applicaFiltriDipendente();
}
function cambiaVistaDipendente() {
  const vista = document.getElementById('filtro-vista-dipendente').value;
  filtriDipendente.vista = vista;
  if (vista === 'giorno') {
    document.getElementById('gruppo-filtro-giorno').style.display = 'block';
    document.getElementById('gruppo-filtro-mese').style.display = 'none';
    document.getElementById('gruppo-filtro-anno').style.display = 'none';
  } else {
    document.getElementById('gruppo-filtro-giorno').style.display = 'none';
    document.getElementById('gruppo-filtro-mese').style.display = 'block';
    document.getElementById('gruppo-filtro-anno').style.display = 'block';
  }
  applicaFiltriDipendente();
}
function applicaFiltriDipendente() {
  if (!dipendenteCorrenteDettaglio) return;
  const vista = document.getElementById('filtro-vista-dipendente').value;
  filtriDipendente.vista = vista;
  const output = document.getElementById('dettaglio-dipendente-output');
  const giorniSett = tGiorniSettimana();

  if (vista === 'giorno') {
    const giorno = document.getElementById('filtro-giorno').value;
    filtriDipendente.giorno = giorno;
    if (!giorno) { output.innerHTML = '<p class="text-muted">Seleziona un giorno</p>'; return; }
    const registrazioni = dati.registrazioni.filter(r => r.utente_id === dipendenteCorrenteDettaglio && r.data === giorno);
    const richiesta = dati.richieste.find(r =>
      r.utente_id === dipendenteCorrenteDettaglio && r.stato === 'approvata' &&
      r.data_inizio <= giorno && r.data_fine >= giorno
    );
    document.getElementById('dettaglio-dipendente-contatore').textContent = `📊 ${registrazioni.length} registrazioni`;
    if (registrazioni.length === 0 && !richiesta) { output.innerHTML = '<p class="text-muted">Nessuna registrazione per questo giorno.</p>'; return; }

    const dataFormattata = new Date(giorno + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let html = '<div class="gruppo-giorno"><div class="gruppo-giorno-header"><h4><i class="fas fa-calendar-day"></i> ' + dataFormattata + '</h4>';
    if (richiesta) {
      const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
      const tipo = richiesta.tipo === 'recupero_ore' ? 'RECUPERO ORE' : richiesta.tipo.toUpperCase();
      const emojiChar = emoji[richiesta.tipo] || '📌';
      const prot = (richiesta.tipo === 'malattia' && richiesta.protocollo) ? `<br><span style="font-size:0.9em;color:#00695C;font-weight:bold;">📄 Protocollo: ${richiesta.protocollo}</span>` : '';
      html += `<span class="subtotale-giorno">${emojiChar} ${tipo}</span></div>`;
      html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><tbody><tr class="riga-speciale ${richiesta.tipo}"><td><span class="icona-tipo">${emojiChar}</span> <strong>${tipo}</strong>${richiesta.note ? ' - ' + richiesta.note : ''}${prot}</td></tr></tbody></table></div></div>`;
      output.innerHTML = html;
      return;
    }
    let totGiorno = 0;
    registrazioni.forEach(r => {
      if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
        const [h1, m1] = r.ora_inizio.split(':').map(Number);
        const [h2, m2] = r.ora_fine.split(':').map(Number);
        totGiorno += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
      }
    });
    html += `<span class="subtotale-giorno">${totGiorno.toFixed(2)}h</span></div>`;
    html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><thead><tr><th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;
    registrazioni.sort((a, b) => (a.ora_inizio || '').localeCompare(b.ora_inizio || ''));
    registrazioni.forEach(r => {
      const c = dati.commesse.find(c => c.id === r.commessa_id);
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
      const isStr = r.straordinario ? ' ⭐' : '';
      const isRec = r.recupero ? ' ⏰' : '';
      html += `<tr><td><strong>${c?.nome || 'N/A'}</strong></td><td>${r.ora_inizio || '-'}</td><td>${r.ora_fine || '-'}</td><td><strong>${ore.toFixed(2)}h${isStr}${isRec}</strong></td><td>${r.descrizione || '-'}</td></tr>`;
    });
    html += `</tbody></table></div></div>`;
    output.innerHTML = html;
  } else {
    const mese = parseInt(document.getElementById('filtro-mese').value);
    const anno = parseInt(document.getElementById('filtro-anno').value);
    filtriDipendente.mese = mese;
    filtriDipendente.anno = anno;
    if (!mese || !anno) { output.innerHTML = '<p class="text-muted">Seleziona mese e anno</p>'; return; }

    const giorniMese = new Date(anno, mese, 0).getDate();
    const mesePadded = String(mese).padStart(2, '0');
    const meseNome = t('mese_' + mese);
    let html = '';
    let totMese = 0, regTotali = 0;

    for (let g = 1; g <= giorniMese; g++) {
      const data = `${anno}-${mesePadded}-${String(g).padStart(2, '0')}`;
      const dataObj = new Date(data + 'T00:00:00');
      const gs = dataObj.getDay();
      const wk = gs === 0 || gs === 6;
      const registrazioni = dati.registrazioni.filter(r => r.utente_id === dipendenteCorrenteDettaglio && r.data === data);
      const richiesta = dati.richieste.find(r =>
        r.utente_id === dipendenteCorrenteDettaglio && r.stato === 'approvata' &&
        r.data_inizio <= data && r.data_fine >= data
      );

      if (wk && registrazioni.length === 0 && !richiesta) continue;

      if (registrazioni.length === 0 && !richiesta && !wk) {
        const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
        if (dataObj < oggi) {
          html += `<div class="gruppo-giorno"><div class="gruppo-giorno-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${giorniSett[gs]})</span></h4><span class="subtotale-giorno">⬜ ASSENTE</span></div></div>`;
        }
        continue;
      }

      if (richiesta && registrazioni.length === 0) {
        const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
        const tipo = richiesta.tipo === 'recupero_ore' ? 'RECUPERO ORE' : richiesta.tipo.toUpperCase();
        const emojiChar = emoji[richiesta.tipo] || '📌';
        html += `<div class="gruppo-giorno"><div class="gruppo-giorno-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${giorniSett[gs]})</span></h4><span class="subtotale-giorno">${emojiChar} ${tipo}</span></div>`;
        html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><tbody><tr class="riga-speciale ${richiesta.tipo}"><td><span class="icona-tipo">${emojiChar}</span> <strong>${tipo}</strong>${richiesta.note ? ' - ' + richiesta.note : ''}`;
        if (richiesta.tipo === 'malattia' && richiesta.protocollo) html += `<br><span style="font-size:0.9em;color:#00695C;font-weight:bold;">📄 Protocollo: ${richiesta.protocollo}</span>`;
        html += `</td></tr></tbody></table></div></div>`;
        continue;
      }

      const regSpeciale = registrazioni.find(r => r.tipo === 'malattia' || r.tipo === 'ferie' || r.tipo === 'permesso');
      if (regSpeciale) {
        const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒' };
        const tipo = regSpeciale.tipo.toUpperCase();
        const emojiChar = emoji[regSpeciale.tipo] || '📌';
        const richCollegata = dati.richieste.find(r =>
          r.utente_id === dipendenteCorrenteDettaglio && r.stato === 'approvata' &&
          r.tipo === regSpeciale.tipo && r.data_inizio <= data && r.data_fine >= data
        );
        const prot = (regSpeciale.tipo === 'malattia' && richCollegata && richCollegata.protocollo) ? `<br><span style="font-size:0.9em;color:#00695C;font-weight:bold;">📄 Protocollo: ${richCollegata.protocollo}</span>` : '';
        html += `<div class="gruppo-giorno"><div class="gruppo-giorno-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${giorniSett[gs]})</span></h4><span class="subtotale-giorno">${emojiChar} ${tipo}</span></div>`;
        html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><tbody><tr class="riga-speciale ${regSpeciale.tipo}"><td><span class="icona-tipo">${emojiChar}</span> <strong>${tipo}</strong>${regSpeciale.descrizione ? ' - ' + regSpeciale.descrizione : ''}${prot}</td></tr></tbody></table></div></div>`;
        continue;
      }

      let totGiorno = 0;
      registrazioni.sort((a, b) => (a.ora_inizio || '').localeCompare(b.ora_inizio || ''));
      registrazioni.forEach(r => {
        if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
          const [h1, m1] = r.ora_inizio.split(':').map(Number);
          const [h2, m2] = r.ora_fine.split(':').map(Number);
          totGiorno += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
        }
      });
      regTotali += registrazioni.length;
      totMese += totGiorno;

      html += `<div class="gruppo-giorno"><div class="gruppo-giorno-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${giorniSett[gs]})</span></h4><span class="subtotale-giorno">${totGiorno.toFixed(2)}h</span></div>`;
      html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><thead><tr><th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;
      registrazioni.forEach(r => {
        const c = dati.commesse.find(c => c.id === r.commessa_id);
        const [h1, m1] = r.ora_inizio.split(':').map(Number);
        const [h2, m2] = r.ora_fine.split(':').map(Number);
        const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
        const isStr = r.straordinario ? ' ⭐' : '';
        const isRec = r.recupero ? ' ⏰' : '';
        html += `<tr><td><strong>${c?.nome || 'N/A'}</strong></td><td>${r.ora_inizio || '-'}</td><td>${r.ora_fine || '-'}</td><td><strong>${ore.toFixed(2)}h${isStr}${isRec}</strong></td><td>${r.descrizione || '-'}</td></tr>`;
      });
      html += `</tbody></table></div></div>`;
    }

    document.getElementById('dettaglio-dipendente-contatore').textContent = `📊 ${regTotali} registrazioni nel mese`;
    if (html === '') { output.innerHTML = '<p class="text-muted">Nessuna registrazione per questo mese.</p>'; return; }
    const headerHTML = `<div class="dipendente-info-box"><h3><i class="fas fa-chart-bar"></i> Riepilogo ${meseNome} ${anno}</h3><div class="info-dettagli"><span>📊 ${regTotali} registrazioni</span><span>⏱️ Totale: ${totMese.toFixed(2)}h</span></div></div>`;
    output.innerHTML = headerHTML + html;
  }
}
function resetFiltriDipendente() {
  const oggi = new Date();
  filtriDipendente = { vista: 'mese', giorno: oggi.toISOString().split('T')[0], mese: oggi.getMonth() + 1, anno: oggi.getFullYear() };
  document.getElementById('filtro-vista-dipendente').value = 'mese';
  document.getElementById('filtro-giorno').value = filtriDipendente.giorno;
  document.getElementById('filtro-mese').value = filtriDipendente.mese;
  document.getElementById('filtro-anno').value = filtriDipendente.anno;
  cambiaVistaDipendente();
}
function chiudiDettaglioDipendente() {
  document.getElementById('modal-dettaglio-dipendente').classList.remove('active');
  dipendenteCorrenteDettaglio = null;
}

// ============================================
// EXPORT PDF DIPENDENTE — FIX #6
// ============================================
async function esportaPDFDipendente() {
  if (!dipendenteCorrenteDettaglio) { alert('❌ Nessun dipendente selezionato'); return; }
  const utente = dati.utenti.find(u => u.username === dipendenteCorrenteDettaglio);
  if (!utente) return;
  const content = document.getElementById('dettaglio-dipendente-output').innerHTML;
  if (!content || content.includes('Nessuna registrazione')) { alert('⚠️ Nessuna registrazione da esportare'); return; }

  const vista = filtriDipendente.vista;
  let periodo = '';
  const meseNome = t('mese_' + filtriDipendente.mese);
  periodo = vista === 'giorno'
    ? new Date(filtriDipendente.giorno + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `${meseNome} ${filtriDipendente.anno}`;

  const logoHTML = document.querySelector('.logo-small')?.outerHTML || '<h2 style="color:#00695C;">MEC-ROY srls</h2>';
  const btnEsporta = event?.target?.closest('button');
  const testoOrig = btnEsporta ? btnEsporta.innerHTML : '';
  if (btnEsporta) { btnEsporta.disabled = true; btnEsporta.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generazione...'; }

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-99999px;top:0;width:1200px;background:white;padding:25px;font-family:Arial,sans-serif;';
  container.innerHTML = `
    <style>
      table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:15px; }
      th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; }
      th { background:#00695C; color:white; font-weight:bold; }
      tr:nth-child(even) td { background:#f9f9f9; }
      .header { display:flex; align-items:center; justify-content:space-between; padding-bottom:12px; border-bottom:3px solid #00695C; margin-bottom:18px; }
      .header-left { display:flex; align-items:center; gap:10px; }
      .header-left h2 { color:#00695C; margin:0; font-size:20px; }
      .header-right { text-align:right; font-size:10px; line-height:1.5; color:#333; }
      .header-right .commercialista-nome { font-weight:700; font-size:11px; color:#00695C; }
      .titolo-report { text-align:center; margin:15px 0; }
      .titolo-report h2 { color:#00695C; margin:0; font-size:18px; }
      .titolo-report h3 { color:#333; margin:5px 0 0 0; font-size:14px; }
      .titolo-report p { color:#888; font-size:11px; margin:5px 0; }
      .footer { text-align:center; padding:10px 0; border-top:2px solid #ddd; margin-top:20px; color:#888; font-size:10px; }
      .dipendente-info-box { background:#00695C; color:white; padding:12px 20px; border-radius:8px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
      .dipendente-info-box h3 { margin:0; font-size:14px; color:white; }
      .dipendente-info-box .info-dettagli { display:flex; gap:15px; font-size:11px; }
      .dipendente-info-box .info-dettagli span { background:rgba(255,255,255,0.22); padding:3px 10px; border-radius:10px; }
      .gruppo-giorno { margin-bottom:15px; border:1px solid #ddd; border-radius:6px; overflow:hidden; page-break-inside:avoid; }
      .gruppo-giorno-header { background:#00695C; color:white; padding:8px 12px; display:flex; justify-content:space-between; }
      .gruppo-giorno-header h4 { margin:0; color:white; font-size:12px; }
      .gruppo-giorno-header .giorno-settimana { font-size:0.85em; opacity:0.9; margin-left:6px; }
      .gruppo-giorno-header .subtotale-giorno { background:rgba(255,255,255,0.22); padding:3px 10px; border-radius:10px; font-weight:bold; font-size:11px; }
      .riga-speciale.ferie td { background:#E3F2FD; color:#0d47a1; text-align:center; font-weight:bold; padding:15px; }
      .riga-speciale.permesso td { background:#FFF3E0; color:#e65100; text-align:center; font-weight:bold; padding:15px; }
      .riga-speciale.malattia td { background:#FFEBEE; color:#b71c1c; text-align:center; font-weight:bold; padding:15px; }
    </style>
    <div class="header">
      <div class="header-left">${logoHTML}</div>
      <div class="header-right">
        <div class="commercialista-nome">Dott.ssa ELENA ROBERTI</div>
        <div>Studio Elaborazione Paghe</div>
        <div>Piazza I.Alpi, 1 42019 Scandiano (RE)</div>
        <div>Tel 0522 856515</div>
        <div>elenaroberti@studiocostetti.com</div>
      </div>
    </div>
    <div class="titolo-report">
      <h2>REPORT DIPENDENTE</h2>
      <h3>${utente.nome} ${utente.cognome}</h3>
      <p>Periodo: ${periodo} · Generato il ${new Date().toLocaleDateString('it-IT')}</p>
    </div>
    <div>${content}</div>
    <div class="footer">MEC-ROY srls - Documento generato automaticamente</div>`;
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 300));
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    await generaPDFMultipagina(pdf, container, 210, 297, 8, 'portrait');
    document.body.removeChild(container);
    await scaricaOCondividiPDF(pdf, `Report_${utente.nome}_${utente.cognome}.pdf`);
  } catch (err) {
    console.error('❌ Errore PDF Dipendente:', err);
    if (document.body.contains(container)) document.body.removeChild(container);
    alert('❌ Errore: ' + err.message);
  } finally {
    if (btnEsporta) { btnEsporta.disabled = false; btnEsporta.innerHTML = testoOrig; }
  }
}

// ============================================
// BACKUP ZIP
// ============================================
function apriModalBackup() {
  if (utenteCorrente?.ruolo !== 'admin') { alert('Solo gli amministratori'); return; }
  document.getElementById('msg-backup').innerHTML = '';
  document.getElementById('modal-backup').classList.add('active');
}
function chiudiModalBackup() { document.getElementById('modal-backup')?.classList.remove('active'); }
async function eseguiBackup() {
  if (utenteCorrente?.ruolo !== 'admin') return;
  const msg = document.getElementById('msg-backup');
  msg.innerHTML = '<div class="info-msg">⏳ Generazione backup in corso...</div>';

  try {
    await new Promise(r => setTimeout(r, 100));
    const zip = new JSZip();
    const dataOggi = new Date().toISOString().split('T')[0];
    const nomeCartella = `MEC-ROY_Backup_${dataOggi}`;
    const root = zip.folder(nomeCartella);
    const stiliComuni = `<style>body{font-family:Arial,sans-serif;padding:20px;color:#333;}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;}th{background:#00695C;color:white;}h1,h2{color:#00695C;}</style>`;
    const headHTML = (titolo) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titolo}</title>${stiliComuni}</head><body>`;
    const cartellaComm = root.folder('Commesse');

    for (const commessa of dati.commesse) {
      const registrazioni = dati.registrazioni.filter(r => r.commessa_id === commessa.id && r.tipo === 'lavoro');
      if (registrazioni.length === 0) continue;
      let htmlContent = headHTML(`Commessa ${commessa.nome}`);
      htmlContent += `<h1>${commessa.nome}</h1><table><thead><tr><th>Data</th><th>Dipendente</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;
      registrazioni.forEach(r => {
        const u = dati.utenti.find(u => u.username === r.utente_id);
        const nome = u ? `${u.nome} ${u.cognome}` : r.utente_id;
        const [h1, m1] = r.ora_inizio.split(':').map(Number);
        const [h2, m2] = r.ora_fine.split(':').map(Number);
        const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
        htmlContent += `<tr><td>${r.data}</td><td>${nome}</td><td>${r.ora_inizio}</td><td>${r.ora_fine}</td><td>${ore.toFixed(2)}h</td><td>${r.descrizione || '-'}</td></tr>`;
      });
      htmlContent += `</tbody></table></body></html>`;
      cartellaComm.file(`${commessa.nome.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`, htmlContent);
    }

    msg.innerHTML = '<div class="info-msg">📦 Creazione ZIP in corso...</div>';
    const blob = await zip.generateAsync({ type: 'blob' });
    const nomeZip = `${nomeCartella}.zip`;
    const file = new File([blob], nomeZip, { type: 'application/zip' });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nomeCartella, text: 'Backup MEC-ROY' });
        msg.innerHTML = '<div class="success">✅ Backup condiviso!</div>';
        setTimeout(chiudiModalBackup, 1500);
        return;
      } catch (error) { if (error.name === 'AbortError') { msg.innerHTML = ''; return; } }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeZip;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    msg.innerHTML = '<div class="success">✅ Backup scaricato!</div>';
    setTimeout(chiudiModalBackup, 1500);
  } catch (err) {
    console.error('❌ Errore backup:', err);
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

// ============================================
// NUMERI MANCANTI
// ============================================
function apriNumeriMancanti() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('main-page').style.display = 'block';
  document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const tabNM = document.getElementById('tab-numeri-mancanti');
  if (tabNM) { tabNM.style.display = 'inline-block'; tabNM.classList.add('active'); }
  const panelNM = document.getElementById('panel-numeri-mancanti');
  if (panelNM) panelNM.classList.add('active');
  const btnLogout = document.querySelector('.btn-logout');
  if (btnLogout) {
    btnLogout.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    btnLogout.onclick = function () {
      document.getElementById('login-page').style.display = 'block';
      document.getElementById('main-page').style.display = 'none';
      btnLogout.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
      btnLogout.onclick = logout;
      document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
    };
  }
  nmMostraSchermataCommesse();
  nmCommessaCorrente = null;
  nmCartellaCorrente = null;
  nmCaricaListaCommesse();
}
function nmMostraSchermataCommesse() {
  const s1 = document.getElementById('nm-schermata-commesse');
  const s2 = document.getElementById('nm-schermata-cartelle');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
}
function nmMostraSchermataCartelle() {
  const s1 = document.getElementById('nm-schermata-commesse');
  const s2 = document.getElementById('nm-schermata-cartelle');
  if (s1) s1.style.display = 'none';
  if (s2) s2.style.display = 'block';
}

// ✅ FIX #14: orderBy con fallback per doc senza data_modifica
async function nmCaricaListaCommesse() {
  const div = document.getElementById('nm-lista-commesse');
  if (!div) return;
  div.innerHTML = '<p class="text-muted">⏳ Caricamento commesse...</p>';
  try {
    // Carica tutto senza orderBy per non escludere doc vecchi
    const snapshot = await nmGetCollection().get();
    if (snapshot.empty) {
      div.innerHTML = '<p class="text-muted">' + t('nm_crea') + '</p>';
      return;
    }
    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    // Ordina in JS per data_modifica (fallback data_creazione)
    docs.sort((a, b) => {
      const da = a.data_modifica || a.data_creazione || '';
      const db = b.data_modifica || b.data_creazione || '';
      return db.localeCompare(da);
    });

    let html = '<div class="nm-commesse-grid">';
    docs.forEach(commessa => {
      const id = commessa.id;
      let totNumeri = 0;
      if (commessa.cartelle) {
        Object.keys(commessa.cartelle).forEach(k => {
          if (Array.isArray(commessa.cartelle[k])) totNumeri += commessa.cartelle[k].length;
        });
      }
      const dataMod = commessa.data_modifica
        ? new Date(commessa.data_modifica).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'N/D';
      const isAdmin = utenteCorrente && utenteCorrente.ruolo === 'admin';
      html += `<div class="nm-commessa-card">
        <div class="nm-commessa-header" onclick="nmApriCommessa('${id}')">
          <i class="fas fa-folder"></i>
          <div class="nm-commessa-info">
            <div class="nm-commessa-codice">${commessa.codice || id}</div>
            <div class="nm-commessa-meta">${totNumeri} · ${dataMod}</div>
          </div>
        </div>
        ${isAdmin ? `<button class="nm-btn-cancella-commessa" onclick="event.stopPropagation(); nmRichiediCancellazione('${id}')" title="Cancella"><i class="fas fa-trash"></i></button>` : ''}
      </div>`;
    });
    html += '</div>';
    div.innerHTML = html;
    docs.forEach(d => { nmCommesseCache[d.id] = d; });
  } catch (err) {
    console.error('❌ Errore:', err);
    div.innerHTML = '<p class="error">Errore: ' + err.message + '</p>';
  }
}

function nmApriCreaCommessa() {
  document.getElementById('nm-input-4cifre').value = '';
  document.getElementById('nm-input-6char').value = '';
  document.getElementById('nm-msg-crea-commessa').innerHTML = '';
  nmAggiornaPreview();
  document.getElementById('nm-modal-crea-commessa').classList.add('active');
  setTimeout(() => document.getElementById('nm-input-4cifre').focus(), 200);
}
function nmChiudiCreaCommessa() { document.getElementById('nm-modal-crea-commessa')?.classList.remove('active'); }
function nmAggiornaPreview() {
  const cifre = document.getElementById('nm-input-4cifre').value;
  const chars = document.getElementById('nm-input-6char').value;
  const preview = document.getElementById('nm-preview-commessa');
  if (!preview) return;
  const cifreLabel = cifre.padEnd(4, '0') || '0000';
  const charsLabel = chars.toUpperCase().padEnd(6, 'X') || 'XXXXXX';
  preview.textContent = 'Anteprima: CC' + cifreLabel + '-A-' + charsLabel;
}
async function nmSalvaNuovaCommessa() {
  const cifre = document.getElementById('nm-input-4cifre').value.trim();
  const chars = document.getElementById('nm-input-6char').value.trim().toUpperCase();
  const msg = document.getElementById('nm-msg-crea-commessa');
  if (cifre.length !== 4) { msg.innerHTML = '<div class="error">❌ Inserisci esattamente 4 cifre</div>'; return; }
  if (chars.length !== 6) { msg.innerHTML = '<div class="error">❌ Inserisci esattamente 6 caratteri</div>'; return; }
  const codiceCompleto = 'CC' + cifre + '-A-' + chars;
  msg.innerHTML = '<div class="info-msg">⏳ Verifica...</div>';
  try {
    const doc = await nmGetCollection().doc(codiceCompleto).get();
    if (doc.exists) { msg.innerHTML = '<div class="error">❌ Esiste già una commessa con questo codice</div>'; return; }
    await nmGetCollection().doc(codiceCompleto).set({
      id: codiceCompleto, codice: codiceCompleto,
      data_creazione: new Date().toISOString(), data_modifica: new Date().toISOString(),
      cartelle: { filo: [], cavo: [], adesive: [], targhette: [], morsetti: [] }
    });
    msg.innerHTML = '<div class="success">✅ Commessa creata!</div>';
    setTimeout(() => { nmChiudiCreaCommessa(); nmCaricaListaCommesse(); }, 800);
  } catch (err) {
    console.error('❌ Errore:', err);
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}
function nmApriCommessa(idCommessa) {
  nmCommessaCorrente = idCommessa;
  const titolo = document.getElementById('nm-commessa-corrente-titolo');
  if (titolo) titolo.textContent = idCommessa;
  nmAggiornaConteggiCartelle();
  nmMostraSchermataCartelle();
  nmPushHistory('cartelle');
}

async function nmAggiornaConteggiCartelle() {
  if (!nmCommessaCorrente) return;
  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) return;
    const commessa = doc.data();
    const cartelle = commessa.cartelle || {};
    ['filo', 'cavo', 'adesive', 'targhette', 'morsetti'].forEach(tipo => {
      const numeri = cartelle[tipo] || [];
      const totale = numeri.length;
      const stampati = numeri.filter(n => n.stampato === true).length;
      const nuovi = totale - stampati;
      const el = document.getElementById('nm-count-' + tipo);
      if (el) el.textContent = totale;
      const cartellaDiv = el ? el.closest('.nm-cartella') : null;
      if (!cartellaDiv) return;
      let contatore = cartellaDiv.querySelector('.nm-cartella-stampati-nuovi');
      if (!contatore) {
        contatore = document.createElement('div');
        contatore.className = 'nm-cartella-stampati-nuovi';
        el.parentElement.appendChild(contatore);
      }
      if (totale === 0) contatore.innerHTML = '';
      else if (nuovi === 0) contatore.innerHTML = `<span class="nm-badge-stampati">🟢 ${stampati} stampati</span>`;
      else if (stampati === 0) contatore.innerHTML = `<span class="nm-badge-nuovi">⚪ ${nuovi} nuovi</span>`;
      else contatore.innerHTML = `<span class="nm-badge-stampati">🟢 ${stampati}</span><span class="nm-badge-nuovi">⚪ ${nuovi}</span>`;
    });
  } catch (err) { console.error('❌ Errore conteggi:', err); }
}

function nmTornaAlleCommesse() {
  nmCommessaCorrente = null;
  nmCartellaCorrente = null;
  nmMostraSchermataCommesse();
  nmCaricaListaCommesse();
  window._nmHistoryState = 'commesse';
}

async function nmApriCartella(tipo) {
  if (!nmCommessaCorrente) return;
  nmCartellaCorrente = tipo;
  nmPushHistory('popup');
  document.getElementById('nm-popup-titolo').textContent = NM_CARTELLE_LABEL[tipo];
  const inputSingolo = document.getElementById('nm-input-singolo');
  const inputDoppio = document.getElementById('nm-input-doppio');
  if (tipo === 'cavo') {
    inputSingolo.style.display = 'none';
    inputDoppio.style.display = 'flex';
    document.getElementById('nm-cavo-sinistra').value = '';
    document.getElementById('nm-cavo-destra').value = '';
  } else {
    inputSingolo.style.display = 'flex';
    inputDoppio.style.display = 'none';
    document.getElementById('nm-input-numero').value = '';
  }
  document.getElementById('nm-modal-popup').classList.add('active');
  await nmCaricaNumeriCartella();
  setTimeout(() => {
    if (tipo === 'cavo') document.getElementById('nm-cavo-sinistra').focus();
    else document.getElementById('nm-input-numero').focus();
  }, 200);
}
function nmChiudiPopup() {
  document.getElementById('nm-modal-popup').classList.remove('active');
  nmCartellaCorrente = null;
  nmAggiornaConteggiCartelle();
  window._nmHistoryState = 'cartelle';
}

async function nmCaricaNumeriCartella() {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;
  const div = document.getElementById('nm-lista-numeri');
  div.innerHTML = '<p class="text-muted">⏳ Caricamento...</p>';
  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) { div.innerHTML = '<p class="error">Commessa non trovata</p>'; return; }
    const commessa = doc.data();
    const numeri = (commessa.cartelle && commessa.cartelle[nmCartellaCorrente]) || [];

    let barraRicerca = document.getElementById('nm-barra-ricerca');
    if (!barraRicerca) {
      barraRicerca = document.createElement('div');
      barraRicerca.id = 'nm-barra-ricerca';
      barraRicerca.className = 'nm-barra-ricerca';
      barraRicerca.innerHTML = `
        <i class="fas fa-search"></i>
        <input type="text" id="nm-input-ricerca" placeholder="Cerca numero..." autocomplete="off" oninput="nmFiltraNumeri()" />
        <button class="nm-btn-clear-ricerca" onclick="nmPulisciRicerca()" title="Pulisci"><i class="fas fa-times"></i></button>`;
      div.parentElement.insertBefore(barraRicerca, div);
    }
    const inputRicerca = document.getElementById('nm-input-ricerca');
    if (inputRicerca) inputRicerca.value = '';

    if (numeri.length === 0) { div.innerHTML = '<p class="text-muted">Nessun numero inserito</p>'; return; }
    window._nmNumeriCorrenti = numeri;
    nmRenderNumeri(numeri);
  } catch (err) {
    console.error('❌ Errore:', err);
    div.innerHTML = '<p class="error">Errore: ' + err.message + '</p>';
  }
}

// ✅ FIX #18: event delegation per evitare XSS
function nmRenderNumeri(numeri) {
  const div = document.getElementById('nm-lista-numeri');
  if (!div) return;
  if (numeri.length === 0) { div.innerHTML = '<p class="text-muted">Nessun numero trovato</p>'; return; }
  div.innerHTML = numeri.map(n => `
    <div class="nm-numero-item${n.stampato ? ' stampato' : ''}" data-id="${nmEscapaHtml(n.id)}">
      <span class="nm-numero-testo">${nmEscapaHtml(n.testo)}</span>
      <div class="nm-numero-azioni">
        <button class="nm-btn-azione nm-btn-duplica" data-azione="duplica" title="Duplica"><i class="fas fa-copy"></i></button>
        <button class="nm-btn-azione nm-btn-modifica" data-azione="modifica" title="Modifica"><i class="fas fa-edit"></i></button>
        <button class="nm-btn-azione nm-btn-cancella" data-azione="cancella" title="Cancella"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');
}

// Event delegation (una sola volta)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-azione]');
  if (!btn) return;
  const item = btn.closest('.nm-numero-item');
  if (!item) return;
  const id = item.dataset.id;
  const azione = btn.dataset.azione;
  if (azione === 'duplica') nmDuplicaNumero(id);
  else if (azione === 'modifica') nmModificaNumero(id);
  else if (azione === 'cancella') nmCancellaNumero(id);
});

function nmFiltraNumeri() {
  const input = document.getElementById('nm-input-ricerca');
  if (!input) return;
  const query = input.value.trim().toUpperCase();
  const numeri = window._nmNumeriCorrenti || [];
  if (!query) { nmRenderNumeri(numeri); return; }
  nmRenderNumeri(numeri.filter(n => (n.testo || '').toUpperCase().includes(query)));
}
function nmPulisciRicerca() {
  const input = document.getElementById('nm-input-ricerca');
  if (input) { input.value = ''; input.focus(); }
  nmFiltraNumeri();
}

async function nmDuplicaNumero(idNumero) {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;
  try {
    const docRef = nmGetCollection().doc(nmCommessaCorrente);
    const doc = await docRef.get();
    if (!doc.exists) return;
    const commessa = doc.data();
    const numeri = commessa.cartelle[nmCartellaCorrente] || [];
    const idx = numeri.findIndex(n => n.id === idNumero);
    if (idx === -1) { alert('❌ Numero non trovato'); return; }
    const originale = numeri[idx];
    const duplicato = {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      testo: originale.testo, ordine: idx + 1,
      data_aggiunta: new Date().toISOString(), stampato: false
    };
    numeri.splice(idx + 1, 0, duplicato);
    numeri.forEach((n, i) => n.ordine = i);
    commessa.cartelle[nmCartellaCorrente] = numeri;
    commessa.data_modifica = new Date().toISOString();
    await docRef.set(commessa);
    await nmCaricaNumeriCartella();
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

// ✅ FIX #28: controllo duplicati in nmAggiungiNumero
async function nmAggiungiNumero() {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;
  let testo = '';
  if (nmCartellaCorrente === 'cavo') {
    const sinistraInput = document.getElementById('nm-cavo-sinistra');
    const destraInput = document.getElementById('nm-cavo-destra');
    const sinistra = sinistraInput.value.trim().toUpperCase();
    const destra = destraInput.value.trim().toUpperCase();
    if (!sinistra && !destra) { alert('⚠️ Compila entrambe le caselle'); sinistraInput.focus(); return; }
    if (!sinistra) { alert('⚠️ Compila la casella sinistra'); sinistraInput.focus(); return; }
    if (!destra) { alert('⚠️ Compila la casella destra'); destraInput.focus(); return; }
    testo = '-' + sinistra + '/-' + destra;
  } else {
    const input = document.getElementById('nm-input-numero');
    testo = input.value.trim().toUpperCase();
    if (!testo) { input.focus(); return; }
    if (!testo.startsWith('-')) testo = '-' + testo;
  }

  try {
    const docRef = nmGetCollection().doc(nmCommessaCorrente);
    const doc = await docRef.get();
    if (!doc.exists) { alert('❌ Commessa non trovata'); return; }
    const commessa = doc.data();
    if (!commessa.cartelle) commessa.cartelle = {};
    if (!Array.isArray(commessa.cartelle[nmCartellaCorrente])) commessa.cartelle[nmCartellaCorrente] = [];

    // ✅ Controllo duplicato
    if (commessa.cartelle[nmCartellaCorrente].some(n => (n.testo || '').toUpperCase() === testo)) {
      alert('⚠️ Questo numero esiste già in questa cartella.');
      return;
    }

    const nuovo = {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      testo, ordine: commessa.cartelle[nmCartellaCorrente].length,
      data_aggiunta: new Date().toISOString(), stampato: false
    };
    commessa.cartelle[nmCartellaCorrente].push(nuovo);
    commessa.data_modifica = new Date().toISOString();
    await docRef.set(commessa);

    if (nmCartellaCorrente === 'cavo') {
      document.getElementById('nm-cavo-sinistra').value = '';
      document.getElementById('nm-cavo-destra').value = '';
      document.getElementById('nm-cavo-sinistra').focus();
    } else {
      document.getElementById('nm-input-numero').value = '';
      document.getElementById('nm-input-numero').focus();
    }
    await nmCaricaNumeriCartella();
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

async function nmModificaNumero(idNumero) {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;
  try {
    const docRef = nmGetCollection().doc(nmCommessaCorrente);
    const doc = await docRef.get();
    if (!doc.exists) return;
    const commessa = doc.data();
    const numeri = commessa.cartelle[nmCartellaCorrente] || [];
    const numero = numeri.find(n => n.id === idNumero);
    if (!numero) return;
    let nuovoTesto = '';
    if (nmCartellaCorrente === 'cavo') {
      const parti = numero.testo.replace(/^-/, '').split('/-');
      const sinistraAttuale = parti[0] || '';
      const destraAttuale = parti[1] || '';
      const nuovaSinistra = prompt('Modifica scritta SINISTRA:', sinistraAttuale);
      if (nuovaSinistra === null) return;
      if (!nuovaSinistra.trim()) { alert('❌ La scritta sinistra non può essere vuota'); return; }
      const nuovaDestra = prompt('Modifica scritta DESTRA:', destraAttuale);
      if (nuovaDestra === null) return;
      if (!nuovaDestra.trim()) { alert('❌ La scritta destra non può essere vuota'); return; }
      nuovoTesto = '-' + nuovaSinistra.trim().toUpperCase() + '/-' + nuovaDestra.trim().toUpperCase();
    } else {
      const nuovo = prompt('Modifica il numero:', numero.testo);
      if (nuovo === null) return;
      if (!nuovo.trim()) { alert('❌ Il numero non può essere vuoto'); return; }
      nuovoTesto = nuovo.trim().toUpperCase();
      if (!nuovoTesto.startsWith('-')) nuovoTesto = '-' + nuovoTesto;
    }
    numero.testo = nuovoTesto;
    commessa.data_modifica = new Date().toISOString();
    await docRef.set(commessa);
    await nmCaricaNumeriCartella();
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

async function nmCancellaNumero(idNumero) {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;
  if (!confirm('Cancellare questo numero?')) return;
  try {
    const docRef = nmGetCollection().doc(nmCommessaCorrente);
    const doc = await docRef.get();
    if (!doc.exists) return;
    const commessa = doc.data();
    commessa.cartelle[nmCartellaCorrente] = (commessa.cartelle[nmCartellaCorrente] || []).filter(n => n.id !== idNumero);
    // ✅ FIX #29: rinumera ordine
    commessa.cartelle[nmCartellaCorrente].forEach((n, i) => n.ordine = i);
    commessa.data_modifica = new Date().toISOString();
    await docRef.set(commessa);
    await nmCaricaNumeriCartella();
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

// ✅ FIX #27: transazione per "ho stampato"
async function nmHoStampato() {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;
  if (!confirm('Segnare tutti i numeri di questa cartella come STAMPATI?')) return;
  try {
    const docRef = nmGetCollection().doc(nmCommessaCorrente);
    await _dbFirestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) throw new Error('Commessa non trovata');
      const commessa = doc.data();
      if (!commessa.cartelle || !Array.isArray(commessa.cartelle[nmCartellaCorrente])) return;
      commessa.cartelle[nmCartellaCorrente].forEach(n => n.stampato = true);
      commessa.data_modifica = new Date().toISOString();
      transaction.set(docRef, commessa);
    });
    await nmCaricaNumeriCartella();
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

async function nmHoStampatoTutto() {
  if (!nmCommessaCorrente) return;
  if (!confirm('Segnare TUTTI i numeri di TUTTE le cartelle come STAMPATI?')) return;
  try {
    const docRef = nmGetCollection().doc(nmCommessaCorrente);
    let totale = 0;
    await _dbFirestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) throw new Error('Commessa non trovata');
      const commessa = doc.data();
      if (!commessa.cartelle) return;
      ['filo', 'cavo', 'adesive', 'targhette', 'morsetti'].forEach(tipo => {
        (commessa.cartelle[tipo] || []).forEach(n => { n.stampato = true; totale++; });
      });
      commessa.data_modifica = new Date().toISOString();
      transaction.set(docRef, commessa);
    });
    await nmAggiornaConteggiCartelle();
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

// PDF cartella singola / commessa (jsPDF puro)
async function nmCondividiCartella() {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;
  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) return;
    const commessa = doc.data();
    const numeri = (commessa.cartelle && commessa.cartelle[nmCartellaCorrente]) || [];
    if (numeri.length === 0) { alert('⚠️ Nessun numero da condividere'); return; }
    const numColonne = NM_CARTELLE_COLONNE[nmCartellaCorrente] || 3;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297, margin = 12;
    const contentW = pageW - margin * 2;
    const colorPrimary = [0, 105, 92];
    const colorText = [34, 34, 34];
    const logo = await caricaLogoPerPDF();
    const dataGen = new Date().toLocaleDateString('it-IT');
    let y = margin + 2;
    const logoMaxH = 12;
    let logoH = 0, logoW = 0;
    if (logo) {
      logoH = logoMaxH; logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
      try { pdf.addImage(logo, 'PNG', margin, y, logoW, logoH); } catch (err) {}
    }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...colorPrimary);
    pdf.text('MEC-ROY SRLS', margin + (logo ? logoW + 4 : 0), y + logoH / 2 + 2);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...colorText);
    pdf.text(dataGen, pageW - margin, y + logoH / 2 + 2, { align: 'right' });
    y += logoH + 4;
    pdf.setDrawColor(...colorPrimary); pdf.setLineWidth(0.5); pdf.line(margin, y, pageW - margin, y);
    y += 8;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...colorPrimary);
    pdf.text(commessa.codice + ' - ' + NM_CARTELLE_LABEL[nmCartellaCorrente], margin, y);
    y += 8;
    let fontSize = 10;
    if (numColonne >= 6) fontSize = 8;
    else if (numColonne >= 4) fontSize = 9;
    else if (numColonne === 2) fontSize = 9;
    const lineHeight = fontSize * 0.55;
    const righeMaxCol = Math.floor((pageH - y - margin - 5) / lineHeight);
    const colonnaW = contentW / numColonne;
    const padding = 2;
    const maxChars = Math.floor((colonnaW - padding * 2) / (fontSize * 0.18));
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(fontSize); pdf.setTextColor(...colorText);
    const numPerPag = righeMaxCol * numColonne;
    const numPagine = Math.ceil(numeri.length / numPerPag);
    for (let p = 0; p < numPagine; p++) {
      if (p > 0) { pdf.addPage(); y = margin + 5; }
      const numPag = numeri.slice(p * numPerPag, (p + 1) * numPerPag);
      const righeBil = Math.ceil(numPag.length / numColonne);
      for (let c = 0; c < numColonne; c++) {
        const startIdx = c * righeBil;
        const numCol = numPag.slice(startIdx, startIdx + righeBil);
        const colX = margin + (c * colonnaW) + padding;
        numCol.forEach((num, i) => {
          const rigaY = y + ((i + 1) * lineHeight);
          let testo = num.testo || '';
          if (testo && !testo.startsWith('-')) testo = '-' + testo;
          if (testo.length > maxChars) testo = testo.substring(0, maxChars - 2) + '..';
          pdf.text(testo, colX, rigaY);
        });
      }
    }
    const nomeFile = `${commessa.codice}_${NM_CARTELLE_LABEL[nmCartellaCorrente]}`.replace(/\s+/g, '_') + '.pdf';
    await scaricaOCondividiPDF(pdf, nomeFile);
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

async function nmCondividiTuttaCommessa() {
  if (!nmCommessaCorrente) { alert('⚠️ Nessuna commessa selezionata'); return; }
  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) { alert('❌ Commessa non trovata'); return; }
    const commessa = doc.data();
    const cartelle = commessa.cartelle || {};
    const cartelleDaStampare = [];
    ['filo', 'cavo', 'adesive', 'targhette', 'morsetti'].forEach(tipo => {
      const numeri = cartelle[tipo] || [];
      if (numeri.length > 0) cartelleDaStampare.push({ tipo, numeri });
    });
    if (cartelleDaStampare.length === 0) { alert('⚠️ Nessun numero inserito in questa commessa'); return; }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297, margin = 12;
    const contentW = pageW - margin * 2;
    const colorPrimary = [0, 105, 92];
    const colorText = [34, 34, 34];
    const logo = await caricaLogoPerPDF();
    const dataGen = new Date().toLocaleDateString('it-IT');
    let y = margin + 2;
    const logoH = logo ? 12 : 0;
    let logoW = 0;
    if (logo) { logoW = (logo.naturalWidth / logo.naturalHeight) * logoH; try { pdf.addImage(logo, 'PNG', margin, y, logoW, logoH); } catch (err) {} }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...colorPrimary);
    pdf.text('MEC-ROY SRLS', margin + (logo ? logoW + 4 : 0), y + logoH / 2 + 2);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...colorText);
    pdf.text(dataGen, pageW - margin, y + logoH / 2 + 2, { align: 'right' });
    y += logoH + 4;
    pdf.setDrawColor(...colorPrimary); pdf.setLineWidth(0.5); pdf.line(margin, y, pageW - margin, y);
    y += 8;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...colorPrimary);
    pdf.text(commessa.codice + ' - NUMERI MANCANTI', margin, y);
    y += 10;
    for (const cartella of cartelleDaStampare) {
      const tipo = cartella.tipo;
      const numeri = cartella.numeri;
      const label = NM_CARTELLE_LABEL[tipo];
      const numColonne = NM_CARTELLE_COLONNE[tipo] || 3;
      let fontSize = 10;
      if (numColonne >= 6) fontSize = 8;
      else if (numColonne >= 4) fontSize = 9;
      else if (numColonne === 2) fontSize = 9;
      const lineHeight = fontSize * 0.55;
      const righeBil = Math.ceil(numeri.length / numColonne);
      const altSezione = righeBil * lineHeight + 12;
      if (y + altSezione > pageH - margin && y > margin + 10) { pdf.addPage(); y = margin + 5; }
      pdf.setFillColor(...colorPrimary); pdf.rect(margin, y, contentW, 7, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(255, 255, 255);
      pdf.text(label, margin + 3, y + 5);
      pdf.setFontSize(9); pdf.text(numeri.length + ' numeri', pageW - margin - 3, y + 5, { align: 'right' });
      const yInizio = y + 10;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(fontSize); pdf.setTextColor(...colorText);
      const colonnaW = contentW / numColonne;
      const maxChars = Math.floor((colonnaW - 4) / (fontSize * 0.18));
      for (let c = 0; c < numColonne; c++) {
        const startIdx = c * righeBil;
        const numCol = numeri.slice(startIdx, startIdx + righeBil);
        const colX = margin + (c * colonnaW) + 2;
        numCol.forEach((num, i) => {
          const rigaY = yInizio + ((i + 1) * lineHeight);
          let testo = num.testo || '';
          if (testo && !testo.startsWith('-')) testo = '-' + testo;
          if (testo.length > maxChars) testo = testo.substring(0, maxChars - 2) + '..';
          pdf.text(testo, colX, rigaY);
        });
      }
      y = yInizio + righeBil * lineHeight + 8;
    }
    await scaricaOCondividiPDF(pdf, `${commessa.codice}_Numeri_Mancanti.pdf`);
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

function nmRichiediCancellazione(idCommessa) {
  if (!utenteCorrente || utenteCorrente.ruolo !== 'admin') { alert('❌ Non autorizzato'); return; }
  nmCommessaDaCancellare = idCommessa;
  document.getElementById('nm-admin-password').value = '';
  document.getElementById('nm-msg-admin').innerHTML = '';
  document.getElementById('nm-modal-admin').classList.add('active');
  setTimeout(() => document.getElementById('nm-admin-password').focus(), 200);
}
function nmChiudiAdmin() {
  document.getElementById('nm-modal-admin').classList.remove('active');
  nmCommessaDaCancellare = null;
}

// ✅ FIX #10: rilegge utente dal DB per password fresca
async function nmConfermaCancellazione() {
  if (!nmCommessaDaCancellare) return;
  const password = document.getElementById('nm-admin-password').value;
  const msg = document.getElementById('nm-msg-admin');
  if (!password) { msg.innerHTML = '<div class="error">Inserisci la password</div>'; return; }
  if (!utenteCorrente || utenteCorrente.ruolo !== 'admin') { msg.innerHTML = '<div class="error">❌ Non sei autorizzato</div>'; return; }

  let utenteFresco = utenteCorrente;
  try {
    const snap = await _dbFirestore().collection('utenti').doc(utenteCorrente.username).get();
    if (snap.exists) utenteFresco = snap.data();
  } catch (e) { console.warn('⚠️ Rilettura utente fallita:', e); }

  if (utenteFresco.password !== password) { msg.innerHTML = '<div class="error">❌ Password errata</div>'; return; }
  msg.innerHTML = '<div class="info-msg">⏳ Cancellazione...</div>';
  try {
    await nmGetCollection().doc(nmCommessaDaCancellare).delete();
    msg.innerHTML = '<div class="success">✅ Commessa cancellata!</div>';
    setTimeout(() => { nmChiudiAdmin(); nmCaricaListaCommesse(); }, 800);
  } catch (err) {
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

function nmEscapaHtml(testo) {
  if (!testo) return '';
  return String(testo).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// CSV Phoenix
async function nmScaricaCSVPhoenix() {
  if (!nmCommessaCorrente || !nmCartellaCorrente) { alert('❌ Nessuna cartella aperta'); return; }
  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) return;
    const commessa = doc.data();
    const numeri = (commessa.cartelle && commessa.cartelle[nmCartellaCorrente]) || [];
    if (numeri.length === 0) { alert('⚠️ Nessun numero in questa cartella'); return; }
    let csv = '';
    numeri.forEach(n => { let t = (n.testo || '').replace(/;/g, ','); csv += "'" + t + '\n'; });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const nomeCommessa = (commessa.codice || nmCommessaCorrente).replace(/[^a-zA-Z0-9_-]/g, '_');
    const nomeCartella = (NM_CARTELLE_LABEL[nmCartellaCorrente] || nmCartellaCorrente).replace(/\s+/g, '_');
    const nomeFile = `${nomeCommessa}_${nomeCartella}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeFile;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

async function nmCopiaPerPhoenix() {
  if (!nmCommessaCorrente || !nmCartellaCorrente) { alert('❌ Nessuna cartella aperta'); return; }
  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) return;
    const numeri = (doc.data().cartelle && doc.data().cartelle[nmCartellaCorrente]) || [];
    if (numeri.length === 0) { alert('⚠️ Nessun numero'); return; }
    const testi = numeri.map(n => n.testo || '');
    const testoPlain = testi.join('\n');
    const htmlTabella = '<table>' + testi.map(t => `<tr><td>${t}</td></tr>`).join('') + '</table>';
    try {
      if (typeof ClipboardItem !== 'undefined') {
        const blobHtml = new Blob([htmlTabella], { type: 'text/html' });
        const blobPlain = new Blob([testoPlain], { type: 'text/plain' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobPlain })]);
      } else {
        await navigator.clipboard.writeText(testoPlain);
      }
      alert(`✅ Copiati ${numeri.length} numeri. Incolla in Phoenix Contact con Ctrl+V.`);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = testoPlain;
      textarea.style.position = 'fixed'; textarea.style.opacity = '0';
      document.body.appendChild(textarea); textarea.select();
      document.execCommand('copy'); document.body.removeChild(textarea);
      alert(`✅ Copiati ${numeri.length} numeri.`);
    }
  } catch (err) { alert('❌ Errore: ' + err.message); }
}

// ============================================
// PROTOCOLLO MALATTIA
// ============================================
function nmInitProtocolloInputs() {
  const inputs = document.querySelectorAll('.protocollo-digit');
  if (inputs.length === 0) return;
  inputs.forEach((input, index) => {
    if (input.dataset.protocolloInit === '1') return;
    input.dataset.protocolloInit = '1';
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (e.target.value.length === 1 && index < inputs.length - 1) inputs[index + 1].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
        e.preventDefault(); inputs[index - 1].focus(); inputs[index - 1].value = '';
      }
      if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); inputs[index - 1].focus(); }
      if (e.key === 'ArrowRight' && index < inputs.length - 1) { e.preventDefault(); inputs[index + 1].focus(); }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const testo = (e.clipboardData || window.clipboardData).getData('text');
      const cifre = testo.replace(/[^0-9]/g, '').slice(0, 9);
      if (cifre.length > 0) {
        for (let i = 0; i < inputs.length; i++) inputs[i].value = cifre[i] || '';
        const ultima = Math.min(cifre.length, inputs.length) - 1;
        if (ultima >= 0) inputs[ultima].focus();
      }
    });
  });
}
function nmLeggiProtocollo() {
  let p = '';
  document.querySelectorAll('.protocollo-digit').forEach(i => p += i.value);
  return p;
}
function nmSvuotaProtocollo() { document.querySelectorAll('.protocollo-digit').forEach(i => i.value = ''); }
function nmCompilaProtocollo(protocollo) {
  const inputs = document.querySelectorAll('.protocollo-digit');
  const cifre = String(protocollo || '').replace(/[^0-9]/g, '');
  inputs.forEach((input, i) => input.value = cifre[i] || '');
}

// ============================================
// PROTOCOLLO MODALE
// ============================================
function apriModificaProtocollo(idRichiesta) {
  const richiesta = dati.richieste.find(r => r.id === idRichiesta);
  if (!richiesta) { alert('❌ Richiesta non trovata'); return; }
  if (richiesta.tipo !== 'malattia') { alert('⚠️ Il protocollo è solo per le richieste di malattia'); return; }
  window._idRichiestaProtocollo = idRichiesta;
  nmCompilaProtocolloModale(richiesta.protocollo || '');
  document.getElementById('modal-protocollo').classList.add('active');
  setTimeout(() => {
    const inputs = document.querySelectorAll('.protocollo-digit-modale');
    for (const input of inputs) { if (!input.value) { input.focus(); break; } }
  }, 200);
}
function chiudiModificaProtocollo() {
  document.getElementById('modal-protocollo').classList.remove('active');
  window._idRichiestaProtocollo = null;
}
function nmCompilaProtocolloModale(protocollo) {
  const inputs = document.querySelectorAll('.protocollo-digit-modale');
  const cifre = String(protocollo || '').replace(/[^0-9]/g, '');
  inputs.forEach((input, i) => input.value = cifre[i] || '');
}
function nmLeggiProtocolloModale() {
  let p = '';
  document.querySelectorAll('.protocollo-digit-modale').forEach(i => p += i.value);
  return p;
}
function nmInitProtocolloModale() {
  const inputs = document.querySelectorAll('.protocollo-digit-modale');
  if (inputs.length === 0) return;
  inputs.forEach((input, index) => {
    if (input.dataset.protocolloInit === '1') return;
    input.dataset.protocolloInit = '1';
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (e.target.value.length === 1 && index < inputs.length - 1) inputs[index + 1].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
        e.preventDefault(); inputs[index - 1].focus(); inputs[index - 1].value = '';
      }
    });
  });
}
async function salvaProtocolloModale() {
  if (!window._idRichiestaProtocollo) return;
  const protocollo = nmLeggiProtocolloModale();
  const msg = document.getElementById('msg-protocollo');
  if (protocollo.length !== 9 || !/^\d{9}$/.test(protocollo)) { msg.innerHTML = '<div class="error">❌ Inserisci tutte e 9 le cifre</div>'; return; }
  try {
    const richiesta = dati.richieste.find(r => r.id === window._idRichiestaProtocollo);
    if (!richiesta) { msg.innerHTML = '<div class="error">❌ Richiesta non trovata</div>'; return; }
    richiesta.protocollo = protocollo;
    await richAggiorna(richiesta.id, { protocollo });
    msg.innerHTML = '<div class="success">✅ Protocollo aggiornato!</div>';
    setTimeout(() => { chiudiModificaProtocollo(); caricaRichiesteAdmin(); }, 800);
  } catch (err) {
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

// ============================================
// ✅ FIX #11: HISTORY PULITA
// ============================================
function nmPushHistory(state) {
  const precedente = window._nmHistoryState || 'commesse';
  if (precedente === state) return;
  window._nmHistoryState = state;
  history.pushState({ nmState: state, precedente }, '', location.pathname);
}

window.addEventListener('popstate', function (event) {
  const panelNM = document.getElementById('panel-numeri-mancanti');
  if (!panelNM || !panelNM.classList.contains('active')) return;
  const stato = event.state?.nmState || 'commesse';
  if (stato === 'commesse') {
    nmMostraSchermataCommesse();
    nmCaricaListaCommesse();
    window._nmHistoryState = 'commesse';
  } else if (stato === 'cartelle') {
    nmChiudiPopup();
    nmMostraSchermataCartelle();
    window._nmHistoryState = 'cartelle';
  }
}, false);

// ============================================
// FOTO DIPENDENTE
// ============================================
function ridimensionaFoto(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) { if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; } }
        else { if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; } }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Immagine non valida'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Errore lettura file'));
    reader.readAsDataURL(file);
  });
}

function htmlAvatar(utente, size = 'sm') {
  const classe = 'foto-avatar foto-avatar-' + size;
  if (utente && utente.foto) return `<div class="${classe}"><img src="${utente.foto}" alt="foto" /></div>`;
  return `<div class="${classe}"><i class="fas fa-user"></i></div>`;
}

async function gestisciFileNuovoDipendente(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('⚠️ Seleziona un file immagine'); return; }
  try {
    const base64 = await ridimensionaFoto(file);
    window._fotoNuovoDipendenteBase64 = base64;
    const preview = document.getElementById('dip-foto-preview');
    if (preview) preview.innerHTML = `<img src="${base64}" alt="foto" />`;
    const btnRimuovi = document.getElementById('dip-foto-rimuovi');
    if (btnRimuovi) btnRimuovi.style.display = 'inline-block';
  } catch (err) { alert('❌ Errore nel caricamento della foto'); }
}
function rimuoviFotoNuovoDipendente() {
  window._fotoNuovoDipendenteBase64 = null;
  const preview = document.getElementById('dip-foto-preview');
  if (preview) preview.innerHTML = '<i class="fas fa-user"></i>';
  const btnRimuovi = document.getElementById('dip-foto-rimuovi');
  if (btnRimuovi) btnRimuovi.style.display = 'none';
  const inputFile = document.getElementById('dip-foto-file');
  if (inputFile) inputFile.value = '';
}

// Foto editor (zoom + trascina)
const _editorState = {
  scale: 1, x: 0, y: 0,
  imgNaturalW: 0, imgNaturalH: 0,
  baseScale: 1, minScale: 0.5, maxScale: 4,
  lastPinchDist: 0, dragging: false, lastX: 0, lastY: 0
};

function initFotoEditor() {
  const viewport = document.getElementById('foto-editor-viewport');
  if (!viewport || viewport.dataset.editorInit === '1') return;
  viewport.dataset.editorInit = '1';
  viewport.style.webkitUserSelect = 'none';
  viewport.style.webkitTouchCallout = 'none';
  viewport.addEventListener('mousedown', (e) => {
    if (!_editorState.imgNaturalW) return;
    _editorState.dragging = true;
    _editorState.lastX = e.clientX; _editorState.lastY = e.clientY;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!_editorState.dragging) return;
    _editorState.x += e.clientX - _editorState.lastX;
    _editorState.y += e.clientY - _editorState.lastY;
    _editorState.lastX = e.clientX; _editorState.lastY = e.clientY;
    applicaTrasformazioneEditor();
  });
  window.addEventListener('mouseup', () => { _editorState.dragging = false; });
  viewport.addEventListener('wheel', (e) => {
    if (!_editorState.imgNaturalW) return;
    e.preventDefault();
    cambiaZoomEditor(e.deltaY > 0 ? -0.1 : 0.1);
  }, { passive: false });
  viewport.addEventListener('touchstart', (e) => {
    if (!_editorState.imgNaturalW) return;
    if (e.touches.length === 1) {
      _editorState.dragging = true;
      _editorState.lastX = e.touches[0].clientX;
      _editorState.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      _editorState.dragging = false;
      _editorState.lastPinchDist = distanzaTouch(e.touches);
    }
  }, { passive: true });
  viewport.addEventListener('touchmove', (e) => {
    if (!_editorState.imgNaturalW) return;
    e.preventDefault();
    if (e.touches.length === 1 && _editorState.dragging) {
      _editorState.x += e.touches[0].clientX - _editorState.lastX;
      _editorState.y += e.touches[0].clientY - _editorState.lastY;
      _editorState.lastX = e.touches[0].clientX;
      _editorState.lastY = e.touches[0].clientY;
      applicaTrasformazioneEditor();
    } else if (e.touches.length === 2) {
      const d = distanzaTouch(e.touches);
      const delta = (d - _editorState.lastPinchDist) / 150;
      _editorState.lastPinchDist = d;
      cambiaZoomEditor(delta);
    }
  }, { passive: false });
  viewport.addEventListener('touchend', () => {
    _editorState.dragging = false;
    _editorState.lastPinchDist = 0;
  });
}
function distanzaTouch(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
function cambiaZoomEditor(delta) {
  _editorState.scale = Math.max(_editorState.minScale, Math.min(_editorState.maxScale, _editorState.scale + delta));
  applicaTrasformazioneEditor();
}
function applicaTrasformazioneEditor() {
  const img = document.getElementById('foto-editor-img');
  if (!img) return;
  const totalScale = _editorState.baseScale * _editorState.scale;
  img.style.transform = `translate(-50%, -50%) translate(${_editorState.x}px, ${_editorState.y}px) scale(${totalScale})`;
}
function caricaImmagineEditor(base64) {
  const img = document.getElementById('foto-editor-img');
  const placeholder = document.getElementById('foto-editor-placeholder');
  if (!img) return;
  img.style.display = 'block';
  img.style.opacity = '0';
  const onLoad = () => {
    const viewport = document.getElementById('foto-editor-viewport');
    const vw = viewport.clientWidth || 260;
    const vh = viewport.clientHeight || 260;
    const natW = img.naturalWidth, natH = img.naturalHeight;
    if (!natW || !natH) { img.style.opacity = '1'; return; }
    _editorState.imgNaturalW = natW;
    _editorState.imgNaturalH = natH;
    const circleSize = Math.min(vw, vh) * 0.77;
    _editorState.baseScale = Math.max(circleSize / natW, circleSize / natH);
    _editorState.scale = 1; _editorState.x = 0; _editorState.y = 0;
    img.style.width = natW + 'px';
    img.style.height = natH + 'px';
    applicaTrasformazioneEditor();
    if (placeholder) placeholder.style.display = 'none';
    img.style.display = 'block';
    img.style.opacity = '1';
  };
  if (img.complete && img.naturalWidth > 0 && img.src === base64) { onLoad(); return; }
  img.onload = onLoad;
  img.onerror = () => { img.style.opacity = '0'; };
  img.src = base64;
}
function generaFotoFinale(callback) {
  const img = document.getElementById('foto-editor-img');
  const viewport = document.getElementById('foto-editor-viewport');
  if (!img || !_editorState.imgNaturalW) { callback(null); return; }
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const circleSize = Math.min(vw, vh) * 0.77;
  const outputSize = 400;
  const canvas = document.createElement('canvas');
  canvas.width = outputSize; canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  const totalScale = _editorState.baseScale * _editorState.scale;
  const centerImgX = _editorState.imgNaturalW / 2 - _editorState.x / totalScale;
  const centerImgY = _editorState.imgNaturalH / 2 - _editorState.y / totalScale;
  const cropSize = circleSize / totalScale;
  const srcX = centerImgX - cropSize / 2;
  const srcY = centerImgY - cropSize / 2;
  ctx.drawImage(img, srcX, srcY, cropSize, cropSize, 0, 0, outputSize, outputSize);
  callback(canvas.toDataURL('image/jpeg', 0.85));
}

function apriModaleFoto(username) {
  const utente = dati.utenti.find(u => u.username === username);
  if (!utente) { alert('❌ Dipendente non trovato'); return; }
  window._usernameModaleFoto = username;
  window._fotoModaleBase64 = utente.foto || null;
  const nomeEl = document.getElementById('modal-foto-nome');
  if (nomeEl) nomeEl.textContent = utente.nome + ' ' + utente.cognome;
  document.getElementById('msg-foto').innerHTML = '';
  const imgEl = document.getElementById('foto-editor-img');
  const placeholder = document.getElementById('foto-editor-placeholder');
  const btnRimuovi = document.getElementById('foto-btn-rimuovi');
  const btnSalva = document.getElementById('foto-btn-salva');
  if (window._fotoModaleBase64) {
    imgEl.style.display = 'block'; placeholder.style.display = 'none';
    caricaImmagineEditor(window._fotoModaleBase64);
    btnRimuovi.style.display = 'inline-block';
  } else {
    imgEl.style.display = 'none'; placeholder.style.display = 'flex';
    _editorState.imgNaturalW = 0;
    btnRimuovi.style.display = 'none';
  }
  btnSalva.disabled = !window._fotoModaleBase64;
  setTimeout(initFotoEditor, 100);
  document.getElementById('modal-foto').classList.add('active');
}
async function gestisciFileFoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('⚠️ Seleziona un file immagine'); return; }
  try {
    const base64 = await ridimensionaFoto(file, 1200);
    window._fotoModaleBase64 = base64;
    const imgEl = document.getElementById('foto-editor-img');
    const placeholder = document.getElementById('foto-editor-placeholder');
    const btnRimuovi = document.getElementById('foto-btn-rimuovi');
    const btnSalva = document.getElementById('foto-btn-salva');
    imgEl.style.display = 'block'; placeholder.style.display = 'none';
    btnRimuovi.style.display = 'inline-block';
    btnSalva.disabled = false;
    caricaImmagineEditor(base64);
  } catch (err) { alert('❌ Errore nel caricamento'); }
}
function rimuoviFotoModale() {
  if (!window._fotoModaleBase64) return;
  if (!confirm('Rimuovere la foto di questo dipendente?')) return;
  window._fotoModaleBase64 = null;
  _editorState.imgNaturalW = 0;
  const imgEl = document.getElementById('foto-editor-img');
  const placeholder = document.getElementById('foto-editor-placeholder');
  const btnRimuovi = document.getElementById('foto-btn-rimuovi');
  const btnSalva = document.getElementById('foto-btn-salva');
  imgEl.style.display = 'none'; placeholder.style.display = 'flex';
  btnRimuovi.style.display = 'none'; btnSalva.disabled = true;
}
async function salvaFotoModale() {
  if (!window._usernameModaleFoto) return;
  const utente = dati.utenti.find(u => u.username === window._usernameModaleFoto);
  if (!utente) return;
  const msg = document.getElementById('msg-foto');
  const btnSalva = document.getElementById('foto-btn-salva');
  if (!window._fotoModaleBase64) {
    try {
      delete utente.foto;
      await utenteSalva(utente);
      msg.innerHTML = '<div class="success">✅ Foto rimossa!</div>';
      setTimeout(() => { chiudiModaleFoto(); caricaListaDipendenti(); }, 700);
    } catch (err) { msg.innerHTML = '<div class="error">❌ ' + err.message + '</div>'; }
    return;
  }
  btnSalva.disabled = true;
  const orig = btnSalva.innerHTML;
  btnSalva.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';
  generaFotoFinale(async (base64Final) => {
    if (!base64Final) {
      msg.innerHTML = '<div class="error">❌ Errore durante il ritaglio</div>';
      btnSalva.disabled = false; btnSalva.innerHTML = orig; return;
    }
    try {
      utente.foto = base64Final;
      await utenteSalva(utente);
      msg.innerHTML = '<div class="success">✅ Foto aggiornata!</div>';
      setTimeout(() => { chiudiModaleFoto(); caricaListaDipendenti(); }, 700);
    } catch (err) {
      msg.innerHTML = '<div class="error">❌ ' + err.message + '</div>';
      btnSalva.disabled = false; btnSalva.innerHTML = orig;
    }
  });
}
function chiudiModaleFoto() {
  document.getElementById('modal-foto')?.classList.remove('active');
  window._usernameModaleFoto = null;
  window._fotoModaleBase64 = null;
  _editorState.imgNaturalW = 0;
  const inputFile = document.getElementById('foto-input-file');
  if (inputFile) inputFile.value = '';
}

// ============================================
// ✅ FIX #20: SCHERMATA BENVENUTO con timer cancellabile
// ============================================
function mostraSchermataBenvenuto(utente) {
  if (!utente) return;
  if (window._timerBenvenuto) { clearTimeout(window._timerBenvenuto); window._timerBenvenuto = null; }
  const overlay = document.getElementById('welcome-overlay');
  if (!overlay) return;
  const avatarEl = document.getElementById('welcome-avatar');
  const nomeEl = document.getElementById('welcome-nome');
  if (avatarEl) {
    if (utente.foto) avatarEl.innerHTML = `<img src="${utente.foto}" alt="foto" />`;
    else avatarEl.innerHTML = '<i class="fas fa-user"></i>';
  }
  if (nomeEl) nomeEl.textContent = t('benvenuto') + ' ' + (utente.nome || utente.username);
  overlay.classList.add('attivo');
  overlay.classList.remove('uscita');
  window._timerBenvenuto = setTimeout(() => {
    overlay.classList.add('uscita');
    window._timerBenvenuto = setTimeout(() => {
      overlay.classList.remove('attivo');
      overlay.classList.remove('uscita');
    }, 400);
  }, 2000);
}

// ============================================
// AGGIUNGI REGISTRAZIONE MANUALE (admin)
// ============================================
function apriModaleAggiungiRegistrazione() {
  if (utenteCorrente?.ruolo !== 'admin') { alert('Solo gli amministratori'); return; }
  const selDip = document.getElementById('addreg-dipendente');
  selDip.innerHTML = '<option value="">-- Seleziona --</option>';
  dati.utenti.filter(u => u.ruolo === 'dipendente').forEach(u => {
    selDip.innerHTML += `<option value="${u.username}">${u.nome} ${u.cognome} (${u.username})</option>`;
  });
  const selComm = document.getElementById('addreg-commessa');
  selComm.innerHTML = '<option value="">-- Nessuna --</option>';
  (dati.commesse || []).forEach(c => { selComm.innerHTML += `<option value="${c.id}">${c.nome}</option>`; });
  document.getElementById('addreg-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('addreg-ora-inizio').value = '';
  document.getElementById('addreg-ora-fine').value = '';
  document.getElementById('addreg-descrizione').value = '';
  document.getElementById('addreg-straordinario').checked = false;
  document.getElementById('addreg-msg').innerHTML = '';
  ['addreg-ora-inizio', 'addreg-ora-fine'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.dataset.smartInit !== '1') initSmartTime(el);
  });
  document.getElementById('modal-aggiungi-reg').classList.add('active');
}
function chiudiModaleAggiungiReg() { document.getElementById('modal-aggiungi-reg')?.classList.remove('active'); }

async function salvaRegistrazioneManuale() {
  const username = document.getElementById('addreg-dipendente').value;
  const data = document.getElementById('addreg-data').value;
  const oraInizio = document.getElementById('addreg-ora-inizio').value;
  const oraFine = document.getElementById('addreg-ora-fine').value;
  const commessaId = parseInt(document.getElementById('addreg-commessa').value) || null;
  const descrizione = document.getElementById('addreg-descrizione').value.trim();
  const straordinario = document.getElementById('addreg-straordinario').checked;
  const msg = document.getElementById('addreg-msg');

  if (!username) { msg.innerHTML = '<div class="error">❌ Seleziona un dipendente</div>'; return; }
  if (!data) { msg.innerHTML = '<div class="error">❌ Inserisci la data</div>'; return; }
  if (!oraInizio || !oraFine) { msg.innerHTML = '<div class="error">❌ Inserisci ora inizio e fine</div>'; return; }
  if (oraInizio >= oraFine) { msg.innerHTML = '<div class="error">❌ L\'ora fine deve essere dopo l\'ora inizio</div>'; return; }
  if (!descrizione) { msg.innerHTML = '<div class="error">❌ Inserisci una descrizione</div>'; return; }

  const [h1, m1] = oraInizio.split(':').map(Number);
  const [h2, m2] = oraFine.split(':').map(Number);
  const oreLavorate = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  if (oreLavorate <= 0 || oreLavorate > 24) { msg.innerHTML = '<div class="error">❌ Ore non valide</div>'; return; }

  const sovrapposta = dati.registrazioni.some(r =>
    r.utente_id === username && r.data === data && r.tipo === 'lavoro' &&
    r.ora_inizio && r.ora_fine && !(oraFine <= r.ora_inizio || oraInizio >= r.ora_fine)
  );
  if (sovrapposta) {
    if (!confirm('⚠️ Esiste già una registrazione in questa fascia oraria.\nVuoi aggiungerla comunque?')) return;
  }

  const nuova = {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    utente_id: username, commessa_id: commessaId, data,
    ora_inizio: oraInizio, ora_fine: oraFine,
    descrizione: descrizione + (straordinario ? ' (STRAORDINARIO)' : ''),
    tipo: 'lavoro', straordinario, ore: oreLavorate, _manuale: true
  };
  try {
    await regAggiungi(nuova);
    dati.registrazioni.push(nuova);
    msg.innerHTML = '<div class="success">✅ Registrazione creata!</div>';
    setTimeout(() => {
      chiudiModaleAggiungiReg();
      if (dipendenteCorrenteDettaglio === username) applicaFiltriDipendente();
      caricaRegistrazioniModifica();
      caricaCalendario();
    }, 800);
  } catch (err) {
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

// ============================================
// SMART TIME INPUT
// ============================================
const SMART_TIME_DEFS = {
  'ora-inizio': { next: 'ora-fine' },
  'ora-fine': { next: 'descrizione' },
  'recupero-ora-inizio': { next: 'recupero-ora-fine' },
  'recupero-ora-fine': { next: 'recupero-motivo' }
};
function initSmartTime(input) {
  if (!input || input.dataset.smartInit === '1') return;
  input.dataset.smartInit = '1';
  input.dataset.smartPhase = 'ore';
  input.dataset.smartOre = '';
  input.dataset.smartMinuti = '';
  input.addEventListener('focus', () => {
    if (input.dataset.smartOre.length === 2 && input.dataset.smartMinuti.length === 2) {
      input.dataset.smartPhase = 'ore';
      input.dataset.smartOre = '';
      input.dataset.smartMinuti = '';
      input.value = '';
    }
  });
  input.addEventListener('keydown', (e) => {
    const controllo = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'];
    if (controllo.includes(e.key)) {
      if (e.key === 'Backspace') { e.preventDefault(); gestisciBackspace(input); }
      if (e.key === 'Enter') { e.preventDefault(); saltaAlProssimo(input); }
      return;
    }
    if (!/^\d$/.test(e.key)) { e.preventDefault(); return; }
    e.preventDefault();
    gestisciCifra(input, e.key);
  });
}
function gestisciCifra(input, cifra) {
  const fase = input.dataset.smartPhase;
  let ore = input.dataset.smartOre;
  let minuti = input.dataset.smartMinuti;
  if (fase === 'ore') {
    if (ore === '') {
      if (cifra >= '3' && cifra <= '9') {
        ore = '0' + cifra;
        input.dataset.smartOre = ore;
        input.dataset.smartPhase = 'minuti';
        input.value = ore + ':';
        return;
      } else {
        ore = cifra;
        input.dataset.smartOre = ore;
        input.value = ore + ':';
        return;
      }
    } else {
      const oreNum = parseInt(ore + cifra, 10);
      if (oreNum >= 0 && oreNum <= 24) {
        const oreFinali = oreNum === 24 ? '24' : String(oreNum).padStart(2, '0');
        input.dataset.smartOre = oreFinali;
        input.dataset.smartPhase = 'minuti';
        input.value = oreFinali + ':';
        return;
      }
    }
  }
  if (fase === 'minuti') {
    if (minuti === '') {
      if (cifra >= '6' && cifra <= '9') {
        minuti = '0' + cifra;
        input.dataset.smartMinuti = minuti;
        input.value = input.dataset.smartOre + ':' + minuti;
        saltaAlProssimo(input);
        return;
      } else {
        minuti = cifra;
        input.dataset.smartMinuti = minuti;
        input.value = input.dataset.smartOre + ':' + minuti;
        return;
      }
    } else {
      const minNum = parseInt(minuti + cifra, 10);
      if (minNum >= 0 && minNum <= 59) {
        const minFinali = String(minNum).padStart(2, '0');
        input.dataset.smartMinuti = minFinali;
        input.value = input.dataset.smartOre + ':' + minFinali;
        saltaAlProssimo(input);
        return;
      }
    }
  }
}
function gestisciBackspace(input) {
  const fase = input.dataset.smartPhase;
  let ore = input.dataset.smartOre;
  let minuti = input.dataset.smartMinuti;
  if (fase === 'minuti') {
    if (minuti.length > 0) {
      minuti = minuti.slice(0, -1);
      input.dataset.smartMinuti = minuti;
      input.value = ore + ':' + minuti;
    } else {
      input.dataset.smartPhase = 'ore';
      if (ore.length > 0) { ore = ore.slice(0, -1); input.dataset.smartOre = ore; }
      input.value = ore + (ore ? ':' : '');
    }
  } else if (fase === 'ore') {
    if (ore.length > 0) {
      ore = ore.slice(0, -1);
      input.dataset.smartOre = ore;
      input.value = ore + (ore ? ':' : '');
    }
  }
}
function saltaAlProssimo(input) {
  const def = SMART_TIME_DEFS[input.id];
  if (def && def.next) {
    const next = document.getElementById(def.next);
    if (next) {
      setTimeout(() => { next.focus(); if (typeof next.select === 'function') next.select(); }, 50);
    }
  }
}

// ============================================
// NOTIFICHE PUSH FCM
// ============================================
const VAPID_KEY = 'BGDim7zjRi-WXyIDYoKnZjAX92fChXCHo1uUZKOef9l2cHSu6FJrInHrB4IEFAJewF8TrJCDzTsNR1BANwLUml0';

async function chiediPermessoNotifiche() {
  if (!utenteCorrente) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'denied') return;
  if (Notification.permission === 'default') {
    const permesso = await Notification.requestPermission();
    if (permesso !== 'granted') return;
  }
  try {
    const swReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './firebase-cloud-messaging-push-scope' });
    await navigator.serviceWorker.ready;
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) return;
    const utente = dati.utenti.find(u => u.username === utenteCorrente.username);
    if (!utente || utente.token_fcm === token) return;
    utente.token_fcm = token;
    await utenteSalva(utente);
  } catch (err) { console.error('❌ Errore FCM:', err); }
}
async function ascoltaRinnovoToken() {
  if (!utenteCorrente) return;
  try {
    const messaging = firebase.messaging();
    messaging.onTokenRefresh(async () => { await chiediPermessoNotifiche(); });
  } catch (err) {}
}

// ============================================
// LOGO / HELPER PDF
// ============================================
function caricaLogoPerPDF() {
  return new Promise((resolve) => {
    if (typeof LOGO_BASE64 === 'undefined' || !LOGO_BASE64) { resolve(null); return; }
    const img = new Image();
    const timeout = setTimeout(() => resolve(null), 3000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = LOGO_BASE64;
  });
}

// ============================================
// DROPDOWN MENU
// ============================================
function toggleDropdown(nome, event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('dropdown-menu-' + nome);
  const btn = menu ? menu.previousElementSibling : null;
  if (!menu) return;
  if (menu.classList.contains('aperto')) {
    menu.classList.remove('aperto');
    if (btn) btn.classList.remove('aperto');
    return;
  }
  chiudiTuttiDropdown();
  menu.classList.add('aperto');
  if (btn) btn.classList.add('aperto');
}
function chiudiTuttiDropdown() {
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('aperto'));
  document.querySelectorAll('.dropdown-btn').forEach(b => b.classList.remove('aperto'));
}
document.addEventListener('click', function (e) {
  if (!e.target.closest('.dropdown')) chiudiTuttiDropdown();
});

// ============================================
// SESSIONI
// ============================================
function salvaSessione(username) {
  if (!username) return;
  localStorage.setItem('utente_loggato', username);
}
function cancellaSessione() { localStorage.removeItem('utente_loggato'); }
function leggiSessione() { return localStorage.getItem('utente_loggato'); }
function caricaCredenzialiSalvate() {
  const ricordamiAttivo = localStorage.getItem('ricordami_attivo');
  if (ricordamiAttivo === 'true') {
    const username = localStorage.getItem('ricordami_username');
    const password = localStorage.getItem('ricordami_password');
    if (username && password) {
      document.getElementById('username').value = username;
      document.getElementById('password').value = password;
      document.getElementById('ricordami').checked = true;
      setTimeout(() => document.querySelector('.login-box button')?.focus(), 100);
    }
  }
}

function logout() {
  cancellaSessione();
  utenteCorrente = null;

  // Ferma tutti i listener
  [_unsubscribeSnapshot, _unsubReg, _unsubRich, _unsubNot, _unsubUt].forEach(fn => {
    if (typeof fn === 'function') { try { fn(); } catch (e) {} }
  });
  _unsubscribeSnapshot = _unsubReg = _unsubRich = _unsubNot = _unsubUt = null;

  const menuC = document.getElementById('commesse-menu');
  const aggC = document.getElementById('commesse-aggiungi');
  const anaC = document.getElementById('commesse-analizza');
  if (menuC) menuC.style.display = 'block';
  if (aggC) aggC.style.display = 'none';
  if (anaC) anaC.style.display = 'none';
  document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  document.getElementById('login-page').style.display = 'block';
  document.getElementById('main-page').style.display = 'none';
  caricaCredenzialiSalvate();
  if (localStorage.getItem('ricordami_attivo') !== 'true') {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  }

  setTimeout(() => { if (typeof aggiornaUILoginBiometrico === 'function') aggiornaUILoginBiometrico(); }, 300);
}

// ============================================
// MIGRAZIONE (una tantum)
// ============================================
async function migraDatiVecchi() {
  if (typeof utenteCorrente === 'undefined' || !utenteCorrente || utenteCorrente.ruolo !== 'admin') {
    alert('❌ Solo un admin può migrare'); return;
  }
  if (!confirm('MIGRAZIONE DATI\n\nVerranno COPIATI i dati vecchi nelle nuove collezioni.\nGli array in dati/main resteranno come backup.\n\nProcedere?')) return;

  const btn = document.getElementById('btn-migra-dati');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Migrazione...'; }

  try {
    const snap = await _dbFirestore().collection('dati').doc('main').get();
    if (!snap.exists) { alert('❌ dati/main non trovato'); return; }
    const d = snap.data();
    if (d.migrazione_fatta === true) { alert('✅ Già migrato in data ' + d.migrazione_data); return; }

    const registrazioni = d.registrazioni || [];
    const richieste = d.richieste || [];
    const notifiche = d.notifiche || [];
    const utenti = d.utenti || [];
    let contaReg = 0, contaRich = 0, contaNot = 0, contaUt = 0;

    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Utenti...';
    for (const u of utenti) {
      if (!u.username) continue;
      await _dbFirestore().collection('utenti').doc(u.username).set(u);
      contaUt++;
    }

    const BATCH = 500;
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrazioni...';
    for (let i = 0; i < registrazioni.length; i += BATCH) {
      const batch = _dbFirestore().batch();
      registrazioni.slice(i, i + BATCH).forEach(r => {
        batch.set(_dbFirestore().collection('registrazioni').doc(String(r.id)), r);
        contaReg++;
      });
      await batch.commit();
    }
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Richieste...';
    for (let i = 0; i < richieste.length; i += BATCH) {
      const batch = _dbFirestore().batch();
      richieste.slice(i, i + BATCH).forEach(r => {
        batch.set(_dbFirestore().collection('richieste').doc(String(r.id)), r);
        contaRich++;
      });
      await batch.commit();
    }
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Notifiche...';
    for (let i = 0; i < notifiche.length; i += BATCH) {
      const batch = _dbFirestore().batch();
      notifiche.slice(i, i + BATCH).forEach(n => {
        batch.set(_dbFirestore().collection('notifiche').doc(String(n.id)), n);
        contaNot++;
      });
      await batch.commit();
    }

    await _dbFirestore().collection('dati').doc('main').update({
      migrazione_fatta: true,
      migrazione_data: new Date().toISOString(),
      migrazione_conteggi: { registrazioni: contaReg, richieste: contaRich, notifiche: contaNot, utenti: contaUt }
    });

    alert(`✅ MIGRAZIONE COMPLETATA\n\n• ${contaReg} registrazioni\n• ${contaRich} richieste\n• ${contaNot} notifiche\n• ${contaUt} utenti`);
    if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Migrazione completata'; btn.style.background = '#28a745'; }
  } catch (err) {
    console.error('❌ Errore migrazione:', err);
    alert('❌ Errore: ' + err.message + '\n\nRiprova. I dati vecchi non sono stati toccati.');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-database"></i> MIGRA DATI (admin)'; }
  }
}

function iniettaBottoneMigrazione() {
  if (!window.utenteCorrente || utenteCorrente.ruolo !== 'admin') return;
  const wrapper = document.querySelector('#panel-dipendenti .dipendenti-azioni-wrapper');
  if (!wrapper) return;
  if (document.getElementById('btn-migra-dati')) return;
  const btn = document.createElement('button');
  btn.id = 'btn-migra-dati';
  btn.className = 'btn-danger';
  btn.style.cssText = 'margin-top:15px;background:#b71c1c;';
  btn.innerHTML = '<i class="fas fa-database"></i> MIGRA DATI (admin)';
  btn.onclick = migraDatiVecchi;
  wrapper.appendChild(btn);
  const status = document.createElement('div');
  status.id = 'migrazione-status';
  status.style.cssText = 'margin-top:10px;font-size:0.85em;';
  status.innerHTML = '<em>Verifica stato migrazione...</em>';
  wrapper.appendChild(status);
  _dbFirestore().collection('dati').doc('main').get().then(snap => {
    if (snap.exists && snap.data().migrazione_fatta === true) {
      const d = snap.data();
      status.innerHTML = `<span style="color:#28a745;">✅ Migrato il ${new Date(d.migrazione_data).toLocaleString('it-IT')}</span>`;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-check"></i> Già migrato';
      btn.style.background = '#28a745';
    } else {
      status.innerHTML = '<span style="color:#d32f2f;">⚠️ Migrazione NON eseguita</span>';
    }
  });
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', function () {
  popolaTendinaLingua();
  caricaLinguaSalvata();
  caricaCredenzialiSalvate();

  caricaDati().then(() => {
    const adesso = new Date();
    const calMese = document.getElementById('cal-mese');
    const calAnno = document.getElementById('cal-anno');
    if (calMese) calMese.value = adesso.getMonth() + 1;
    if (calAnno) calAnno.value = adesso.getFullYear();

    const usernameSalvato = leggiSessione();
    if (usernameSalvato) {
      const utente = dati.utenti.find(u => u.username === usernameSalvato);
      if (utente) {
        utenteCorrente = utente;
        document.getElementById('username').value = utente.username;
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('main-page').style.display = 'block';
        document.getElementById('errore').style.display = 'none';
        const ruoloBadge = document.getElementById('user-ruolo');
        ruoloBadge.textContent = utente.ruolo === 'admin' ? t('dip_admin') : t('dip_dipendente');
        ruoloBadge.className = 'badge ' + utente.ruolo;

        configuraUIUtente(utente);
        inizializzaAppPerUtente(utente);
        attivaAscoltoRealtime();
        mostraSchermataBenvenuto(utente);
        return;
      } else { cancellaSessione(); }
    }
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('main-page').style.display = 'none';
  }).catch((err) => {
    console.error('❌ Errore caricamento dati:', err);
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('main-page').style.display = 'none';
  });

  // Input protocollo
  nmInitProtocolloInputs();
  nmInitProtocolloModale();

  // Input NM
  const input4 = document.getElementById('nm-input-4cifre');
  const input6 = document.getElementById('nm-input-6char');
  if (input4) {
    input4.addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
      nmAggiornaPreview();
      if (this.value.length === 4) document.getElementById('nm-input-6char').focus();
    });
    input4.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (this.value.length === 4) document.getElementById('nm-input-6char').focus(); }
    });
  }
  if (input6) {
    input6.addEventListener('input', function () {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      nmAggiornaPreview();
    });
    input6.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); nmSalvaNuovaCommessa(); }
    });
  }
  const inputPopup = document.getElementById('nm-input-numero');
  if (inputPopup) inputPopup.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); nmAggiungiNumero(); }
  });
  const cavoSinistra = document.getElementById('nm-cavo-sinistra');
  const cavoDestra = document.getElementById('nm-cavo-destra');
  if (cavoSinistra) cavoSinistra.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('nm-cavo-destra').focus(); }
  });
  if (cavoDestra) cavoDestra.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); nmAggiungiNumero(); }
  });
  const inputAdmin = document.getElementById('nm-admin-password');
  if (inputAdmin) inputAdmin.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); nmConfermaCancellazione(); }
  });

  // Observer per iniettare bottone migrazione
  const observer = new MutationObserver(() => {
    if (window.utenteCorrente && document.querySelector('#panel-dipendenti.active')) {
      iniettaBottoneMigrazione();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  setTimeout(() => {
    if (typeof aggiornaUILoginBiometrico === 'function') aggiornaUILoginBiometrico();
  }, 500);
});

// Click fuori modali
document.addEventListener('click', function (e) {
  const modali = [
    { id: 'modal-notifiche', chiudi: chiudiNotifiche },
    { id: 'modal-password', chiudi: chiudiModificaPassword },
    { id: 'modal-aziende', chiudi: chiudiModalAziende },
    { id: 'modal-backup', chiudi: chiudiModalBackup },
    { id: 'modal-dettaglio-commessa', chiudi: chiudiDettaglioCommessa },
    { id: 'modal-dettaglio-dipendente', chiudi: chiudiDettaglioDipendente },
    { id: 'modal-foto', chiudi: chiudiModaleFoto },
    { id: 'modal-aggiungi-reg', chiudi: chiudiModaleAggiungiReg },
    { id: 'nm-modal-crea-commessa', chiudi: nmChiudiCreaCommessa },
    { id: 'nm-modal-popup', chiudi: nmChiudiPopup },
    { id: 'nm-modal-admin', chiudi: nmChiudiAdmin },
    { id: 'modal-protocollo', chiudi: chiudiModificaProtocollo }
  ];
  modali.forEach(m => {
    const modal = document.getElementById(m.id);
    if (modal && e.target === modal) m.chiudi();
  });
});

console.log('✅ script.js — COMPLETO (versione corretta) caricato');
