// ===== VARIABILI GLOBALI =====
let currentUser = null;
let cartellaCorrenteId = null;

// ===== UTENTI DI DEFAULT =====
const DEFAULT_USERS = [
    {
        email: 'admin@mec-roy.it',
        password: 'admin123',
        name: 'Amministratore',
        type: 'admin',
        ruolo: 'admin',
        stato: 'attivo',
        ritardi: 0,
        dataCreazione: new Date().toISOString()
    },
    {
        email: 'mario@mec-roy.it',
        password: '123456',
        name: 'Mario Rossi',
        type: 'user',
        ruolo: 'operaio',
        stato: 'attivo',
        ritardi: 0,
        dataCreazione: new Date().toISOString()
    },
    {
        email: 'luca@mec-roy.it',
        password: '123456',
        name: 'Luca Bianchi',
        type: 'user',
        ruolo: 'operaio',
        stato: 'attivo',
        ritardi: 0,
        dataCreazione: new Date().toISOString()
    },
    {
        email: 'anna@mec-roy.it',
        password: '123456',
        name: 'Anna Verdi',
        type: 'user',
        ruolo: 'operaio',
        stato: 'attivo',
        ritardi: 0,
        dataCreazione: new Date().toISOString()
    }
];

// ===== INIZIALIZZAZIONE COMPLETA DEL DATABASE =====
async function inizializzaDatabaseCompleto() {
    console.log('🚀 Inizializzazione database in corso...');
    
    // Verifica che Firebase sia disponibile
    if (typeof db === 'undefined') {
        console.error('❌ Firebase non disponibile');
        return false;
    }
    
    try {
        // 1. CREA COLLEZIONE UTENTI
        console.log('📝 Creazione utenti...');
        for (const user of DEFAULT_USERS) {
            const userRef = db.collection('utenti').doc(user.email);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                await userRef.set(user);
                console.log(`✅ Utente creato: ${user.email}`);
            } else {
                console.log(`ℹ️ Utente già esistente: ${user.email}`);
            }
        }
        
        // 2. CREA COLLEZIONE COMMESSE (esempi)
        console.log('📝 Creazione commesse esempio...');
        const commesseEsempio = [
            {
                codice: 'CC2024-001',
                descrizione: 'Progetto A - Nuova linea produzione',
                dataCreazione: new Date().toLocaleDateString('it-IT'),
                terminata: false
            },
            {
                codice: 'CC2024-002',
                descrizione: 'Manutenzione impianti elettrici',
                dataCreazione: new Date().toLocaleDateString('it-IT'),
                terminata: false
            },
            {
                codice: 'CC2024-003',
                descrizione: 'Installazione nuovi macchinari',
                dataCreazione: new Date().toLocaleDateString('it-IT'),
                terminata: false
            }
        ];
        
        const commesseSnapshot = await db.collection('commesse').get();
        if (commesseSnapshot.empty) {
            for (const commessa of commesseEsempio) {
                await db.collection('commesse').add(commessa);
                console.log(`✅ Commessa creata: ${commessa.codice}`);
            }
        } else {
            console.log(`ℹ️ Già presenti ${commesseSnapshot.size} commesse`);
        }
        
        // 3. CREA COLLEZIONE RICHIESTE (esempi)
        console.log('📝 Creazione richieste esempio...');
        const richiesteSnapshot = await db.collection('richieste').get();
        if (richiesteSnapshot.empty) {
            const richiesteEsempio = [
                {
                    id: Date.now(),
                    utente: 'Mario Rossi',
                    utenteEmail: 'mario@mec-roy.it',
                    tipo: 'Ferie',
                    dal: '2026-03-15',
                    al: '2026-03-20',
                    stato: 'in attesa',
                    dataRichiesta: new Date().toISOString()
                },
                {
                    id: Date.now() + 1,
                    utente: 'Luca Bianchi',
                    utenteEmail: 'luca@mec-roy.it',
                    tipo: 'Permesso',
                    dal: '2026-03-10',
                    al: '2026-03-10',
                    stato: 'in attesa',
                    dataRichiesta: new Date().toISOString()
                }
            ];
            
            for (const richiesta of richiesteEsempio) {
                await db.collection('richieste').add(richiesta);
                console.log(`✅ Richiesta creata: ${richiesta.tipo} per ${richiesta.utente}`);
            }
        }
        
        console.log('✅ Database inizializzato completamente!');
        return true;
        
    } catch (error) {
        console.error('❌ Errore inizializzazione database:', error);
        
        // Se l'errore è di permessi, mostra istruzioni
        if (error.code === 'permission-denied') {
            console.error('⚠️ ERRORE DI PERMESSI!');
            console.error('Devi modificare le regole di Firestore:');
            console.error('1. Vai su Firebase Console -> Firestore Database -> Regole');
            console.error('2. Imposta le regole a: allow read, write: if true;');
            console.error('3. Clicca Pubblica');
        }
        
        return false;
    }
}

