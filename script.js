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

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);

// ============================================
// NUOVA CONFIGURAZIONE FIRESTORE (PERSISTENTE)
// ============================================
const db = firebase.firestore();

// Abilita la cache offline nel modo corretto per la versione 8
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
// DATI
// ============================================
let dati = {};
let utenteCorrente = null;
let prossimoId = 1; // Verrà aggiornato automaticamente da caricaDati()

// ============================================
// FUNZIONI DI CONNESSIONE A FIRESTORE
// ============================================

// CARICA DATI DA FIRESTORE
async function caricaDaFirestore() {
  try {
    console.log('🔄 Caricamento dati da Firestore...');
    const snapshot = await db.collection('dati').doc('main').get();
    if (snapshot.exists) {
      const datiFirestore = snapshot.data();
      console.log('✅ Dati caricati da Firestore');
      return datiFirestore;
    } else {
      console.log('⚠️ Nessun dato in Firestore, uso default');
      return null;
    }
  } catch (error) {
    console.error('❌ Errore caricamento Firestore:', error);
    return null;
  }
}

// SALVA DATI SU FIRESTORE
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

// CARICA DATI (locale + Firestore)
async function caricaDati() {
  const datiFirestore = await caricaDaFirestore();
  
  if (datiFirestore) {
    dati = datiFirestore;
    
    // 🛑 CALCOLA AUTOMATICAMENTE L'ID PIÙ ALTO PER EVITARE DUPLICATI
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
    if (!parsed.aziende) {
      parsed.aziende = [{ id: 1, nome: 'MEC-ROY srls' }];
    }
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
    aziende: [
      { id: 1, nome: 'MEC-ROY srls' }
    ]
  };
  
  dati = defaultData;
  await salvaSuFirestore(dati);
  localStorage.setItem('datiLavoroV2', JSON.stringify(dati));
  return dati;
}

// SALVA DATI (Firestore + localStorage)
async function salvaDati() {
  // Protezione per browser che bloccano localStorage
  try {
    localStorage.setItem('datiLavoroV2', JSON.stringify(dati));
  } catch (e) {
    console.warn('⚠️ Salvataggio locale bloccato, salvo solo su Cloud.');
  }
  await salvaSuFirestore(dati);
}

// ============================================
// CALCOLA ORE GIORNATA
// ============================================
function calcolaOreGiornata(username, data) {
  const registrazioni = dati.registrazioni.filter(r => 
    r.utente_id === username && 
    r.data === data && 
    r.tipo === 'lavoro'
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

// ============================================
// CONTROLLA ORARIO (dopo le 20:00 non si può modificare)
// ============================================
function isOltre20() {
  const ora = new Date();
  const ore = ora.getHours();
  return ore >= 20;
}

// ============================================
// CARICA DATI ALL'AVVIO
// ============================================
async function init() {
  await caricaDati();
  document.getElementById('login-page').style.display = 'block';
  document.getElementById('main-page').style.display = 'none';
  const anno = new Date().getFullYear();
  document.getElementById('cal-anno').value = anno;
}

// ============================================
// LOGIN / LOGOUT
// ============================================
function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  const utente = dati.utenti.find(u => u.username === username && u.password === password);
  
  if (utente) {
    utenteCorrente = utente;
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
      document.getElementById('cal-filtro-dipendente').style.display = 'block';
      document.getElementById('btn-password').style.display = 'flex';
      document.getElementById('azienda-container').style.display = 'inline-block';
      
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
      document.getElementById('cal-filtro-dipendente').style.display = 'none';
      document.getElementById('btn-password').style.display = 'none';
      document.getElementById('azienda-container').style.display = 'none';
      
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
    });
    
    if (utente.ruolo === 'dipendente') {
      const oraInizio = document.getElementById('ora-inizio');
      const oraFine = document.getElementById('ora-fine');
      
      const ora = new Date();
      const oraCorrente = ora.getHours().toString().padStart(2, '0') + ':00';
      oraInizio.value = oraCorrente;
      
      oraInizio.oninput = function() {
        if (this.value) {
          const [h, m] = this.value.split(':').map(Number);
          const hFine = (h + 1).toString().padStart(2, '0');
          oraFine.value = hFine + ':00';
          oraFine.focus();
        }
      };
      
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
    
    caricaSelectCommesse();
    caricaListaCommesse();
    caricaRichiesteDipendente();
    caricaSelectDipendentiModifica();
    caricaSelectDipendentiCalendario();
    
  } else {
    document.getElementById('errore').style.display = 'block';
  }
}

