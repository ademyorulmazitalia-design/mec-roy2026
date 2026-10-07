// ============================================
// MEC-ROY — script.js
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

db.enablePersistence()
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Persistenza non abilitata: app aperta in più schede.');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Persistenza non supportata da questo browser.');
    } else {
      console.warn('Offline persistence:', err.code);
    }
  });

// ============================================
// VARIABILI GLOBALI
// ============================================
let dati = {};
let utenteCorrente = null;
let prossimoId = 1;
let commessaCorrenteDettaglio = null;

// Realtime
let _stoSalvando = false;
let _unsubscribeSnapshot = null;

// Filtri
let filtriCommessa = {
  dataInizio: '',
  dataFine: '',
  ricerca: '',
  dipendenti: []
};

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
  filo: 3,
  cavo: 2,
  adesive: 4,
  targhette: 6,
  morsetti: 6
};

let nmCommessaCorrente = null;
let nmCartellaCorrente = null;
let nmCommessaDaCancellare = null;
let nmCommesseCache = {};

function nmGetCollection() {
  return db.collection('numeri_mancanti_commesse');
}

// ============================================
// CARICAMENTO / SALVATAGGIO FIRESTORE
// ============================================
async function caricaDaFirestore() {
  try {
    console.log('🔄 Caricamento dati da Firestore...');
    const snapshot = await db.collection('dati').doc('main').get();
    if (snapshot.exists) {
      console.log('✅ Dati caricati da Firestore');
      return snapshot.data();
    } else {
      console.log('⚠️ Nessun dato in Firestore, uso default');
      return null;
    }
  } catch (error) {
    console.error('❌ Errore caricamento Firestore:', error);
    return null;
  }
}

async function salvaSuFirestore(datiDaSalvare) {
  try {
    console.log('🔄 Salvataggio su Firestore...');
    await db.collection('dati').doc('main').set(datiDaSalvare);
    console.log('✅ Dati salvati su Firestore');
    return true;
  } catch (error) {
    console.error('❌ Errore salvataggio Firestore:', error);
    return false;
  }
}

async function caricaDati() {
  const datiFirestore = await caricaDaFirestore();

  if (datiFirestore) {
    dati = datiFirestore;

    if (!dati.utenti) dati.utenti = [];
    if (!dati.registrazioni) dati.registrazioni = [];
    if (!dati.richieste) dati.richieste = [];
    if (!dati.notifiche) dati.notifiche = [];
    if (!dati.commesse) dati.commesse = [];
    if (!dati.aziende) dati.aziende = [{ id: 1, nome: 'MEC-ROY srls' }];

    let maxIdTrovato = 0;
    dati.richieste.forEach(r => { if (r.id > maxIdTrovato) maxIdTrovato = r.id; });
    dati.registrazioni.forEach(r => { if (r.id > maxIdTrovato) maxIdTrovato = r.id; });
    dati.notifiche.forEach(n => { if (n.id > maxIdTrovato) maxIdTrovato = n.id; });
    prossimoId = maxIdTrovato + 1;

    return dati;
  }

  const saved = localStorage.getItem('datiLavoroV2');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (!parsed.aziende) parsed.aziende = [{ id: 1, nome: 'MEC-ROY srls' }];
    if (!parsed.commesse) parsed.commesse = [];
    dati = parsed;
    await salvaSuFirestore(dati);
    return dati;
  }

  const defaultData = {
    utenti: [
      { username: 'admin', password: 'admin123', nome: 'Admin', cognome: 'Sistema', ruolo: 'admin' }
    ],
    commesse: [],
    registrazioni: [],
    richieste: [],
    notifiche: [],
    aziende: [{ id: 1, nome: 'MEC-ROY srls' }]
  };

  dati = defaultData;
  await salvaSuFirestore(dati);
  localStorage.setItem('datiLavoroV2', JSON.stringify(dati));
  return dati;
}

async function salvaDati() {
  _stoSalvando = true;
  try {
    localStorage.setItem('datiLavoroV2', JSON.stringify(dati));
  } catch (e) {
    console.warn('⚠️ Salvataggio locale bloccato.');
  }
  await salvaSuFirestore(dati);
  setTimeout(() => { _stoSalvando = false; }, 800);
}

// ============================================
// ASCOLTO REALTIME
// ============================================
function attivaAscoltoRealtime() {
  if (_unsubscribeSnapshot) {
    _unsubscribeSnapshot();
    _unsubscribeSnapshot = null;
  }

  console.log('🔄 Attivo ascolto realtime Firestore...');

  _unsubscribeSnapshot = db.collection('dati').doc('main').onSnapshot((snapshot) => {
    if (!snapshot.exists) return;
    if (_stoSalvando) {
      console.log('⏸️ Snapshot ignorato (stiamo salvando)');
      return;
    }

    const datiNuovi = snapshot.data();
    if (!datiNuovi) return;
    if (JSON.stringify(datiNuovi) === JSON.stringify(dati)) return;

    console.log('🔄 Dati aggiornati da Firestore (realtime)');
    dati = datiNuovi;

    if (!dati.utenti) dati.utenti = [];
    if (!dati.registrazioni) dati.registrazioni = [];
    if (!dati.richieste) dati.richieste = [];
    if (!dati.notifiche) dati.notifiche = [];
    if (!dati.commesse) dati.commesse = [];
    if (!dati.aziende) dati.aziende = [{ id: 1, nome: 'MEC-ROY srls' }];

    if (utenteCorrente) {
      aggiornaUIDopoRealtime();
    }
  });
}

function aggiornaUIDopoRealtime() {
  if (!utenteCorrente) return;

  aggiornaBadgeRichieste();
  aggiornaBadgeNotifiche();

  const panelAttivo = document.querySelector('.panel.active');
  if (!panelAttivo) return;

  const id = panelAttivo.id;

  if (id === 'panel-richieste' && utenteCorrente.ruolo === 'admin') {
    caricaRichiesteAdmin();
  }
  if (id === 'panel-richiedi') {
    caricaRichiesteDipendente();
  }
  if (id === 'panel-dipendenti' && utenteCorrente.ruolo === 'admin') {
    caricaListaDipendenti();
  }
  if (id === 'panel-commesse' && utenteCorrente.ruolo === 'admin') {
    caricaListaCommesse();
  }
}

// ============================================
// HELPER WEEKEND
// ============================================
function isWeekendOggi() {
  const oggi = new Date();
  const giorno = oggi.getDay();
  return giorno === 0 || giorno === 6;
}

// ============================================
// CONTROLLO SOVRAPPOSIZIONI
// ============================================
function controllaSovrapposizioni(username, data, ora_inizio, ora_fine, tipo) {
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

  const richiesteEsistenti = dati.richieste.filter(r => {
    if (r.utente_id !== username) return false;
    if (r.stato === 'rifiutata') return false;

    if (r.tipo === 'recupero_ore' && ora_inizio && ora_fine && r.ora_inizio && r.ora_fine) {
      return r.data === data && !(ora_fine <= r.ora_inizio || ora_inizio >= r.ora_fine);
    }

    if (r.tipo !== 'recupero_ore') {
      if (data >= r.data_inizio && data <= r.data_fine) {
        if (r.tipo === 'ferie' && tipo === 'recupero_ore') return false;
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
    } else {
      return {
        tipo: 'richiesta',
        messaggio: `Hai già una richiesta di ${tipoLabel} dal ${r.data_inizio} al ${r.data_fine}. Correggi le date.`
      };
    }
  }

  return null;
}

function calcolaOreGiornata(username, data) {
  const registrazioni = dati.registrazioni.filter(r =>
    r.utente_id === username && r.data === data && r.tipo === 'lavoro'
  );

  let totaleOre = 0;
  registrazioni.forEach(r => {
    if (r.ore) {
      totaleOre += r.ore;
    } else if (r.ora_inizio && r.ora_fine) {
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      totaleOre += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    }
  });
  return totaleOre;
}

function isOltre20() {
  return new Date().getHours() >= 20;
}

console.log('✅ script.js — PARTE 1/6 caricata');
// ============================================
// LOGIN
// ============================================
function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const ricordami = document.getElementById('ricordami').checked;

  const utente = dati.utenti.find(u => u.username === username && u.password === password);

  if (utente) {
    utenteCorrente = utente;
    salvaSessione(utente.username);

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

    document.getElementById('user-nome').textContent = utente.nome + ' ' + utente.cognome;
    const ruoloBadge = document.getElementById('user-ruolo');
    ruoloBadge.textContent = utente.ruolo;
    ruoloBadge.className = 'badge ' + utente.ruolo;

    if (utente.ruolo === 'admin') {
      document.getElementById('tab-registra').style.display = 'none';
      document.getElementById('tab-richiedi').style.display = 'none';
      document.getElementById('tab-modifica').style.display = 'inline-block';
      document.getElementById('tab-richieste').style.display = 'inline-block';
      document.getElementById('tab-commesse').style.display = 'inline-block';
      document.getElementById('tab-dipendenti').style.display = 'inline-block';
      document.getElementById('tab-calendario').style.display = 'inline-block';
      document.getElementById('tab-numeri-mancanti').style.display = 'inline-block';
      document.getElementById('cal-filtro-dipendente').style.display = 'block';
      document.getElementById('btn-password').style.display = 'flex';
      document.getElementById('azienda-container').style.display = 'inline-block';
      document.getElementById('cal-vista-selector').style.display = 'none';

      caricaSelectAziende();
      caricaSelectAziendeCommesse();
      caricaSelectDipendentiModifica();
      caricaSelectDipendentiCalendario();
      caricaRichiesteAdmin();
      caricaListaDipendenti();
      aggiornaBadgeRichieste();

      showTab('modifica');
    } else {
      document.getElementById('tab-registra').style.display = 'inline-block';
      document.getElementById('tab-richiedi').style.display = 'inline-block';
      document.getElementById('tab-modifica').style.display = 'none';
      document.getElementById('tab-richieste').style.display = 'none';
      document.getElementById('tab-commesse').style.display = 'none';
      document.getElementById('tab-dipendenti').style.display = 'none';
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

    const oggi = new Date().toISOString().split('T')[0];
    const dataReg = document.getElementById('data-reg');
    dataReg.value = oggi;
    dataReg.disabled = true;
    dataReg.style.backgroundColor = '#f0f0f0';
    dataReg.style.cursor = 'not-allowed';

    const adesso = new Date();
    document.getElementById('cal-mese').value = adesso.getMonth() + 1;
    document.getElementById('cal-anno').value = adesso.getFullYear();
    document.getElementById('richiesta-data-inizio').value = oggi;
    document.getElementById('richiesta-data-fine').value = oggi;
    document.getElementById('modifica-data').value = oggi;
    document.getElementById('recupero-data').value = oggi;

    caricaSelectRecuperoCommesse();

    document.getElementById('tipo-richiesta').addEventListener('change', function() {
      const tipo = this.value;
      document.getElementById('gruppo-certificato').style.display = tipo === 'malattia' ? 'block' : 'none';
      document.getElementById('gruppo-recupero').style.display = tipo === 'recupero_ore' ? 'block' : 'none';
      document.getElementById('campi-standard').style.display = (tipo === 'recupero_ore') ? 'none' : 'block';

      const mostraOrari = (tipo === 'ferie' || tipo === 'permesso');
      document.getElementById('riga-orari-opzionali').style.display = mostraOrari ? 'flex' : 'none';
      document.getElementById('hint-orari-opzionali').style.display = mostraOrari ? 'block' : 'none';
    });

    setTimeout(() => {
      chiediPermessoNotifiche();
      ascoltaRinnovoToken();
    }, 1500);

    if (utente.ruolo === 'dipendente') {
      const oraInizio = document.getElementById('ora-inizio');
      const ora = new Date();
      const oraCorrente = ora.getHours().toString().padStart(2, '0') + ':00';
      oraInizio.value = oraCorrente;

      document.getElementById('straordinario').addEventListener('change', function() {
        const oraInizio = document.getElementById('ora-inizio');
        if (this.checked) {
          oraInizio.disabled = false;
          oraInizio.style.backgroundColor = 'white';
          oraInizio.style.cursor = 'text';
          document.getElementById('info-registrazione').innerHTML = `
            <div class="info-msg" style="background:#ffebee;border-color:#d32f2f;color:#d32f2f;">
              ⏰ <strong>Modalità Straordinario attivata!</strong> Le ore oltre le 8 verranno segnate come straordinario.
            </div>
          `;
        } else {
          caricaUltimaRegistrazione();
        }
      });

      caricaUltimaRegistrazione();
    }

    const menuC = document.getElementById('commesse-menu');
    const aggC  = document.getElementById('commesse-aggiungi');
    const anaC  = document.getElementById('commesse-analizza');
    if (menuC) menuC.style.display = 'block';
    if (aggC)  aggC.style.display  = 'none';
    if (anaC)  anaC.style.display  = 'none';

    caricaSelectCommesse();
    caricaListaCommesse();
    caricaRichiesteDipendente();
    caricaSelectDipendentiModifica();
    caricaSelectDipendentiCalendario();

    attivaAscoltoRealtime();

  } else {
    const loginBox = document.querySelector('.login-box');
    if (loginBox) {
      loginBox.classList.remove('shake');
      void loginBox.offsetWidth;
      loginBox.classList.add('shake');
      setTimeout(() => loginBox.classList.remove('shake'), 550);
    }
    document.getElementById('errore').style.display = 'block';
  }
}

// ============================================
// SHOW TAB
// ============================================
function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  const tabButton = document.querySelector(`.tab[onclick="showTab('${tab}')"]`);
  if (tabButton) tabButton.classList.add('active');

  const panel = document.getElementById('panel-' + tab);
  if (panel) panel.classList.add('active');

  if (tab === 'modifica') caricaRegistrazioniModifica();
  if (tab === 'commesse') caricaListaCommesse();
  if (tab === 'dipendenti') caricaListaDipendenti();
  if (tab === 'richieste') {
    caricaRichiesteAdmin();
    aggiornaBadgeRichieste();
  }
  if (tab === 'richiedi') caricaRichiesteDipendente();
  if (tab === 'numeri-mancanti') {
    nmMostraSchermataCommesse();
    nmCommessaCorrente = null;
    nmCartellaCorrente = null;
    nmCaricaListaCommesse();
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
    const container = document.getElementById('app-container');
    const body = document.body;
    container.classList.add('dark-mode');
    body.classList.add('dark-mode');
    document.getElementById('btn-darkmode').innerHTML = '<i class="fas fa-sun"></i>';
  }
}

// ============================================
// SELECT AZIENDE
// ============================================
function caricaSelectAziende() {
  const select = document.getElementById('select-azienda');
  if (!select) return;
  select.innerHTML = '<option value="0">-- Tutte --</option>';
  if (dati.aziende) {
    dati.aziende.forEach(a => {
      select.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
    });
  }
}

function caricaSelectAziendeCommesse() {
  const select = document.getElementById('commessa-azienda');
  if (!select) return;
  select.innerHTML = '<option value="0">-- Seleziona Azienda --</option>';
  if (dati.aziende) {
    dati.aziende.forEach(a => {
      select.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
    });
  }
}

function caricaSelectRecuperoCommesse() {
  const select = document.getElementById('recupero-commessa');
  if (!select) return;
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  dati.commesse.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
  });
}

function cambiaAzienda() {
  const aziendaId = parseInt(document.getElementById('select-azienda').value);
  caricaDatiFiltrati(aziendaId);
}

function caricaDatiFiltrati(aziendaId) {
  if (aziendaId > 0) {
    const utentiAzienda = dati.utenti.filter(u => u.azienda_id === aziendaId);
    const usernames = utentiAzienda.map(u => u.username);
    caricaListaDipendentiFiltrati(usernames);
    caricaCalendarioFiltrato(usernames);
  } else {
    caricaListaDipendenti();
    caricaCalendario();
  }
}

function caricaListaDipendentiFiltrati(usernames) {
  caricaListaDipendenti();
}

function caricaCalendarioFiltrato(usernames) {
  caricaCalendario();
}

// ============================================
// MODALE AZIENDE
// ============================================
function apriModalAziende() {
  if (utenteCorrente?.ruolo !== 'admin') {
    alert('Solo gli amministratori possono gestire le aziende');
    return;
  }
  const modal = document.getElementById('modal-aziende');
  if (modal) {
    modal.classList.add('active');
    caricaListaAziende();
  }
}

function chiudiModalAziende() {
  const modal = document.getElementById('modal-aziende');
  if (modal) modal.classList.remove('active');
}