// ===== LOGIN =====
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMessage');
    
    if (!email || !password) {
        errorMsg.textContent = 'Inserisci email e password';
        errorMsg.style.display = 'block';
        return;
    }
    
    try {
        // Prima verifica che il database sia inizializzato
        const databasePronto = await inizializzaDatabaseCompleto();
        
        if (!databasePronto) {
            errorMsg.textContent = 'Errore di connessione al database. Verifica le regole di Firestore.';
            errorMsg.style.display = 'block';
            return;
        }
        
        // Cerca l'utente
        const userDoc = await db.collection('utenti').doc(email).get();
        
        if (!userDoc.exists) {
            errorMsg.textContent = 'Utente non trovato. Usa: admin@mec-roy.it / admin123';
            errorMsg.style.display = 'block';
            return;
        }
        
        const userData = userDoc.data();
        
        if (userData.password === password) {
            errorMsg.style.display = 'none';
            
            currentUser = {
                id: email,
                email: email,
                ...userData
            };
            
            window.currentUser = currentUser;
            
            // Inizializza localStorage per l'utente
            if (!localStorage.getItem(`cartelle_${email}`)) {
                localStorage.setItem(`cartelle_${email}`, JSON.stringify([]));
            }
            
            caricaTemaSalvato();
            
            if (currentUser.type === 'admin') {
                await caricaPagina('admin-dashboard.html');
                initAdminDashboard();
            } else {
                await caricaPagina('user-dashboard.html');
                initUserDashboard();
            }
        } else {
            errorMsg.textContent = 'Password errata';
            errorMsg.style.display = 'block';
        }
    } catch (error) {
        console.error('Errore login:', error);
        
        if (error.code === 'permission-denied') {
            errorMsg.innerHTML = '⚠️ ERRORE PERMESSI FIRESTORE!<br><br>' +
                'Devi modificare le regole di Firestore:<br>' +
                '1. Vai su <strong>Firebase Console</strong><br>' +
                '2. Seleziona <strong>Firestore Database</strong><br>' +
                '3. Clicca su <strong>Regole</strong><br>' +
                '4. Sostituisci con:<br>' +
                '<code style="background:#000; padding:5px; display:block; margin:5px 0;">rules_version = \'2\';<br>' +
                'service cloud.firestore {<br>' +
                '&nbsp;&nbsp;match /databases/{database}/documents {<br>' +
                '&nbsp;&nbsp;&nbsp;&nbsp;match /{document=**} {<br>' +
                '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if true;<br>' +
                '&nbsp;&nbsp;&nbsp;&nbsp;}<br>' +
                '&nbsp;&nbsp;}<br>' +
                '}</code><br>' +
                '5. Clicca <strong>Pubblica</strong><br>' +
                '6. Ricarica la pagina';
            errorMsg.style.display = 'block';
        } else {
            errorMsg.textContent = 'Errore: ' + error.message;
            errorMsg.style.display = 'block';
        }
    }
}

// ===== LOGOUT =====
function logout() {
    currentUser = null;
    window.currentUser = null;
    window.location.reload();
}

// ===== NAVIGAZIONE =====
async function caricaPagina(nomeFile) {
    try {
        let html = '';
        
        switch(nomeFile) {
            case 'admin-dashboard.html':
                html = getAdminDashboardHTML();
                break;
            case 'user-dashboard.html':
                html = getUserDashboardHTML();
                break;
            case 'numeri-mancanti.html':
                html = getNumeriMancantiHTML();
                break;
            case 'segna-ore.html':
                html = getSegnaOreHTML();
                break;
            case 'gestione-commesse.html':
                html = getGestioneCommesseHTML();
                break;
            case 'gestione-utenti.html':
                html = getGestioneUtentiHTML();
                break;
            default:
                html = `<div class="dashboard">
                    <div class="header">
                        <div class="header-left">
                            <button class="back-btn" onclick="tornaIndietro()">← Torna indietro</button>
                            <h2>📄 ${nomeFile}</h2>
                        </div>
                    </div>
                    <div style="text-align: center; padding: 50px;">
                        <p>Pagina in costruzione</p>
                    </div>
                </div>`;
        }
        
        document.getElementById('container').innerHTML = html;
        document.getElementById('container').classList.add('wide');
    } catch (error) {
        console.error('Errore caricamento pagina:', error);
    }
}

// ===== TEMPLATE HTML =====
function getAdminDashboardHTML() {
    return `
        <div class="dashboard">
            <div class="header">
                <div class="header-left">
                    <button class="back-btn" onclick="logout()">🚪 Logout</button>
                    <h2>👑 Admin Dashboard</h2>
                </div>
                <div class="header-right">
                    <button class="header-btn" onclick="mostraSelettoreTema()">🎨 Tema</button>
                </div>
            </div>
            
            <div class="admin-grid">
                <div class="admin-card" onclick="mostraGestioneUtenti()">
                    <div class="admin-card-icon">👥</div>
                    <h3>Gestione Utenti</h3>
                    <p>Aggiungi/modifica dipendenti</p>
                </div>
                <div class="admin-card" onclick="mostraNumeriMancanti()">
                    <div class="admin-card-icon">🔢</div>
                    <h3>Numeri Mancanti</h3>
                    <p>Gestione cartelle numeri</p>
                </div>
                <div class="admin-card" onclick="mostraSegnaOre()">
                    <div class="admin-card-icon">⏱️</div>
                    <h3>Segna Ore</h3>
                    <p>Registrazione ore lavoro</p>
                </div>
                <div class="admin-card" onclick="mostraGestioneCommesse()">
                    <div class="admin-card-icon">📋</div>
                    <h3>Commesse</h3>
                    <p>Gestione progetti</p>
                </div>
                <div class="admin-card" onclick="mostraReportOre()">
                    <div class="admin-card-icon">📊</div>
                    <h3>Report Ore</h3>
                    <p>Visualizza statistiche</p>
                </div>
            </div>
            
            <div id="richiesteList" class="numbers-list" style="margin-top: 20px;"></div>
        </div>
    `;
}

