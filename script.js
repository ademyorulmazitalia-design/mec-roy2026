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

let dati = {};
let utenteCorrente = null;
let prossimoId = 1; 
let commessaCorrenteDettaglio = null;
let filtriCommessa = {
  dataInizio: '',
  dataFine: '',
  ricerca: '',
  dipendenti: []
};

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
    if (!parsed.commesse) {
      parsed.commesse = [];
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

async function salvaDati() {
  try {
    localStorage.setItem('datiLavoroV2', JSON.stringify(dati));
  } catch (e) {
    console.warn('⚠️ Salvataggio locale bloccato, salvo solo su Cloud.');
  }
  await salvaSuFirestore(dati);
}

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

function isOltre20() {
  const ora = new Date();
  const ore = ora.getHours();
  return ore >= 20;
}

async function init() {
  await caricaDati();
  document.getElementById('login-page').style.display = 'block';
  document.getElementById('main-page').style.display = 'none';
  const adesso = new Date();
  document.getElementById('cal-mese').value = adesso.getMonth() + 1;
  document.getElementById('cal-anno').value = adesso.getFullYear();
}

function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const ricordami = document.getElementById('ricordami').checked;
  
  const utente = dati.utenti.find(u => u.username === username && u.password === password);
  
  if (utente) {
    utenteCorrente = utente;
    salvaSessione(utente.username);
    // ============================================
    // SALVA CREDENZIALI SE "RICORDAMI" È SPUNTATO
    // ============================================
    if (ricordami) {
      localStorage.setItem('ricordami_username', username);
      localStorage.setItem('ricordami_password', password);
      localStorage.setItem('ricordami_attivo', 'true');
    } else {
      localStorage.removeItem('ricordami_username');
      localStorage.removeItem('ricordami_password');
      localStorage.removeItem('ricordami_attivo');
    }
    
    // Fade-out del form prima di mostrare la main
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

    // Imposta il mese e l'anno correnti nel calendario
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
    });
    
        // Chiedi il permesso per le notifiche (solo dipendenti)
    setTimeout(() => {
      chiediPermessoNotifiche();
      ascoltaRinnovoToken();
    }, 1500);
    
    if (utente.ruolo === 'dipendente') {
      const oraInizio = document.getElementById('ora-inizio');
      const oraFine = document.getElementById('ora-fine');
      
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
    
    // Reset dei sotto-pannelli Commesse allo stato iniziale
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
    
  } else {
    // Shake del form quando le credenziali sono errate
    const loginBox = document.querySelector('.login-box');
    if (loginBox) {
      loginBox.classList.remove('shake');
      // Forza il reflow per far ripartire l'animazione se già attiva
      void loginBox.offsetWidth;
      loginBox.classList.add('shake');
      setTimeout(() => loginBox.classList.remove('shake'), 550);
    }
    document.getElementById('errore').style.display = 'block';
  }
}


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

  if (straordinarioCheck && straordinarioCheck.checked) {
    return;
  }

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