function aggiungiAzienda() {
  const nome = document.getElementById('azienda-nome').value.trim();
  const msg = document.getElementById('msg-azienda');

  if (!nome) {
    msg.innerHTML = '<div class="error">❌ Inserisci il nome dell\'azienda</div>';
    return;
  }

  if (!dati.aziende) dati.aziende = [];

  const maxId = dati.aziende.length > 0 ? dati.aziende.reduce((max, a) => a.id > max ? a.id : max, 0) : 0;
  dati.aziende.push({ id: maxId + 1, nome: nome });
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

  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += '<th>ID</th><th>Nome</th><th>Azioni</th>';
  html += '</tr></thead><tbody>';

  dati.aziende.forEach(a => {
    const canDelete = dati.aziende.length > 1;
    html += `<tr>
      <td>${a.id}</td>
      <td><strong>${a.nome}</strong></td>
      <td>
        ${canDelete ? `<button class="btn-danger" onclick="eliminaAzienda(${a.id})"><i class="fas fa-trash"></i></button>` : '<span style="color:#999;font-size:0.8em;">(ultima)</span>'}
      </td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  div.innerHTML = html;
}

function eliminaAzienda(id) {
  if (!confirm('Eliminare questa azienda? Verranno eliminati anche i dipendenti associati.')) return;

  const utentiAzienda = dati.utenti.filter(u => u.azienda_id === id);
  const usernames = utentiAzienda.map(u => u.username);

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

  document.getElementById('ora-inizio').disabled = false;
  document.getElementById('ora-inizio').style.backgroundColor = 'white';

  if (isOltre20()) {
    const infoDiv = document.getElementById('info-registrazione');
    infoDiv.innerHTML = `
      <div class="error" style="background:#ffebee;border-color:#d32f2f;color:#d32f2f;font-weight:bold;">
        ⛔ <strong>Ore 20:00 superate!</strong> Non è più possibile registrare ore per oggi.
        <br><small>Contatta l'amministratore per eventuali recuperi.</small>
      </div>
    `;
    document.getElementById('ora-inizio').disabled = true;
    document.getElementById('ora-fine').disabled = true;
    document.getElementById('straordinario').disabled = true;
    return;
  }

  const oggi = new Date().toISOString().split('T')[0];
  const oraCorrente = new Date();
  const oreCorrente = oraCorrente.getHours();

  const isPomeriggio = oreCorrente >= 13;

  const registrazioniOggi = dati.registrazioni.filter(r =>
    r.utente_id === utenteCorrente.username &&
    r.data === oggi &&
    r.tipo === 'lavoro'
  );

  const infoDiv = document.getElementById('info-registrazione');
  const oraInizio = document.getElementById('ora-inizio');
  const oraFine = document.getElementById('ora-fine');
  const straordinarioCheck = document.getElementById('straordinario');

  if (straordinarioCheck && straordinarioCheck.checked) return;

  let ultima = null;
  if (registrazioniOggi.length > 0) {
    ultima = registrazioniOggi.reduce((max, r) => {
      return r.ora_fine > max.ora_fine ? r : max;
    }, registrazioniOggi[0]);
  }

  if (isPomeriggio) {
    oraInizio.disabled = false;
    oraInizio.style.backgroundColor = 'white';
    oraFine.disabled = false;
    oraFine.style.backgroundColor = 'white';

    if (ultima) {
      const h = parseInt(ultima.ora_fine.split(':')[0]);
      oraInizio.value = h < 13 ? '13:00' : ultima.ora_fine;
    } else {
      const oreOra = oreCorrente.toString().padStart(2, '0') + ':00';
      oraInizio.value = (oreCorrente <= 23) ? oreOra : '13:00';
    }

    const oraCorrenteMinuti = oraCorrente.getHours() * 60 + oraCorrente.getMinutes();
    const inizioMinuti = parseInt(oraInizio.value.split(':')[0]) * 60 + parseInt(oraInizio.value.split(':')[1] || 0);
    if (inizioMinuti > oraCorrenteMinuti) {
      oraInizio.value = oreCorrente.toString().padStart(2, '0') + ':00';
    }

    const hFine = (parseInt(oraInizio.value.split(':')[0]) + 1).toString().padStart(2, '0');
    oraFine.value = hFine + ':00';
    infoDiv.innerHTML = `<div class="info-msg" style="background:#fff3cd;border-color:#ffc107;color:#856404;">
      ⏰ <strong>Pomeriggio</strong> - Ora inizio e fine sono modificabili.
    </div>`;
    return;
  }

  if (!ultima) {
    oraInizio.disabled = false;
    oraInizio.value = oreCorrente.toString().padStart(2, '0') + ':00';
    oraFine.disabled = false;
    const hFine = (parseInt(oraInizio.value.split(':')[0]) + 1).toString().padStart(2, '0');
    oraFine.value = hFine + ':00';
    infoDiv.innerHTML = `<div class="info-msg">⏱️ Prima registrazione - Inserisci gli orari.</div>`;
    return;
  }

  oraInizio.value = ultima.ora_fine;
  oraInizio.disabled = true;
  oraInizio.style.backgroundColor = '#f0f0f0';

  oraFine.disabled = false;
  oraFine.style.backgroundColor = 'white';

  const hFine = (parseInt(ultima.ora_fine.split(':')[0]) + 1).toString().padStart(2, '0');
  oraFine.value = hFine + ':00';

  infoDiv.innerHTML = `<div class="info-msg">
    ⏱️ <strong>Ora inizio:</strong> ${ultima.ora_fine} (bloccata) - Puoi modificare l'ora fine.
  </div>`;
}

// ============================================
// SELECT COMMESSE
// ============================================
function caricaSelectCommesse() {
  const select = document.getElementById('commessa');
  if (!select) return;
  select.innerHTML = '<option value="">-- Seleziona una commessa --</option>';

  if (dati.commesse.length === 0) {
    select.innerHTML = '<option value="">-- Nessuna commessa disponibile --</option>';
    return;
  }

  dati.commesse.forEach(c => {
    select.innerHTML += '<option value="' + c.id + '">' + c.nome + '</option>';
  });
}

console.log('✅ script.js — PARTE 2/6 caricata');
// ============================================
// COMMESSE - CRUD
// ============================================
function aggiungiCommessa() {
  const nome = document.getElementById('commessa-nome').value.trim();
  const azienda_id = parseInt(document.getElementById('commessa-azienda').value);
  const msg = document.getElementById('msg-commessa');

  if (!nome) {
    msg.innerHTML = '<div class="error">Inserisci il nome della commessa</div>';
    return;
  }

  if (!azienda_id || azienda_id === 0) {
    msg.innerHTML = '<div class="error">Seleziona un\'azienda</div>';
    return;
  }

  const maxId = dati.commesse.reduce((max, c) => c.id > max ? c.id : max, 0);

  dati.commesse.push({
    id: maxId + 1,
    nome: nome,
    azienda_id: azienda_id,
    attivo: true,
    data_creazione: new Date().toISOString()
  });

  salvaDati();

  document.getElementById('commessa-nome').value = '';
  document.getElementById('commessa-azienda').value = '0';
  msg.innerHTML = '<div class="success">✅ Commessa aggiunta!</div>';

  caricaSelectCommesse();
  caricaListaCommesse();
  caricaSelectAziendeCommesse();
  caricaSelectRecuperoCommesse();
}

function caricaListaCommesse() {
  const div = document.getElementById('lista-commesse');
  if (!div) return;

  if (dati.commesse.length === 0) {
    div.innerHTML = '<p class="text-muted">📭 Nessuna commessa creata</p>';
    return;
  }

  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += '<th>Nome</th><th>Azienda</th><th>Azioni</th>';
  html += '</tr></thead><tbody>';

  dati.commesse.forEach(c => {
    const azienda = dati.aziende.find(a => a.id === c.azienda_id);
    html += '<tr>';
    html += '<td><strong>' + c.nome + '</strong></td>';
    html += '<td>' + (azienda ? azienda.nome : '-') + '</td>';
    html += '<td>';
    html += '<button class="btn-warning" onclick="apriModificaCommessa(' + c.id + ')" style="margin-right:5px;" title="Modifica"><i class="fas fa-edit"></i></button>';
    html += '<button class="btn-danger" onclick="eliminaCommessa(' + c.id + ')" title="Elimina"><i class="fas fa-trash"></i></button>';
    html += '</td>';
    html += '</tr>';
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
// SALVA REGISTRAZIONE ORE
// ============================================
function salvaRegistrazione() {
  if (utenteCorrente?.ruolo === 'admin') {
    alert('Gli amministratori non possono registrare ore qui');
    return;
  }

  if (isOltre20()) {
    document.getElementById('msg-registra').innerHTML = `
      <div class="error" style="background:#ffebee;border-color:#d32f2f;color:#d32f2f;font-weight:bold;">
        ⛔ <strong>Ore 20:00 superate!</strong> Non è più possibile registrare ore per oggi.
        <br><small>Contatta l'amministratore per eventuali recuperi.</small>
      </div>
    `;
    return;
  }

  const commessa_id = parseInt(document.getElementById('commessa').value);
  const data = document.getElementById('data-reg').value;
  const ora_inizio = document.getElementById('ora-inizio').value;
  const ora_fine = document.getElementById('ora-fine').value;
  const descrizione = document.getElementById('descrizione').value.trim();
  const straordinario = document.getElementById('straordinario').checked;
  const msg = document.getElementById('msg-registra');

  if (!commessa_id) {
    msg.innerHTML = '<div class="error">❌ Seleziona una commessa</div>';
    return;
  }
  if (!data) {
    msg.innerHTML = '<div class="error">❌ Data non valida</div>';
    return;
  }
  if (!ora_inizio) {
    msg.innerHTML = '<div class="error">❌ Inserisci l\'ora di inizio</div>';
    return;
  }
  if (!ora_fine) {
    msg.innerHTML = '<div class="error">❌ Inserisci l\'ora di fine</div>';
    return;
  }
  if (!descrizione) {
    msg.innerHTML = '<div class="error">❌ Inserisci una descrizione del lavoro svolto</div>';
    return;
  }
  if (ora_inizio >= ora_fine) {
    msg.innerHTML = '<div class="error">L\'ora fine deve essere dopo l\'ora inizio</div>';
    return;
  }

  const adesso = new Date();
  const minutiAdesso = adesso.getHours() * 60 + adesso.getMinutes();
  const minutiInizio = parseInt(ora_inizio.split(':')[0]) * 60 + parseInt(ora_inizio.split(':')[1] || 0);

  if (minutiInizio > minutiAdesso) {
    msg.innerHTML = `<div class="error">❌ Non puoi segnare un orario nel futuro! L'ora attuale è ${adesso.getHours()}:${String(adesso.getMinutes()).padStart(2, '0')}.</div>`;
    return;
  }

  if (!straordinario) {
    const oraCorrente = new Date();
    const oreCorrente = oraCorrente.getHours();
    const isPomeriggio = oreCorrente >= 13;
    const oraInizioNum = parseInt(ora_inizio.split(':')[0]);

    if (isPomeriggio && oraInizioNum < 13) {
      msg.innerHTML = `
        <div class="error">
          ❌ Non puoi segnare ore mattutine dopo le 13:00.<br>
          <small>Se hai dimenticato di segnare le ore, usa <strong>"Richiedi Recupero Ore"</strong> nella sezione Richieste.</small>
        </div>
      `;
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
  } else {
    if (oreLavorate > maxOre) {
      oreLavorate = maxOre;
      isStraordinario = false;
      msg.innerHTML = `
        <div class="success">✅ Registrazione salvata!</div>
        <div class="info-msg" style="background:#fff3cd;border-color:#ffc107;color:#856404;margin-top:10px;">
          ⚠️ Le ore totali superavano 8h. Sono state arrotondate a 8h (straordinario non pagato).<br>
          <small>Per segnare straordinario, attiva il flag "Straordinario" prima di salvare.</small>
        </div>
      `;
    } else {
      isStraordinario = false;
    }
  }

  dati.registrazioni.push({
    id: prossimoId++,
    utente_id: utenteCorrente.username,
    commessa_id: commessa_id,
    data: data,
    ora_inizio: ora_inizio,
    ora_fine: ora_fine,
    descrizione: descrizione + (isStraordinario ? ' (STRAORDINARIO)' : ''),
    tipo: 'lavoro',
    straordinario: isStraordinario,
    ore: oreLavorate
  });

  salvaDati();

  if (!msg.innerHTML.includes('arrotondate')) {
    msg.innerHTML = '<div class="success">✅ Registrazione salvata!</div>';
  }

  document.getElementById('ora-fine').value = '';
  document.getElementById('descrizione').value = '';
  document.getElementById('straordinario').checked = false;

  caricaUltimaRegistrazione();
}

// ============================================
// INVIA RICHIESTA
// ============================================
async function inviaRichiesta() {
  if (utenteCorrente?.ruolo === 'admin') {
    alert('Gli amministratori non possono fare richieste');
    return;
  }

  try {
    const datiFreschi = await caricaDaFirestore();
    if (datiFreschi) {
      dati = datiFreschi;
      if (!dati.utenti) dati.utenti = [];
      if (!dati.registrazioni) dati.registrazioni = [];
      if (!dati.richieste) dati.richieste = [];
      if (!dati.notifiche) dati.notifiche = [];
    }
  } catch (e) {
    console.warn('⚠️ Impossibile rileggere Firestore prima della richiesta:', e);
  }

  const tipo = document.getElementById('tipo-richiesta').value;
  const msg = document.getElementById('msg-richiesta');

  if (tipo === 'recupero_ore') {
    const data = document.getElementById('recupero-data').value;
    const ora_inizio = document.getElementById('recupero-ora-inizio').value;
    const ora_fine = document.getElementById('recupero-ora-fine').value;
    const commessa_id = parseInt(document.getElementById('recupero-commessa').value) || null;
    const descrizione_lavoro = document.getElementById('recupero-motivo').value.trim();

    if (!data || !ora_inizio || !ora_fine || !descrizione_lavoro) {
      msg.innerHTML = '<div class="error">Compila tutti i campi obbligatori</div>';
      return;
    }

    if (ora_inizio >= ora_fine) {
      msg.innerHTML = '<div class="error">L\'ora fine deve essere dopo l\'ora inizio</div>';
      return;
    }

    const oggi = new Date().toISOString().split('T')[0];
    if (data > oggi) {
      msg.innerHTML = '<div class="error">Non puoi richiedere recupero per date future</div>';
      return;
    }

    const sovrapposizione = controllaSovrapposizioni(
      utenteCorrente.username, data, ora_inizio, ora_fine, 'recupero_ore'
    );
    if (sovrapposizione) {
      msg.innerHTML = '<div class="error">❌ ' + sovrapposizione.messaggio + '</div>';
      return;
    }

    const richiesta = {
      id: prossimoId++,
      utente_id: utenteCorrente.username,
      tipo: tipo,
      data: data,
      ora_inizio: ora_inizio,
      ora_fine: ora_fine,
      commessa_id: commessa_id,
      descrizione_lavoro: descrizione_lavoro,
      stato: 'pending',
      data_richiesta: new Date().toISOString()
    };

    dati.richieste.push(richiesta);
    await salvaDati();

    if (isWeekendOggi()) {
      console.log('📵 Weekend: notifica push NON inviata');
    } else {
      try {
        await db.collection('richieste_trigger').add({
          richiesta_id: richiesta.id,
          utente_id: richiesta.utente_id,
          tipo: richiesta.tipo,
          data: richiesta.data || null,
          ora_inizio: richiesta.ora_inizio || null,
          ora_fine: richiesta.ora_fine || null,
          commessa_id: richiesta.commessa_id || null,
          descrizione_lavoro: richiesta.descrizione_lavoro || null,
          creato_il: new Date().toISOString()
        });
        console.log('✅ Richiesta recupero salvata nel trigger');
      } catch (err) {
        console.warn('⚠️ Errore trigger:', err);
      }
    }

    msg.innerHTML = '<div class="success">✅ Richiesta di recupero ore inviata! Attendi l\'approvazione dell\'admin.</div>';

    document.getElementById('recupero-data').value = '';
    document.getElementById('recupero-ora-inizio').value = '';
    document.getElementById('recupero-ora-fine').value = '';
    document.getElementById('recupero-motivo').value = '';

    aggiornaBadgeRichieste();
    return;
  }

  // Ferie / permesso / malattia
  const data_inizio = document.getElementById('richiesta-data-inizio').value;
  const data_fine = document.getElementById('richiesta-data-fine').value;
  const note = document.getElementById('richiesta-note').value.trim();
  const certificato = document.getElementById('certificato').files[0];

  if (!data_inizio || !data_fine) {
    msg.innerHTML = '<div class="error">Inserisci le date</div>';
    return;
  }

  if (data_inizio > data_fine) {
    msg.innerHTML = '<div class="error">La data inizio deve essere prima della data fine</div>';
    return;
  }

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
    const sovrapposizione = controllaSovrapposizioni(
      utenteCorrente.username, giorno, oraInizioCheck, oraFineCheck, tipo
    );
    if (sovrapposizione) {
      msg.innerHTML = '<div class="error">❌ ' + sovrapposizione.messaggio + '</div>';
      return;
    }
  }

  const richiesta = {
    id: prossimoId++,
    utente_id: utenteCorrente.username,
    tipo: tipo,
    data_inizio: data_inizio,
    data_fine: data_fine,
    note: note,
    stato: 'pending',
    data_richiesta: new Date().toISOString()
  };

  if (certificato) {
    richiesta.certificato = certificato.name;
    richiesta.certificato_tipo = certificato.type;
  }

  dati.richieste.push(richiesta);
  await salvaDati();

  if (isWeekendOggi()) {
    console.log('📵 Weekend: notifica push NON inviata');
  } else {
    try {
      await db.collection('richieste_trigger').add({
        richiesta_id: richiesta.id,
        utente_id: richiesta.utente_id,
        tipo: richiesta.tipo,
        data_inizio: richiesta.data_inizio || null,
        data_fine: richiesta.data_fine || null,
        note: richiesta.note || null,
        creato_il: new Date().toISOString()
      });
      console.log('✅ Richiesta salvata nel trigger');
    } catch (err) {
      console.warn('⚠️ Errore trigger:', err);
    }
  }

  msg.innerHTML = '<div class="success">✅ Richiesta inviata! Attendi la risposta.</div>';

  document.getElementById('richiesta-note').value = '';
  document.getElementById('certificato').value = '';

  caricaRichiesteDipendente();
  aggiornaBadgeRichieste();
}

// ============================================
// LISTA RICHIESTE DIPENDENTE
// ============================================
function caricaRichiesteDipendente() {
  const div = document.getElementById('lista-richieste-dipendente');
  if (!div) return;

  const richieste = dati.richieste.filter(r => r.utente_id === utenteCorrente.username);

  if (richieste.length === 0) {
    div.innerHTML = '<p class="text-muted">Nessuna richiesta inviata</p>';
    return;
  }

  const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
  const statoMap = {
    pending: '⏳ In attesa',
    approvata: '✅ APPROVATA',
    rifiutata: '❌ RIFIUTATA'
  };
  const statoColor = {
    pending: '#ffc107',
    approvata: '#28a745',
    rifiutata: '#dc3545'
  };

  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += '<th>Tipo</th><th>Periodo</th><th>Note</th><th>Stato</th>';
  html += '</tr></thead><tbody>';

  richieste.forEach(r => {
    const colore = statoColor[r.stato] || '#666';
    let periodo = '';
    if (r.tipo === 'recupero_ore') {
      periodo = r.data + ' (' + r.ora_inizio + ' - ' + r.ora_fine + ')';
    } else {
      periodo = r.data_inizio + ' → ' + r.data_fine;
    }
    html += '<tr>';
    html += '<td>' + (emoji[r.tipo] || '📌') + ' ' + r.tipo.replace('_', ' ').charAt(0).toUpperCase() + r.tipo.replace('_', ' ').slice(1) + '</td>';
    html += '<td>' + periodo + '</td>';
    html += '<td>' + (r.tipo === 'recupero_ore' ? r.descrizione_lavoro || '-' : (r.note || '-')) + '</td>';
    html += '<td style="font-weight:bold;color:' + colore + ';">' + (statoMap[r.stato] || r.stato) + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  div.innerHTML = html;
}

// ============================================
// LISTA RICHIESTE ADMIN
// ============================================
function caricaRichiesteAdmin() {
  const div = document.getElementById('lista-richieste-admin');
  if (!div) return;

  const richieste = dati.richieste.filter(r => r.stato === 'pending');

  if (richieste.length === 0) {
    div.innerHTML = '<p class="text-muted">✅ Nessuna richiesta in sospeso</p>';
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
        ${r.commessa_id ? `<br><small>Commessa: ${dati.commesse.find(c => c.id === r.commessa_id)?.nome || '-'}</small>` : ''}
      `;
    } else {
      dettagli = `
        <small>Dal ${r.data_inizio} al ${r.data_fine}</small>
        ${r.note ? `<br><small>📝 ${r.note}</small>` : ''}
        ${r.certificato ? `<br><small>📎 Certificato: ${r.certificato}</small>` : ''}
      `;
    }

    html += `<div class="richiesta-card pending">
      <div class="info">
        <strong>${emoji[r.tipo] || '📌'} ${r.tipo.replace('_', ' ').charAt(0).toUpperCase() + r.tipo.replace('_', ' ').slice(1)} - ${nome}</strong>
        ${dettagli}
        <small style="display:block;color:#999;">Richiesto il: ${new Date(r.data_richiesta).toLocaleDateString('it-IT')}</small>
      </div>
      <div class="azioni">
        <button class="btn-approva" onclick="approvaRichiesta(${r.id})"><i class="fas fa-check"></i> Approva</button>
        <button class="btn-rifiuta" onclick="rifiutaRichiesta(${r.id})"><i class="fas fa-times"></i> Rifiuta</button>
      </div>
    </div>`;
  });

  div.innerHTML = html;
}

function aggiornaBadgeRichieste() {
  const pending = dati.richieste.filter(r => r.stato === 'pending').length;
  const badge = document.getElementById('badge-richieste');
  if (!badge) return;

  if (pending > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = pending;
  } else {
    badge.style.display = 'none';
  }
}

function mostraRichieste() {
  showTab('richieste');
}

// ============================================
// AGGIORNA RICHIESTE MANUALE
// ============================================
function aggiornaRichiesteManuale() {
  caricaDati().then(() => {
    if (utenteCorrente && utenteCorrente.ruolo === 'admin') {
      caricaRichiesteAdmin();
      aggiornaBadgeRichieste();
      alert('✅ Richieste aggiornate!');
    } else {
      alert('⚠️ Non sei autorizzato a vedere le richieste.');
    }
  }).catch((err) => {
    console.error('❌ Errore aggiornamento:', err);
    alert('❌ Errore: ' + err.message);
  });
}

console.log('✅ script.js — PARTE 3/6 caricata');
// ============================================
// NOTIFICHE INTERNE
// ============================================
function aggiungiNotifica(utente_id, tipo, messaggio, link) {
  dati.notifiche.push({
    id: prossimoId++,
    utente_id: utente_id,
    tipo: tipo,
    messaggio: messaggio,
    link: link || '#',
    letto: false,
    data: new Date().toISOString()
  });
  salvaDati();
  aggiornaBadgeNotifiche();
}

function aggiornaBadgeNotifiche() {
  if (!utenteCorrente) return;

  const nonLette = dati.notifiche.filter(n =>
    n.utente_id === utenteCorrente.username && !n.letto
  ).length;

  const badge = document.getElementById('badge-notifiche');
  if (!badge) return;

  if (nonLette > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = nonLette;
    document.getElementById('btn-notifica').style.color = '#dc3545';
    document.getElementById('notifiche-container').style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
    document.getElementById('btn-notifica').style.color = '#555';
  }
}

function mostraNotifiche() {
  const modal = document.getElementById('modal-notifiche');
  modal.classList.add('active');

  const div = document.getElementById('notifiche-lista');
  const notifiche = dati.notifiche
    .filter(n => n.utente_id === utenteCorrente.username)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  if (notifiche.length === 0) {
    div.innerHTML = '<p class="text-muted">Nessuna notifica</p>';
    return;
  }

  let html = '';
  notifiche.forEach(n => {
    const data = new Date(n.data).toLocaleDateString('it-IT') + ' ' + new Date(n.data).toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'});
    const classe = n.letto ? 'notifica-item letto' : 'notifica-item non letto';
    html += `
      <div class="${classe}" onclick="segnaLetta(${n.id})">
        <span class="notifica-testo">${n.messaggio}</span>
        <span class="notifica-data">${data}</span>
      </div>
    `;
  });

  div.innerHTML = html;
}

function segnaLetta(id) {
  const notifica = dati.notifiche.find(n => n.id === id);
  if (notifica) {
    notifica.letto = true;
    salvaDati();
    aggiornaBadgeNotifiche();
    mostraNotifiche();
  }
}

function chiudiNotifiche() {
  document.getElementById('modal-notifiche').classList.remove('active');
}

// ============================================
// MODALE PASSWORD
// ============================================
function apriModificaPassword() {
  if (utenteCorrente?.ruolo !== 'admin') {
    alert('Solo gli amministratori possono cambiare la password');
    return;
  }
  document.getElementById('modal-password').classList.add('active');
  document.getElementById('nuova-password').value = '';
  document.getElementById('conferma-password').value = '';
  document.getElementById('msg-password').innerHTML = '';
}

function chiudiModificaPassword() {
  document.getElementById('modal-password').classList.remove('active');
}

function salvaNuovaPassword() {
  const nuova = document.getElementById('nuova-password').value.trim();
  const conferma = document.getElementById('conferma-password').value.trim();
  const msg = document.getElementById('msg-password');

  if (!nuova || nuova.length < 4) {
    msg.innerHTML = '<div class="error">La password deve essere almeno di 4 caratteri</div>';
    return;
  }

  if (nuova !== conferma) {
    msg.innerHTML = '<div class="error">Le password non coincidono</div>';
    return;
  }

  const utente = dati.utenti.find(u => u.username === utenteCorrente.username);
  if (!utente) return;

  utente.password = nuova;
  salvaDati();

  msg.innerHTML = '<div class="success">✅ Password cambiata con successo!</div>';

  setTimeout(() => {
    chiudiModificaPassword();
  }, 1500);
}

// ============================================
// EXPORT ORE MESE (CSV/Excel)
// ============================================
function esportaOreMese() {
  if (utenteCorrente?.ruolo !== 'admin') {
    alert('Solo gli amministratori possono esportare');
    return;
  }

  const mese = prompt('Inserisci il mese (1-12):', new Date().getMonth() + 1);
  if (!mese) return;
  const meseNum = parseInt(mese);
  if (meseNum < 1 || meseNum > 12) {
    alert('Mese non valido');
    return;
  }

  const anno = prompt('Inserisci l\'anno (es. 2026):', new Date().getFullYear());
  if (!anno) return;
  const annoNum = parseInt(anno);
  if (annoNum < 2000 || annoNum > 2100) {
    alert('Anno non valido');
    return;
  }

  const giorniMese = new Date(annoNum, meseNum, 0).getDate();
  const dipendenti = dati.utenti.filter(u => u.ruolo === 'dipendente');

  if (dipendenti.length === 0) {
    alert('Nessun dipendente trovato');
    return;
  }

  let header = 'DIPENDENTE';
  for (let g = 1; g <= giorniMese; g++) {
    const giornoSett = new Date(annoNum, meseNum - 1, g).getDay();
    const giornoNome = ['DOM','LUN','MAR','MER','GIO','VEN','SAB'][giornoSett];
    header += `;${g} (${giornoNome})`;
  }
  header += ';TOTALE ORE';

  let csv = `MESE: ${mese}/${annoNum}\n`;
  csv += `DATA ESPORTAZIONE: ${new Date().toLocaleDateString('it-IT')}\n\n`;
  csv += header + '\n';

  dipendenti.forEach(dip => {
    let riga = dip.nome + ' ' + dip.cognome;
    let totaleOre = 0;

    for (let g = 1; g <= giorniMese; g++) {
      const data = `${annoNum}-${String(meseNum).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
      const giornoSett = new Date(annoNum, meseNum - 1, g).getDay();
      const isWeekend = giornoSett === 0 || giornoSett === 6;

      const registrazioni = dati.registrazioni.filter(r =>
        r.utente_id === dip.username && r.data === data
      );

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
          simbolo = oreGiorno.toFixed(2).replace('.', ',');
        }
      } else {
        if (isWeekend) {
          simbolo = '/';
        } else {
          const haRichiestaApprovata = dati.richieste.some(r =>
            r.utente_id === dip.username &&
            r.stato === 'approvata' &&
            r.data_inizio <= data && r.data_fine >= data
          );
          if (haRichiestaApprovata) {
            const richiesta = dati.richieste.find(r =>
              r.utente_id === dip.username &&
              r.stato === 'approvata' &&
              r.data_inizio <= data && r.data_fine >= data
            );
            if (richiesta) {
              if (richiesta.tipo === 'ferie') simbolo = 'F';
              else if (richiesta.tipo === 'permesso') simbolo = 'P';
              else if (richiesta.tipo === 'malattia') simbolo = 'M';
            }
          } else {
            simbolo = 'A';
          }
        }
      }

      totaleOre += oreGiorno;
      riga += ';' + simbolo;
    }

    riga += ';' + totaleOre.toFixed(2).replace('.', ',');
    csv += riga + '\n';
  });

  const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][meseNum - 1];

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ORE_${meseNome}_${annoNum}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);

  alert('✅ File esportato con successo!');
}