function logout() {
  utenteCorrente = null;
  document.getElementById('login-page').style.display = 'block';
  document.getElementById('main-page').style.display = 'none';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

// ============================================
// TAB
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
// MULTI-AZIENDA
// ============================================
function caricaSelectAziende() {
  const select = document.getElementById('select-azienda');
  select.innerHTML = '<option value="0">-- Tutte --</option>';
  if (dati.aziende) {
    dati.aziende.forEach(a => {
      select.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
    });
  }
}

function caricaSelectAziendeCommesse() {
  const select = document.getElementById('commessa-azienda');
  select.innerHTML = '<option value="0">-- Seleziona Azienda --</option>';
  if (dati.aziende) {
    dati.aziende.forEach(a => {
      select.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
    });
  }
}

function caricaSelectRecuperoCommesse() {
  const select = document.getElementById('recupero-commessa');
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  dati.commesse.filter(c => c.attivo).forEach(c => {
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
// GESTIONE AZIENDE - MODALE
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
  } else {
    console.error('❌ Modale aziende non trovato');
    alert('Errore: modale aziende non trovato');
  }
}

function chiudiModalAziende() {
  const modal = document.getElementById('modal-aziende');
  if (modal) {
    modal.classList.remove('active');
  }
}

// ============================================
// AGGIUNGI / LISTA / ELIMINA AZIENDE
// ============================================
function aggiungiAzienda() {
  const nome = document.getElementById('azienda-nome').value.trim();
  const msg = document.getElementById('msg-azienda');

  if (!nome) {
    msg.innerHTML = '<div class="error">❌ Inserisci il nome dell\'azienda</div>';
    return;
  }

  if (!dati.aziende) {
    dati.aziende = [];
  }

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
  
  if (!div) {
    console.error('❌ Elemento lista-aziende non trovato');
    return;
  }
  
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

  // SBLOCCA SEMPRE L'ORA INIZIO DI DEFAULT
  document.getElementById('ora-inizio').disabled = false;
  document.getElementById('ora-inizio').style.backgroundColor = 'white';

  // Se sono passate le 20:00
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

  if (straordinarioCheck && straordinarioCheck.checked) {
    return;
  }

  let ultima = null;
  if (registrazioniOggi.length > 0) {
    ultima = registrazioniOggi.reduce((max, r) => {
      return r.ora_fine > max.ora_fine ? r : max;
    }, registrazioniOggi[0]);
  }

  // ============================================
  // POMERIGGIO (dopo le 12:00)
  // ============================================
  if (isPomeriggio) {
    oraInizio.disabled = false;
    oraInizio.style.backgroundColor = 'white';
    oraFine.disabled = false;
    oraFine.style.backgroundColor = 'white';

        if (ultima) {
      const h = parseInt(ultima.ora_fine.split(':')[0]);
      oraInizio.value = h < 13 ? '13:00' : ultima.ora_fine;
    } else {
      // 🛑 Imposta l'ora ATTUALE, MAI oltre l'ora attuale se siamo pomeriggio
      const oreOra = oreCorrente.toString().padStart(2, '0') + ':00';
      oraInizio.value = (oreCorrente <= 23) ? oreOra : '13:00';
    }
    
    // 🛑 Controlla che l'ora di fine non sia nel futuro
    const oraCorrenteMinuti = oraCorrente * 60;
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

  // ============================================
  // MATTINO (prima delle 12:00)
  // ============================================
  if (!ultima) {
    oraInizio.disabled = false;
    oraInizio.value = oreCorrente.toString().padStart(2, '0') + ':00';
    oraFine.disabled = false;
    const hFine = (parseInt(oraInizio.value.split(':')[0]) + 1).toString().padStart(2, '0');
    oraFine.value = hFine + ':00';
    infoDiv.innerHTML = `<div class="info-msg">⏱️ Prima registrazione - Inserisci gli orari.</div>`;
    return;
  }

  // Mattino con registrazioni: BLOCCA SOLO ORA INIZIO
  oraInizio.value = ultima.ora_fine;
  oraInizio.disabled = true;
  oraInizio.style.backgroundColor = '#f0f0f0';
  
  // ORA FINE SEMPRE LIBERA
  oraFine.disabled = false;
  oraFine.style.backgroundColor = 'white';
  
  const hFine = (parseInt(ultima.ora_fine.split(':')[0]) + 1).toString().padStart(2, '0');
  oraFine.value = hFine + ':00';

  infoDiv.innerHTML = `<div class="info-msg">
    ⏱️ <strong>Ora inizio:</strong> ${ultima.ora_fine} (bloccata) - Puoi modificare l'ora fine.
  </div>`;
}

// ============================================
// COMMESSE
// ============================================
function caricaSelectCommesse() {
  const select = document.getElementById('commessa');
  select.innerHTML = '<option value="">-- Seleziona una commessa --</option>';
  
  if (dati.commesse.length === 0) {
    select.innerHTML = '<option value="">-- Nessuna commessa disponibile --</option>';
    return;
  }
  
  dati.commesse.filter(c => c.attivo).forEach(c => {
    select.innerHTML += '<option value="' + c.id + '">' + c.nome + '</option>';
  });
}

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
    attivo: true
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
  
  if (dati.commesse.length === 0) {
    div.innerHTML = '<p class="text-muted">📭 Nessuna commessa creata</p>';
    return;
  }

  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += '<th>Nome</th><th>Azienda</th><th>Stato</th><th>Azioni</th>';
  html += '</tr></thead><tbody>';

  dati.commesse.forEach(c => {
    const azienda = dati.aziende.find(a => a.id === c.azienda_id);
    html += '<tr>';
    html += '<td><strong>' + c.nome + '</strong></td>';
    html += '<td>' + (azienda ? azienda.nome : '-') + '</td>';
    html += '<td>' + (c.attivo ? '✅ Attivo' : '❌ Disattivo') + '</td>';
    html += '<td><button class="btn-danger" onclick="toggleCommessa(' + c.id + ')">';
    html += c.attivo ? 'Disattiva' : 'Attiva';
    html += '</button></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  div.innerHTML = html;
}

function toggleCommessa(id) {
  const commessa = dati.commesse.find(c => c.id === id);
  if (!commessa) return;
  
  commessa.attivo = !commessa.attivo;
  salvaDati();
  caricaSelectCommesse();
  caricaListaCommesse();
  caricaSelectRecuperoCommesse();
}

// ============================================
// REGISTRAZIONE ORE
// ============================================
function salvaRegistrazione() {
  if (utenteCorrente?.ruolo === 'admin') {
    alert('Gli amministratori non possono registrare ore qui');
    return;
  }

  // Controllo ore 20:00
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

  // VALIDAZIONE
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

  // 🛑 NUOVO CONTROLLO: L'ORA DI INIZIO NON PUÒ ESSERE NEL FUTURO
  const adesso = new Date();
  const minutiAdesso = adesso.getHours() * 60 + adesso.getMinutes();
  const minutiInizio = parseInt(ora_inizio.split(':')[0]) * 60 + parseInt(ora_inizio.split(':')[1] || 0);
  
  if (minutiInizio > minutiAdesso) {
    msg.innerHTML = `<div class="error">❌ Non puoi segnare un orario nel futuro! L'ora attuale è ${adesso.getHours()}:${String(adesso.getMinutes()).padStart(2, '0')}.</div>`;
    return;
  }
  // Controllo orario mattutino (solo se NON straordinario)
  if (!straordinario) {
    const oraCorrente = new Date();
    const oreCorrente = oraCorrente.getHours();
    const isPomeriggio = oreCorrente >= 12;
    const oraInizioNum = parseInt(ora_inizio.split(':')[0]);

    if (isPomeriggio && oraInizioNum < 12) {
      msg.innerHTML = `
        <div class="error">
          ❌ Non puoi segnare ore mattutine dopo le 12:00.<br>
          <small>Se hai dimenticato di segnare le ore, usa <strong>"Richiedi Recupero Ore"</strong> nella sezione Richieste.</small>
        </div>
      `;
      return;
    }
  }

  // Controllo sovrapposizioni
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

  // ============================================
  // CALCOLO ORE CON ARROTONDAMENTO
  // ============================================
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

  // ============================================
  // SALVA
  // ============================================
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
  
  // Ricarica ultima registrazione per aggiornare l'ora inizio
  caricaUltimaRegistrazione();
}

// ============================================
// RICHIESTE (DIPENDENTE)
// ============================================
function inviaRichiesta() {
  if (utenteCorrente?.ruolo === 'admin') {
    alert('Gli amministratori non possono fare richieste');
    return;
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
    salvaDati();

    msg.innerHTML = '<div class="success">✅ Richiesta di recupero ore inviata! Attendi l\'approvazione dell\'admin.</div>';
    
    document.getElementById('recupero-data').value = '';
    document.getElementById('recupero-ora-inizio').value = '';
    document.getElementById('recupero-ora-fine').value = '';
    document.getElementById('recupero-motivo').value = '';
    
    aggiornaBadgeRichieste();
    return;
  }

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
  salvaDati();

  msg.innerHTML = '<div class="success">✅ Richiesta inviata! Attendi la risposta.</div>';
  
  document.getElementById('richiesta-note').value = '';
  document.getElementById('certificato').value = '';
  
  caricaRichiesteDipendente();
  aggiornaBadgeRichieste();
}

function caricaRichiesteDipendente() {
  const div = document.getElementById('lista-richieste-dipendente');
  
  // 🛑 ELIMINA LE RICHIESTE GIÀ PROCESSATE
  dati.richieste = dati.richieste.filter(r => r.stato === 'pending');
  
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
// RICHIESTE (ADMIN)
// ============================================
function caricaRichiesteAdmin() {
  const div = document.getElementById('lista-richieste-admin');
  
  // 🛑 ELIMINA LE RICHIESTE GIÀ PROCESSATE
  dati.richieste = dati.richieste.filter(r => r.stato === 'pending');
  
  const richieste = dati.richieste;
  
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

function approvaRichiesta(id) {
  const richiesta = dati.richieste.find(r => r.id === id);
  if (!richiesta) {
    alert('❌ Richiesta non trovata');
    return;
  }
  
  // 🛑 IMPEDISCI DOPPIO CLICK: se è già approvata, esci subito
  if (richiesta.stato !== 'pending') {
    alert('⚠️ Questa richiesta è già stata processata.');
    return;
  }
  
  richiesta.stato = 'approvata';

  // ✅ Usa SEMPRE l'utente della richiesta
  const utenteIdCorretto = richiesta.utente_id;

  if (richiesta.tipo === 'recupero_ore') {
    const [h1, m1] = richiesta.ora_inizio.split(':').map(Number);
    const [h2, m2] = richiesta.ora_fine.split(':').map(Number);
    let oreLavorate = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    
    // 🛑 CONTROLLO MATEMATICO: se il calcolo è negativo o supera le 12 ore, l'errore è nei dati. Blocca tutto.
    if (oreLavorate <= 0 || oreLavorate > 12) {
      alert('❌ ERRORE DATI: Orario non valido per la richiesta di recupero. Controlla le ore inserite.');
      return;
    }

    dati.registrazioni.push({
      id: prossimoId++,
      utente_id: utenteIdCorretto,
      commessa_id: richiesta.commessa_id || null,
      data: richiesta.data,
      ora_inizio: richiesta.ora_inizio,
      ora_fine: richiesta.ora_fine,
      descrizione: richiesta.descrizione_lavoro || 'Recupero ore',
      tipo: 'lavoro',
      recupero: true,
      ore: oreLavorate
    });
    
    aggiungiNotifica(
      utenteIdCorretto,
      'recupero_approvato',
      '✅ Le tue ore del ' + richiesta.data + ' (' + richiesta.ora_inizio + ' - ' + richiesta.ora_fine + ') sono state APPROVATE e inserite!',
      '#'
    );
    
  } else {
    dati.registrazioni.push({
      id: prossimoId++,
      utente_id: utenteIdCorretto,
      commessa_id: null,
      data: richiesta.data_inizio,
      ora_inizio: '00:00',
      ora_fine: '00:00',
      descrizione: richiesta.tipo + ' (approvata)',
      tipo: richiesta.tipo,
      richiesta_id: richiesta.id
    });
    
    if (richiesta.data_inizio !== richiesta.data_fine) {
      let dataCorrente = new Date(richiesta.data_inizio);
      const dataFine = new Date(richiesta.data_fine);
      while (dataCorrente < dataFine) {
        dataCorrente.setDate(dataCorrente.getDate() + 1);
        const dataStr = dataCorrente.toISOString().split('T')[0];
        dati.registrazioni.push({
          id: prossimoId++,
          utente_id: utenteIdCorretto,
          commessa_id: null,
          data: dataStr,
          ora_inizio: '00:00',
          ora_fine: '00:00',
          descrizione: richiesta.tipo + ' (approvata)',
          tipo: richiesta.tipo,
          richiesta_id: richiesta.id
        });
      }
    }
    
    const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
    aggiungiNotifica(
      utenteIdCorretto,
      'approvazione',
      emoji[richiesta.tipo] + ' La tua richiesta di ' + richiesta.tipo + ' dal ' + richiesta.data_inizio + ' al ' + richiesta.data_fine + ' è stata APPROVATA ✅',
      '#'
    );
  }
  
  // Salva su Firestore
  salvaDati();
  
  // 🛑 RIMUOVI LA CARD DALLO SCHERMO SENZA RICARICARE LA PAGINA
  const card = document.querySelector('.richiesta-card');
  if (card) {
    card.remove();
  }
  
  // Aggiorna la lista e il badge
  caricaRichiesteAdmin();
  aggiornaBadgeRichieste();
  caricaRichiesteDipendente();
  aggiornaBadgeNotifiche();
  
  alert('✅ Richiesta approvata! Notifica inviata al dipendente.');
}

function rifiutaRichiesta(id) {
  const richiesta = dati.richieste.find(r => r.id === id);
  if (!richiesta) {
    alert('❌ Richiesta non trovata');
    return;
  }
  
  richiesta.stato = 'rifiutata';
  
  const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
  aggiungiNotifica(
    richiesta.utente_id,
    'rifiuto',
    emoji[richiesta.tipo] + ' La tua richiesta di ' + richiesta.tipo + ' dal ' + richiesta.data_inizio + ' al ' + richiesta.data_fine + ' è stata RIFIUTATA ❌',
    '#'
  );
  
  salvaDati();
  
  // Rimuovi fisicamente la richiesta dallo schermo senza ricaricare la pagina
  const card = document.querySelector('.richiesta-card');
  if (card) {
    card.remove();
  }
  
  caricaRichiesteAdmin();
  aggiornaBadgeRichieste();
  caricaRichiesteDipendente();
  aggiornaBadgeNotifiche();
  alert('❌ Richiesta rifiutata. Notifica inviata al dipendente.');
}

function aggiornaBadgeRichieste() {
  const pending = dati.richieste.filter(r => r.stato === 'pending').length;
  const badge = document.getElementById('badge-richieste');
  
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
// NOTIFICHE
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
    const classe = n.letto ? 'notifica-item letto' : 'notifica-item non-letto';
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
// CAMBIA PASSWORD (ADMIN)
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
// ESPORTA ORE MESE
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
    const data = `${annoNum}-${String(meseNum).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
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

        if (haFerie) {
          simbolo = 'F';
        } else if (haPermesso) {
          simbolo = 'P';
        } else if (haMalattia) {
          simbolo = 'M';
        } else if (haLavoro) {
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
// ESPORTA PDF
// ============================================
function esportaPDF() {
  const output = document.getElementById('calendario-output');
  const content = output.innerHTML;
  
  if (!content || content.includes('Seleziona mese/anno') || content.includes('Nessun dipendente trovato')) {
    alert('⚠️ Prima genera il report nel calendario!\n\nVai su "Calendario" → seleziona mese/anno → clicca "Visualizza"');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  
  if (!printWindow) {
    alert('❌ Impossibile aprire la finestra di stampa. Consentire i popup per questo sito.');
    return;
  }

  const logoHTML = document.querySelector('.logo-small') ? 
    document.querySelector('.logo-small').outerHTML : '<h2 style="color:#00695C;">MEC-ROY srls</h2>';

  const style = `
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
      th { background: #00695C; color: white; font-weight: bold; }
      tr:nth-child(even) { background: #f9f9f9; }
      .header { text-align: center; padding: 10px 0; border-bottom: 3px solid #00695C; margin-bottom: 15px; }
      .footer { text-align: center; padding: 10px 0; border-top: 2px solid #ddd; margin-top: 15px; color: #888; font-size: 11px; }
      h2 { color: #00695C; margin: 5px 0; }
      .logo-small { display: flex; align-items: center; justify-content: center; gap: 8px; }
      .logo-small-img { max-height: 40px; }
      .azienda-small { font-weight: 700; color: #00695C; font-size: 18px; }
      .badge { display: none; }
      .btn { display: none; }
      .ore-straordinario { background-color: #ffebee !important; }
      .totale-oltre8 { color: #d32f2f !important; font-weight: bold; }
    </style>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Report Ore Mensile</title>
      ${style}
    </head>
    <body>
      <div class="header">
        ${logoHTML}
        <h2>Report Ore Mensile</h2>
        <p style="color:#888;font-size:14px;margin:0;">Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'})}</p>
      </div>
      
      <div style="margin-top:10px;">
        ${content}
      </div>
      
      <div class="footer">
        MEC-ROY srls - Sistema di Gestione Lavoro<br>
        Documento generato automaticamente
      </div>
      
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

// ============================================
// GESTIONE DIPENDENTI
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
  
  if (dati.utenti.length === 0) {
    div.innerHTML = '<p class="text-muted">📭 Nessun dipendente</p>';
    return;
  }

  let html = '<div class="table-wrapper"><table><thead><tr>';
  html += '<th>Username</th><th>Nome</th><th>Cognome</th><th>Ruolo</th><th>Azioni</th>';
  html += '</tr></thead><tbody>';

  dati.utenti.forEach(u => {
    const isSelf = u.username === utenteCorrente.username;
    html += '<tr id="row-' + u.username + '">';
    html += '<td><strong>' + u.username + '</strong></td>';
    html += '<td>' + u.nome + '</td>';
    html += '<td>' + u.cognome + '</td>';
    html += '<td><span class="badge ' + u.ruolo + '">' + u.ruolo + '</span></td>';
    html += '<td>';
    if (!isSelf) {
      html += '<button class="btn-warning" onclick="apriModificaDipendente(\'' + u.username + '\')" style="margin-right:5px;" title="Modifica"><i class="fas fa-edit"></i></button>';
      html += '<button class="btn-danger" onclick="eliminaDipendente(\'' + u.username + '\')" title="Elimina"><i class="fas fa-trash"></i></button>';
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

// ============================================
// MODIFICA ORE (ADMIN)
// ============================================
function caricaSelectDipendentiModifica() {
  const select = document.getElementById('modifica-dipendente');
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  dati.utenti.filter(u => u.ruolo === 'dipendente').forEach(u => {
    select.innerHTML += '<option value="' + u.username + '">' + u.nome + ' ' + u.cognome + '</option>';
  });
}

function caricaRegistrazioniModifica() {
  const username = document.getElementById('modifica-dipendente').value;
  const data = document.getElementById('modifica-data').value;
  const div = document.getElementById('modifica-lista');

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
  html += '<th>Commessa</th><th>Inizio</th><th>Fine</th><th>Ore</th><th>Descrizione</th><th>Azioni</th>';
  html += '</tr></thead><tbody>';

  registrazioni.forEach(r => {
    const commessa = dati.commesse.find(c => c.id === r.commessa_id);
    const [h1, m1] = r.ora_inizio.split(':').map(Number);
    const [h2, m2] = r.ora_fine.split(':').map(Number);
    const ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    const isStraordinario = r.straordinario || false;

    html += '<tr' + (isOltre8 ? ' class="ore-straordinario"' : '') + '>';
    html += '<td><strong>' + (commessa?.nome || 'N/A') + '</strong></td>';
    html += '<td><input type="time" id="mod-inizio-' + r.id + '" value="' + r.ora_inizio + '" class="edit-input" /></td>';
    html += '<td><input type="time" id="mod-fine-' + r.id + '" value="' + r.ora_fine + '" class="edit-input" /></td>';
    html += '<td>' + ore.toFixed(2) + 'h' + (isStraordinario ? ' ⭐' : '') + '</td>';
    html += '<td><input type="text" id="mod-desc-' + r.id + '" value="' + (r.descrizione || '') + '" class="edit-input" /></td>';
    html += '<td>';
    html += '<button class="btn-warning" onclick="salvaModifica(' + r.id + ')"><i class="fas fa-save"></i></button>';
    html += '<button class="btn-danger" onclick="eliminaRegistrazione(' + r.id + ')"><i class="fas fa-trash"></i></button>';
    html += '</td>';
    html += '</tr>';
  });

  // Totale giornata con indicazione straordinario (ROSSO se > 8)
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

function salvaModifica(id) {
  const nuovaInizio = document.getElementById('mod-inizio-' + id).value;
  const nuovaFine = document.getElementById('mod-fine-' + id).value;
  const nuovaDesc = document.getElementById('mod-desc-' + id).value.trim();

  const registro = dati.registrazioni.find(r => r.id === id);
  if (!registro) return;

  if (nuovaInizio >= nuovaFine) {
    alert('L\'ora fine deve essere dopo l\'ora inizio');
    return;
  }

  registro.ora_inizio = nuovaInizio;
  registro.ora_fine = nuovaFine;
  registro.descrizione = nuovaDesc;
  
  const [h1, m1] = nuovaInizio.split(':').map(Number);
  const [h2, m2] = nuovaFine.split(':').map(Number);
  registro.ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;

  salvaDati();
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
// CALENDARIO
// ============================================
function caricaSelectDipendentiCalendario() {
  const select = document.getElementById('cal-dipendente');
  select.innerHTML = '<option value="">-- Tutti --</option>';
  dati.utenti.filter(u => u.ruolo === 'dipendente').forEach(u => {
    select.innerHTML += '<option value="' + u.username + '">' + u.nome + ' ' + u.cognome + '</option>';
  });
}

function caricaCalendario() {
  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);
  const output = document.getElementById('calendario-output');

  if (!anno) {
    output.innerHTML = '<p class="text-muted">Inserisci un anno valido</p>';
    return;
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

        if (haFerie) {
          cella = 'F';
          bgColor = '#E3F2FD';
        } else if (haPermesso) {
          cella = 'P';
          bgColor = '#FFF3E0';
        } else if (haMalattia) {
          cella = 'M';
          bgColor = '#FFEBEE';
        } else if (haRecupero) {
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
            cella = 'A';
            bgColor = '#f5f5f5';
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

    // TOTALE GIORNATA - ROSSO SE > 8 ORE
    const isOltre8 = totaleOre > 8;
    const bgTotal = isOltre8 ? '#ffebee' : '#e8f5e9';
    const colorTotal = isOltre8 ? '#d32f2f' : '#2e7d32';
    html += `<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold;background:${bgTotal};color:${colorTotal};">${totaleOre.toFixed(1)}h${isOltre8 ? ' ⚠️' : ''}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  output.innerHTML = html;
}

// ============================================
// AVVIO
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  // Carica i dati prima di mostrare la pagina
  caricaDati().then(() => {
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('main-page').style.display = 'none';
    const anno = new Date().getFullYear();
    document.getElementById('cal-anno').value = anno;
  }).catch((err) => {
    console.error('❌ Errore caricamento dati:', err);
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('main-page').style.display = 'none';
  });
});

document.addEventListener('click', function(e) {
  const modal = document.getElementById('modal-notifiche');
  if (e.target === modal) {
    chiudiNotifiche();
  }
});

document.addEventListener('click', function(e) {
  const modal = document.getElementById('modal-password');
  if (e.target === modal) {
    chiudiModificaPassword();
  }
});

document.addEventListener('click', function(e) {
  const modal = document.getElementById('modal-aziende');
  if (e.target === modal) {
    chiudiModalAziende();
  }
});