function getUserDashboardHTML() {
    return `
        <div class="dashboard">
            <div class="header">
                <div class="header-left">
                    <button class="back-btn" onclick="logout()">🚪 Logout</button>
                    <h2>👤 ${currentUser?.name || 'Utente'}</h2>
                </div>
                <div class="header-right">
                    <button class="header-btn" onclick="mostraSelettoreTema()">🎨 Tema</button>
                </div>
            </div>
            
            <div id="ingressoContainer" style="text-align: center;">
                <div class="info-badge" style="margin: 10px 0; background: var(--card-bg); padding: 10px; border-radius: 8px;">
                    <span id="ritardiCounter">Ritardi: ${currentUser?.ritardi || 0}</span>
                </div>
                <div class="ingresso-btn" id="ingressoBtn" onclick="faiIngresso()">
                    <span>🕐<br>ENTRA</span>
                </div>
                <div class="info-badge" style="background: var(--card-bg); padding: 10px; border-radius: 8px; margin-top: 10px;">
                    Ultimo ingresso: <span id="ultimoIngresso">${currentUser?.ultimoIngresso || '--:--'}</span>
                </div>
            </div>
            
            <div class="admin-grid" style="margin-top: 20px;">
                <div class="admin-card" onclick="mostraNumeriMancanti()">
                    <div class="admin-card-icon">🔢</div>
                    <h3>Numeri Mancanti</h3>
                    <p>Gestione cartelle</p>
                </div>
                <div class="admin-card" onclick="mostraSegnaOre()">
                    <div class="admin-card-icon">⏱️</div>
                    <h3>Segna Ore</h3>
                    <p>Registra ore lavoro</p>
                </div>
                <div class="admin-card" onclick="mostraRichiesteUtente()">
                    <div class="admin-card-icon">📝</div>
                    <h3>Richiedi Permesso</h3>
                    <p>Ferie/permessi/malattia</p>
                </div>
            </div>
        </div>
    `;
}

function getNumeriMancantiHTML() {
    return `
        <div class="dashboard">
            <div class="header">
                <div class="header-left">
                    <button class="back-btn" onclick="tornaIndietro()">← Indietro</button>
                    <h2>🔢 Numeri Mancanti</h2>
                </div>
                <div class="header-right">
                    <button class="header-btn" onclick="mostraNuovaCartella()">➕ Nuova Cartella</button>
                    <button class="header-btn" onclick="condividiTutto()">📄 Esporta Tutto</button>
                </div>
            </div>
            <div id="elencoCartelle" class="admin-grid"></div>
        </div>
    `;
}

function getSegnaOreHTML() {
    return `
        <div class="dashboard">
            <div class="header">
                <div class="header-left">
                    <button class="back-btn" onclick="tornaIndietro()">← Indietro</button>
                    <h2>⏱️ Segna Ore</h2>
                </div>
            </div>
            
            <div class="input-page" style="background: var(--card-bg); padding: 20px; border-radius: 10px;">
                <div class="input-group">
                    <label>📅 Data</label>
                    <input type="date" id="dataOre" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="input-group">
                    <label>🕐 Inizio</label>
                    <input type="text" id="oreInizio" placeholder="08:00" oninput="mascheraOra(this)" maxlength="5">
                </div>
                <div class="input-group">
                    <label>🕐 Fine</label>
                    <input type="text" id="oreFine" placeholder="12:00" oninput="mascheraOra(this)" maxlength="5">
                </div>
                <div class="input-group">
                    <label>📋 Commessa</label>
                    <select id="oreCommessa"></select>
                </div>
                <div class="input-group">
                    <label>📝 Descrizione</label>
                    <input type="text" id="oreDescrizione" placeholder="Descrizione attività">
                </div>
                <button onclick="salvaOre()">💾 Salva Ore</button>
            </div>
            
            <h3 style="margin-top: 20px; color: var(--text-primary);">Ore di oggi</h3>
            <div id="listaOre" class="numbers-list" style="background: var(--card-bg); padding: 15px; border-radius: 10px;"></div>
        </div>
    `;
}

function getGestioneCommesseHTML() {
    return `
        <div class="dashboard">
            <div class="header">
                <div class="header-left">
                    <button class="back-btn" onclick="tornaIndietro()">← Indietro</button>
                    <h2>📋 Gestione Commesse</h2>
                </div>
                <div class="header-right">
                    <button class="header-btn" onclick="mostraNuovaCommessa()">➕ Nuova Commessa</button>
                </div>
            </div>
            <div id="elencoCommesse"></div>
        </div>
    `;
}