// ============================================
// EXPORT PDF CALENDARIO
// ============================================
async function esportaPDF() {
  const output = document.getElementById('calendario-output');
  const content = output.innerHTML;

  if (!content || content.includes('Seleziona mese/anno')) {
    alert('⚠️ Prima genera il report nel calendario');
    return;
  }

  const logoHTML = document.querySelector('.logo-small') ?
    document.querySelector('.logo-small').outerHTML : '<h2>MEC-ROY srls</h2>';

  const fullHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #00695C; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <div style="text-align:center;padding:20px;">${logoHTML}</div>
      <h2 style="text-align:center;">Report Ore Mensile</h2>
      ${content}
      <div style="text-align:center;padding:10px;font-size:11px;color:#888;">
        MEC-ROY srls - Generato il ${new Date().toLocaleDateString('it-IT')}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([fullHTML], { type: 'text/html' });
  const file = new File([blob], 'Report_MEC-ROY.html', { type: 'text/html' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Report Ore MEC-ROY',
        text: 'In allegato il report ore.'
      });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.warn('Errore condivisione, provo download...', error);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Report_MEC-ROY.html';
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// DIPENDENTI - CRUD
// ============================================
function aggiungiDipendente() {
  const nome = document.getElementById('dip-nome').value.trim();
  const cognome = document.getElementById('dip-cognome').value.trim();
  const username = document.getElementById('dip-username').value.trim();
  const password = document.getElementById('dip-password').value.trim();
  const ruolo = document.getElementById('dip-ruolo').value;
  const msg = document.getElementById('msg-dipendente');

  if (!nome || !cognome || !username || !password) {
    msg.innerHTML = '<div class="error">Compila tutti i campi obbligatori</div>';
    return;
  }

  if (dati.utenti.some(u => u.username === username)) {
    msg.innerHTML = '<div class="error">❌ Username già esistente</div>';
    return;
  }

  dati.utenti.push({
    username: username,
    password: password,
    nome: nome,
    cognome: cognome,
    ruolo: ruolo
  });

  salvaDati();

  document.getElementById('dip-nome').value = '';
  document.getElementById('dip-cognome').value = '';
  document.getElementById('dip-username').value = '';
  document.getElementById('dip-password').value = '';
  msg.innerHTML = '<div class="success">✅ Dipendente aggiunto con successo!</div>';

  caricaListaDipendenti();
  caricaSelectDipendentiModifica();
  caricaSelectDipendentiCalendario();
}

function caricaListaDipendenti() {
  const div = document.getElementById('lista-dipendenti');
  if (!div) return;

  if (dati.utenti.length === 0) {
    div.innerHTML = '<p class="text-muted">📭 Nessun dipendente</p>';
    return;
  }

  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += '<th>Username</th><th>Nome</th><th>Cognome</th><th>Ruolo</th><th>Azioni</th>';
  html += '</tr></thead><tbody>';

  dati.utenti.forEach(u => {
    const isSelf = u.username === utenteCorrente.username;
    html += '<tr id="row-' + u.username + '" style="cursor:pointer;" onclick="apriDettaglioDipendente(\'' + u.username + '\')" title="Clicca per vedere il dettaglio">';
    html += '<td><strong>' + u.username + '</strong></td>';
    html += '<td>' + u.nome + '</td>';
    html += '<td>' + u.cognome + '</td>';
    html += '<td><span class="badge ' + u.ruolo + '">' + u.ruolo + '</span></td>';
    html += '<td>';
    if (!isSelf) {
      html += '<button class="btn-warning" onclick="event.stopPropagation(); apriModificaDipendente(\'' + u.username + '\')" style="margin-right:5px;" title="Modifica"><i class="fas fa-edit"></i></button>';
      html += '<button class="btn-danger" onclick="event.stopPropagation(); eliminaDipendente(\'' + u.username + '\')" title="Elimina"><i class="fas fa-trash"></i></button>';
    } else {
      html += '<span style="color:#999;font-size:0.8em;">(tu)</span>';
    }
    html += '</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  div.innerHTML = html;
}

function apriModificaDipendente(username) {
  const utente = dati.utenti.find(u => u.username === username);
  if (!utente) return;

  const row = document.getElementById('row-' + username);
  if (!row) return;

  row.innerHTML = `
    <td><input type="text" id="edit-username-${username}" value="${utente.username}" class="edit-input" /></td>
    <td><input type="text" id="edit-nome-${username}" value="${utente.nome}" class="edit-input" /></td>
    <td><input type="text" id="edit-cognome-${username}" value="${utente.cognome}" class="edit-input" /></td>
    <td>
      <select id="edit-ruolo-${username}" class="edit-input">
        <option value="dipendente" ${utente.ruolo === 'dipendente' ? 'selected' : ''}>Dipendente</option>
        <option value="admin" ${utente.ruolo === 'admin' ? 'selected' : ''}>Admin</option>
      </select>
    </td>
    <td>
      <button class="btn-success" onclick="salvaModificaDipendente('${username}')" style="margin-right:5px;" title="Salva"><i class="fas fa-save"></i></button>
      <button class="btn-danger" onclick="annullaModificaDipendente('${username}')" title="Annulla"><i class="fas fa-times"></i></button>
    </td>
  `;
}

function salvaModificaDipendente(oldUsername) {
  const nuovoUsername = document.getElementById('edit-username-' + oldUsername).value.trim();
  const nome = document.getElementById('edit-nome-' + oldUsername).value.trim();
  const cognome = document.getElementById('edit-cognome-' + oldUsername).value.trim();
  const ruolo = document.getElementById('edit-ruolo-' + oldUsername).value;

  if (!nuovoUsername || !nome || !cognome) {
    alert('Compila tutti i campi');
    return;
  }

  if (nuovoUsername !== oldUsername && dati.utenti.some(u => u.username === nuovoUsername)) {
    alert('❌ Username già esistente');
    return;
  }

  const utente = dati.utenti.find(u => u.username === oldUsername);
  if (!utente) return;

  utente.username = nuovoUsername;
  utente.nome = nome;
  utente.cognome = cognome;
  utente.ruolo = ruolo;

  if (nuovoUsername !== oldUsername) {
    dati.registrazioni.forEach(r => {
      if (r.utente_id === oldUsername) r.utente_id = nuovoUsername;
    });
    dati.richieste.forEach(r => {
      if (r.utente_id === oldUsername) r.utente_id = nuovoUsername;
    });
    dati.notifiche.forEach(n => {
      if (n.utente_id === oldUsername) n.utente_id = nuovoUsername;
    });
  }

  salvaDati();
  caricaListaDipendenti();
  caricaSelectDipendentiModifica();
  caricaSelectDipendentiCalendario();
  alert('✅ Dipendente modificato con successo!');
}

function annullaModificaDipendente(username) {
  caricaListaDipendenti();
}

function eliminaDipendente(username) {
  const registrazioniCount = dati.registrazioni.filter(r => r.utente_id === username).length;
  const richiesteCount = dati.richieste.filter(r => r.utente_id === username).length;

  let msg = '⚠️ Eliminare il dipendente "' + username + '"?\n\n';
  if (registrazioniCount > 0 || richiesteCount > 0) {
    msg += '⚠️ ATTENZIONE: Questo dipendente ha:\n';
    if (registrazioniCount > 0) msg += '  - ' + registrazioniCount + ' registrazioni ore\n';
    if (richiesteCount > 0) msg += '  - ' + richiesteCount + ' richieste\n';
    msg += '\nEliminando il dipendente, TUTTI questi dati verranno PERDUTI.\n';
  }
  msg += '\nSei sicuro di voler procedere?';

  if (!confirm(msg)) return;

  dati.utenti = dati.utenti.filter(u => u.username !== username);
  dati.registrazioni = dati.registrazioni.filter(r => r.utente_id !== username);
  dati.richieste = dati.richieste.filter(r => r.utente_id !== username);
  dati.notifiche = dati.notifiche.filter(n => n.utente_id !== username);

  salvaDati();
  caricaListaDipendenti();
  caricaSelectDipendentiModifica();
  caricaSelectDipendentiCalendario();
  alert('🗑️ Dipendente eliminato');
}

function caricaSelectDipendentiModifica() {
  const select = document.getElementById('modifica-dipendente');
  if (!select) return;
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  dati.utenti.filter(u => u.ruolo === 'dipendente').forEach(u => {
    select.innerHTML += '<option value="' + u.username + '">' + u.nome + ' ' + u.cognome + '</option>';
  });
}

function caricaSelectDipendentiCalendario() {
  const select = document.getElementById('cal-dipendente');
  if (!select) return;
  select.innerHTML = '<option value="">-- Tutti --</option>';
  dati.utenti.filter(u => u.ruolo === 'dipendente').forEach(u => {
    select.innerHTML += '<option value="' + u.username + '">' + u.nome + ' ' + u.cognome + '</option>';
  });
}

console.log('✅ script.js — PARTE 4/6 caricata');
// ============================================
// CARICA REGISTRAZIONI MODIFICA (admin)
// ============================================
function caricaRegistrazioniModifica() {
  const username = document.getElementById('modifica-dipendente').value;
  const data = document.getElementById('modifica-data').value;
  const div = document.getElementById('modifica-lista');
  if (!div) return;

  if (!username || !data) {
    div.innerHTML = '<p class="text-muted">Seleziona dipendente e data</p>';
    return;
  }

  const registrazioni = dati.registrazioni.filter(r =>
    r.utente_id === username && r.data === data && r.tipo === 'lavoro'
  );

  if (registrazioni.length === 0) {
    div.innerHTML = '<p class="text-muted">Nessuna registrazione per questo dipendente in questa data</p>';
    return;
  }

  const totaleGiornata = calcolaOreGiornata(username, data);
  const isOltre8 = totaleGiornata > 8;

  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += '<th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Tipo</th><th>Descrizione</th><th>Azioni</th>';
  html += '</tr></thead><tbody>';

  registrazioni.forEach(r => {
    const commessa = dati.commesse.find(c => c.id === r.commessa_id);
    const [h1, m1] = r.ora_inizio.split(':').map(Number);
    const [h2, m2] = r.ora_fine.split(':').map(Number);
    const ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    const isStraordinario = r.straordinario || false;
    const tipoCorrente = r.tipo || 'lavoro';

    html += '<tr' + (isOltre8 ? ' class="ore-straordinario"' : '') + '>';
    html += '<td><strong>' + (commessa?.nome || 'N/A') + '</strong></td>';
    html += '<td><input type="time" id="mod-inizio-' + r.id + '" value="' + r.ora_inizio + '" class="edit-input" /></td>';
    html += '<td><input type="time" id="mod-fine-' + r.id + '" value="' + r.ora_fine + '" class="edit-input" /></td>';
    html += '<td>' + ore.toFixed(2) + 'h' + (isStraordinario ? ' ⭐' : '') + '</td>';
    html += '<td>' +
      '<select id="mod-tipo-' + r.id + '" class="edit-input">' +
        '<option value="lavoro"' + (tipoCorrente === 'lavoro' ? ' selected' : '') + '>Lavoro</option>' +
        '<option value="ferie"' + (tipoCorrente === 'ferie' ? ' selected' : '') + '>Ferie</option>' +
        '<option value="permesso"' + (tipoCorrente === 'permesso' ? ' selected' : '') + '>Permesso</option>' +
        '<option value="malattia"' + (tipoCorrente === 'malattia' ? ' selected' : '') + '>Malattia</option>' +
        '<option value="recupero_ore"' + (tipoCorrente === 'recupero_ore' ? ' selected' : '') + '>Recupero ore</option>' +
      '</select>' +
    '</td>';
    html += '<td><input type="text" id="mod-desc-' + r.id + '" value="' + (r.descrizione || '') + '" class="edit-input" /></td>';
    html += '<td>';
    html += '<button class="btn-warning" onclick="salvaModifica(' + r.id + ')"><i class="fas fa-save"></i></button>';
    html += '<button class="btn-danger" onclick="eliminaRegistrazione(' + r.id + ')"><i class="fas fa-trash"></i></button>';
    html += '</td>';
    html += '</tr>';
  });

  const bgColor = isOltre8 ? '#ffebee' : '#e8f5e9';
  const textColor = isOltre8 ? '#d32f2f' : '#2e7d32';
  html += `
    <tr style="font-weight:bold;">
      <td colspan="3" style="text-align:right;background:${bgColor};color:${textColor};">TOTALE GIORNATA:</td>
      <td colspan="3" style="background:${bgColor};color:${textColor};">
        ${totaleGiornata.toFixed(2)}h ${isOltre8 ? '⚠️ STRAORDINARIO (> 8h)' : ''}
      </td>
    </tr>
  `;

  html += '</tbody></table></div>';
  div.innerHTML = html;
}

async function salvaModifica(id) {
  const nuovaInizio = document.getElementById('mod-inizio-' + id).value;
  const nuovaFine = document.getElementById('mod-fine-' + id).value;
  const nuovaDesc = document.getElementById('mod-desc-' + id).value.trim();
  const nuovoTipo = document.getElementById('mod-tipo-' + id).value;

  const registro = dati.registrazioni.find(r => r.id === id);
  if (!registro) return;

  if (nuovaInizio >= nuovaFine) {
    alert('L\'ora fine deve essere dopo l\'ora inizio');
    return;
  }

  registro.ora_inizio = nuovaInizio;
  registro.ora_fine = nuovaFine;
  registro.descrizione = nuovaDesc;
  registro.tipo = nuovoTipo;

  const [h1, m1] = nuovaInizio.split(':').map(Number);
  const [h2, m2] = nuovaFine.split(':').map(Number);
  registro.ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;

  await salvaDati();
  caricaRegistrazioniModifica();
  alert('✅ Registrazione modificata!');
}

function eliminaRegistrazione(id) {
  if (!confirm('Eliminare questa registrazione?')) return;

  dati.registrazioni = dati.registrazioni.filter(r => r.id !== id);
  salvaDati();
  caricaRegistrazioniModifica();
  alert('🗑️ Registrazione eliminata');
}

// ============================================
// CARICA CALENDARIO (vista mensile)
// ============================================
function caricaCalendario() {
  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);
  const output = document.getElementById('calendario-output');
  if (!output) return;

  if (!anno) {
    output.innerHTML = '<p class="text-muted">Inserisci un anno valido</p>';
    return;
  }

  if (utenteCorrente.ruolo === 'dipendente') {
    const vistaScelta = document.querySelector('input[name="cal-vista"]:checked');
    if (vistaScelta && vistaScelta.value === 'dettagliato') {
      caricaCalendarioDettagliato();
      return;
    }
  }

  const isAdmin = utenteCorrente.ruolo === 'admin';
  let utenteFilter = utenteCorrente.username;
  if (isAdmin) {
    utenteFilter = document.getElementById('cal-dipendente').value;
  }

  const giorniMese = new Date(anno, mese, 0).getDate();

  let dipendentiDaMostrare = [];
  if (isAdmin) {
    if (utenteFilter) {
      dipendentiDaMostrare = dati.utenti.filter(u => u.username === utenteFilter);
    } else {
      dipendentiDaMostrare = dati.utenti.filter(u => u.ruolo === 'dipendente');
    }
  } else {
    dipendentiDaMostrare = dati.utenti.filter(u => u.username === utenteCorrente.username);
  }

  const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][mese-1];

  let html = `<h4 style="margin-bottom:15px;color:#333;">${meseNome} ${anno}</h4>`;

  html += `
    <div style="margin-bottom:15px;padding:10px 15px;background:#f8f9fa;border-radius:8px;border:1px solid #ddd;display:flex;gap:15px;flex-wrap:wrap;font-size:0.85em;">
      <span><span style="display:inline-block;width:16px;height:16px;background:#E8F5E9;border:1px solid #4CAF50;border-radius:3px;"></span> Lavorato</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#E3F2FD;border:1px solid #2196F3;border-radius:3px;"></span> Ferie</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#FFF3E0;border:1px solid #FF9800;border-radius:3px;"></span> Permesso</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#FFEBEE;border:1px solid #f44336;border-radius:3px;"></span> Malattia</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#fff3cd;border:1px solid #ffc107;border-radius:3px;"></span> Recupero</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#ffebee;border:1px solid #d32f2f;border-radius:3px;"></span> Straordinario</span>
      <span><span style="display:inline-block;width:16px;height:16px;background:#f5f5f5;border:1px solid #999;border-radius:3px;border-style:dashed;"></span> Assente</span>
    </div>
  `;

  if (dipendentiDaMostrare.length === 0) {
    html += '<p class="text-muted">Nessun dipendente trovato</p>';
    output.innerHTML = html;
    return;
  }

  html += '<div style="overflow-x:auto;">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:0.85em;">';
  html += '<thead><tr><th style="padding:8px;border:1px solid #ddd;background:#00695C;color:white;min-width:120px;">Dipendente</th>';

  const giorniSett = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  for (let g = 1; g <= giorniMese; g++) {
    const giornoSett = new Date(anno, mese - 1, g).getDay();
    const isWeekend = giornoSett === 0 || giornoSett === 6;
    const bgColor = isWeekend ? '#f5f5f5' : 'white';
    html += `<th style="padding:6px;border:1px solid #ddd;text-align:center;background:${bgColor};min-width:35px;font-size:0.75em;">${g}<br><span style="font-weight:normal;font-size:0.7em;color:#888;">${giorniSett[giornoSett]}</span></th>`;
  }
  html += '<th style="padding:8px;border:1px solid #ddd;background:#00695C;color:white;min-width:60px;">Totale</th>';
  html += '</tr></thead><tbody>';

  dipendentiDaMostrare.forEach(dip => {
    html += `<tr>`;
    html += `<td style="padding:6px 10px;border:1px solid #ddd;font-weight:600;background:#f8f9fa;"><strong>${dip.nome} ${dip.cognome}</strong></td>`;

    let totaleOre = 0;

    for (let g = 1; g <= giorniMese; g++) {
      const data = `${anno}-${String(mese).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
      const giornoSett = new Date(anno, mese - 1, g).getDay();
      const isWeekend = giornoSett === 0 || giornoSett === 6;

      const registrazioni = dati.registrazioni.filter(r =>
        r.utente_id === dip.username && r.data === data
      );

      let cella = '';
      let bgColor = 'white';

      if (registrazioni.length > 0) {
        const haFerie = registrazioni.some(r => r.tipo === 'ferie');
        const haPermesso = registrazioni.some(r => r.tipo === 'permesso');
        const haMalattia = registrazioni.some(r => r.tipo === 'malattia');
        const haRecupero = registrazioni.some(r => r.recupero === true);
        const haStraordinario = registrazioni.some(r => r.straordinario === true);
        const haLavoro = registrazioni.some(r => r.tipo === 'lavoro');

        if (haFerie) { cella = 'F'; bgColor = '#E3F2FD'; }
        else if (haPermesso) { cella = 'P'; bgColor = '#FFF3E0'; }
        else if (haMalattia) { cella = 'M'; bgColor = '#FFEBEE'; }
        else if (haRecupero) {
          let oreGiorno = 0;
          registrazioni.forEach(r => {
            if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
              const [h1, m1] = r.ora_inizio.split(':').map(Number);
              const [h2, m2] = r.ora_fine.split(':').map(Number);
              oreGiorno += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
            }
          });
          cella = oreGiorno.toFixed(1) + 'h';
          bgColor = '#fff3cd';
          totaleOre += oreGiorno;
        } else if (haLavoro) {
          let oreGiorno = 0;
          registrazioni.forEach(r => {
            if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
              const [h1, m1] = r.ora_inizio.split(':').map(Number);
              const [h2, m2] = r.ora_fine.split(':').map(Number);
              oreGiorno += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
            }
          });

          if (haStraordinario) {
            cella = oreGiorno.toFixed(1) + 'h ⭐';
            bgColor = '#ffebee';
          } else {
            cella = oreGiorno.toFixed(1) + 'h';
            bgColor = '#E8F5E9';
          }
          totaleOre += oreGiorno;
        }
      } else {
        if (isWeekend) {
          cella = '/';
          bgColor = '#f5f5f5';
        } else {
          const haRichiestaApprovata = dati.richieste.some(r =>
            r.utente_id === dip.username &&
            r.stato === 'approvata' &&
            r.data_inizio <= data && r.data_fine >= data
          );
          if (haRichiestaApprovata) {
            const richiesta = dati.richieste.find(r =>
              r.utente_id === dip.username &&
              r.stato === 'approvata' &&
              r.data_inizio <= data && r.data_fine >= data
            );
            if (richiesta) {
              if (richiesta.tipo === 'ferie') { cella = 'F'; bgColor = '#E3F2FD'; }
              else if (richiesta.tipo === 'permesso') { cella = 'P'; bgColor = '#FFF3E0'; }
              else if (richiesta.tipo === 'malattia') { cella = 'M'; bgColor = '#FFEBEE'; }
              else if (richiesta.tipo === 'recupero_ore') {
                const [h1, m1] = richiesta.ora_inizio.split(':').map(Number);
                const [h2, m2] = richiesta.ora_fine.split(':').map(Number);
                const oreRecupero = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
                cella = oreRecupero.toFixed(1) + 'h';
                bgColor = '#fff3cd';
              }
            }
          } else {
            const oggi = new Date();
            oggi.setHours(0, 0, 0, 0);
            const dataGiorno = new Date(data + 'T00:00:00');

            if (dataGiorno > oggi) {
              cella = '';
              bgColor = 'white';
            } else {
              cella = 'A';
              bgColor = '#f5f5f5';
            }
          }
        }
      }

      if (isWeekend && cella === '') {
        cella = '/';
        bgColor = '#f5f5f5';
      }

      let borderStyle = '1px solid #ddd';
      if (cella === 'A') {
        borderStyle = '2px dashed #999';
      }

      html += `<td style="padding:6px;border:${borderStyle};text-align:center;background:${bgColor};font-weight:${cella === 'A' ? 'bold' : 'normal'};color:${cella === 'A' ? '#d32f2f' : '#333'};">${cella}</td>`;
    }

    const isOltre8 = totaleOre > 8;
    const bgTotal = isOltre8 ? '#ffebee' : '#e8f5e9';
    const colorTotal = isOltre8 ? '#d32f2f' : '#2e7d32';
    html += `<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold;background:${bgTotal};color:${colorTotal};">${totaleOre.toFixed(1)}h${isOltre8 ? ' ⚠️' : ''}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  output.innerHTML = html;

  // Aggiungi totale mese
  setTimeout(() => {
    if (output && !output.innerHTML.includes('📊 TOTALE MESE')) {
      mostraTotaliMese();
    }
  }, 50);
}

// ============================================
// TOTALI MESE (filtrato per utente)
// ============================================
function mostraTotaliMese() {
  if (!utenteCorrente) return;

  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);
  if (!mese || !anno) return;

  const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][mese-1];

  let totaleGenerale = 0;
  let dipendentiDaContare = 0;

  if (utenteCorrente.ruolo === 'admin') {
    dati.registrazioni.forEach(r => {
      if (r.tipo === 'lavoro' && r.data && r.data.startsWith(`${anno}-${String(mese).padStart(2,'0')}`)) {
        totaleGenerale += r.ore || 0;
      }
    });
    dipendentiDaContare = dati.utenti.filter(u => u.ruolo === 'dipendente').length;
  } else {
    dati.registrazioni.forEach(r => {
      if (r.utente_id === utenteCorrente.username &&
          r.tipo === 'lavoro' &&
          r.data && r.data.startsWith(`${anno}-${String(mese).padStart(2,'0')}`)) {
        totaleGenerale += r.ore || 0;
      }
    });
    dipendentiDaContare = 1;
  }

  const container = document.getElementById('calendario-output');
  if (container) {
    const labelSoggetto = utenteCorrente.ruolo === 'admin'
      ? `Dipendenti attivi: ${dipendentiDaContare}`
      : `Le tue ore del mese`;

    const totaliHTML = `
      <div style="background:#e8f5e9;border:2px solid #4CAF50;border-radius:10px;padding:15px;margin-bottom:20px;text-align:center;">
        <h4 style="color:#2e7d32;margin:0;">📊 TOTALE MESE: ${meseNome} ${anno}</h4>
        <p style="margin:5px 0;font-size:1.2em;"><strong>${totaleGenerale.toFixed(2)} ore</strong> lavorate</p>
        <small style="color:#666;">${labelSoggetto}</small>
      </div>
    `;
    container.innerHTML = totaliHTML + container.innerHTML;
  }
}

function cambiaVistaCalendario() {
  caricaCalendario();
}

// ============================================
// CALENDARIO DETTAGLIATO (vista dipendente)
// ============================================
function caricaCalendarioDettagliato() {
  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);
  const output = document.getElementById('calendario-output');

  if (!mese || !anno) {
    output.innerHTML = '<p class="text-muted">Seleziona mese e anno</p>';
    return;
  }

  const username = utenteCorrente.username;
  const giorniMese = new Date(anno, mese, 0).getDate();
  const mesePadded = String(mese).padStart(2, '0');
  const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][mese-1];

  let html = '';
  let totaleMese = 0;
  let registrazioniTotali = 0;
  let giorniLavorati = 0;

  for (let g = 1; g <= giorniMese; g++) {
    const data = `${anno}-${mesePadded}-${String(g).padStart(2, '0')}`;
    const dataObj = new Date(data + 'T00:00:00');
    const giornoSett = dataObj.getDay();
    const isWeekend = giornoSett === 0 || giornoSett === 6;

    const registrazioni = dati.registrazioni.filter(r =>
      r.utente_id === username && r.data === data
    );

    const richiesta = dati.richieste.find(r =>
      r.utente_id === username &&
      r.stato === 'approvata' &&
      r.data_inizio <= data && r.data_fine >= data
    );

    if (isWeekend && registrazioni.length === 0 && !richiesta) continue;

    if (!isWeekend && registrazioni.length === 0 && !richiesta) {
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);
      if (dataObj < oggi) {
        html += `<div class="giorno-dettaglio"><div class="giorno-dettaglio-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4><span class="giorno-totale">⬜ ASSENTE</span></div></div>`;
      }
      continue;
    }

    if (richiesta && registrazioni.length === 0) {
      const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
      const tipo = richiesta.tipo === 'recupero_ore' ? 'RECUPERO ORE' : richiesta.tipo.toUpperCase();
      const emojiChar = emoji[richiesta.tipo] || '📌';

      html += `<div class="giorno-dettaglio"><div class="giorno-dettaglio-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4><span class="giorno-totale">${emojiChar} ${tipo}</span></div><div class="table-wrapper" style="margin-top:0;border:none;"><table><tbody><tr class="riga-speciale-giorno ${richiesta.tipo}"><td>${emojiChar} <strong>${tipo}</strong>${richiesta.note ? ' - ' + richiesta.note : ''}</td></tr></tbody></table></div></div>`;
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

    registrazioniTotali += registrazioni.length;
    totaleMese += totaleGiorno;
    if (totaleGiorno > 0) giorniLavorati++;

    const isOltre8 = totaleGiorno > 8;
    const bgHeader = isOltre8 ? '#b71c1c' : '#00695C';

    html += `<div class="giorno-dettaglio"><div class="giorno-dettaglio-header" style="background:${bgHeader};"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4><span class="giorno-totale">${totaleGiorno.toFixed(2)}h${isOltre8 ? ' ⚠️' : ''}</span></div>`;

    html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><thead><tr><th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;

    registrazioni.forEach(r => {
      const commessa = dati.commesse.find(c => c.id === r.commessa_id);
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
      const isStraordinario = r.straordinario ? ' ⭐' : '';
      const isRecupero = r.recupero ? ' ⏰' : '';

      html += `<tr><td><strong>${commessa?.nome || 'N/A'}</strong></td><td>${r.ora_inizio || '-'}</td><td>${r.ora_fine || '-'}</td><td><strong>${ore.toFixed(2)}h${isStraordinario}${isRecupero}</strong></td><td>${r.descrizione || '-'}</td></tr>`;
    });

    html += `</tbody></table></div></div>`;
  }

  if (html === '') {
    output.innerHTML = '<p class="text-muted">Nessuna registrazione per questo mese.</p>';
    return;
  }

  const headerHTML = `
    <div class="calendario-dettagliato-info">
      <h3><i class="fas fa-chart-bar"></i> Riepilogo ${meseNome} ${anno}</h3>
      <div class="info-totali">
        <span>📊 ${registrazioniTotali} registrazioni</span>
        <span>📅 ${giorniLavorati} giorni lavorati</span>
        <span>⏱️ Totale: ${totaleMese.toFixed(2)}h</span>
      </div>
    </div>
  `;

  output.innerHTML = headerHTML + html;
}