function caricaSelectCommesse() {
  const select = document.getElementById('commessa');
  select.innerHTML = '<option value="">-- Seleziona una commessa --</option>';
  
  if (dati.commesse.length === 0) {
    select.innerHTML = '<option value="">-- Nessuna commessa disponibile --</option>';
    return;
  }
  
  dati.commesse.forEach(c => {
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

// FIX: non cancella più le richieste processate, filtra solo per la visualizzazione
function caricaRichiesteAdmin() {
  const div = document.getElementById('lista-richieste-admin');
  
  // ⚠️ ATTENZIONE: usiamo una variabile locale per la lista da mostrare,
  // NON modifichiamo più dati.richieste (sennò perderemmo lo storico)
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

function approvaRichiesta(id) {
  const richiesta = dati.richieste.find(r => r.id === id);
  if (!richiesta) {
    alert('❌ Richiesta non trovata');
    return;
  }
  
  if (richiesta.stato !== 'pending') {
    alert('⚠️ Questa richiesta è già stata processata.');
    return;
  }
  
  richiesta.stato = 'approvata';

  const utenteIdCorretto = richiesta.utente_id;

  if (richiesta.tipo === 'recupero_ore') {
    const [h1, m1] = richiesta.ora_inizio.split(':').map(Number);
    const [h2, m2] = richiesta.ora_fine.split(':').map(Number);
    let oreLavorate = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    
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
  
  salvaDati();
  
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
      <style>/* ... i tuoi stili per il PDF ... */</style>
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
}

// ============================================
// GESTIONE COMMESSE - MENU
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

// ============================================
// NUOVA MODALE DETTAGLIO COMMESSA
// ============================================
function apriDettaglioCommessa(id) {
  const commessa = dati.commesse.find(c => c.id === id);
  if (!commessa) {
    alert('❌ Commessa non trovata');
    return;
  }
  
  commessaCorrenteDettaglio = id;
  
  filtriCommessa = {
    dataInizio: '',
    dataFine: '',
    ricerca: '',
    dipendenti: []
  };
  
  document.getElementById('dettaglio-commessa-nome').textContent = commessa.nome;
  const dataCreazione = commessa.data_creazione ? 
    new Date(commessa.data_creazione).toLocaleDateString('it-IT') : 
    'N/D';
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
    item.innerHTML = `
      <i class="fas fa-user"></i>
      <span>${utente.nome} ${utente.cognome}</span>
    `;
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
    registrazioni = registrazioni.filter(r => 
      filtriCommessa.dipendenti.includes(r.utente_id)
    );
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
    if (!perDipendente[r.utente_id]) {
      perDipendente[r.utente_id] = [];
    }
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
    html += `<div class="gruppo-dipendente-header">`;
    html += `<h4><i class="fas fa-user"></i> ${nomeDipendente}</h4>`;
    
    perDipendente[username].forEach(r => {
      totaleDipendente += r.ore || 0;
    });
    
    html += `<span class="subtotale">${totaleDipendente.toFixed(2)}h</span>`;
    html += `</div>`;
    
    html += `<div class="table-wrapper" style="margin-top:0;border:none;">`;
    html += `<table>`;
    html += `<thead><tr>
      <th>Data</th>
      <th>Commessa</th>
      <th>Inizio</th>
      <th>Fine</th>
      <th>Ore</th>
      <th>Descrizione</th>
    </tr></thead>`;
    html += `<tbody>`;
    
    perDipendente[username].forEach(r => {
      const commessa = dati.commesse.find(c => c.id === r.commessa_id);
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
      
      const isStraordinario = r.straordinario ? ' ⭐' : '';
      const isRecupero = r.recupero ? ' ⏰' : '';
      
      html += `<tr>`;
      html += `<td>${r.data}</td>`;
      html += `<td><strong>${commessa?.nome || 'N/A'}</strong></td>`;
      html += `<td>${r.ora_inizio}</td>`;
      html += `<td>${r.ora_fine}</td>`;
      html += `<td><strong>${ore.toFixed(2)}h${isStraordinario}${isRecupero}</strong></td>`;
      html += `<td>${r.descrizione || '-'}</td>`;
      html += `</tr>`;
    });
    
    html += `</tbody></table></div>`;
    html += `</div>`;
    
    totaleGenerale += totaleDipendente;
  });
  
  html += `<div class="totale-generale">
    <i class="fas fa-calculator"></i> TOTALE GENERALE: ${totaleGenerale.toFixed(2)}h
  </div>`;
  
  output.innerHTML = html;
}

function resetFiltriCommessa() {
  filtriCommessa = {
    dataInizio: '',
    dataFine: '',
    ricerca: '',
    dipendenti: []
  };
  
  document.getElementById('filtro-data-inizio').value = '';
  document.getElementById('filtro-data-fine').value = '';
  document.getElementById('filtro-ricerca').value = '';
  
  document.querySelectorAll('.filtro-dipendente-item').forEach(item => {
    item.classList.remove('attivo');
  });
  
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
    new Date(commessa.data_creazione).toLocaleDateString('it-IT') : 
    'N/D';
  
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
      <div class="footer">
        MEC-ROY srls - Sistema di Gestione Lavoro<br>
        Documento generato automaticamente
      </div>
    </body>
    </html>
  `;

  await scaricaOCondividiFile(fullHTML, `Report_Commessa_${commessa.nome.replace(/\s+/g, '_')}`);
}

// ============================================
// FUNZIONI EXTRA
// ============================================
function mostraTotaliMese() {
  if (!utenteCorrente) return;
  
  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);
  if (!mese || !anno) return;
  
  const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][mese-1];
  
  let totaleGenerale = 0;
  
  dati.registrazioni.forEach(r => {
    if (r.data && r.data.startsWith(`${anno}-${String(mese).padStart(2,'0')}`)) {
      totaleGenerale += r.ore || 0;
    }
  });
  
  const container = document.getElementById('calendario-output');
  if (container) {
    const totaliHTML = `
      <div style="background:#e8f5e9;border:2px solid #4CAF50;border-radius:10px;padding:15px;margin-bottom:20px;text-align:center;">
        <h4 style="color:#2e7d32;margin:0;">📊 TOTALE MESE: ${meseNome} ${anno}</h4>
        <p style="margin:5px 0;font-size:1.2em;"><strong>${totaleGenerale.toFixed(2)} ore</strong> lavorate totali</p>
        <small style="color:#666;">Dipendenti attivi: ${dati.utenti.filter(u => u.ruolo === 'dipendente').length}</small>
      </div>
    `;
    container.innerHTML = totaliHTML + container.innerHTML;
  }
}

const originalCaricaCalendario = caricaCalendario;
caricaCalendario = function() {
  originalCaricaCalendario();
  setTimeout(() => {
    const output = document.getElementById('calendario-output');
    if (output && !output.innerHTML.includes('📊 TOTALE MESE')) {
      mostraTotaliMese();
    }
  }, 100);
};

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

// ============================================
// AVVIO
// ============================================

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

document.addEventListener('click', function(e) {
  const modal = document.getElementById('modal-backup');
  if (e.target === modal) {
    chiudiModalBackup();
  }
});

document.addEventListener('click', function(e) {
  const modal = document.getElementById('modal-dettaglio-commessa');
  if (e.target === modal) {
    chiudiDettaglioCommessa();
  }
});

// ============================================
// MODALE DETTAGLIO DIPENDENTE
// ============================================
let dipendenteCorrenteDettaglio = null;
let filtriDipendente = {
  vista: 'mese',
  giorno: '',
  mese: new Date().getMonth() + 1,
  anno: new Date().getFullYear()
};

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
      r.utente_id === dipendenteCorrenteDettaglio && 
      r.data === giorno
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
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    let html = '';
    let totaleGiorno = 0;
    
    html += `<div class="gruppo-giorno">`;
    html += `<div class="gruppo-giorno-header">`;
    html += `<h4><i class="fas fa-calendar-day"></i> ${dataFormattata}</h4>`;
    
    if (richiesta) {
      const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒' };
      const tipo = richiesta.tipo.toUpperCase();
      html += `<span class="subtotale-giorno">${emoji[richiesta.tipo] || '📌'} ${tipo}</span>`;
      html += `</div>`;
      html += `<div class="table-wrapper" style="margin-top:0;border:none;">`;
      html += `<table>`;
      html += `<tbody>`;
      html += `<tr class="riga-speciale ${richiesta.tipo}">`;
      html += `<td><span class="icona-tipo">${emoji[richiesta.tipo] || '📌'}</span> <strong>${tipo}</strong>`;
      if (richiesta.note) {
        html += ` - ${richiesta.note}`;
      }
      html += `</td>`;
      html += `</tr>`;
      html += `</tbody></table></div>`;
      html += `</div>`;
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
    
    html += `<span class="subtotale-giorno">${totaleGiorno.toFixed(2)}h</span>`;
    html += `</div>`;
    
    html += `<div class="table-wrapper" style="margin-top:0;border:none;">`;
    html += `<table>`;
    html += `<thead><tr>
      <th>Commessa</th>
      <th>Inizio</th>
      <th>Fine</th>
      <th>Ore</th>
      <th>Descrizione</th>
    </tr></thead>`;
    html += `<tbody>`;
    
    registrazioni.sort((a, b) => (a.ora_inizio || '').localeCompare(b.ora_inizio || ''));
    
    registrazioni.forEach(r => {
      const commessa = dati.commesse.find(c => c.id === r.commessa_id);
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
      
      const isStraordinario = r.straordinario ? ' ⭐' : '';
      const isRecupero = r.recupero ? ' ⏰' : '';
      
      html += `<tr>`;
      html += `<td><strong>${commessa?.nome || 'N/A'}</strong></td>`;
      html += `<td>${r.ora_inizio || '-'}</td>`;
      html += `<td>${r.ora_fine || '-'}</td>`;
      html += `<td><strong>${ore.toFixed(2)}h${isStraordinario}${isRecupero}</strong></td>`;
      html += `<td>${r.descrizione || '-'}</td>`;
      html += `</tr>`;
    });
    
    html += `</tbody></table></div>`;
    html += `</div>`;
    
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
        r.utente_id === dipendenteCorrenteDettaglio && 
        r.data === data
      );
      
      const richiesta = dati.richieste.find(r => 
        r.utente_id === dipendenteCorrenteDettaglio && 
        r.stato === 'approvata' &&
        r.data_inizio <= data && r.data_fine >= data
    );
      
      if (isWeekend && registrazioni.length === 0 && !richiesta) {
        continue;
      }
      
      if (registrazioni.length === 0 && !richiesta && !isWeekend) {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        
        if (dataObj < oggi) {
          html += `<div class="gruppo-giorno">`;
          html += `<div class="gruppo-giorno-header">`;
          html += `<h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4>`;
          html += `<span class="subtotale-giorno">⬜ ASSENTE</span>`;
          html += `</div>`;
          html += `</div>`;
        }
        continue;
      }
      
      if (richiesta && registrazioni.length === 0) {
        const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
        const tipo = richiesta.tipo === 'recupero_ore' ? 'RECUPERO ORE' : richiesta.tipo.toUpperCase();
        const emojiChar = emoji[richiesta.tipo] || '📌';
        
        html += `<div class="gruppo-giorno">`;
        html += `<div class="gruppo-giorno-header">`;
        html += `<h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4>`;
        html += `<span class="subtotale-giorno">${emojiChar} ${tipo}</span>`;
        html += `</div>`;
        html += `<div class="table-wrapper" style="margin-top:0;border:none;">`;
        html += `<table><tbody>`;
        html += `<tr class="riga-speciale ${richiesta.tipo}">`;
        html += `<td><span class="icona-tipo">${emojiChar}</span> <strong>${tipo}</strong>`;
        if (richiesta.note) html += ` - ${richiesta.note}`;
        html += `</td></tr>`;
        html += `</tbody></table></div>`;
        html += `</div>`;
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
      
      html += `<div class="gruppo-giorno">`;
      html += `<div class="gruppo-giorno-header">`;
      html += `<h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-settimana">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4>`;
      html += `<span class="subtotale-giorno">${totaleGiorno.toFixed(2)}h</span>`;
      html += `</div>`;
      
      html += `<div class="table-wrapper" style="margin-top:0;border:none;">`;
      html += `<table>`;
      html += `<thead><tr>
        <th>Commessa</th>
        <th>Inizio</th>
        <th>Fine</th>
        <th>Ore</th>
        <th>Descrizione</th>
      </tr></thead>`;
      html += `<tbody>`;
      
      registrazioni.forEach(r => {
        const commessa = dati.commesse.find(c => c.id === r.commessa_id);
        const [h1, m1] = r.ora_inizio.split(':').map(Number);
        const [h2, m2] = r.ora_fine.split(':').map(Number);
        const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
        
        const isStraordinario = r.straordinario ? ' ⭐' : '';
        const isRecupero = r.recupero ? ' ⏰' : '';
        
        html += `<tr>`;
        html += `<td><strong>${commessa?.nome || 'N/A'}</strong></td>`;
        html += `<td>${r.ora_inizio || '-'}</td>`;
        html += `<td>${r.ora_fine || '-'}</td>`;
        html += `<td><strong>${ore.toFixed(2)}h${isStraordinario}${isRecupero}</strong></td>`;
        html += `<td>${r.descrizione || '-'}</td>`;
        html += `</tr>`;
      });
      
      html += `</tbody></table></div>`;
      html += `</div>`;
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
      <div class="footer">
        MEC-ROY srls - Sistema di Gestione Lavoro<br>
        Documento generato automaticamente
      </div>
    </body>
    </html>
  `;

  await scaricaOCondividiFile(fullHTML, `Report_${utente.nome}_${utente.cognome}`);
}

document.addEventListener('click', function(e) {
  const modal = document.getElementById('modal-dettaglio-dipendente');
  if (e.target === modal) {
    chiudiDettaglioDipendente();
  }
});

// ============================================
// CALENDARIO DETTAGLIATO (solo dipendenti)
// ============================================
function cambiaVistaCalendario() {
  caricaCalendario();
}

function caricaCalendarioDettagliato() {
  const mese = parseInt(document.getElementById('cal-mese').value);
  const anno = parseInt(document.getElementById('cal-anno').value);
  const output = document.getElementById('calendario-output');
  
  if (!mese || !anno) {
    output.innerHTML = '<p class="text-muted">Seleziona mese e anno</p>';
    return;
  }
  
  const username = utenteCorrente.username;
  const utente = dati.utenti.find(u => u.username === username);
  if (!utente) {
    output.innerHTML = '<p class="text-muted">Utente non trovato</p>';
    return;
  }
  
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
    
    if (isWeekend && registrazioni.length === 0 && !richiesta) {
      continue;
    }
    
    if (!isWeekend && registrazioni.length === 0 && !richiesta) {
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);
      
      if (dataObj < oggi) {
        html += `<div class="giorno-dettaglio">`;
        html += `<div class="giorno-dettaglio-header">`;
        html += `<h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4>`;
        html += `<span class="giorno-totale">⬜ ASSENTE</span>`;
        html += `</div>`;
        html += `</div>`;
      }
      continue;
    }
    
    if (richiesta && registrazioni.length === 0) {
      const emoji = { ferie: '🏖️', permesso: '📋', malattia: '🤒', recupero_ore: '⏰' };
      const tipo = richiesta.tipo === 'recupero_ore' ? 'RECUPERO ORE' : richiesta.tipo.toUpperCase();
      const emojiChar = emoji[richiesta.tipo] || '📌';
      
      html += `<div class="giorno-dettaglio">`;
      html += `<div class="giorno-dettaglio-header">`;
      html += `<h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4>`;
      html += `<span class="giorno-totale">${emojiChar} ${tipo}</span>`;
      html += `</div>`;
      html += `<div class="table-wrapper" style="margin-top:0;border:none;">`;
      html += `<table><tbody>`;
      html += `<tr class="riga-speciale-giorno ${richiesta.tipo}">`;
      html += `<td>${emojiChar} <strong>${tipo}</strong>`;
      if (richiesta.note) html += ` - ${richiesta.note}`;
      html += `</td></tr>`;
      html += `</tbody></table></div>`;
      html += `</div>`;
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
    
    html += `<div class="giorno-dettaglio">`;
    html += `<div class="giorno-dettaglio-header" style="background:${bgHeader};">`;
    html += `<h4><i class="fas fa-calendar-day"></i> ${g} ${meseNome} ${anno} <span class="giorno-nome">(${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giornoSett]})</span></h4>`;
    html += `<span class="giorno-totale">${totaleGiorno.toFixed(2)}h${isOltre8 ? ' ⚠️' : ''}</span>`;
    html += `</div>`;
    
    html += `<div class="table-wrapper" style="margin-top:0;border:none;">`;
    html += `<table>`;
    html += `<thead><tr>
      <th>Commessa</th>
      <th>Inizio</th>
      <th>Fine</th>
      <th>Ore</th>
      <th>Descrizione</th>
    </tr></thead>`;
    html += `<tbody>`;
    
    registrazioni.forEach(r => {
      const commessa = dati.commesse.find(c => c.id === r.commessa_id);
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
      
      const isStraordinario = r.straordinario ? ' ⭐' : '';
      const isRecupero = r.recupero ? ' ⏰' : '';
      
      html += `<tr>`;
      html += `<td><strong>${commessa?.nome || 'N/A'}</strong></td>`;
      html += `<td>${r.ora_inizio || '-'}</td>`;
      html += `<td>${r.ora_fine || '-'}</td>`;
      html += `<td><strong>${ore.toFixed(2)}h${isStraordinario}${isRecupero}</strong></td>`;
      html += `<td>${r.descrizione || '-'}</td>`;
      html += `</tr>`;
    });
    
    html += `</tbody></table></div>`;
    html += `</div>`;
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

// ============================================
// RICORDAMI - Carica credenziali salvate
// ============================================
// ============================================
// SESSIONE PERSISTENTE — Ricorda l'utente loggato
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
      
      setTimeout(() => {
        document.querySelector('.login-box button').focus();
      }, 100);
    }
  }
}

// ============================================
// LOGOUT - Reset completo dello stato
// ============================================
function logout() {
  cancellaSessione();
  utenteCorrente = null;

  // Reset dei sotto-pannelli Commesse (evita che restino aperti dopo il logout)
  const menuC = document.getElementById('commesse-menu');
  const aggC  = document.getElementById('commesse-aggiungi');
  const anaC  = document.getElementById('commesse-analizza');
  if (menuC) menuC.style.display = 'block';
  if (aggC)  aggC.style.display  = 'none';
  if (anaC)  anaC.style.display  = 'none';

  // Chiudi eventuali modali aperte
  document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));

  document.getElementById('login-page').style.display = 'block';
  document.getElementById('main-page').style.display = 'none';

  // Ricarica le credenziali salvate (se "ricordami" è attivo)
  caricaCredenzialiSalvate();

  // Se NON è ricordami, svuota i campi
  if (localStorage.getItem('ricordami_attivo') !== 'true') {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  }
}

// ============================================
// AVVIO - Carica credenziali all'apertura
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  caricaCredenzialiSalvate();
  
  caricaDati().then(() => {
    const adesso = new Date();
    document.getElementById('cal-mese').value = adesso.getMonth() + 1;
    document.getElementById('cal-anno').value = adesso.getFullYear();

    // 🔑 Controlla se c'è una sessione salvata
    const usernameSalvato = leggiSessione();
    if (usernameSalvato) {
      const utente = dati.utenti.find(u => u.username === usernameSalvato);
      if (utente) {
        // Utente valido → ricrea il login automaticamente
        utenteCorrente = utente;

        // Ricordami: popola il form (ma verrà nascosto subito)
        document.getElementById('username').value = utente.username;
        
        // Applica il login come se l'utente avesse appena cliccato "Entra"
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
          document.getElementById('cal-filtro-dipendente').style.display = 'none';
          document.getElementById('btn-password').style.display = 'none';
          document.getElementById('azienda-container').style.display = 'none';
          document.getElementById('cal-vista-selector').style.display = 'flex';
          showTab('registra');
        }
        
        document.getElementById('notifiche-container').style.display = 'inline-block';
        aggiornaBadgeNotifiche();
        caricaDarkMode();

        // Imposta il mese e l'anno correnti nel calendario
        const adesso = new Date();
        document.getElementById('cal-mese').value = adesso.getMonth() + 1;
        document.getElementById('cal-anno').value = adesso.getFullYear();

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
        
        // Re-inizializza lo smart-time (importante!)
        ['ora-inizio', 'ora-fine', 'recupero-ora-inizio', 'recupero-ora-fine'].forEach(id => {
          const el = document.getElementById(id);
          if (el) initSmartTime(el);
        });
        
        return;
      } else {
        // Utente non più esistente → cancella sessione e mostra login
        cancellaSessione();
      }
    }
    
    // Nessuna sessione valida → mostra login
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('main-page').style.display = 'none';
  }).catch((err) => {
    console.error('❌ Errore caricamento dati:', err);
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('main-page').style.display = 'none';
  });
});

// ============================================
// HELPER: Scarica o Condividi file (funziona su mobile)
// ============================================
async function scaricaOCondividiFile(htmlContent, fileNameBase) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const fileName = `${fileNameBase}_${new Date().toISOString().split('T')[0]}.html`;
  const file = new File([blob], fileName, { type: 'text/html' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: fileNameBase,
        text: 'Report MEC-ROY'
      });
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
// BACKUP ZIP (solo admin)
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

    // ---------- STILI CONDIVISI ----------
    const stiliComuni = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; background: #f5f5f5; margin: 0; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        h1 { color: #00695C; margin: 5px 0; font-size: 1.6em; }
        h2 { color: #00695C; margin: 5px 0; font-size: 1.2em; font-weight: 500; }
        h3 { color: #333; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; table-layout: fixed; }
        th, td { border: 1px solid #ddd; padding: 6px 4px; text-align: center; overflow: hidden; }
        th { background: #00695C; color: white; font-weight: 600; font-size: 11px; }
        td:first-child, th:first-child { text-align: left; padding-left: 10px; min-width: 130px; width: 130px; white-space: nowrap; }
        tr:nth-child(even) td { background: #fafafa; }
        .gruppo { margin-bottom: 25px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .gruppo-header { background: linear-gradient(135deg, #00695C 0%, #004D40 100%); color: white; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; }
        .gruppo-header h4 { margin: 0; font-size: 1em; font-weight: 500; }
        .totale { background: #fff3cd; border: 2px solid #ffc107; padding: 12px; text-align: center; font-weight: bold; border-radius: 8px; color: #856404; margin: 20px 0; }
        .header-info { text-align: center; padding: 10px 0 15px 0; border-bottom: 2px solid #00695C; margin-bottom: 20px; }
        .header-info h1 { border: none; margin: 5px 0; }
        .header-info p { color: #888; margin: 3px 0; font-size: 12px; }
        .footer { text-align: center; padding: 15px; color: #888; font-size: 11px; border-top: 2px solid #ddd; margin-top: 30px; }
        .subtotale { background: rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 10px; font-size: 12px; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: bold; margin-left: 3px; }
        .badge.straordinario { background: #d32f2f; color: white; }
        .badge.recupero { background: #ffc107; color: #333; }
        .legenda { margin: 15px 0; padding: 10px 15px; background: #f8f9fa; border-radius: 6px; font-size: 12px; color: #555; }
        .wrap { overflow-x: auto; }
        @media print {
          body { background: white; padding: 0; }
          .container { box-shadow: none; padding: 10px; }
        }
      </style>
    `;

    const intestazione = (titolo, sottotitolo) => `
      <div class="header-info">
        <h1>MEC-ROY srls</h1>
        <h2>${titolo}</h2>
        ${sottotitolo ? `<p>${sottotitolo}</p>` : ''}
        <p>Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'})}</p>
      </div>
    `;

    const pieDiPagina = `
      <div class="footer">
        MEC-ROY srls - Sistema di Gestione Lavoro<br>
        Documento generato automaticamente dal backup
      </div>
    `;

    const headHTML = (titolo) => `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titolo}</title>${stiliComuni}</head><body><div class="container">`;

    // ---------- FUNZIONE: RENDER ORE MENSILI (riepilogo tutti) ----------
    function renderRiepilogoMensile(anno, mese) {
      const giorniMese = new Date(anno, mese, 0).getDate();
      const mesePadded = String(mese).padStart(2, '0');
      const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
        'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][mese-1];
      const giorniSett = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];

      const dipendenti = dati.utenti.filter(u => u.ruolo === 'dipendente')
        .sort((a,b) => (a.cognome || '').localeCompare(b.cognome || ''));

      let html = `<table><thead><tr><th>Dipendente</th>`;
      for (let g = 1; g <= giorniMese; g++) {
        const giornoSett = new Date(anno, mese - 1, g).getDay();
        const isWeekend = giornoSett === 0 || giornoSett === 6;
        const bg = isWeekend ? '#004D40' : '#00695C';
        html += `<th style="background:${bg};">${g}<br><span style="font-weight:400;font-size:10px;opacity:0.85;">${giorniSett[giornoSett]}</span></th>`;
      }
      html += `<th style="background:#004D40;">Totale</th></tr></thead><tbody>`;

      dipendenti.forEach(dip => {
        html += `<tr><td><strong>${dip.cognome || ''} ${dip.nome || ''}</strong></td>`;
        let totaleOre = 0;

        for (let g = 1; g <= giorniMese; g++) {
          const data = `${anno}-${mesePadded}-${String(g).padStart(2,'0')}`;
          const giornoSett = new Date(anno, mese - 1, g).getDay();
          const isWeekend = giornoSett === 0 || giornoSett === 6;

          const regs = dati.registrazioni.filter(r =>
            r.utente_id === dip.username && r.data === data
          );

          let cella = '';
          let bg = 'white';

          if (regs.length > 0) {
            const haFerie = regs.some(r => r.tipo === 'ferie');
            const haPermesso = regs.some(r => r.tipo === 'permesso');
            const haMalattia = regs.some(r => r.tipo === 'malattia');
            const haLavoro = regs.some(r => r.tipo === 'lavoro');
            const haStraordinario = regs.some(r => r.straordinario === true);
            const haRecupero = regs.some(r => r.recupero === true);

            if (haFerie) { cella = 'F'; bg = '#E3F2FD'; }
            else if (haPermesso) { cella = 'P'; bg = '#FFF3E0'; }
            else if (haMalattia) { cella = 'M'; bg = '#FFEBEE'; }
            else if (haLavoro) {
              let oreG = 0;
              regs.forEach(r => {
                if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
                  const [h1, m1] = r.ora_inizio.split(':').map(Number);
                  const [h2, m2] = r.ora_fine.split(':').map(Number);
                  oreG += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
                }
              });
              totaleOre += oreG;
              if (haStraordinario) { cella = oreG.toFixed(1) + 'h★'; bg = '#ffebee'; }
              else if (haRecupero) { cella = oreG.toFixed(1) + 'h⏰'; bg = '#fff3cd'; }
              else { cella = oreG.toFixed(1) + 'h'; bg = '#E8F5E9'; }
            }
          } else {
            if (isWeekend) { cella = '/'; bg = '#f5f5f5'; }
            else {
              const dataObj = new Date(data + 'T00:00:00');
              const oggi = new Date(); oggi.setHours(0,0,0,0);
              if (dataObj < oggi) { cella = 'A'; bg = '#f5f5f5'; }
            }
          }

          html += `<td style="background:${bg};">${cella}</td>`;
        }

        html += `<td style="background:#e8f5e9;font-weight:bold;color:#2e7d32;">${totaleOre.toFixed(1)}h</td></tr>`;
      });

      html += `</tbody></table>`;

      const legenda = `<div class="legenda"><strong>Legenda:</strong> F = Ferie · P = Permesso · M = Malattia · A = Assente · / = Weekend · Xh = Ore lavorate · ★ = Straordinario · ⏰ = Recupero</div>`;

      return `${headHTML(`Riepilogo ${meseNome} ${anno}`)}
        ${intestazione(`Riepilogo Mensile - ${meseNome} ${anno}`, `Tutti i dipendenti`)}
        ${legenda}
        <div class="wrap">${html}</div>
        ${pieDiPagina}
      </div></body></html>`;
    }

    // ---------- FUNZIONE: RENDER DIPENDENTE MENSILE (singolo) ----------
    function renderDipendenteMensile(dip, anno, mese, registrazioni) {
      const giorniMese = new Date(anno, mese, 0).getDate();
      const mesePadded = String(mese).padStart(2, '0');
      const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
        'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][mese-1];
      const giorniSett = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];

      const perGiorno = {};
      registrazioni.forEach(r => {
        if (!perGiorno[r.data]) perGiorno[r.data] = [];
        perGiorno[r.data].push(r);
      });

      let htmlCalendario = `<div class="wrap"><table><thead><tr>`;
      for (let g = 1; g <= giorniMese; g++) {
        const giornoSett = new Date(anno, mese - 1, g).getDay();
        const isWeekend = giornoSett === 0 || giornoSett === 6;
        const bg = isWeekend ? '#004D40' : '#00695C';
        htmlCalendario += `<th style="background:${bg};width:calc(100% / ${giorniMese});">${g}<br><span style="font-weight:400;font-size:10px;opacity:0.85;">${giorniSett[giornoSett]}</span></th>`;
      }
      htmlCalendario += `</tr></thead><tbody><tr>`;

      let totaleMese = 0;

      for (let g = 1; g <= giorniMese; g++) {
        const data = `${anno}-${mesePadded}-${String(g).padStart(2,'0')}`;
        const giornoSett = new Date(anno, mese - 1, g).getDay();
        const isWeekend = giornoSett === 0 || giornoSett === 6;
        const regs = perGiorno[data] || [];

        let cella = '';
        let bg = 'white';

        if (regs.length > 0) {
          const haFerie = regs.some(r => r.tipo === 'ferie');
          const haPermesso = regs.some(r => r.tipo === 'permesso');
          const haMalattia = regs.some(r => r.tipo === 'malattia');
          const haLavoro = regs.some(r => r.tipo === 'lavoro');
          const haStraordinario = regs.some(r => r.straordinario === true);
          const haRecupero = regs.some(r => r.recupero === true);

          if (haFerie) { cella = 'F'; bg = '#E3F2FD'; }
          else if (haPermesso) { cella = 'P'; bg = '#FFF3E0'; }
          else if (haMalattia) { cella = 'M'; bg = '#FFEBEE'; }
          else if (haLavoro) {
            let oreG = 0;
            regs.forEach(r => {
              if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
                const [h1, m1] = r.ora_inizio.split(':').map(Number);
                const [h2, m2] = r.ora_fine.split(':').map(Number);
                oreG += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
              }
            });
            totaleMese += oreG;
            if (haStraordinario) { cella = oreG.toFixed(1) + 'h★'; bg = '#ffebee'; }
            else if (haRecupero) { cella = oreG.toFixed(1) + 'h⏰'; bg = '#fff3cd'; }
            else { cella = oreG.toFixed(1) + 'h'; bg = '#E8F5E9'; }
          }
        } else {
          if (isWeekend) { cella = '/'; bg = '#f5f5f5'; }
          else {
            const dataObj = new Date(data + 'T00:00:00');
            const oggi = new Date(); oggi.setHours(0,0,0,0);
            if (dataObj < oggi) { cella = 'A'; bg = '#f5f5f5'; }
          }
        }

        htmlCalendario += `<td style="background:${bg};padding:8px 4px;">${cella}</td>`;
      }

      htmlCalendario += `</tr></tbody></table></div>`;

      const giorniConRegs = Object.keys(perGiorno).sort();

      let htmlDettaglio = '';
      if (giorniConRegs.length > 0) {
        htmlDettaglio += `<h3 style="margin-top:25px;">📋 Dettaglio giorno per giorno</h3>`;

        for (const data of giorniConRegs) {
          const regs = perGiorno[data].sort((a,b) => (a.ora_inizio||'').localeCompare(b.ora_inizio||''));
          const dataObj = new Date(data + 'T00:00:00');
          const dataFormattata = dataObj.toLocaleDateString('it-IT', {
            weekday: 'long', day: 'numeric', month: 'long'
          });

          let totGiorno = 0;
          regs.forEach(r => {
            if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
              const [h1, m1] = r.ora_inizio.split(':').map(Number);
              const [h2, m2] = r.ora_fine.split(':').map(Number);
              totGiorno += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
            }
          });

          htmlDettaglio += `<div class="gruppo">`;
          htmlDettaglio += `<div class="gruppo-header"><h4>📅 ${dataFormattata}</h4><span class="subtotale">${totGiorno.toFixed(2)}h</span></div>`;
          htmlDettaglio += `<table><thead><tr><th style="text-align:left;width:auto;">Commessa</th><th style="width:80px;">Inizio</th><th style="width:80px;">Fine</th><th style="width:90px;">Ore</th><th style="text-align:left;width:auto;">Descrizione</th></tr></thead><tbody>`;

          regs.forEach(r => {
            const commessa = dati.commesse.find(c => c.id === r.commessa_id);
            const [h1, m1] = r.ora_inizio.split(':').map(Number);
            const [h2, m2] = r.ora_fine.split(':').map(Number);
            const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);

            let badge = '';
            if (r.straordinario) badge += '<span class="badge straordinario">STRAORD.</span>';
            if (r.recupero) badge += '<span class="badge recupero">RECUPERO</span>';

            htmlDettaglio += `<tr>
              <td style="text-align:left;"><strong>${commessa?.nome || 'N/A'}</strong></td>
              <td>${r.ora_inizio || '-'}</td>
              <td>${r.ora_fine || '-'}</td>
              <td><strong>${ore.toFixed(2)}h</strong>${badge}</td>
              <td style="text-align:left;">${r.descrizione || '-'}</td>
            </tr>`;
          });

          htmlDettaglio += `</tbody></table></div>`;
        }
      }

      const legenda = `<div class="legenda"><strong>Legenda:</strong> F = Ferie · P = Permesso · M = Malattia · A = Assente · / = Weekend · Xh = Ore lavorate · ★ = Straordinario · ⏰ = Recupero</div>`;

      return `${headHTML(`Ore ${meseNome} ${anno} - ${dip.nome} ${dip.cognome}`)}
        ${intestazione(`Ore Mensili - ${meseNome} ${anno}`, `${dip.cognome} ${dip.nome}`)}
        ${legenda}
        <div class="totale">📊 TOTALE MESE: ${totaleMese.toFixed(2)}h</div>
        ${htmlCalendario}
        ${htmlDettaglio}
        ${pieDiPagina}
      </div></body></html>`;
    }

    // ============================================
    // 1. ORE MENSILI (riepilogo + un file per ogni dipendente, per mese)
    // ============================================
    if (tipo === 'tutto' || tipo === 'ore') {
      const cartellaOre = root.folder('Ore_Mensili');

      const combinazioni = new Set();
      dati.registrazioni.forEach(r => {
        if (r.data && r.data.length >= 7) combinazioni.add(r.data.substring(0, 7));
      });

      const combinazioniOrdinate = [...combinazioni].sort();
      const dipendentiOrdinati = dati.utenti
        .filter(u => u.ruolo === 'dipendente')
        .sort((a,b) => (a.cognome || '').localeCompare(b.cognome || ''));

      for (const annoMese of combinazioniOrdinate) {
        const [anno, mese] = annoMese.split('-').map(Number);
        const meseNome = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
          'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][mese-1];

        const cartellaMese = cartellaOre.folder(annoMese);

        // 1a. Riepilogo mensile con tutti i dipendenti
        const htmlRiepilogo = renderRiepilogoMensile(anno, mese);
        cartellaMese.file(`Riepilogo_${meseNome}_${anno}.html`, htmlRiepilogo);

        // 1b. Un file per ogni dipendente con ore in questo mese
        for (const dip of dipendentiOrdinati) {
          const regs = dati.registrazioni.filter(r =>
            r.utente_id === dip.username && r.data.startsWith(annoMese)
          );
          if (regs.length === 0) continue;

          const htmlSingolo = renderDipendenteMensile(dip, anno, mese, regs);
          cartellaMese.file(`${dip.cognome}_${dip.nome}.html`, htmlSingolo);
        }
      }
    }

    // ============================================
    // 2. DIPENDENTI (un file per dipendente, dettaglio completo)
    // ============================================
    if (tipo === 'tutto') {
      const cartellaDip = root.folder('Dipendenti');
      const dipendenti = dati.utenti.filter(u => u.ruolo === 'dipendente')
        .sort((a,b) => (a.cognome || '').localeCompare(b.cognome || ''));

      for (const dip of dipendenti) {
        const registrazioni = dati.registrazioni.filter(r => r.utente_id === dip.username);
        if (registrazioni.length === 0) continue;

        const perGiorno = {};
        registrazioni.forEach(r => {
          if (!perGiorno[r.data]) perGiorno[r.data] = [];
          perGiorno[r.data].push(r);
        });

        const giorniOrdinati = Object.keys(perGiorno).sort();

        let htmlGiorni = '';
        let totaleGenerale = 0;

        for (const data of giorniOrdinati) {
          const regs = perGiorno[data].sort((a,b) => (a.ora_inizio||'').localeCompare(b.ora_inizio||''));
          const dataObj = new Date(data + 'T00:00:00');
          const dataFormattata = dataObj.toLocaleDateString('it-IT', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          });

          let totGiorno = 0;
          regs.forEach(r => {
            if (r.tipo === 'lavoro' && r.ora_inizio && r.ora_fine) {
              const [h1, m1] = r.ora_inizio.split(':').map(Number);
              const [h2, m2] = r.ora_fine.split(':').map(Number);
              totGiorno += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
            }
          });
          totaleGenerale += totGiorno;

          htmlGiorni += `<div class="gruppo">`;
          htmlGiorni += `<div class="gruppo-header"><h4>📅 ${dataFormattata}</h4><span class="subtotale">${totGiorno.toFixed(2)}h</span></div>`;
          htmlGiorni += `<table><thead><tr><th style="width:auto;text-align:left;">Commessa</th><th style="width:80px;">Inizio</th><th style="width:80px;">Fine</th><th style="width:90px;">Ore</th><th style="width:auto;text-align:left;">Descrizione</th></tr></thead><tbody>`;

          regs.forEach(r => {
            const commessa = dati.commesse.find(c => c.id === r.commessa_id);
            const [h1, m1] = r.ora_inizio.split(':').map(Number);
            const [h2, m2] = r.ora_fine.split(':').map(Number);
            const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);

            let badge = '';
            if (r.straordinario) badge += '<span class="badge straordinario">STRAORD.</span>';
            if (r.recupero) badge += '<span class="badge recupero">RECUPERO</span>';

            htmlGiorni += `<tr style="text-align:left;">
              <td style="text-align:left;"><strong>${commessa?.nome || 'N/A'}</strong></td>
              <td>${r.ora_inizio || '-'}</td>
              <td>${r.ora_fine || '-'}</td>
              <td><strong>${ore.toFixed(2)}h</strong>${badge}</td>
              <td style="text-align:left;">${r.descrizione || '-'}</td>
            </tr>`;
          });

          htmlGiorni += `</tbody></table></div>`;
        }

        const htmlCompleto = `${headHTML(`Dettaglio ${dip.nome} ${dip.cognome}`)}
          ${intestazione(`Dettaglio Dipendente`, `${dip.cognome} ${dip.nome} · ${giorniOrdinati.length} giorni registrati`)}
          <div class="totale">📊 TOTALE GENERALE: ${totaleGenerale.toFixed(2)}h</div>
          ${htmlGiorni}
          ${pieDiPagina}
        </div></body></html>`;

        cartellaDip.file(`${dip.cognome}_${dip.nome}.html`, htmlCompleto);
      }
    }

    // ============================================
    // 3. COMMESSE (un file per commessa)
    // ============================================
    if (tipo === 'tutto' || tipo === 'commesse') {
      const cartellaComm = root.folder('Commesse');

      for (const commessa of dati.commesse) {
        const registrazioni = dati.registrazioni.filter(r =>
          r.commessa_id === commessa.id && r.tipo === 'lavoro'
        );
        if (registrazioni.length === 0) continue;

        const perDip = {};
        registrazioni.forEach(r => {
          if (!perDip[r.utente_id]) perDip[r.utente_id] = [];
          perDip[r.utente_id].push(r);
        });

        let htmlDip = '';
        let totaleGenerale = 0;

        for (const username of Object.keys(perDip)) {
          const utente = dati.utenti.find(u => u.username === username);
          const nomeDip = utente ? `${utente.cognome || ''} ${utente.nome || ''}` : username;
          const regs = perDip[username].sort((a,b) => a.data.localeCompare(b.data));

          let totDip = 0;
          regs.forEach(r => { totDip += r.ore || 0; });
          totaleGenerale += totDip;

          htmlDip += `<div class="gruppo">`;
          htmlDip += `<div class="gruppo-header"><h4>👤 ${nomeDip}</h4><span class="subtotale">${totDip.toFixed(2)}h</span></div>`;
          htmlDip += `<table><thead><tr><th style="width:100px;">Data</th><th style="width:80px;">Inizio</th><th style="width:80px;">Fine</th><th style="width:100px;">Ore</th><th style="text-align:left;">Descrizione</th></tr></thead><tbody>`;

          regs.forEach(r => {
            const [h1, m1] = r.ora_inizio.split(':').map(Number);
            const [h2, m2] = r.ora_fine.split(':').map(Number);
            const ore = r.ore || (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);

            let badge = '';
            if (r.straordinario) badge += '<span class="badge straordinario">STRAORD.</span>';
            if (r.recupero) badge += '<span class="badge recupero">RECUPERO</span>';

            htmlDip += `<tr>
              <td>${r.data}</td>
              <td>${r.ora_inizio}</td>
              <td>${r.ora_fine}</td>
              <td><strong>${ore.toFixed(2)}h</strong>${badge}</td>
              <td style="text-align:left;">${r.descrizione || '-'}</td>
            </tr>`;
          });

          htmlDip += `</tbody></table></div>`;
        }

        const nomeFile = commessa.nome.replace(/[^a-zA-Z0-9_-]/g, '_');
        const htmlCompleto = `${headHTML(`Commessa ${commessa.nome}`)}
          ${intestazione(`Report Commessa`, commessa.nome)}
          <div class="totale">📊 TOTALE GENERALE: ${totaleGenerale.toFixed(2)}h</div>
          ${htmlDip}
          ${pieDiPagina}
        </div></body></html>`;

        cartellaComm.file(`${nomeFile}.html`, htmlCompleto);
      }
    }

    // ============================================
    // 4. Genera ZIP
    // ============================================
    msg.innerHTML = '<div class="info-msg">📦 Creazione ZIP in corso...</div>';

    const blob = await zip.generateAsync({ type: 'blob' });
    const nomeZip = `${nomeCartella}.zip`;

    const file = new File([blob], nomeZip, { type: 'application/zip' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: nomeCartella,
          text: 'Backup MEC-ROY'
        });
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
    msg.innerHTML = '<div class="error">❌ Errore durante il backup: ' + err.message + '</div>';
  }
}
// ============================================
// SMART TIME INPUT — Gestione intelligente ore
// ============================================
// Logica:
// - L'utente digita solo cifre
// - Ore valide: 0-24  |  Minuti validi: 0-59
// - Quando completi le ore → focus si sposta alla parte minuti (stesso campo)
// - Quando completi i minuti → focus passa al campo successivo
// - Backspace cancella l'ultima cifra
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

  // Stato interno: 'ore' o 'minuti'
  input.dataset.smartPhase = 'ore';
  input.dataset.smartOre = '';
  input.dataset.smartMinuti = '';

  input.addEventListener('focus', () => {
    // Se ci sono già 4 cifre complete, riparte dalla fase ore quando riselezioni
    if (input.dataset.smartOre.length === 2 && input.dataset.smartMinuti.length === 2) {
      input.dataset.smartPhase = 'ore';
      input.dataset.smartOre = '';
      input.dataset.smartMinuti = '';
      input.value = '';
    }
  });

  input.addEventListener('keydown', (e) => {
    // Blocca caratteri non numerici (eccetto controlli)
    const controllo = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'];
    if (controllo.includes(e.key)) {
      if (e.key === 'Backspace') {
        e.preventDefault();
        gestisciBackspace(input);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        // Completa il campo e salta
        saltaAlProssimo(input);
      }
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    gestisciCifra(input, e.key);
  });

  // Per mobile (input event)
  input.addEventListener('input', (e) => {
    // Rimuovi caratteri non numerici che potrebbero essere inseriti
    const pulito = input.value.replace(/[^\d]/g, '');
    if (pulito.length < 4) {
      input.value = formattaSmartTime(pulito);
    }
  });
}