function getGestioneUtentiHTML() {
    return `
        <div class="dashboard">
            <div class="header">
                <div class="header-left">
                    <button class="back-btn" onclick="tornaIndietro()">← Indietro</button>
                    <h2>👥 Gestione Utenti</h2>
                </div>
                <div class="header-right">
                    <button class="header-btn" onclick="mostraNuovoUtente()">➕ Nuovo Utente</button>
                    <button class="header-btn" onclick="esportaUtenti()">📄 Esporta CSV</button>
                </div>
            </div>
            <div style="overflow-x: auto;">
                <table class="presenze-table" style="width: 100%;">
                    <thead>
                        <tr><th>Nome</th><th>Email</th><th>Ruolo</th><th>Stato</th><th>Ritardi</th><th>Azioni</th></tr>
                    </thead>
                    <tbody id="utentiTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

// ===== FUNZIONI ADMIN =====
function initAdminDashboard() {
    caricaTemaSalvato();
    caricaRichiesteAdmin();
}

async function mostraGestioneUtenti() {
    await caricaPagina('gestione-utenti.html');
    await caricaTabellaUtenti();
}

function mostraNumeriMancanti() {
    caricaPagina('numeri-mancanti.html').then(() => {
        caricaElencoCartelle();
    });
}

function mostraSegnaOre() {
    caricaPagina('segna-ore.html').then(() => {
        caricaOreSalvate();
        caricaCommesseInSelect();
    });
}

function mostraGestioneCommesse() {
    caricaPagina('gestione-commesse.html').then(() => {
        caricaElencoCommesse();
    });
}

function mostraReportOre() {
    caricaPagina('report-ore.html').then(() => {
        document.getElementById('container').innerHTML = `
            <div class="dashboard">
                <div class="header">
                    <div class="header-left">
                        <button class="back-btn" onclick="tornaIndietro()">← Indietro</button>
                        <h2>📊 Report Ore</h2>
                    </div>
                </div>
                <div style="overflow-x: auto;">
                    <table class="presenze-table" style="width: 100%;">
                        <thead>
                            <tr><th>Dipendente</th><th>Data</th><th>Orario</th><th>Ore</th><th>Commessa</th></tr>
                        </thead>
                        <tbody id="reportOreBody"></tbody>
                    </table>
                </div>
                <div style="margin-top: 20px; text-align: center; background: var(--card-bg); padding: 15px; border-radius: 10px;">
                    <strong style="color: var(--text-primary);">Totale Ore: </strong>
                    <span id="totaleOre">0h</span>
                </div>
            </div>
        `;
        caricaReportOre();
    });
}

function tornaIndietro() {
    if (currentUser?.type === 'admin') {
        caricaPagina('admin-dashboard.html').then(() => initAdminDashboard());
    } else {
        caricaPagina('user-dashboard.html').then(() => initUserDashboard());
    }
}

// ===== FUNZIONI UTENTE =====
function initUserDashboard() {
    caricaTemaSalvato();
    const ritardiSpan = document.getElementById('ritardiCounter');
    if (ritardiSpan) ritardiSpan.innerHTML = `Ritardi: ${currentUser?.ritardi || 0}`;
    caricaUltimoIngresso();
}

async function caricaUltimoIngresso() {
    if (!currentUser) return;
    
    try {
        const oggi = new Date().toISOString().split('T')[0];
        const ingressi = await caricaIngressiDaFirestore(currentUser.email, oggi);
        
        if (ingressi.length > 0) {
            const ultimo = ingressi[ingressi.length - 1];
            const ultimoSpan = document.getElementById('ultimoIngresso');
            if (ultimoSpan) ultimoSpan.textContent = ultimo.ora;
            
            const btn = document.getElementById('ingressoBtn');
            if (btn && ingressi.some(i => i.tipo === 'primo')) {
                btn.classList.add('disabled');
            }
        }
    } catch (error) {
        console.error('Errore caricamento ingressi:', error);
    }
}

function mostraRichiesteUtente() {
    const html = `
        <div class="dashboard">
            <div class="header">
                <div class="header-left">
                    <button class="back-btn" onclick="tornaIndietro()">← Indietro</button>
                    <h2>📝 Richiedi Permesso</h2>
                </div>
            </div>
            <div class="input-page" style="background: var(--card-bg); padding: 20px; border-radius: 10px;">
                <div class="input-group">
                    <label>📋 Tipo</label>
                    <select id="tipoRichiesta">
                        <option value="ferie">Ferie</option>
                        <option value="permesso">Permesso</option>
                        <option value="malattia">Malattia</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>📅 Dal</label>
                    <input type="date" id="dataInizio">
                </div>
                <div class="input-group">
                    <label>📅 Al</label>
                    <input type="date" id="dataFine">
                </div>
                <button onclick="inviaRichiesta()">📨 Invia Richiesta</button>
            </div>
            <h3 style="margin-top: 20px; color: var(--text-primary);">📋 Le tue richieste</h3>
            <div id="storicoRichieste" class="numbers-list" style="background: var(--card-bg); padding: 15px; border-radius: 10px;"></div>
        </div>
    `;
    
    document.getElementById('container').innerHTML = html;
    document.getElementById('container').classList.add('wide');
    caricaStoricoRichieste();
}

// ===== FUNZIONI INGRESSO =====
async function faiIngresso() {
    if (!currentUser) return;
    
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    const oggi = now.toISOString().split('T')[0];
    
    try {
        let ingressiOggi = await caricaIngressiDaFirestore(currentUser.email, oggi);
        
        if (ingressiOggi.some(i => i.tipo === 'primo')) {
            mostraPopup('Hai già effettuato il primo ingresso oggi', 'errore');
            return;
        }
        
        const inRitardo = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 1);
        
        if (inRitardo) {
            currentUser.ritardi = (currentUser.ritardi || 0) + 1;
            const ritardiSpan = document.getElementById('ritardiCounter');
            if (ritardiSpan) ritardiSpan.innerHTML = `Ritardi: ${currentUser.ritardi}`;
            
            await db.collection('utenti').doc(currentUser.email).update({
                ritardi: currentUser.ritardi
            });
            
            mostraPopup(`Attenzione: Primo ingresso in ritardo!`, 'ritardo');
            const btn = document.getElementById('ingressoBtn');
            if (btn) btn.classList.add('ritardo');
        } else {
            mostraPopup(`Primo ingresso registrato alle ${time}`, 'info');
        }
        
        const nuovoIngresso = { ora: time, tipo: 'primo', ritardo: inRitardo };
        ingressiOggi.push(nuovoIngresso);
        await salvaIngressiSuFirestore(currentUser.email, oggi, ingressiOggi);
        
        const ultimoSpan = document.getElementById('ultimoIngresso');
        if (ultimoSpan) ultimoSpan.textContent = time;
        
        const btn = document.getElementById('ingressoBtn');
        if (btn) btn.classList.add('disabled');
        
    } catch (error) {
        console.error('Errore registrazione ingresso:', error);
        mostraPopup('Errore durante la registrazione', 'errore');
    }
}

// ===== FUNZIONI ORE =====
async function salvaOre() {
    const data = document.getElementById('dataOre').value;
    const inizio = document.getElementById('oreInizio').value;
    const fine = document.getElementById('oreFine').value;
    const commessa = document.getElementById('oreCommessa').value;
    const descrizione = document.getElementById('oreDescrizione').value;
    
    if (!data || !inizio || !fine || !commessa) {
        mostraPopup('Compila tutti i campi', 'errore');
        return;
    }
    
    const oreData = {
        data: data,
        inizio: inizio,
        fine: fine,
        commessa: commessa,
        descrizione: descrizione,
        dataRegistrazione: new Date().toISOString()
    };
    
    try {
        let oreSalvate = await caricaOreDaFirestore(currentUser.email);
        oreSalvate.push(oreData);
        await salvaOreSuFirestore(currentUser.email, oreSalvate);
        
        mostraPopup('Ore salvate con successo!', 'info');
        
        document.getElementById('oreInizio').value = '';
        document.getElementById('oreFine').value = '';
        document.getElementById('oreDescrizione').value = '';
        
        caricaOreSalvate();
    } catch (error) {
        console.error('Errore salvataggio ore:', error);
        mostraPopup('Errore durante il salvataggio', 'errore');
    }
}

async function caricaOreSalvate() {
    const container = document.getElementById('listaOre');
    if (!container || !currentUser) return;
    
    try {
        const oreSalvate = await caricaOreDaFirestore(currentUser.email);
        const oggi = new Date().toISOString().split('T')[0];
        const oreOggi = oreSalvate.filter(ore => ore.data === oggi);
        
        if (oreOggi.length === 0) {
            container.innerHTML = '<div style="text-align:center;">Nessuna ora registrata oggi</div>';
            return;
        }
        
        let html = '';
        oreOggi.forEach(ore => {
            html += `
                <div style="padding: 8px; border-bottom: 1px solid var(--border-color);">
                    ${ore.inizio} - ${ore.fine} | ${ore.commessa}<br>
                    <small style="color: var(--text-secondary);">${ore.descrizione}</small>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento ore:', error);
    }
}