console.log('✅ script.js — PARTE 5/6 caricata');
// ============================================
// MODALE DETTAGLIO COMMESSA (admin)
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
  dati.commesse.forEach(c => {
    select.innerHTML += '<option value="' + c.id + '">' + c.nome + '</option>';
  });
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
  if (!commessa) {
    alert('❌ Commessa non trovata');
    return;
  }

  commessaCorrenteDettaglio = id;

  filtriCommessa = { dataInizio: '', dataFine: '', ricerca: '', dipendenti: [] };

  document.getElementById('dettaglio-commessa-nome').textContent = commessa.nome;
  const dataCreazione = commessa.data_creazione ?
    new Date(commessa.data_creazione).toLocaleDateString('it-IT') : 'N/D';
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

  const utentiConRegistrazioni = [...new Set(
    dati.registrazioni
      .filter(r => r.commessa_id === commessaCorrenteDettaglio)
      .map(r => r.utente_id)
  )];

  if (utentiConRegistrazioni.length === 0) {
    container.innerHTML = '<p class="text-muted" style="margin:0;">Nessun dipendente con registrazioni</p>';
    return;
  }

  utentiConRegistrazioni.forEach(username => {
    const utente = dati.utenti.find(u => u.username === username);
    if (!utente) return;

    const item = document.createElement('div');
    item.className = 'filtro-dipendente-item';
    item.dataset.username = username;
    item.innerHTML = `<i class="fas fa-user"></i> <span>${utente.nome} ${utente.cognome}</span>`;
    item.onclick = function() {
      const idx = filtriCommessa.dipendenti.indexOf(username);
      if (idx > -1) {
        filtriCommessa.dipendenti.splice(idx, 1);
        this.classList.remove('attivo');
      } else {
        filtriCommessa.dipendenti.push(username);
        this.classList.add('attivo');
      }
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

  let registrazioni = dati.registrazioni.filter(r =>
    r.commessa_id === commessaCorrenteDettaglio && r.tipo === 'lavoro'
  );

  if (filtriCommessa.dataInizio) {
    registrazioni = registrazioni.filter(r => r.data >= filtriCommessa.dataInizio);
  }
  if (filtriCommessa.dataFine) {
    registrazioni = registrazioni.filter(r => r.data <= filtriCommessa.dataFine);
  }
  if (filtriCommessa.dipendenti.length > 0) {
    registrazioni = registrazioni.filter(r => filtriCommessa.dipendenti.includes(r.utente_id));
  }
  if (filtriCommessa.ricerca) {
    registrazioni = registrazioni.filter(r => {
      const utente = dati.utenti.find(u => u.username === r.utente_id);
      const nome = utente ? (utente.nome + ' ' + utente.cognome).toLowerCase() : '';
      const descrizione = (r.descrizione || '').toLowerCase();
      const data = r.data || '';
      return nome.includes(filtriCommessa.ricerca) ||
             descrizione.includes(filtriCommessa.ricerca) ||
             data.includes(filtriCommessa.ricerca);
    });
  }

  registrazioni.sort((a, b) => b.data.localeCompare(a.data));

  document.getElementById('dettaglio-contatore').textContent =
    `📊 ${registrazioni.length} registrazioni visualizzate`;

  const perDipendente = {};
  registrazioni.forEach(r => {
    if (!perDipendente[r.utente_id]) perDipendente[r.utente_id] = [];
    perDipendente[r.utente_id].push(r);
  });

  const output = document.getElementById('dettaglio-commessa-output');

  if (registrazioni.length === 0) {
    output.innerHTML = '<p class="text-muted">Nessuna registrazione trovata con i filtri applicati.</p>';
    return;
  }

  let html = '';
  let totaleGenerale = 0;

  Object.keys(perDipendente).forEach(username => {
    const utente = dati.utenti.find(u => u.username === username);
    const nomeDipendente = utente ? utente.nome + ' ' + utente.cognome : username;
    let totaleDipendente = 0;

    html += `<div class="gruppo-dipendente">`;
    html += `<div class="gruppo-dipendente-header"><h4><i class="fas fa-user"></i> ${nomeDipendente}</h4>`;

    perDipendente[username].forEach(r => { totaleDipendente += r.ore || 0; });
    html += `<span class="subtotale">${totaleDipendente.toFixed(2)}h</span></div>`;

    html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><thead><tr><th>Data</th><th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;

    perDipendente[username].forEach(r => {
      const commessa = dati.commesse.find(c => c.id === r.commessa_id);
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
      const isStraordinario = r.straordinario ? ' ⭐' : '';
      const isRecupero = r.recupero ? ' ⏰' : '';

      html += `<tr><td>${r.data}</td><td><strong>${commessa?.nome || 'N/A'}</strong></td><td>${r.ora_inizio}</td><td>${r.ora_fine}</td><td><strong>${ore.toFixed(2)}h${isStraordinario}${isRecupero}</strong></td><td>${r.descrizione || '-'}</td></tr>`;
    });

    html += `</tbody></table></div></div>`;
    totaleGenerale += totaleDipendente;
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

async function esportaPDFCommessa() {
  if (!commessaCorrenteDettaglio) {
    alert('❌ Nessuna commessa selezionata');
    return;
  }

  const commessa = dati.commesse.find(c => c.id === commessaCorrenteDettaglio);
  if (!commessa) return;

  const content = document.getElementById('dettaglio-commessa-output').innerHTML;

  if (!content || content.includes('Nessuna registrazione')) {
    alert('⚠️ Nessuna registrazione da esportare');
    return;
  }

  let infoFiltri = '';
  if (filtriCommessa.dataInizio || filtriCommessa.dataFine) {
    infoFiltri += `<p><strong>Periodo:</strong> `;
    if (filtriCommessa.dataInizio) infoFiltri += `dal ${filtriCommessa.dataInizio} `;
    if (filtriCommessa.dataFine) infoFiltri += `al ${filtriCommessa.dataFine}`;
    infoFiltri += `</p>`;
  }
  if (filtriCommessa.dipendenti.length > 0) {
    const nomiDip = filtriCommessa.dipendenti.map(u => {
      const ut = dati.utenti.find(x => x.username === u);
      return ut ? ut.nome + ' ' + ut.cognome : u;
    }).join(', ');
    infoFiltri += `<p><strong>Dipendenti:</strong> ${nomiDip}</p>`;
  }
  if (filtriCommessa.ricerca) {
    infoFiltri += `<p><strong>Ricerca:</strong> "${filtriCommessa.ricerca}"</p>`;
  }

  const logoHTML = document.querySelector('.logo-small') ?
    document.querySelector('.logo-small').outerHTML : '<h2 style="color:#00695C;">MEC-ROY srls</h2>';

  const dataCreazione = commessa.data_creazione ?
    new Date(commessa.data_creazione).toLocaleDateString('it-IT') : 'N/D';

  const fullHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Report Commessa - ${commessa.nome}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #00695C; color: white; font-weight: bold; }
        tr:nth-child(even) { background: #f9f9f9; }
        .header { text-align: center; padding: 10px 0; border-bottom: 3px solid #00695C; margin-bottom: 15px; }
        .header h2 { color: #00695C; margin: 5px 0; }
        .header h3 { color: #333; margin: 5px 0; }
        .info-filtri { background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 12px; }
        .footer { text-align: center; padding: 10px 0; border-top: 2px solid #ddd; margin-top: 15px; color: #888; font-size: 11px; }
        .logo-small { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
        .logo-small-img { max-height: 50px; }
        .azienda-small { font-weight: 700; color: #00695C; font-size: 20px; }
        .gruppo-dipendente-header { background: #00695C; color: white; padding: 8px 12px; border-radius: 6px 6px 0 0; }
        .subtotale { background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px; font-weight: bold; }
        .totale-generale { background: #fff3cd; border: 2px solid #ffc107; padding: 12px; text-align: center; font-weight: bold; border-radius: 8px; color: #856404; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoHTML}
        <h2>REPORT COMMESSA</h2>
        <h3>${commessa.nome}</h3>
        <p style="color:#888;font-size:12px;margin:5px 0;">Data creazione: ${dataCreazione}</p>
        <p style="color:#888;font-size:12px;margin:0;">Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'})}</p>
      </div>
      ${infoFiltri ? `<div class="info-filtri"><strong>🔍 Filtri applicati:</strong>${infoFiltri}</div>` : ''}
      <div style="margin-top:10px;">${content}</div>
      <div class="footer">MEC-ROY srls - Sistema di Gestione Lavoro<br>Documento generato automaticamente</div>
    </body>
    </html>
  `;

  await scaricaOCondividiFile(fullHTML, `Report_Commessa_${commessa.nome.replace(/\s+/g, '_')}`);
}

// ============================================
// MODALE DETTAGLIO DIPENDENTE (admin)
// ============================================
function apriDettaglioDipendente(username) {
  const utente = dati.utenti.find(u => u.username === username);
  if (!utente) {
    alert('❌ Dipendente non trovato');
    return;
  }

  dipendenteCorrenteDettaglio = username;

  const oggi = new Date();
  filtriDipendente = {
    vista: 'mese',
    giorno: oggi.toISOString().split('T')[0],
    mese: oggi.getMonth() + 1,
    anno: oggi.getFullYear()
  };

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

  if (vista === 'giorno') {
    const giorno = document.getElementById('filtro-giorno').value;
    filtriDipendente.giorno = giorno;

    if (!giorno) {
      output.innerHTML = '<p class="text-muted">Seleziona un giorno</p>';
      return;
    }

    const registrazioni = dati.registrazioni.filter(r =>
      r.utente_id === dipendenteCorrenteDettaglio && r.data === giorno
    );

    const richiesta = dati.richieste.find(r =>
      r.utente_id === dipendenteCorrenteDettaglio &&
      r.stato === 'approvata' &&
      r.data_inizio <= giorno && r.data_fine >= giorno
    );

    document.getElementById('dettaglio-dipendente-contatore').textContent =
      `📊 ${registrazioni.length} registrazioni`;

    if (registrazioni.length === 0 && !richiesta) {
      output.innerHTML = '<p class="text-muted">Nessuna registrazione per questo giorno.</p>';
      return;
    }

    const dataFormattata = new Date(giorno + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    let html = '';
    let totaleGiorno = 0;

    html += `<div class="gruppo-giorno"><div class="gruppo-giorno-header"><h4><i class="fas fa-calendar-day"></i> ${dataFormattata}</h4>`;

    if (richiesta) {
      const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒' };
      const tipo = richiesta.tipo.toUpperCase();
      html += `<span class="subtotale-giorno">${emoji[richiesta.tipo] || '📌'} ${tipo}</span></div>`;
      html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><tbody><tr class="riga-speciale ${richiesta.tipo}"><td><span class="icona-tipo">${emoji[richiesta.tipo] || '📌'}</span> <strong>${tipo}</strong>${richiesta.note ? ' - ' + richiesta.note : ''}</td></tr></tbody></table></div></div>`;
      output.innerHTML = html;
      return;
    }

    registrazioni.forEach(r => {
      if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
        const [h1, m1] = r.ora_inizio.split(':').map(Number);
        const [h2, m2] = r.ora_fine.split(':').map(Number);
        totaleGiorno += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
      }
    });

    html += `<span class="subtotale-giorno">${totaleGiorno.toFixed(2)}h</span></div>`;
    html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><thead><tr><th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;

    registrazioni.sort((a, b) => (a.ora_inizio || '').localeCompare(b.ora_inizio || ''));

    registrazioni.forEach(r => {
      const commessa = dati.commesse.find(c => c.id === r.commessa_id);
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
      const isStraordinario = r.straordinario ? ' ⭐' : '';
      const isRecupero = r.recupero ? ' ⏰' : '';

      html += `<tr><td><strong>${commessa?.nome || 'N/A'}</strong></td><td>${r.ora_inizio || '-'}</td><td>${r.ora_fine || '-'}</td><td><strong>${ore.toFixed(2)}h${isStraordinario}${isRecupero}</strong></td><td>${r.descrizione || '-'}</td></tr>`;
    });

    html += `</tbody></table></div></div>`;
    output.innerHTML = html;

  } else {
    const mese = parseInt(document.getElementById('filtro-mese').value);
    const anno = parseInt(document.getElementById('filtro-anno').value);

    filtriDipendente.mese = mese;
    filtriDipendente.anno = anno;

    if (!mese || !anno) {
      output.innerHTML = '<p class="text-muted">Seleziona mese e anno</p>';
      return;
    }

    const giorniMese = new Date(anno, mese, 0).getDate();
    const mesePadded = String(mese).padStart(2, '0');
    const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
      'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][mese-1];

    let html = '';
    let totaleMese = 0;
    let registrazioniTotali = 0;

    for (let g = 1; g <= giorniMese; g++) {
      const data = `${anno}-${mesePadded}-${String(g).padStart(2, '0')}`;
      const dataObj = new Date(data + 'T00:00:00');
      const giornoSett = dataObj.getDay();
      const isWeekend = giornoSett === 0 || giornoSett === 6;

      const registrazioni = dati.registrazioni.filter(r =>
        r.utente_id === dipendenteCorrenteDettaglio && r.data === data
      );

      const richiesta = dati.richieste.find(r =>
        r.utente_id === dipendenteCorrenteDettaglio &&
        r.stato === 'approvata' &&
        r.data_inizio <= data && r.data_fine >= data
      );

      if (isWeekend && registrazioni.length === 0 && !richiesta) continue;

      if (registrazioni.length === 0 && !richiesta && !isWeekend) {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        if (dataObj < oggi) {
          html += `<div class="gruppo-giorno"><div class="gruppo-giorno-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4><span class="subtotale-giorno">⬜ ASSENTE</span></div></div>`;
        }
        continue;
      }

      if (richiesta && registrazioni.length === 0) {
        const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
        const tipo = richiesta.tipo === 'recupero_ore' ? 'RECUPERO ORE' : richiesta.tipo.toUpperCase();
        const emojiChar = emoji[richiesta.tipo] || '📌';

        html += `<div class="gruppo-giorno"><div class="gruppo-giorno-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4><span class="subtotale-giorno">${emojiChar} ${tipo}</span></div><div class="table-wrapper" style="margin-top:0;border:none;"><table><tbody><tr class="riga-speciale ${richiesta.tipo}"><td><span class="icona-tipo">${emojiChar}</span> <strong>${tipo}</strong>${richiesta.note ? ' - ' + richiesta.note : ''}</td></tr></tbody></table></div></div>`;
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

      registrazioniTotali += registrazioni.length;
      totaleMese += totaleGiorno;

      html += `<div class="gruppo-giorno"><div class="gruppo-giorno-header"><h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4><span class="subtotale-giorno">${totaleGiorno.toFixed(2)}h</span></div>`;
      html += `<div class="table-wrapper" style="margin-top:0;border:none;"><table><thead><tr><th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;

      registrazioni.forEach(r => {
        const commessa = dati.commesse.find(c => c.id === r.commessa_id);
        const [h1, m1] = r.ora_inizio.split(':').map(Number);
        const [h2, m2] = r.ora_fine.split(':').map(Number);
        const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
        const isStraordinario = r.straordinario ? ' ⭐' : '';
        const isRecupero = r.recupero ? ' ⏰' : '';

        html += `<tr><td><strong>${commessa?.nome || 'N/A'}</strong></td><td>${r.ora_inizio || '-'}</td><td>${r.ora_fine || '-'}</td><td><strong>${ore.toFixed(2)}h${isStraordinario}${isRecupero}</strong></td><td>${r.descrizione || '-'}</td></tr>`;
      });

      html += `</tbody></table></div></div>`;
    }

    document.getElementById('dettaglio-dipendente-contatore').textContent =
      `📊 ${registrazioniTotali} registrazioni nel mese`;

    if (html === '') {
      output.innerHTML = '<p class="text-muted">Nessuna registrazione per questo mese.</p>';
      return;
    }

    const headerHTML = `
      <div class="dipendente-info-box">
        <h3><i class="fas fa-chart-bar"></i> Riepilogo ${meseNome} ${anno}</h3>
        <div class="info-dettagli">
          <span>📊 ${registrazioniTotali} registrazioni</span>
          <span>⏱️ Totale: ${totaleMese.toFixed(2)}h</span>
        </div>
      </div>
    `;

    output.innerHTML = headerHTML + html;
  }
}

function resetFiltriDipendente() {
  const oggi = new Date();
  filtriDipendente = {
    vista: 'mese',
    giorno: oggi.toISOString().split('T')[0],
    mese: oggi.getMonth() + 1,
    anno: oggi.getFullYear()
  };

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

async function esportaPDFDipendente() {
  if (!dipendenteCorrenteDettaglio) {
    alert('❌ Nessun dipendente selezionato');
    return;
  }

  const utente = dati.utenti.find(u => u.username === dipendenteCorrenteDettaglio);
  if (!utente) return;

  const content = document.getElementById('dettaglio-dipendente-output').innerHTML;

  if (!content || content.includes('Nessuna registrazione')) {
    alert('⚠️ Nessuna registrazione da esportare');
    return;
  }

  const logoHTML = document.querySelector('.logo-small') ?
    document.querySelector('.logo-small').outerHTML : '<h2 style="color:#00695C;">MEC-ROY srls</h2>';

  const vista = filtriDipendente.vista;
  let periodo = '';
  const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][filtriDipendente.mese - 1];

  if (vista === 'giorno') {
    periodo = new Date(filtriDipendente.giorno + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  } else {
    periodo = `${meseNome} ${filtriDipendente.anno}`;
  }

  const fullHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Report Dipendente - ${utente.nome} ${utente.cognome}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #00695C; color: white; font-weight: bold; }
        tr:nth-child(even) { background: #f9f9f9; }
        .header { text-align: center; padding: 10px 0; border-bottom: 3px solid #00695C; margin-bottom: 15px; }
        .header h2 { color: #00695C; margin: 5px 0; }
        .header h3 { color: #333; margin: 5px 0; }
        .footer { text-align: center; padding: 10px 0; border-top: 2px solid #ddd; margin-top: 15px; color: #888; font-size: 11px; }
        .logo-small { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
        .logo-small-img { max-height: 50px; }
        .azienda-small { font-weight: 700; color: #00695C; font-size: 20px; }
        .dipendente-info-box { background: #00695C; color: white; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
        .dipendente-info-box h3 { margin: 0 0 5px 0; color: white; }
        .gruppo-giorno { margin-bottom: 20px; page-break-inside: avoid; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
        .gruppo-giorno-header { background: #00695C; color: white; padding: 8px 12px; display: flex; justify-content: space-between; }
        .gruppo-giorno-header h4 { margin: 0; color: white; }
        .gruppo-giorno-header .subtotale-giorno { background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px; font-weight: bold; }
        .riga-speciale.ferie td { background: #E3F2FD; color: #0d47a1; text-align: center; font-weight: bold; padding: 15px; }
        .riga-speciale.permesso td { background: #FFF3E0; color: #e65100; text-align: center; font-weight: bold; padding: 15px; }
        .riga-speciale.malattia td { background: #FFEBEE; color: #b71c1c; text-align: center; font-weight: bold; padding: 15px; }
        .riga-speciale.assente td { background: #f5f5f5; color: #666; text-align: center; font-style: italic; padding: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoHTML}
        <h2>REPORT DIPENDENTE</h2>
        <h3>${utente.nome} ${utente.cognome}</h3>
        <p style="color:#888;font-size:12px;margin:5px 0;">Periodo: ${periodo}</p>
        <p style="color:#888;font-size:12px;margin:0;">Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'})}</p>
      </div>
      <div style="margin-top:10px;">${content}</div>
      <div class="footer">MEC-ROY srls - Sistema di Gestione Lavoro<br>Documento generato automaticamente</div>
    </body>
    </html>
  `;

  await scaricaOCondividiFile(fullHTML, `Report_${utente.nome}_${utente.cognome}`);
}

// ============================================
// MODALE BACKUP ZIP (admin)
// ============================================
function apriModalBackup() {
  if (utenteCorrente?.ruolo !== 'admin') {
    alert('Solo gli amministratori possono scaricare il backup');
    return;
  }
  document.getElementById('msg-backup').innerHTML = '';
  document.getElementById('modal-backup').classList.add('active');
}

function chiudiModalBackup() {
  document.getElementById('modal-backup').classList.remove('active');
}

async function eseguiBackup() {
  if (utenteCorrente?.ruolo !== 'admin') return;

  const tipo = document.querySelector('input[name="backup-tipo"]:checked')?.value || 'tutto';
  const msg = document.getElementById('msg-backup');

  msg.innerHTML = '<div class="info-msg">⏳ Generazione backup in corso...</div>';

  try {
    await new Promise(r => setTimeout(r, 100));

    const zip = new JSZip();
    const dataOggi = new Date().toISOString().split('T')[0];
    const nomeCartella = `MEC-ROY_Backup_${dataOggi}`;
    const root = zip.folder(nomeCartella);

    const stiliComuni = `<style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #00695C; color: white; }
      h1, h2 { color: #00695C; }
    </style>`;

    const headHTML = (titolo) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titolo}</title>${stiliComuni}</head><body>`;

    // Backup commesse ore
    if (tipo === 'tutto' || tipo === 'commesse') {
      const cartellaComm = root.folder('Commesse');

      for (const commessa of dati.commesse) {
        const registrazioni = dati.registrazioni.filter(r =>
          r.commessa_id === commessa.id && r.tipo === 'lavoro'
        );
        if (registrazioni.length === 0) continue;

        let htmlContent = headHTML(`Commessa ${commessa.nome}`);
        htmlContent += `<h1>${commessa.nome}</h1>`;
        htmlContent += `<table><thead><tr><th>Data</th><th>Dipendente</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>`;

        registrazioni.forEach(r => {
          const utente = dati.utenti.find(u => u.username === r.utente_id);
          const nomeDip = utente ? `${utente.nome} ${utente.cognome}` : r.utente_id;
          const [h1, m1] = r.ora_inizio.split(':').map(Number);
          const [h2, m2] = r.ora_fine.split(':').map(Number);
          const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);

          htmlContent += `<tr><td>${r.data}</td><td>${nomeDip}</td><td>${r.ora_inizio}</td><td>${r.ora_fine}</td><td>${ore.toFixed(2)}h</td><td>${r.descrizione || '-'}</td></tr>`;
        });

        htmlContent += `</tbody></table></body></html>`;

        const nomeFile = commessa.nome.replace(/[^a-zA-Z0-9_-]/g, '_');
        cartellaComm.file(`${nomeFile}.html`, htmlContent);
      }
    }

    msg.innerHTML = '<div class="info-msg">📦 Creazione ZIP in corso...</div>';

    const blob = await zip.generateAsync({ type: 'blob' });
    const nomeZip = `${nomeCartella}.zip`;

    const file = new File([blob], nomeZip, { type: 'application/zip' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nomeCartella, text: 'Backup MEC-ROY' });
        msg.innerHTML = '<div class="success">✅ Backup generato e condiviso!</div>';
        setTimeout(chiudiModalBackup, 1500);
        return;
      } catch (error) {
        if (error.name === 'AbortError') { msg.innerHTML = ''; return; }
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeZip;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    msg.innerHTML = '<div class="success">✅ Backup scaricato con successo!</div>';
    setTimeout(chiudiModalBackup, 1500);

  } catch (err) {
    console.error('❌ Errore backup:', err);
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

// ============================================
// NUMERI MANCANTI — apertura da login
// ============================================
function apriNumeriMancanti() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('main-page').style.display = 'block';

  document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  const tabNM = document.getElementById('tab-numeri-mancanti');
  if (tabNM) {
    tabNM.style.display = 'inline-block';
    tabNM.classList.add('active');
  }

  const panelNM = document.getElementById('panel-numeri-mancanti');
  if (panelNM) panelNM.classList.add('active');

  const btnLogout = document.querySelector('.btn-logout');
  if (btnLogout) {
    btnLogout.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    btnLogout.onclick = function() {
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

async function nmCaricaListaCommesse() {
  const div = document.getElementById('nm-lista-commesse');
  if (!div) return;

  div.innerHTML = '<p class="text-muted">⏳ Caricamento commesse...</p>';

  try {
    const snapshot = await nmGetCollection().orderBy('data_modifica', 'desc').get();

    if (snapshot.empty) {
      div.innerHTML = '<p class="text-muted">Nessuna commessa creata. Clicca "Crea Nuova Commessa" per iniziare.</p>';
      return;
    }

    let html = '<div class="nm-commesse-grid">';

    snapshot.forEach(doc => {
      const commessa = doc.data();
      const id = doc.id;

      let totNumeri = 0;
      if (commessa.cartelle) {
        Object.keys(commessa.cartelle).forEach(k => {
          if (Array.isArray(commessa.cartelle[k])) {
            totNumeri += commessa.cartelle[k].length;
          }
        });
      }

      const dataMod = commessa.data_modifica
        ? new Date(commessa.data_modifica).toLocaleDateString('it-IT', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          })
        : 'N/D';

      const isAdmin = utenteCorrente && utenteCorrente.ruolo === 'admin';

      html += `
        <div class="nm-commessa-card">
          <div class="nm-commessa-header" onclick="nmApriCommessa('${id}')">
            <i class="fas fa-folder"></i>
            <div class="nm-commessa-info">
              <div class="nm-commessa-codice">${commessa.codice || id}</div>
              <div class="nm-commessa-meta">${totNumeri} numeri · ${dataMod}</div>
            </div>
          </div>
          ${isAdmin ? `<button class="nm-btn-cancella-commessa" onclick="event.stopPropagation(); nmRichiediCancellazione('${id}')" title="Cancella commessa"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      `;
    });

    html += '</div>';
    div.innerHTML = html;

    snapshot.forEach(doc => {
      nmCommesseCache[doc.id] = doc.data();
    });

  } catch (err) {
    console.error('❌ Errore caricamento commesse:', err);
    div.innerHTML = '<p class="error">Errore nel caricamento: ' + err.message + '</p>';
  }
}

function nmApriCreaCommessa() {
  document.getElementById('nm-input-4cifre').value = '';
  document.getElementById('nm-input-6char').value = '';
  document.getElementById('nm-msg-crea-commessa').innerHTML = '';
  nmAggiornaPreview();
  document.getElementById('nm-modal-crea-commessa').classList.add('active');
  setTimeout(() => { document.getElementById('nm-input-4cifre').focus(); }, 200);
}

function nmChiudiCreaCommessa() {
  document.getElementById('nm-modal-crea-commessa').classList.remove('active');
}

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

  if (cifre.length !== 4) {
    msg.innerHTML = '<div class="error">❌ Inserisci esattamente 4 cifre</div>';
    return;
  }
  if (chars.length !== 6) {
    msg.innerHTML = '<div class="error">❌ Inserisci esattamente 6 caratteri</div>';
    return;
  }

  const codiceCompleto = 'CC' + cifre + '-A-' + chars;
  msg.innerHTML = '<div class="info-msg">⏳ Verifica...</div>';

  try {
    const doc = await nmGetCollection().doc(codiceCompleto).get();
    if (doc.exists) {
      msg.innerHTML = '<div class="error">❌ Esiste già una commessa con questo codice</div>';
      return;
    }

    const nuovaCommessa = {
      id: codiceCompleto,
      codice: codiceCompleto,
      data_creazione: new Date().toISOString(),
      data_modifica: new Date().toISOString(),
      cartelle: { filo: [], cavo: [], adesive: [], targhette: [], morsetti: [] }
    };

    await nmGetCollection().doc(codiceCompleto).set(nuovaCommessa);

    console.log('✅ Commessa creata:', codiceCompleto);
    msg.innerHTML = '<div class="success">✅ Commessa creata!</div>';

    setTimeout(() => {
      nmChiudiCreaCommessa();
      nmCaricaListaCommesse();
    }, 800);

  } catch (err) {
    console.error('❌ Errore creazione commessa:', err);
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

function nmApriCommessa(idCommessa) {
  nmCommessaCorrente = idCommessa;
  const titolo = document.getElementById('nm-commessa-corrente-titolo');
  if (titolo) titolo.textContent = idCommessa;
  nmAggiornaConteggiCartelle();
  nmMostraSchermataCartelle();
}

async function nmAggiornaConteggiCartelle() {
  if (!nmCommessaCorrente) return;

  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) return;

    const commessa = doc.data();
    const cartelle = commessa.cartelle || {};

    ['filo', 'cavo', 'adesive', 'targhette', 'morsetti'].forEach(tipo => {
      const count = (cartelle[tipo] || []).length;
      const el = document.getElementById('nm-count-' + tipo);
      if (el) el.textContent = count;
    });

  } catch (err) {
    console.error('❌ Errore conteggi:', err);
  }
}

function nmTornaAlleCommesse() {
  nmCommessaCorrente = null;
  nmCartellaCorrente = null;
  nmMostraSchermataCommesse();
  nmCaricaListaCommesse();
}

async function nmApriCartella(tipo) {
  if (!nmCommessaCorrente) return;

  nmCartellaCorrente = tipo;

  document.getElementById('nm-popup-titolo').textContent = NM_CARTELLE_LABEL[tipo];

  // Mostra/nascondi i 2 tipi di input in base alla cartella
  const inputSingolo = document.getElementById('nm-input-singolo');
  const inputDoppio = document.getElementById('nm-input-doppio');

  if (tipo === 'cavo') {
    // CAVO → mostra doppio input
    inputSingolo.style.display = 'none';
    inputDoppio.style.display = 'flex';
    document.getElementById('nm-cavo-sinistra').value = '';
    document.getElementById('nm-cavo-destra').value = '';
  } else {
    // Altre cartelle → input singolo
    inputSingolo.style.display = 'flex';
    inputDoppio.style.display = 'none';
    document.getElementById('nm-input-numero').value = '';
  }

  document.getElementById('nm-modal-popup').classList.add('active');

  await nmCaricaNumeriCartella();

  setTimeout(() => {
    if (tipo === 'cavo') {
      document.getElementById('nm-cavo-sinistra').focus();
    } else {
      document.getElementById('nm-input-numero').focus();
    }
  }, 200);
}

function nmChiudiPopup() {
  document.getElementById('nm-modal-popup').classList.remove('active');
  nmCartellaCorrente = null;
  nmAggiornaConteggiCartelle();
}

async function nmCaricaNumeriCartella() {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;

  const div = document.getElementById('nm-lista-numeri');
  div.innerHTML = '<p class="text-muted">⏳ Caricamento...</p>';

  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) {
      div.innerHTML = '<p class="error">Commessa non trovata</p>';
      return;
    }

    const commessa = doc.data();
    const numeri = (commessa.cartelle && commessa.cartelle[nmCartellaCorrente]) || [];

    if (numeri.length === 0) {
      div.innerHTML = '<p class="text-muted">Nessun numero inserito</p>';
      return;
    }

    let html = '';
    numeri.forEach((numero) => {
      html += `
        <div class="nm-numero-item" data-id="${numero.id}">
          <span class="nm-numero-testo">- ${nmEscapaHtml(numero.testo)}</span>
          <div class="nm-numero-azioni">
            <button class="nm-btn-azione nm-btn-modifica" onclick="nmModificaNumero('${numero.id}')" title="Modifica"><i class="fas fa-edit"></i></button>
            <button class="nm-btn-azione nm-btn-cancella" onclick="nmCancellaNumero('${numero.id}')" title="Cancella"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    });

    div.innerHTML = html;

  } catch (err) {
    console.error('❌ Errore caricamento numeri:', err);
    div.innerHTML = '<p class="error">Errore: ' + err.message + '</p>';
  }
}

async function nmAggiungiNumero() {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;

  let testo = '';

  if (nmCartellaCorrente === 'cavo') {
    // CAVO → leggi dalle 2 caselle
    const sinistraInput = document.getElementById('nm-cavo-sinistra');
    const destraInput = document.getElementById('nm-cavo-destra');
    const sinistra = sinistraInput.value.trim().toUpperCase();
    const destra = destraInput.value.trim().toUpperCase();

    if (!sinistra && !destra) {
      alert('⚠️ Compila entrambe le caselle');
      sinistraInput.focus();
      return;
    }

    if (!sinistra) {
      alert('⚠️ Compila la casella sinistra');
      sinistraInput.focus();
      return;
    }

    if (!destra) {
      alert('⚠️ Compila la casella destra');
      destraInput.focus();
      return;
    }

    testo = '-' + sinistra + '/-' + destra;

  } else {
    // Altre cartelle → 1 casella
    const input = document.getElementById('nm-input-numero');
    testo = input.value.trim().toUpperCase();

    if (!testo) { input.focus(); return; }
  }

  try {
    const docRef = nmGetCollection().doc(nmCommessaCorrente);
    const doc = await docRef.get();
    if (!doc.exists) { alert('❌ Commessa non trovata'); return; }

    const commessa = doc.data();
    if (!commessa.cartelle) commessa.cartelle = {};
    if (!Array.isArray(commessa.cartelle[nmCartellaCorrente])) {
      commessa.cartelle[nmCartellaCorrente] = [];
    }

    const nuovoNumero = {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      testo: testo,
      ordine: commessa.cartelle[nmCartellaCorrente].length,
      data_aggiunta: new Date().toISOString()
    };

    commessa.cartelle[nmCartellaCorrente].push(nuovoNumero);
    commessa.data_modifica = new Date().toISOString();

    await docRef.set(commessa);

    // Svuota gli input corretti
    if (nmCartellaCorrente === 'cavo') {
      document.getElementById('nm-cavo-sinistra').value = '';
      document.getElementById('nm-cavo-destra').value = '';
      document.getElementById('nm-cavo-sinistra').focus();
    } else {
      document.getElementById('nm-input-numero').value = '';
      document.getElementById('nm-input-numero').focus();
    }

    await nmCaricaNumeriCartella();
    console.log('✅ Numero aggiunto:', testo);

  } catch (err) {
    console.error('❌ Errore aggiunta numero:', err);
    alert('❌ Errore: ' + err.message);
  }
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
      // CAVO → prompt separato per sinistra e destra
      // Estrai i 2 pezzi dal testo attuale
      // Formato attuale: -SINISTRA/-DESTRA
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
      // Altre cartelle → prompt singolo
      const nuovo = prompt('Modifica il numero:', numero.testo);
      if (nuovo === null) return;
      if (!nuovo.trim()) { alert('❌ Il numero non può essere vuoto'); return; }

      nuovoTesto = nuovo.trim().toUpperCase();
    }

    numero.testo = nuovoTesto;
    commessa.data_modifica = new Date().toISOString();

    await docRef.set(commessa);
    await nmCaricaNumeriCartella();
    console.log('✅ Numero modificato:', nuovoTesto);

  } catch (err) {
    console.error('❌ Errore modifica:', err);
    alert('❌ Errore: ' + err.message);
  }
}
async function nmCancellaNumero(idNumero) {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;
  if (!confirm('Cancellare questo numero?')) return;

  try {
    const docRef = nmGetCollection().doc(nmCommessaCorrente);
    const doc = await docRef.get();
    if (!doc.exists) return;

    const commessa = doc.data();
    commessa.cartelle[nmCartellaCorrente] = (commessa.cartelle[nmCartellaCorrente] || [])
      .filter(n => n.id !== idNumero);
    commessa.data_modifica = new Date().toISOString();

    await docRef.set(commessa);
    await nmCaricaNumeriCartella();
    console.log('✅ Numero cancellato');

  } catch (err) {
    console.error('❌ Errore cancellazione:', err);
    alert('❌ Errore: ' + err.message);
  }
}

async function nmCondividiCartella() {
  if (!nmCommessaCorrente || !nmCartellaCorrente) return;

  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) return;

    const commessa = doc.data();
    const numeri = (commessa.cartelle && commessa.cartelle[nmCartellaCorrente]) || [];

    if (numeri.length === 0) {
      alert('⚠️ Nessun numero da condividere');
      return;
    }

    const numColonne = NM_CARTELLE_COLONNE[nmCartellaCorrente] || 3;
    const righePerColonna = 38;

    let colonneHTML = '';
    for (let c = 0; c < numColonne; c++) {
      const start = c * righePerColonna;
      const end = start + righePerColonna;
      const numeriColonna = numeri.slice(start, end);

      colonneHTML += '<div class="a4-colonna">';
      if (numeriColonna.length === 0) {
        colonneHTML += '&nbsp;';
      } else {
        numeriColonna.forEach(num => {
          colonneHTML += `<div class="a4-riga">- ${nmEscapaHtml(num.testo)}</div>`;
        });
      }
      colonneHTML += '</div>';
    }

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>${commessa.codice} - ${NM_CARTELLE_LABEL[nmCartellaCorrente]}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: white; padding: 0; }
          .a4-foglio { width: 21cm; height: 29.7cm; padding: 1.5cm 1cm; margin: 0 auto; background: white; display: flex; flex-direction: column; }
          .a4-header { text-align: center; padding-bottom: 0.5cm; border-bottom: 2px solid #00695C; margin-bottom: 0.8cm; }
          .a4-header h1 { font-size: 16pt; color: #00695C; margin-bottom: 0.3cm; }
          .a4-header .a4-sottotitolo { font-size: 11pt; color: #555; }
          .a4-header .a4-data { font-size: 9pt; color: #888; margin-top: 0.2cm; }
          .a4-colonne { display: flex; gap: 0.5cm; flex: 1; overflow: hidden; }
          .a4-colonna { flex: 1; border-right: 1px dashed #ddd; padding-right: 0.4cm; min-height: 0; overflow: hidden; }
          .a4-colonna:last-child { border-right: none; }
          .a4-riga { font-size: 13pt; line-height: 1.6; color: #222; padding: 1px 0; word-wrap: break-word; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          @media print { .a4-foglio { margin: 0; padding: 1.5cm 1cm; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="a4-foglio">
          <div class="a4-header">
            <h1>${commessa.codice} - ${NM_CARTELLE_LABEL[nmCartellaCorrente]}</h1>
            <div class="a4-sottotitolo">MEC-ROY srls - Numeri Mancanti</div>
            <div class="a4-data">Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}</div>
          </div>
          <div class="a4-colonne">${colonneHTML}</div>
        </div>
      </body>
      </html>
    `;

    const nomeFile = `${commessa.codice}_${NM_CARTELLE_LABEL[nmCartellaCorrente]}`.replace(/\s+/g, '_');
    await scaricaOCondividiFile(html, nomeFile);

  } catch (err) {
    console.error('❌ Errore condivisione:', err);
    alert('❌ Errore: ' + err.message);
  }
}

async function nmCondividiTuttaCommessa() {
  if (!nmCommessaCorrente) { alert('⚠️ Nessuna commessa selezionata'); return; }

  try {
    const doc = await nmGetCollection().doc(nmCommessaCorrente).get();
    if (!doc.exists) { alert('❌ Commessa non trovata'); return; }

    const commessa = doc.data();
    const cartelle = commessa.cartelle || {};

    const ordine = ['filo', 'cavo', 'adesive', 'targhette', 'morsetti'];
    const cartelleDaStampare = [];

    ordine.forEach(tipo => {
      const numeri = cartelle[tipo] || [];
      if (numeri.length > 0) {
        cartelleDaStampare.push({ tipo, numeri });
      }
    });

    if (cartelleDaStampare.length === 0) {
      alert('⚠️ Nessun numero inserito in questa commessa');
      return;
    }

    let sezioniHTML = '';

    cartelleDaStampare.forEach((cartella) => {
      const tipo = cartella.tipo;
      const numeri = cartella.numeri;
      const label = NM_CARTELLE_LABEL[tipo];
      const numColonne = NM_CARTELLE_COLONNE[tipo] || 3;
      const righePerColonna = 38;

      let colonneHTML = '';
      for (let c = 0; c < numColonne; c++) {
        const start = c * righePerColonna;
        const end = start + righePerColonna;
        const numeriColonna = numeri.slice(start, end);

        colonneHTML += '<div class="a4-colonna">';
        if (numeriColonna.length === 0) {
          colonneHTML += '&nbsp;';
        } else {
          numeriColonna.forEach(num => {
            colonneHTML += `<div class="a4-riga">- ${nmEscapaHtml(num.testo)}</div>`;
          });
        }
        colonneHTML += '</div>';
      }

      sezioniHTML += `
        <div class="a4-sezione">
          <div class="a4-sezione-header">
            <h2>${nmEscapaHtml(label)}</h2>
            <span class="a4-sezione-count">${numeri.length} numeri</span>
          </div>
          <div class="a4-colonne">${colonneHTML}</div>
        </div>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>${commessa.codice} - Numeri Mancanti</title>
        <style>
          @page { size: A4 portrait; margin: 1.5cm 1cm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: white; padding: 0; }
          .a4-foglio { width: 21cm; min-height: 29.7cm; padding: 1.5cm 1cm; margin: 0 auto; background: white; }
          .a4-header { text-align: center; padding-bottom: 0.5cm; border-bottom: 2px solid #00695C; margin-bottom: 1cm; }
          .a4-header h1 { font-size: 16pt; color: #00695C; margin-bottom: 0.3cm; }
          .a4-header .a4-sottotitolo { font-size: 11pt; color: #555; }
          .a4-header .a4-data { font-size: 9pt; color: #888; margin-top: 0.2cm; }
          .a4-sezione { margin-bottom: 1cm; page-break-inside: avoid; }
          .a4-sezione-header { display: flex; justify-content: space-between; align-items: center; background: #00695C; color: white; padding: 8px 14px; border-radius: 6px 6px 0 0; margin-bottom: 0.4cm; }
          .a4-sezione-header h2 { font-size: 13pt; color: white; margin: 0; letter-spacing: 0.5px; }
          .a4-sezione-count { font-size: 10pt; background: rgba(255,255,255,0.25); padding: 2px 10px; border-radius: 10px; }
          .a4-colonne { display: flex; gap: 0.5cm; }
          .a4-colonna { flex: 1; border-right: 1px dashed #ddd; padding-right: 0.4cm; min-height: 0; }
          .a4-colonna:last-child { border-right: none; }
          .a4-riga { font-size: 12pt; line-height: 1.5; color: #222; padding: 1px 0; word-wrap: break-word; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          @media print { .a4-foglio { margin: 0; padding: 1.5cm 1cm; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="a4-foglio">
          <div class="a4-header">
            <h1>${commessa.codice} - Numeri Mancanti</h1>
            <div class="a4-sottotitolo">MEC-ROY srls</div>
            <div class="a4-data">Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}</div>
          </div>
          ${sezioniHTML}
        </div>
      </body>
      </html>
    `;

    const nomeFile = `${commessa.codice}_Numeri_Mancanti`;
    await scaricaOCondividiFile(html, nomeFile);

  } catch (err) {
    console.error('❌ Errore condivisione commessa:', err);
    alert('❌ Errore: ' + err.message);
  }
}

function nmRichiediCancellazione(idCommessa) {
  if (!utenteCorrente || utenteCorrente.ruolo !== 'admin') {
    alert('❌ Non sei autorizzato.\n\nSolo un amministratore può cancellare una commessa.');
    return;
  }

  nmCommessaDaCancellare = idCommessa;
  document.getElementById('nm-admin-password').value = '';
  document.getElementById('nm-msg-admin').innerHTML = '';
  document.getElementById('nm-modal-admin').classList.add('active');

  setTimeout(() => {
    document.getElementById('nm-admin-password').focus();
  }, 200);
}

function nmChiudiAdmin() {
  document.getElementById('nm-modal-admin').classList.remove('active');
  nmCommessaDaCancellare = null;
}

async function nmConfermaCancellazione() {
  if (!nmCommessaDaCancellare) return;

  const password = document.getElementById('nm-admin-password').value;
  const msg = document.getElementById('nm-msg-admin');

  if (!password) {
    msg.innerHTML = '<div class="error">Inserisci la password</div>';
    return;
  }

  if (!utenteCorrente || utenteCorrente.ruolo !== 'admin') {
    msg.innerHTML = '<div class="error">❌ Non sei autorizzato</div>';
    return;
  }

  if (utenteCorrente.password !== password) {
    msg.innerHTML = '<div class="error">❌ Password errata</div>';
    return;
  }

  msg.innerHTML = '<div class="info-msg">⏳ Cancellazione...</div>';

  try {
    await nmGetCollection().doc(nmCommessaDaCancellare).delete();
    console.log('✅ Commessa cancellata:', nmCommessaDaCancellare);

    msg.innerHTML = '<div class="success">✅ Commessa cancellata!</div>';

    setTimeout(() => {
      nmChiudiAdmin();
      nmCaricaListaCommesse();
    }, 800);

  } catch (err) {
    console.error('❌ Errore cancellazione commessa:', err);
    msg.innerHTML = '<div class="error">❌ Errore: ' + err.message + '</div>';
  }
}

function nmEscapaHtml(testo) {
  if (!testo) return '';
  return String(testo)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// APPROVA / RIFIUTA RICHIESTA
// ============================================
async function approvaRichiesta(id) {
  try {
    const datiFreschi = await caricaDaFirestore();
    if (datiFreschi) {
      dati = datiFreschi;
      if (!dati.utenti) dati.utenti = [];
      if (!dati.registrazioni) dati.registrazioni = [];
      if (!dati.richieste) dati.richieste = [];
      if (!dati.notifiche) dati.notifiche = [];
    }
  } catch (e) {
    console.warn('⚠️ Impossibile rileggere Firestore:', e);
  }

  const richiesta = dati.richieste.find(r => r.id === id);
  if (!richiesta) { alert('❌ Richiesta non trovata'); return; }

  if (richiesta.stato !== 'pending') {
    alert('⚠️ Questa richiesta è già stata processata.');
    return;
  }

  richiesta.stato = 'approvata';

  if (isWeekendOggi()) {
    console.log('📵 Weekend: notifica push approvazione NON inviata');
  } else {
    try {
      await db.collection('richieste_trigger').add({
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
    } catch (err) {
      console.warn('⚠️ Errore trigger approvazione:', err);
    }
  }

  const utenteIdCorretto = richiesta.utente_id;

  if (richiesta.tipo === 'recupero_ore') {
    const [h1, m1] = richiesta.ora_inizio.split(':').map(Number);
    const [h2, m2] = richiesta.ora_fine.split(':').map(Number);
    let oreLavorate = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;

    if (oreLavorate <= 0 || oreLavorate > 12) {
      alert('❌ ERRORE DATI: Orario non valido.');
      richiesta.stato = 'pending';
      return;
    }

    const ferieEsistenti = dati.registrazioni.filter(r =>
      r.utente_id === utenteIdCorretto && r.data === richiesta.data && r.tipo === 'ferie'
    );

    const oreEsistenti = dati.registrazioni.filter(r =>
      r.utente_id === utenteIdCorretto &&
      r.data === richiesta.data &&
      r.tipo === 'lavoro' &&
      r.ora_inizio && r.ora_fine &&
      !(richiesta.ora_fine <= r.ora_inizio || richiesta.ora_inizio >= r.ora_fine)
    );
    if (oreEsistenti.length > 0) {
      alert('❌ Impossibile approvare: ci sono già ore registrate in questa fascia.');
      richiesta.stato = 'pending';
      return;
    }

    if (ferieEsistenti.length > 0) {
      const conferma = confirm('⚠️ Il dipendente ha FERIE il ' + richiesta.data + '.\n\nApprovare?');
      if (!conferma) { richiesta.stato = 'pending'; return; }

      dati.registrazioni = dati.registrazioni.filter(r =>
        !(r.utente_id === utenteIdCorretto && r.data === richiesta.data && r.tipo === 'ferie')
      );

      const orePermesso = 8 - oreLavorate;
      if (orePermesso > 0) {
        const hInizio = parseInt(richiesta.ora_inizio.split(':')[0]);
        let permessoInizio, permessoFine;
        if (hInizio < 12) {
          permessoInizio = '13:00';
          permessoFine = String(13 + orePermesso).padStart(2, '0') + ':00';
        } else {
          permessoInizio = '08:00';
          permessoFine = String(8 + orePermesso).padStart(2, '0') + ':00';
        }
        dati.registrazioni.push({
          id: prossimoId++, utente_id: utenteIdCorretto, commessa_id: null,
          data: richiesta.data, ora_inizio: permessoInizio, ora_fine: permessoFine,
          descrizione: 'Permesso (per recupero ore)', tipo: 'permesso', ore: orePermesso
        });
      }
    }

    dati.registrazioni.push({
      id: prossimoId++, utente_id: utenteIdCorretto,
      commessa_id: richiesta.commessa_id || null, data: richiesta.data,
      ora_inizio: richiesta.ora_inizio, ora_fine: richiesta.ora_fine,
      descrizione: richiesta.descrizione_lavoro || 'Recupero ore',
      tipo: 'lavoro', recupero: true, ore: oreLavorate
    });

    aggiungiNotifica(utenteIdCorretto, 'recupero_approvato',
      '✅ Le tue ore del ' + richiesta.data + ' sono state APPROVATE!', '#');

  } else {
    dati.registrazioni.push({
      id: prossimoId++, utente_id: utenteIdCorretto, commessa_id: null,
      data: richiesta.data_inizio, ora_inizio: '00:00', ora_fine: '00:00',
      descrizione: richiesta.tipo + ' (approvata)', tipo: richiesta.tipo, richiesta_id: richiesta.id
    });

    if (richiesta.data_inizio !== richiesta.data_fine) {
      let dataCorrente = new Date(richiesta.data_inizio);
      const dataFine = new Date(richiesta.data_fine);
      while (dataCorrente < dataFine) {
        dataCorrente.setDate(dataCorrente.getDate() + 1);
        const dataStr = dataCorrente.toISOString().split('T')[0];
        dati.registrazioni.push({
          id: prossimoId++, utente_id: utenteIdCorretto, commessa_id: null,
          data: dataStr, ora_inizio: '00:00', ora_fine: '00:00',
          descrizione: richiesta.tipo + ' (approvata)', tipo: richiesta.tipo, richiesta_id: richiesta.id
        });
      }
    }

    const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
    aggiungiNotifica(utenteIdCorretto, 'approvazione',
      emoji[richiesta.tipo] + ' Richiesta APPROVATA ✅', '#');
  }

  await salvaDati();
  caricaRichiesteAdmin();
  aggiornaBadgeRichieste();
  caricaRichiesteDipendente();
  aggiornaBadgeNotifiche();
  alert('✅ Richiesta approvata!');
}

async function rifiutaRichiesta(id) {
  try {
    const datiFreschi = await caricaDaFirestore();
    if (datiFreschi) {
      dati = datiFreschi;
      if (!dati.richieste) dati.richieste = [];
    }
  } catch (e) {
    console.warn('⚠️ Impossibile rileggere Firestore:', e);
  }

  const richiesta = dati.richieste.find(r => r.id === id);
  if (!richiesta) { alert('❌ Richiesta non trovata'); return; }

  richiesta.stato = 'rifiutata';

  if (isWeekendOggi()) {
    console.log('📵 Weekend: notifica push rifiuto NON inviata');
  } else {
    try {
      await db.collection('richieste_trigger').add({
        richiesta_id: richiesta.id,
        utente_id: richiesta.utente_id,
        tipo: richiesta.tipo,
        azione: 'rifiutata',
        data_inizio: richiesta.data_inizio || null,
        data_fine: richiesta.data_fine || null,
        data: richiesta.data || null,
        ora_inizio: richiesta.ora_inizio || null,
        ora_fine: richiesta.ora_fine || null,
        creato_il: new Date().toISOString()
      });
    } catch (err) {
      console.warn('⚠️ Errore trigger rifiuto:', err);
    }
  }

  const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
  aggiungiNotifica(richiesta.utente_id, 'rifiuto',
    emoji[richiesta.tipo] + ' La tua richiesta è stata RIFIUTATA ❌', '#');

  await salvaDati();
  caricaRichiesteAdmin();
  aggiornaBadgeRichieste();
  caricaRichiesteDipendente();
  aggiornaBadgeNotifiche();
  alert('❌ Richiesta rifiutata.');
}

// ============================================
// SESSIONI
// ============================================
function salvaSessione(username) {
  if (!username) return;
  localStorage.setItem('utente_loggato', username);
}

function cancellaSessione() {
  localStorage.removeItem('utente_loggato');
}

function leggiSessione() {
  return localStorage.getItem('utente_loggato');
}

function caricaCredenzialiSalvate() {
  const ricordamiAttivo = localStorage.getItem('ricordami_attivo');
  if (ricordamiAttivo === 'true') {
    const username = localStorage.getItem('ricordami_username');
    const password = localStorage.getItem('ricordami_password');
    if (username && password) {
      document.getElementById('username').value = username;
      document.getElementById('password').value = password;
      document.getElementById('ricordami').checked = true;
      setTimeout(() => { document.querySelector('.login-box button').focus(); }, 100);
    }
  }
}

function logout() {
  cancellaSessione();
  utenteCorrente = null;

  if (_unsubscribeSnapshot) {
    _unsubscribeSnapshot();
    _unsubscribeSnapshot = null;
    console.log('⏹️ Ascolto realtime fermato');
  }

  const menuC = document.getElementById('commesse-menu');
  const aggC  = document.getElementById('commesse-aggiungi');
  const anaC  = document.getElementById('commesse-analizza');
  if (menuC) menuC.style.display = 'block';
  if (aggC)  aggC.style.display  = 'none';
  if (anaC)  anaC.style.display  = 'none';

  document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));

  document.getElementById('login-page').style.display = 'block';
  document.getElementById('main-page').style.display = 'none';

  caricaCredenzialiSalvate();

  if (localStorage.getItem('ricordami_attivo') !== 'true') {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  }
}

// ============================================
// HELPER: Scarica o Condividi file
// ============================================
async function scaricaOCondividiFile(htmlContent, fileNameBase) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const fileName = `${fileNameBase}_${new Date().toISOString().split('T')[0]}.html`;
  const file = new File([blob], fileName, { type: 'text/html' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileNameBase, text: 'Report MEC-ROY' });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.warn('Condivisione non disponibile, uso download...', error);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    alert('📄 File scaricato!\n\nSu telefono:\n1. Apri il file "Download" o "File"\n2. Tocca il file appena scaricato\n3. Usa "Stampa" o "Condividi" per salvarlo come PDF');
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
    const tentativo = ore + cifra;
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
      const oreNum = parseInt(tentativo, 10);
      if (oreNum >= 0 && oreNum <= 24) {
        let oreFinali;
        if (oreNum === 24) oreFinali = '24';
        else oreFinali = tentativo.padStart(2, '0');
        input.dataset.smartOre = oreFinali;
        input.dataset.smartPhase = 'minuti';
        input.value = oreFinali + ':';
        return;
      }
    }
  }

  if (fase === 'minuti') {
    const tentativo = minuti + cifra;
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
      const minNum = parseInt(tentativo, 10);
      if (minNum >= 0 && minNum <= 59) {
        const minFinali = tentativo.padStart(2, '0');
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
      if (ore.length > 0) {
        ore = ore.slice(0, -1);
        input.dataset.smartOre = ore;
      }
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
  const id = input.id;
  const def = SMART_TIME_DEFS[id];
  if (def && def.next) {
    const next = document.getElementById(def.next);
    if (next) {
      setTimeout(() => {
        next.focus();
        if (typeof next.select === 'function') next.select();
      }, 50);
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
    const swReg = await navigator.serviceWorker.register(
      './firebase-messaging-sw.js',
      { scope: './firebase-cloud-messaging-push-scope' }
    );

    await navigator.serviceWorker.ready;

    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (!token) return;

    console.log('✅ Token FCM ottenuto:', token);
    window._tokenFCMDebug = token;

    const utente = dati.utenti.find(u => u.username === utenteCorrente.username);
    if (!utente) return;
    if (utente.token_fcm === token) return;

    utente.token_fcm = token;
    await salvaDati();
    console.log('✅ Token FCM salvato');

  } catch (err) {
    console.error('❌ Errore getToken:', err);
  }
}

async function ascoltaRinnovoToken() {
  if (!utenteCorrente) return;
  try {
    const messaging = firebase.messaging();
    messaging.onTokenRefresh(async () => {
      await chiediPermessoNotifiche();
    });
  } catch (err) {}
}

// ============================================
// AVVIO + CLICK FUORI MODALI
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  caricaCredenzialiSalvate();

  caricaDati().then(() => {
    const adesso = new Date();
    document.getElementById('cal-mese').value = adesso.getMonth() + 1;
    document.getElementById('cal-anno').value = adesso.getFullYear();

    const usernameSalvato = leggiSessione();
    if (usernameSalvato) {
      const utente = dati.utenti.find(u => u.username === usernameSalvato);
      if (utente) {
        utenteCorrente = utente;
        document.getElementById('username').value = utente.username;

        document.getElementById('login-page').style.display = 'none';
        document.getElementById('main-page').style.display = 'block';
        document.getElementById('errore').style.display = 'none';

        document.getElementById('user-nome').textContent = utente.nome + ' ' + utente.cognome;
        const ruoloBadge = document.getElementById('user-ruolo');
        ruoloBadge.textContent = utente.ruolo;
        ruoloBadge.className = 'badge ' + utente.ruolo;

        if (utente.ruolo === 'admin') {
          document.getElementById('tab-registra').style.display = 'none';
          document.getElementById('tab-richiedi').style.display = 'none';
          document.getElementById('tab-modifica').style.display = 'inline-block';
          document.getElementById('tab-richieste').style.display = 'inline-block';
          document.getElementById('tab-commesse').style.display = 'inline-block';
          document.getElementById('tab-dipendenti').style.display = 'inline-block';
          document.getElementById('tab-calendario').style.display = 'inline-block';
          document.getElementById('tab-numeri-mancanti').style.display = 'inline-block';
          document.getElementById('cal-filtro-dipendente').style.display = 'block';
          document.getElementById('btn-password').style.display = 'flex';
          document.getElementById('azienda-container').style.display = 'inline-block';
          document.getElementById('cal-vista-selector').style.display = 'none';

          caricaSelectAziende();
          caricaSelectAziendeCommesse();
          caricaSelectDipendentiModifica();
          caricaSelectDipendentiCalendario();
          caricaRichiesteAdmin();
          caricaListaDipendenti();
          aggiornaBadgeRichieste();
          showTab('modifica');
        } else {
          document.getElementById('tab-registra').style.display = 'inline-block';
          document.getElementById('tab-richiedi').style.display = 'inline-block';
          document.getElementById('tab-modifica').style.display = 'none';
          document.getElementById('tab-richieste').style.display = 'none';
          document.getElementById('tab-commesse').style.display = 'none';
          document.getElementById('tab-dipendenti').style.display = 'none';
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

        const oggi = new Date().toISOString().split('T')[0];
        const dataReg = document.getElementById('data-reg');
        dataReg.value = oggi;
        dataReg.disabled = true;
        dataReg.style.backgroundColor = '#f0f0f0';
        dataReg.style.cursor = 'not-allowed';

        document.getElementById('richiesta-data-inizio').value = oggi;
        document.getElementById('richiesta-data-fine').value = oggi;
        document.getElementById('modifica-data').value = oggi;
        document.getElementById('recupero-data').value = oggi;

        caricaSelectRecuperoCommesse();

        document.getElementById('tipo-richiesta').addEventListener('change', function() {
          const tipo = this.value;
          document.getElementById('gruppo-certificato').style.display = tipo === 'malattia' ? 'block' : 'none';
          document.getElementById('gruppo-recupero').style.display = tipo === 'recupero_ore' ? 'block' : 'none';
          document.getElementById('campi-standard').style.display = (tipo === 'recupero_ore') ? 'none' : 'block';

          const mostraOrari = (tipo === 'ferie' || tipo === 'permesso');
          document.getElementById('riga-orari-opzionali').style.display = mostraOrari ? 'flex' : 'none';
          document.getElementById('hint-orari-opzionali').style.display = mostraOrari ? 'block' : 'none';
        });

        if (utente.ruolo === 'dipendente') {
          const oraInizio = document.getElementById('ora-inizio');
          const ora = new Date();
          const oraCorrente = ora.getHours().toString().padStart(2, '0') + ':00';
          oraInizio.value = oraCorrente;

          document.getElementById('straordinario').addEventListener('change', function() {
            const oraInizio = document.getElementById('ora-inizio');
            if (this.checked) {
              oraInizio.disabled = false;
              oraInizio.style.backgroundColor = 'white';
              oraInizio.style.cursor = 'text';
            } else {
              caricaUltimaRegistrazione();
            }
          });

          caricaUltimaRegistrazione();
        }

        caricaSelectCommesse();
        caricaListaCommesse();
        caricaRichiesteDipendente();
        caricaSelectDipendentiModifica();
        caricaSelectDipendentiCalendario();

        ['ora-inizio', 'ora-fine', 'recupero-ora-inizio', 'recupero-ora-fine', 'richiesta-ora-inizio', 'richiesta-ora-fine'].forEach(id => {
          const el = document.getElementById(id);
          if (el) initSmartTime(el);
        });

        attivaAscoltoRealtime();
        return;
      } else {
        cancellaSessione();
      }
    }

    document.getElementById('login-page').style.display = 'block';
    document.getElementById('main-page').style.display = 'none';
  }).catch((err) => {
    console.error('❌ Errore caricamento dati:', err);
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('main-page').style.display = 'none';
  });

  // Input listener Numeri Mancanti
  const input4 = document.getElementById('nm-input-4cifre');
  const input6 = document.getElementById('nm-input-6char');

  if (input4) {
    input4.addEventListener('input', function() {
      this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
      nmAggiornaPreview();
      if (this.value.length === 4) {
        document.getElementById('nm-input-6char').focus();
      }
    });
    input4.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.value.length === 4) document.getElementById('nm-input-6char').focus();
      }
    });
  }

  if (input6) {
    input6.addEventListener('input', function() {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      nmAggiornaPreview();
    });
    input6.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); nmSalvaNuovaCommessa(); }
    });
  }

  const inputPopup = document.getElementById('nm-input-numero');
  if (inputPopup) {
    inputPopup.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); nmAggiungiNumero(); }
    });
  }

  // Listener per le 2 caselle CAVO
  const cavoSinistra = document.getElementById('nm-cavo-sinistra');
  const cavoDestra = document.getElementById('nm-cavo-destra');

  if (cavoSinistra) {
    cavoSinistra.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('nm-cavo-destra').focus();
      }
    });
  }

  if (cavoDestra) {
    cavoDestra.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); nmAggiungiNumero(); }
    });
  }

  const inputAdmin = document.getElementById('nm-admin-password');
  if (inputAdmin) {
    inputAdmin.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); nmConfermaCancellazione(); }
    });
  }
});

// Click fuori modali per chiudere
document.addEventListener('click', function(e) {
  const modali = [
    { id: 'modal-notifiche', chiudi: chiudiNotifiche },
    { id: 'modal-password', chiudi: chiudiModificaPassword },
    { id: 'modal-aziende', chiudi: chiudiModalAziende },
    { id: 'modal-backup', chiudi: chiudiModalBackup },
    { id: 'modal-dettaglio-commessa', chiudi: chiudiDettaglioCommessa },
    { id: 'modal-dettaglio-dipendente', chiudi: chiudiDettaglioDipendente },
    { id: 'nm-modal-crea-commessa', chiudi: nmChiudiCreaCommessa },
    { id: 'nm-modal-popup', chiudi: nmChiudiPopup },
    { id: 'nm-modal-admin', chiudi: nmChiudiAdmin }
  ];

  modali.forEach(m => {
    const modal = document.getElementById(m.id);
    if (modal && e.target === modal) {
      m.chiudi();
    }
  });
});

console.log('✅ script.js — COMPLETO caricato (parte 6/6)');