function gestisciCifra(input, cifra) {
  const fase = input.dataset.smartPhase;
  let ore = input.dataset.smartOre;
  let minuti = input.dataset.smartMinuti;

  if (fase === 'ore') {
    // Ore: 0-24
    const tentativo = ore + cifra; // es. '0' + '8' = '08', oppure '1' + '5' = '15'

    // Prima cifra: se è 3-9, capiamo che l'ora è completa (es. 8 → 08)
    if (ore === '') {
      if (cifra >= '3' && cifra <= '9') {
        // Unica cifra: diventa '0' + cifra
        ore = '0' + cifra;
        input.dataset.smartOre = ore;
        // Passa ai minuti
        input.dataset.smartPhase = 'minuti';
        input.value = formattaSmartTime(ore + ':' + '');
        return;
      } else {
        // 0, 1, 2 → aspetta la seconda cifra
        ore = cifra;
        input.dataset.smartOre = ore;
        input.value = formattaSmartTime(ore + ':');
        return;
      }
    } else {
      // Seconda cifra delle ore
      const oreNum = parseInt(tentativo, 10);
      if (oreNum >= 0 && oreNum <= 24) {
        // Ore valide (00-24)
        let oreFinali;
        if (oreNum === 24) {
          oreFinali = '24';
        } else {
          oreFinali = tentativo.padStart(2, '0');
        }
        input.dataset.smartOre = oreFinali;
        input.dataset.smartPhase = 'minuti';
        input.value = formattaSmartTime(oreFinali + ':');
        return;
      } else {
        // Ore > 24 → non valido, ignora la seconda cifra
        // Resta in fase ore con la prima cifra
        return;
      }
    }
  }

  if (fase === 'minuti') {
    const tentativo = minuti + cifra; // es. '3' + '0' = '30'

    // Prima cifra dei minuti
    if (minuti === '') {
      if (cifra >= '6' && cifra <= '9') {
        // Unica cifra: diventa '0' + cifra
        minuti = '0' + cifra;
        input.dataset.smartMinuti = minuti;
        // Completa e salta
        input.value = formattaSmartTime(input.dataset.smartOre + ':' + minuti);
        saltaAlProssimo(input);
        return;
      } else {
        // 0-5 → aspetta seconda cifra
        minuti = cifra;
        input.dataset.smartMinuti = minuti;
        input.value = formattaSmartTime(input.dataset.smartOre + ':' + minuti);
        return;
      }
    } else {
      // Seconda cifra dei minuti
      const minNum = parseInt(tentativo, 10);
      if (minNum >= 0 && minNum <= 59) {
        const minFinali = tentativo.padStart(2, '0');
        input.dataset.smartMinuti = minFinali;
        input.value = formattaSmartTime(input.dataset.smartOre + ':' + minFinali);
        // Completa e salta
        saltaAlProssimo(input);
        return;
      } else {
        // > 59, ignora
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
      input.value = formattaSmartTime(ore + ':' + minuti);
    } else {
      // Torna alla fase ore
      input.dataset.smartPhase = 'ore';
      if (ore.length > 0) {
        ore = ore.slice(0, -1);
        input.dataset.smartOre = ore;
      }
      input.value = formattaSmartTime(ore + (ore ? ':' : ''));
    }
  } else if (fase === 'ore') {
    if (ore.length > 0) {
      ore = ore.slice(0, -1);
      input.dataset.smartOre = ore;
      input.value = formattaSmartTime(ore + (ore ? ':' : ''));
    }
  }
}

function formattaSmartTime(valore) {
  // valore è tipo '08:' oppure '08:3' oppure '08:30'
  if (!valore) return '';
  if (valore.endsWith(':')) {
    return valore;
  }
  return valore;
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

// Inizializza al caricamento
document.addEventListener('DOMContentLoaded', () => {
  ['ora-inizio', 'ora-fine', 'recupero-ora-inizio', 'recupero-ora-fine'].forEach(id => {
    const el = document.getElementById(id);
    if (el) initSmartTime(el);
  });
});

// Reinizializza nel caso i campi vengano creati dopo (sicurezza)
setTimeout(() => {
  ['ora-inizio', 'ora-fine', 'recupero-ora-inizio', 'recupero-ora-fine'].forEach(id => {
    const el = document.getElementById(id);
    if (el) initSmartTime(el);
  });
}, 1000);

// ============================================
// NOTIFICHE PUSH (Firebase Cloud Messaging)
// ============================================

// Chiave VAPID pubblica generata da Firebase Console
const VAPID_KEY = 'BGDim7zjRi-WXyIDYoKnZjAX92fChXCHo1uUZKOef9l2cHSu6FJrInHrB4IEFAJewF8TrJCDzTsNR1BANwLUml0';

// Chiedi il permesso e salva il token dell'utente
async function chiediPermessoNotifiche() {
  if (!utenteCorrente) return;

  if (!('Notification' in window)) {
    console.warn('⚠️ Notifiche non supportate');
    return;
  }

  if (Notification.permission === 'denied') {
    console.warn('⚠️ Notifiche bloccate');
    return;
  }

  if (Notification.permission === 'default') {
    const permesso = await Notification.requestPermission();
    if (permesso !== 'granted') {
      console.log('❌ Utente ha rifiutato le notifiche');
      return;
    }
  }

  try {
    // 1. Registra il service worker di Firebase ESPLICITAMENTE
    //    e ASPETTA che sia pronto
    console.log('📝 Registrazione firebase-messaging-sw.js...');
    
    const swReg = await navigator.serviceWorker.register(
      './firebase-messaging-sw.js',
      { scope: './firebase-cloud-messaging-push-scope' }
    );
    
    console.log('✅ SW Firebase registrato:', swReg);

    // 2. ASPETTA che il SW sia effettivamente attivo
    await navigator.serviceWorker.ready;
    console.log('✅ Service worker pronto');

    // 3. Ora ottieni il token passando la registrazione
    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (!token) {
      console.warn('⚠️ Nessun token ottenuto');
      return;
    }

    console.log('✅ Token FCM ottenuto:', token);
    window._tokenFCMDebug = token;

    // 4. Salva il token nell'utente su Firestore
    const utente = dati.utenti.find(u => u.username === utenteCorrente.username);
    if (!utente) return;

    if (utente.token_fcm === token) {
      console.log('ℹ️ Token già aggiornato');
      return;
    }

    utente.token_fcm = token;
    await salvaDati();
    console.log('%c✅ Token FCM salvato su Firestore', 'background: #00695C; color: white; padding: 4px 8px; border-radius: 4px;');

  } catch (err) {
    console.error('❌ Errore durante getToken:', err);
    console.error('Dettagli errore:', err.message, err.stack);
  }
}

// Ascolta i cambi automatici del token (Firebase può rigenerarlo)
async function ascoltaRinnovoToken() {
  if (!utenteCorrente) return;
  // if (utenteCorrente.ruolo !== 'dipendente') return;  // commentato per test

  try {
    const messaging = firebase.messaging();
    messaging.onTokenRefresh(async () => {
      console.log('🔄 Token FCM rinnovato, aggiorno Firestore...');
      await chiediPermessoNotifiche();
    });
  } catch (err) {
    // Ignora silenziosamente se non supportato
  }
}