async function caricaReportOre() {
    const container = document.getElementById('reportOreBody');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('utenti').get();
        let html = '';
        let totaleOre = 0;
        
        for (const userDoc of snapshot.docs) {
            const user = userDoc.data();
            if (user.type === 'admin') continue;
            
            const oreSalvate = await caricaOreDaFirestore(user.email);
            
            oreSalvate.forEach(ore => {
                const [h1, m1] = ore.inizio.split(':').map(Number);
                const [h2, m2] = ore.fine.split(':').map(Number);
                const oreLavorate = (h2 - h1) + (m2 - m1) / 60;
                totaleOre += oreLavorate;
                
                html += `
                    <tr>
                        <td style="padding: 8px;">${user.name}</td>
                        <td style="padding: 8px;">${ore.data}</td>
                        <td style="padding: 8px;">${ore.inizio} - ${ore.fine}</td>
                        <td style="padding: 8px;">${oreLavorate.toFixed(1)}h</td>
                        <td style="padding: 8px;">${ore.commessa}</td>
                    </tr>
                `;
            });
        }
        
        if (html === '') {
            html = '<tr><td colspan="5" style="text-align:center;">Nessuna ora registrata</td></tr>';
        }
        
        container.innerHTML = html;
        const totaleSpan = document.getElementById('totaleOre');
        if (totaleSpan) totaleSpan.textContent = totaleOre.toFixed(1) + 'h';
        
    } catch (error) {
        console.error('Errore caricamento report:', error);
    }
}

// ===== FUNZIONI RICHIESTE =====
async function inviaRichiesta() {
    const tipo = document.getElementById('tipoRichiesta').value;
    const dal = document.getElementById('dataInizio').value;
    const al = document.getElementById('dataFine').value;
    
    if (!dal || !al) {
        mostraPopup('Seleziona le date', 'errore');
        return;
    }
    
    const nuovaRichiesta = {
        id: Date.now(),
        utente: currentUser.name,
        utenteEmail: currentUser.email,
        tipo: tipo === 'ferie' ? 'Ferie' : (tipo === 'permesso' ? 'Permesso' : 'Malattia'),
        dal: dal,
        al: al,
        stato: 'in attesa',
        dataRichiesta: new Date().toISOString()
    };
    
    try {
        await db.collection('richieste').add(nuovaRichiesta);
        mostraPopup('Richiesta inviata con successo!', 'info');
        
        document.getElementById('dataInizio').value = '';
        document.getElementById('dataFine').value = '';
        
        caricaStoricoRichieste();
        caricaRichiesteAdmin();
    } catch (error) {
        console.error('Errore invio richiesta:', error);
        mostraPopup('Errore durante l\'invio', 'errore');
    }
}

async function caricaStoricoRichieste() {
    const container = document.getElementById('storicoRichieste');
    if (!container || !currentUser) return;
    
    try {
        const snapshot = await db.collection('richieste')
            .where('utenteEmail', '==', currentUser.email)
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<div style="text-align:center;">Nessuna richiesta</div>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const r = doc.data();
            const icona = r.stato === 'approvata' ? '✅' : (r.stato === 'rifiutata' ? '❌' : '⏳');
            html += `
                <div style="padding: 10px; border-bottom: 1px solid var(--border-color);">
                    ${icona} ${r.tipo}: dal ${r.dal} al ${r.al}
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento richieste:', error);
    }
}

async function caricaRichiesteAdmin() {
    const container = document.getElementById('richiesteList');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('richieste')
            .where('stato', '==', 'in attesa')
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center;">Nessuna richiesta in attesa</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const r = doc.data();
            html += `
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: var(--text-primary);">${r.utente}</strong> - ${r.tipo}<br>
                        <small style="color: var(--text-secondary);">Dal ${r.dal} al ${r.al}</small>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="approvaRichiesta('${doc.id}')" style="background: var(--success-bg); color: white; border: none; padding: 5px 15px; border-radius: 5px; cursor: pointer;">✓ Approva</button>
                        <button onclick="rifiutaRichiesta('${doc.id}')" style="background: var(--danger-bg); color: white; border: none; padding: 5px 15px; border-radius: 5px; cursor: pointer;">✗ Rifiuta</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento richieste admin:', error);
    }
}

async function approvaRichiesta(id) {
    try {
        await db.collection('richieste').doc(id).update({ stato: 'approvata' });
        mostraPopup('Richiesta approvata', 'info');
        caricaRichiesteAdmin();
    } catch (error) {
        console.error('Errore approvazione:', error);
    }
}

async function rifiutaRichiesta(id) {
    try {
        await db.collection('richieste').doc(id).update({ stato: 'rifiutata' });
        mostraPopup('Richiesta rifiutata', 'info');
        caricaRichiesteAdmin();
    } catch (error) {
        console.error('Errore rifiuto:', error);
    }
}

// ===== FUNZIONI UTENTI =====
async function caricaTabellaUtenti() {
    const tbody = document.getElementById('utentiTableBody');
    if (!tbody) return;
    
    try {
        const snapshot = await db.collection('utenti').get();
        let html = '';
        
        snapshot.forEach(doc => {
            const user = doc.data();
            if (user.type !== 'admin') {
                let statoClass = 'presente';
                if (user.stato === 'ferie') statoClass = 'ferie';
                else if (user.stato === 'malattia') statoClass = 'malattia';
                
                html += `
                    <tr>
                        <td style="padding: 8px;">${user.name}</td>
                        <td style="padding: 8px;">${doc.id}</td>
                        <td style="padding: 8px;">${user.ruolo || 'Operaio'}</td>
                        <td style="padding: 8px;"><span class="status ${statoClass}">${user.stato}</span></td>
                        <td style="padding: 8px;">${user.ritardi || 0}</td>
                        <td style="padding: 8px;">
                            <button onclick="eliminaUtente('${doc.id}')" style="background: var(--danger-bg); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">🗑️</button>
                        </td>
                    </tr>
                `;
            }
        });
        
        tbody.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento utenti:', error);
    }
}

async function eliminaUtente(email) {
    if (confirm('Eliminare questo utente?')) {
        try {
            await db.collection('utenti').doc(email).delete();
            mostraPopup('Utente eliminato', 'info');
            caricaTabellaUtenti();
        } catch (error) {
            console.error('Errore eliminazione:', error);
        }
    }
}

function mostraNuovoUtente() {
    const popupHtml = `
        <div class="popup" id="utentePopup" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-container); border: 2px solid var(--border-color); border-radius: 10px; padding: 25px; z-index: 2000; box-shadow: 0 0 30px rgba(0,0,0,0.5); min-width: 350px;">
            <h3 style="color: var(--text-primary); margin-bottom: 15px;">➕ Nuovo Utente</h3>
            <div class="input-group">
                <label>Nome completo</label>
                <input type="text" id="nuovoNome" placeholder="Mario Rossi" style="width: 100%; padding: 10px;">
            </div>
            <div class="input-group">
                <label>Email</label>
                <input type="email" id="nuovaEmail" placeholder="nome@mec-roy.it" style="width: 100%; padding: 10px;">
            </div>
            <div class="input-group">
                <label>Password</label>
                <input type="password" id="nuovaPassword" placeholder="******" style="width: 100%; padding: 10px;">
            </div>
            <div class="input-group">
                <label>Ruolo</label>
                <select id="nuovoRuolo" style="width: 100%; padding: 10px;">
                    <option value="user">👷 Operaio</option>
                    <option value="admin">👑 Amministratore</option>
                </select>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button onclick="salvaNuovoUtente()" style="flex: 1;">✅ Salva</button>
                <button onclick="chiudiPopup()" style="flex: 1; background: var(--error-bg);">❌ Annulla</button>
            </div>
        </div>
        <div id="popupOverlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1999;"></div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', popupHtml);
}

async function salvaNuovoUtente() {
    const nome = document.getElementById('nuovoNome')?.value;
    const email = document.getElementById('nuovaEmail')?.value;
    const password = document.getElementById('nuovaPassword')?.value;
    const ruolo = document.getElementById('nuovoRuolo')?.value;
    
    if (!nome || !email || !password) {
        alert('Compila tutti i campi');
        return;
    }
    
    try {
        await db.collection('utenti').doc(email).set({
            email: email,
            password: password,
            name: nome,
            type: ruolo,
            ruolo: ruolo === 'admin' ? 'admin' : 'operaio',
            stato: 'attivo',
            ritardi: 0,
            dataCreazione: new Date().toISOString()
        });
        
        mostraPopup(`✅ Utente ${nome} creato con successo!`, 'info');
        chiudiPopup();
        caricaTabellaUtenti();
    } catch (error) {
        console.error('Errore creazione utente:', error);
        mostraPopup('Errore durante la creazione', 'errore');
    }
}

function chiudiPopup() {
    const popup = document.getElementById('utentePopup');
    const overlay = document.getElementById('popupOverlay');
    if (popup) popup.remove();
    if (overlay) overlay.remove();
}

// ===== FUNZIONI COMMESSE =====
async function caricaElencoCommesse() {
    const container = document.getElementById('elencoCommesse');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('commesse').get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center;">📭 Nessuna commessa. Clicca "Nuova Commessa" per iniziare.</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const commessa = doc.data();
            html += `
                <div style="background: var(--card-bg); border: 2px solid var(--border-color); border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: var(--text-primary); font-size: 18px;">📋 ${commessa.codice}</strong>
                            ${commessa.terminata ? '<span style="color: var(--error-text); margin-left: 10px;">(Terminata)</span>' : ''}
                        </div>
                        <button onclick="eliminaCommessa('${doc.id}')" style="background: var(--danger-bg); color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer;">🗑️ Elimina</button>
                    </div>
                    <p style="color: var(--text-secondary); margin-top: 10px;">${commessa.descrizione}</p>
                    <small style="color: var(--text-tertiary);">📅 Creata il: ${commessa.dataCreazione || 'Data sconosciuta'}</small>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento commesse:', error);
        container.innerHTML = '<p style="color: var(--error-text);">Errore nel caricamento delle commesse</p>';
    }
}

function mostraNuovaCommessa() {
    const popupHtml = `
        <div class="popup" id="commessaPopup" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-container); border: 2px solid var(--border-color); border-radius: 10px; padding: 25px; z-index: 2000; box-shadow: 0 0 30px rgba(0,0,0,0.5); min-width: 350px;">
            <h3 style="color: var(--text-primary); margin-bottom: 15px;">➕ Nuova Commessa</h3>
            <div class="input-group">
                <label>Codice Commessa</label>
                <input type="text" id="codiceCommessa" placeholder="es. CC2024-001" style="width: 100%; padding: 10px;">
            </div>
            <div class="input-group">
                <label>Descrizione</label>
                <textarea id="descrizioneCommessa" placeholder="Descrizione del progetto..." style="width: 100%; padding: 10px; background: var(--input-bg); color: white; border: 2px solid var(--border-color); border-radius: 8px;" rows="3"></textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button onclick="salvaNuovaCommessa()" style="flex: 1;">✅ Salva</button>
                <button onclick="chiudiPopupCommessa()" style="flex: 1; background: var(--error-bg);">❌ Annulla</button>
            </div>
        </div>
        <div id="popupOverlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1999;"></div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', popupHtml);
}

async function salvaNuovaCommessa() {
    const codice = document.getElementById('codiceCommessa')?.value;
    const descrizione = document.getElementById('descrizioneCommessa')?.value;
    
    if (!codice || !descrizione) {
        alert('Compila tutti i campi');
        return;
    }
    
    try {
        await db.collection('commesse').add({
            codice: codice,
            descrizione: descrizione,
            dataCreazione: new Date().toLocaleDateString('it-IT'),
            terminata: false
        });
        
        mostraPopup(`✅ Commessa ${codice} creata con successo!`, 'info');
        chiudiPopupCommessa();
        caricaElencoCommesse();
        caricaCommesseInSelect();
    } catch (error) {
        console.error('Errore creazione commessa:', error);
        mostraPopup('Errore durante la creazione', 'errore');
    }
}

function chiudiPopupCommessa() {
    const popup = document.getElementById('commessaPopup');
    const overlay = document.getElementById('popupOverlay');
    if (popup) popup.remove();
    if (overlay) overlay.remove();
}

async function eliminaCommessa(id) {
    if (confirm('⚠️ Eliminare questa commessa? Questa azione è irreversibile.')) {
        try {
            await db.collection('commesse').doc(id).delete();
            mostraPopup('Commessa eliminata', 'info');
            caricaElencoCommesse();
            caricaCommesseInSelect();
        } catch (error) {
            console.error('Errore eliminazione:', error);
        }
    }
}

async function caricaCommesseInSelect() {
    const select = document.getElementById('oreCommessa');
    if (!select) return;
    
    try {
        const snapshot = await db.collection('commesse').get();
        
        let options = '<option value="">📋 Seleziona commessa...</option>';
        snapshot.forEach(doc => {
            const commessa = doc.data();
            if (!commessa.terminata) {
                options += `<option value="${commessa.codice}">📌 ${commessa.codice} - ${commessa.descrizione.substring(0, 50)}</option>`;
            }
        });
        
        select.innerHTML = options;
    } catch (error) {
        console.error('Errore caricamento commesse:', error);
    }
}

// ===== FUNZIONI CARTELLE NUMERI =====
function caricaElencoCartelle() {
    const container = document.getElementById('elencoCartelle');
    if (!container || !currentUser) return;
    
    const cartelle = JSON.parse(localStorage.getItem(`cartelle_${currentUser.email}`)) || [];
    
    if (cartelle.length === 0) {
        container.innerHTML = '<div style="grid-column: span 3; text-align:center; padding: 40px;">📂 Nessuna cartella. Clicca "Nuova Cartella" per iniziare.</div>';
        return;
    }
    
    let html = '';
    cartelle.forEach(cartella => {
        html += `
            <div class="admin-card" onclick="apriCartella('${cartella.id}')" style="cursor: pointer;">
                <div class="admin-card-icon">📁</div>
                <h3>${cartella.nome}</h3>
                <p>📅 ${cartella.dataCreazione}</p>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function mostraNuovaCartella() {
    const nome = prompt('📂 Inserisci il nome della nuova cartella:', 'Nuova Cartella');
    if (!nome) return;
    
    const cartelle = JSON.parse(localStorage.getItem(`cartelle_${currentUser?.email}`)) || [];
    const nuovaCartella = {
        id: 'cartella_' + Date.now(),
        nome: nome,
        dataCreazione: new Date().toLocaleDateString('it-IT')
    };
    
    cartelle.push(nuovaCartella);
    localStorage.setItem(`cartelle_${currentUser?.email}`, JSON.stringify(cartelle));
    caricaElencoCartelle();
    mostraPopup(`✅ Cartella "${nome}" creata con successo!`, 'info');
}

function apriCartella(id) {
    cartellaCorrenteId = id;
    mostraPopup(`📁 Apertura cartella: ${id}`, 'info');
    // Qui puoi implementare la logica per visualizzare i contenuti della cartella
}

function condividiTutto() {
    mostraPopup('📄 Funzione esportazione PDF in sviluppo', 'info');
}

// ===== FUNZIONI FIRESTORE =====
async function caricaOreDaFirestore(userId) {
    try {
        const snapshot = await db.collection('ore').where('userId', '==', userId).get();
        const ore = [];
        snapshot.forEach(doc => ore.push(doc.data()));
        return ore;
    } catch (error) {
        console.error('Errore caricamento ore:', error);
        return [];
    }
}

async function salvaOreSuFirestore(userId, ore) {
    try {
        const old = await db.collection('ore').where('userId', '==', userId).get();
        const batch = db.batch();
        old.forEach(doc => batch.delete(doc.ref));
        
        ore.forEach(oreData => {
            const docRef = db.collection('ore').doc();
            batch.set(docRef, { ...oreData, userId });
        });
        await batch.commit();
    } catch (error) {
        console.error('Errore salvataggio ore:', error);
    }
}

async function caricaIngressiDaFirestore(userId, data) {
    try {
        const snapshot = await db.collection('ingressi')
            .where('userId', '==', userId)
            .where('data', '==', data)
            .get();
        const ingressi = [];
        snapshot.forEach(doc => ingressi.push(doc.data()));
        return ingressi;
    } catch (error) {
        console.error('Errore caricamento ingressi:', error);
        return [];
    }
}

async function salvaIngressiSuFirestore(userId, data, ingressi) {
    try {
        const old = await db.collection('ingressi')
            .where('userId', '==', userId)
            .where('data', '==', data)
            .get();
        const batch = db.batch();
        old.forEach(doc => batch.delete(doc.ref));
        
        ingressi.forEach(ing => {
            const docRef = db.collection('ingressi').doc();
            batch.set(docRef, { ...ing, userId, data });
        });
        await batch.commit();
    } catch (error) {
        console.error('Errore salvataggio ingressi:', error);
    }
}

// ===== FUNZIONI TEMA =====
function mostraSelettoreTema() {
    const popupHtml = `
        <div class="popup" id="selettoreTema" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-container); border: 2px solid var(--border-color); border-radius: 10px; padding: 25px; z-index: 2000; box-shadow: 0 0 30px rgba(0,0,0,0.5); min-width: 250px;">
            <h3 style="color: var(--text-primary); margin-bottom: 15px;">🎨 Seleziona Tema</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="applicaTema('verde')" style="background: #1e4a1e; color: white;">🌿 Verde</button>
                <button onclick="applicaTema('blu')" style="background: #3498db; color: white;">💙 Blu</button>
                <button onclick="applicaTema('viola')" style="background: #8e44ad; color: white;">💜 Viola</button>
                <button onclick="applicaTema('scuro')" style="background: #333; color: white;">🖤 Scuro</button>
                <button onclick="chiudiSelettoreTema()" style="background: var(--error-bg); color: white;">❌ Chiudi</button>
            </div>
        </div>
        <div id="popupOverlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1999;"></div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', popupHtml);
}

function chiudiSelettoreTema() {
    const selettore = document.getElementById('selettoreTema');
    const overlay = document.getElementById('popupOverlay');
    if (selettore) selettore.remove();
    if (overlay) overlay.remove();
}

function applicaTema(tema) {
    const root = document.documentElement;
    
    const temi = {
        verde: {
            '--bg-body': '#0a1f0a',
            '--bg-container': '#1a3a1a',
            '--text-primary': '#90ee90',
            '--text-secondary': '#adebad',
            '--button-bg': '#1e4a1e',
            '--border-color': '#2a5a2a'
        },
        blu: {
            '--bg-body': '#1a2639',
            '--bg-container': '#2c3e50',
            '--text-primary': '#ecf0f1',
            '--text-secondary': '#b0c4de',
            '--button-bg': '#3498db',
            '--border-color': '#4a6a8a'
        },
        viola: {
            '--bg-body': '#2a0a2a',
            '--bg-container': '#3a1a3a',
            '--text-primary': '#e07ee0',
            '--text-secondary': '#c0a0c0',
            '--button-bg': '#4a2a4a',
            '--border-color': '#6a3a6a'
        },
        scuro: {
            '--bg-body': '#121212',
            '--bg-container': '#1e1e1e',
            '--text-primary': '#ffffff',
            '--text-secondary': '#cccccc',
            '--button-bg': '#333333',
            '--border-color': '#444444'
        }
    };
    
    const t = temi[tema];
    if (t) {
        for (let [prop, valore] of Object.entries(t)) {
            root.style.setProperty(prop, valore);
        }
    }
    
    localStorage.setItem('tema_app', tema);
    chiudiSelettoreTema();
    mostraPopup(`🎨 Tema ${tema} applicato!`, 'info');
}

function caricaTemaSalvato() {
    const temaSalvato = localStorage.getItem('tema_app');
    if (temaSalvato) {
        applicaTema(temaSalvato);
    } else {
        applicaTema('verde');
    }
}

// ===== FUNZIONI UTILITY =====
function mascheraOra(input) {
    let valore = input.value.replace(/\D/g, '');
    if (valore.length > 2) {
        valore = valore.substring(0, 2) + ':' + valore.substring(2, 4);
    }
    input.value = valore;
}

function mostraPopup(messaggio, tipo = 'info') {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-container);
        border: 2px solid var(--border-color);
        border-radius: 10px;
        padding: 25px;
        z-index: 2000;
        box-shadow: 0 0 30px rgba(0,0,0,0.5);
        min-width: 300px;
        text-align: center;
    `;
    
    let colore = 'var(--text-primary)';
    let icona = 'ℹ️';
    if (tipo === 'errore') {
        colore = 'var(--error-text)';
        icona = '❌';
    } else if (tipo === 'ritardo') {
        colore = 'var(--warning-text)';
        icona = '⚠️';
    } else if (tipo === 'successo') {
        colore = 'var(--success-bg)';
        icona = '✅';
    }
    
    popup.innerHTML = `
        <h3 style="color: ${colore}; margin-bottom: 15px;">${icona} ${tipo === 'info' ? 'Info' : tipo === 'errore' ? 'Errore' : tipo === 'ritardo' ? 'Attenzione' : 'Successo'}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">${messaggio}</p>
        <button onclick="this.parentElement.remove()" style="background: var(--button-bg); color: var(--text-primary); border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer;">OK</button>
    `;
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
        if (document.body.contains(popup)) popup.remove();
    }, 5000);
}

function esportaUtenti() {
    mostraPopup('📄 Funzione esportazione CSV in sviluppo', 'info');
}

// ===== INIZIALIZZAZIONE =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Avvio applicazione MEC-ROY...');
    
    // Attacca il gestore del login
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log('✅ Form di login inizializzato');
    }
    
    // Piccolo delay per assicurarsi che Firebase sia pronto
    setTimeout(() => {
        if (typeof db !== 'undefined') {
            console.log('✅ Firebase disponibile');
        } else {
            console.warn('⚠️ Firebase non disponibile - verifica la configurazione');
        }
    }, 500);
});