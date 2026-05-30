const API_URL = "https://mlb-ai-server.onrender.com";

// === ОФИЦИАЛЬНО ПУБЛИЧНЫЕ КЛЮЧИ SUPABASE ===
const SUPABASE_URL = "https://fnuzgypznyzcphewmjdl.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_QihCry4fW9xq7S9cGJWCDg_TmUk46wP";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let isUserVIP = false;
let allMatches = []; 
let currentChatMatchId = null;
let currentBoxScoreMatchId = null; 
let currentAdminMatchId = null;

const isBoss = new URLSearchParams(window.location.search).get('boss') === '1';

// === ПРОВЕРКА СЕССИИ ===
async function checkSession() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success' && currentUser) {
        localStorage.setItem('vip_status_' + currentUser.email, 'true');
        isUserVIP = true;
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => alert("💳 Payment Successful! Welcome to the VIP Club!"), 500);
    } else {
        checkVipStatus();
    }
    
    renderHeader();
    if (document.getElementById('forecast-modal') && document.getElementById('forecast-modal').style.display === 'flex') {
        renderChatControls();
    }
}

function checkVipStatus() {
    if (!currentUser) { isUserVIP = false; return; }
    isUserVIP = localStorage.getItem('vip_status_' + currentUser.email) === 'true';
    if (isBoss) isUserVIP = true;
}

function renderHeader() {
    const headerElement = document.querySelector('header');
    let buttonsContainer = document.getElementById('header-buttons-container');
    if (!buttonsContainer) {
        buttonsContainer = document.createElement('div');
        buttonsContainer.id = 'header-buttons-container';
        buttonsContainer.style.display = 'flex';
        headerElement.appendChild(buttonsContainer);
    }
    let headerButtons = '';
    if (isBoss) {
        headerButtons += `
            <button onclick="publishBoard()" style="background-color: #10B981; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-left: 10px;">🚀 Publish</button>
            <button id="sync-stats-btn" onclick="loadSchedule()" style="background-color: #D50032; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-left: 10px;">Load DB</button>
        `;
    }
    if (currentUser) {
        const name = currentUser.email ? currentUser.email.split('@')[0] : "User";
        const badge = isUserVIP ? "👑 VIP" : "👤 Free";
        headerButtons += `<button onclick="signOut()" style="background-color: #002D72; color: white; border: 1px solid #ffffff; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-left: 10px;">${badge}: ${name} (Exit)</button>`;
    } else {
        headerButtons += `<button onclick="openAuthModal()" style="background-color: #E5E7EB; color: #111827; border: 1px solid #D1D5DB; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-left: 10px;">Sign In</button>`;
    }
    buttonsContainer.innerHTML = headerButtons;
}

async function signOut() { 
    if (supabaseClient) { 
        await supabaseClient.auth.signOut(); 
        localStorage.removeItem('vip_status_' + currentUser.email); 
        location.reload(); 
    } 
}

// === ОКНО АВТОРИЗАЦИИ ===
const authModalHtml = `
    <div id="auth-modal" style="display: none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); justify-content:center; align-items:center; z-index:2000; backdrop-filter: blur(4px);">
        <div style="background:#FFFFFF; width:90%; max-width:400px; border-radius:16px; padding:30px; box-shadow: 0 15px 35px rgba(0,0,0,0.2); position:relative; text-align:center;">
            <button onclick="closeAuthModal()" style="position:absolute; top:15px; right:15px; background:none; border:none; font-size:24px; color:#6B7280; cursor:pointer;">&times;</button>
            <h2 style="margin: 0 0 20px 0; color:#002D72; font-weight:800;">JOIN MLB BUDDY</h2>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <input type="email" id="auth-email" placeholder="Email Address" style="padding:12px; border:1px solid #D1D5DB; border-radius:8px; font-size:14px; outline:none; background:#F9FAFB;">
                <input type="password" id="auth-password" placeholder="Password (min. 6 chars)" style="padding:12px; border:1px solid #D1D5DB; border-radius:8px; font-size:14px; outline:none; background:#F9FAFB;">
                <div style="display:flex; gap:10px; margin-top:5px;">
                    <button onclick="signInWithEmail()" style="flex:1; padding:12px; background:#002D72; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Login</button>
                    <button onclick="signUpWithEmail()" style="flex:1; padding:12px; background:#D50032; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Register</button>
                </div>
            </div>
            <div style="margin: 20px 0; display:flex; align-items:center; color:#9CA3AF; font-size:12px; text-transform:uppercase;">
                <div style="flex:1; height:1px; background:#E5E7EB;"></div><span style="margin:0 10px;">or continue with</span><div style="flex:1; height:1px; background:#E5E7EB;"></div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button onclick="signInWithProvider('google')" style="padding:12px; background:#FFFFFF; color:#374151; border:1px solid #D1D5DB; border-radius:8px; font-weight:bold; cursor:pointer;">🔴 Google</button>
                <button onclick="signInWithProvider('discord')" style="padding:12px; background:#5865F2; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">🟣 Discord</button>
            </div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', authModalHtml);

function openAuthModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }
async function signInWithProvider(provider) { if (supabaseClient) await supabaseClient.auth.signInWithOAuth({ provider: provider, options: { redirectTo: window.location.origin } }); }
async function signUpWithEmail() { if (!supabaseClient) return; const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-password').value; if (!email || password.length < 6) return alert("Enter valid email/password."); const { data, error } = await supabaseClient.auth.signUp({ email, password }); if (error) alert("Error: " + error.message); else { alert("Success! Check email if required."); closeAuthModal(); } }
async function signInWithEmail() { if (!supabaseClient) return; const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-password').value; const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) alert("Error: " + error.message); else closeAuthModal(); }

// === ЗАМОК ОПЛАТЫ (STRIPE) ===
const paywallModalHtml = `
    <div id="paywall-modal" style="display: none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); justify-content:center; align-items:center; z-index:2500; backdrop-filter: blur(5px);">
        <div style="background:#FFFFFF; width:90%; max-width:450px; border-radius:16px; overflow:hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); position:relative;">
            <div style="background: #002D72; padding: 25px 20px; text-align: center; color: white;">
                <button onclick="closePaywallModal()" style="position:absolute; top:15px; right:15px; background:none; border:none; font-size:24px; color:white; cursor:pointer;">&times;</button>
                <h2 style="margin:0; font-weight:800; font-size:24px; text-transform:uppercase;">Unlock Buddy AI Chat</h2>
                <p style="margin:10px 0 0 0; color:#93C5FD; font-size:14px;">Get personal consulting and deep metrics</p>
            </div>
            <div style="padding: 30px 20px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:600; font-size:15px;"><span>✅ Direct Line with Buddy AI</span><span style="color:#10B981;">Unlimited</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:600; font-size:15px;"><span>✅ Live Odds Line Analysis</span><span style="color:#10B981;">Included</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:25px; font-weight:600; font-size:15px;"><span>✅ Pro Analytics & Trends</span><span style="color:#10B981;">Included</span></div>
                <div style="text-align:center; font-size:32px; font-weight:800; color:#111827; margin-bottom:20px;">$29.99 <span style="font-size:14px; font-weight:normal; color:#6B7280;">/ month</span></div>
                <button id="stripe-test-btn" onclick="processTestPayment()" style="width:100%; background:#635BFF; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; font-size:16px; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:10px;">
                    💳 Pay with Stripe
                </button>
                <div style="text-align:center; font-size:11px; color:#9CA3AF; margin-top:15px;">🔒 Secured by Stripe. Cancel anytime.</div>
            </div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', paywallModalHtml);

function openPaywallModal() { document.getElementById('paywall-modal').style.display = 'flex'; }
function closePaywallModal() { document.getElementById('paywall-modal').style.display = 'none'; }
function processTestPayment() { window.location.href = "https://buy.stripe.com/test_dRm7sE0dfcL81fz32593y00"; }

// === ОКНО: MATCH CENTER (BOX SCORE) ===
const matchCenterModalHtml = `
    <div id="match-modal" style="display: none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; z-index:1000;">
        <div style="background:#FFFFFF; width:95%; max-width:650px; border-radius:16px; display:flex; flex-direction:column; overflow:hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); padding:20px; gap:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #E5E7EB; padding-bottom:10px;">
                <h3 id="match-modal-title" style="margin:0; color:#002D72; font-size:20px; font-weight:800;">LIVE SCOREBOX</h3>
                <button onclick="closeMatchModal()" style="background:none; border:none; color:#6B7280; font-size:28px; cursor:pointer;">&times;</button>
            </div>
            <div style="overflow-x:auto; background:#F3F4F6; padding:15px; border-radius:12px; border:1px solid #E5E7EB;">
                <table style="width:100%; border-collapse:collapse; text-align:center; font-family:monospace; font-size:14px;">
                    <thead>
                        <tr style="color:#6B7280; font-weight:bold; border-bottom:1px solid #D1D5DB;">
                            <th style="text-align:left; padding:8px; font-family:sans-serif; width:120px;">Teams</th>
                            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th>
                            <th style="color:#002D72; font-weight:900; padding-left:10px;">R</th><th style="color:#4B5563;">H</th><th style="color:#4B5563;">E</th>
                        </tr>
                    </thead>
                    <tbody style="font-weight:bold; color:#111827;" id="linescore-body">
                        <tr id="linescore-away"></tr><tr id="linescore-home"></tr>
                    </tbody>
                </table>
            </div>
            <div style="background:#F9FAFB; border-left: 4px solid #D50032; padding: 15px; border-radius: 8px;">
                <h4 style="margin:0 0 5px 0; color:#002D72; text-transform:uppercase; font-size:12px; letter-spacing:1px;">Free Match Info</h4>
                <div id="match-modal-pitchers" style="font-size:14px; color:#4B5563;"></div>
            </div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', matchCenterModalHtml);

function openMatchModal(matchId) {
    currentBoxScoreMatchId = matchId;
    document.getElementById('match-modal').style.display = 'flex';
    updateBoxScoreModalData(matchId);
}
function closeMatchModal() { document.getElementById('match-modal').style.display = 'none'; currentBoxScoreMatchId = null; }

function updateBoxScoreModalData(matchId) {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;

    document.getElementById('match-modal-title').innerText = `${match.away_team} @ ${match.home_team}`;
    document.getElementById('match-modal-pitchers').innerText = match.manual_pitchers || match.pitchers ? "⚾ Pitchers: " + (match.manual_pitchers || match.pitchers) : "⚾ Pitchers: TBA";
    
    let l = match.linescore;
    if (!l) {
        l = {
            away_innings: ["-","-","-","-","-","-","-","-","-"], home_innings: ["-","-","-","-","-","-","-","-","-"],
            away_totals: {r:"-", h:"-", e:"-"}, home_totals: {r:"-", h:"-", e:"-"}
        };
    }

    let awayBox = `<td style="text-align:left; font-family:sans-serif; padding:8px 0;">${match.away_team.substring(0,3).toUpperCase()}</td>`;
    let homeBox = `<td style="text-align:left; font-family:sans-serif; padding:8px 0;">${match.home_team.substring(0,3).toUpperCase()}</td>`;
    
    for(let i=0; i<9; i++) {
        awayBox += `<td>${l.away_innings[i] !== undefined ? l.away_innings[i] : "-"}</td>`;
        homeBox += `<td>${l.home_innings[i] !== undefined ? l.home_innings[i] : "-"}</td>`;
    }
    awayBox += `<td style="color:#002D72; font-weight:900; padding-left:10px;">${l.away_totals.r}</td><td>${l.away_totals.h}</td><td>${l.away_totals.e}</td>`;
    homeBox += `<td style="color:#002D72; font-weight:900; padding-left:10px;">${l.home_totals.r}</td><td>${l.home_totals.h}</td><td>${l.home_totals.e}</td>`;
    
    document.getElementById('linescore-away').innerHTML = awayBox;
    document.getElementById('linescore-home').innerHTML = homeBox;
}

// === ОКНО ПРОГНОЗА И ЧАТА ===
const forecastModalHtml = `
    <div id="forecast-modal" style="display: none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; z-index:1000;">
        <div style="background:#FFFFFF; width:95%; max-width:600px; height:85%; border-radius:16px; display:flex; flex-direction:column; overflow:hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <div style="background: #002D72; color:white; padding:15px; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                <span id="forecast-modal-title" style="font-size: 18px; letter-spacing: 0.5px;">Official Forecast & Chat</span>
                <button onclick="closeForecastModal()" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            <div id="forecast-scroll-area" style="flex-grow:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:20px; background:#F9FAFB;">
                <div style="background:#FFFFFF; border-left: 4px solid #10B981; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <h4 style="margin:0 0 10px 0; color:#10B981; text-transform:uppercase; font-size:14px; display:flex; justify-content:space-between;">
                        <span>Free Daily Forecast</span><span style="font-size:11px; color:#6B7280;">Unlocked 🔓</span>
                    </h4>
                    <div id="forecast-text-content" style="color:#111827; font-size:15px; line-height:1.6;">Loading...</div>
                </div>
                <div style="text-align: center; color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-top: 10px;">Live VIP Discussion</div>
                <div id="chat-messages-container" style="display:flex; flex-direction:column; gap:12px;"></div>
            </div>
            <div id="chat-controls" style="padding:15px; border-top:1px solid #E5E7EB; background:#FFFFFF; display:flex; gap:10px;"></div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', forecastModalHtml);

async function openForecastModal(matchId) {
    currentChatMatchId = matchId;
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;

    document.getElementById('forecast-modal-title').innerText = `${match.away_team} @ ${match.home_team}`;
    document.getElementById('forecast-text-content').innerHTML = match.ai_analysis ? match.ai_analysis.replace(/\n/g, '<br>') : `<span style="color:#6B7280; font-style:italic;">Forecast not published yet.</span>`;
    document.getElementById('chat-messages-container').innerHTML = '';
    
    document.getElementById('forecast-modal').style.display = 'flex';
    renderChatControls();

    // ЗАГРУЖАЕМ СТРОГО ЛИЧНЫЙ ЧАТ
    if (currentUser) {
        try {
            const response = await fetch(`${API_URL}/matches/${matchId}/chat/${currentUser.email}`);
            if(response.ok) {
                const history = await response.json();
                history.forEach(msg => appendMessageToChat(msg.role === "user" ? "You" : "Buddy", msg.text));
            }
        } catch(e) {}
    }
}

function closeForecastModal() { 
    document.getElementById('forecast-modal').style.display = 'none'; 
    currentChatMatchId = null; 
}

function renderChatControls() {
    const controls = document.getElementById('chat-controls');
    if (!currentUser) {
        controls.innerHTML = `<input type="text" disabled placeholder="🔒 Locked. Please sign in to chat." style="flex-grow:1; padding:12px; border:1px solid #E5E7EB; border-radius:8px; background:#F3F4F6; color:#6B7280;"><button onclick="openAuthModal()" style="background:#002D72; color:white; border:none; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">Sign In</button>`;
    } else if (!isUserVIP) {
        controls.innerHTML = `<input type="text" disabled placeholder="🔒 VIP Required to ask Buddy questions." style="flex-grow:1; padding:12px; border:1px solid #E5E7EB; border-radius:8px; background:#FEF3C7; color:#B45309;"><button onclick="openPaywallModal()" style="background:#10B981; color:white; border:none; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow: 0 4px 6px rgba(16,185,129,0.3);">💎 Upgrade to VIP</button>`;
    } else {
        controls.innerHTML = `<input type="text" id="chat-user-input" placeholder="Ask Buddy about odds or players..." style="flex-grow:1; padding:12px; border:1px solid #D1D5DB; border-radius:8px; background:#FFFFFF; color:#111827; outline:none;"><button onclick="sendChatMessage()" style="background:#002D72; color:white; border:none; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">Send</button>`;
        document.getElementById('chat-user-input').addEventListener('keydown', e => { if (e.key === "Enter") sendChatMessage(); });
    }
}

// === АДМИН ПАНЕЛЬ ===
const adminModalHtml = `
    <div id="admin-modal" style="display: none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; z-index:1001;">
        <div style="background:#FFFFFF; width:95%; max-width:550px; border-radius:12px; border-top: 4px solid #D50032; display:flex; flex-direction:column; padding:20px; gap:12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E5E7EB; padding-bottom:10px;"><h3 id="admin-modal-title" style="margin:0; color:#002D72;">Control Room</h3><button onclick="closeAdminModal()" style="background:none; border:none; color:#6B7280; font-size:22px; cursor:pointer;">&times;</button></div>
            <input type="password" id="admin-password-field" placeholder="Secret Key..." style="width:100%; padding:10px; background:#F3F4F6; border:1px solid #D1D5DB; color:#111827; border-radius:8px;">
            <label style="font-size:12px; font-weight:bold; color:#002D72;">Manual Pitcher Stats:</label>
            <input type="text" id="admin-pitchers-field" placeholder="e.g. #34 RHP, 4-3, 3.23 vs #22 LHP..." style="width:100%; padding:10px; background:#F3F4F6; border:1px solid #D1D5DB; color:#111827; border-radius:8px;">
            <textarea id="admin-forecast-field" placeholder="Public Forecast..." rows="3" style="width:100%; padding:10px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:8px; resize:vertical;"></textarea>
            <textarea id="admin-stats-field" placeholder="B-R Raw Tables..." rows="3" style="width:100%; padding:10px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:8px; resize:vertical; font-family:monospace; font-size:12px;"></textarea>
            <div style="display:flex; justify-content:flex-end; gap:10px;"><button onclick="closeAdminModal()" style="background:#E5E7EB; color:#374151; border:none; padding:10px 20px; border-radius:8px; font-weight:bold;">Cancel</button><button id="admin-submit-btn" onclick="submitAdminUpdate()" style="background:#002D72; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold;">Save Draft</button></div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', adminModalHtml);

async function loadSchedule() { 
    try { 
        await fetch(`${API_URL}/fetch-schedule`); 
        await loadMatches(); 
    } catch (e) {} 
}

async function publishBoard() { 
    if(confirm("GO LIVE?")) { 
        await fetch(`${API_URL}/publish-board`, {method: 'POST'}); 
        loadMatches(); 
    } 
}

async function loadMatches() {
    const container = document.getElementById('matches-container');
    if (allMatches.length === 0) container.innerHTML = '<div class="loading-text">Loading premium board...</div>';
    
    try {
        const response = await fetch(isBoss ? `${API_URL}/matches?boss=1` : `${API_URL}/matches?boss=0`);
        allMatches = await response.json();
        
        allMatches.sort((a, b) => {
            const getWeight = (st) => {
                if (!st) return 2;
                let s = st.toLowerCase();
                if (s.includes('live') || s.includes('progress') || s.includes('warmup')) return 1;
                if (s.includes('final') || s.includes('game over') || s.includes('completed')) return 3;
                return 2; 
            };
            
            // 1. Сначала сортируем по статусу: LIVE (1) -> Ожидаются (2) -> FINAL (3)
            let weightA = getWeight(a.status); let weightB = getWeight(b.status);
            if (weightA !== weightB) return weightA - weightB;
            
            // 2. Если статус одинаковый (например, два матча Scheduled), сортируем по времени начала
            const timeA = a.game_datetime ? new Date(a.game_datetime).getTime() : 0;
            const timeB = b.game_datetime ? new Date(b.game_datetime).getTime() : 0;
            if (timeA && timeB && timeA !== timeB) return timeA - timeB;
            
            return a.id.localeCompare(b.id);
        });

        if (currentBoxScoreMatchId && document.getElementById('match-modal').style.display === 'flex') {
            updateBoxScoreModalData(currentBoxScoreMatchId);
        }
        
        // Исправлено: Просто полностью очищаем контейнер с матчами перед новой отрисовкой.
        // Карточка установки находится выше в HTML-коде, поэтому она не сотрется и не продублируется.
        container.innerHTML = '';
        
        allMatches.forEach(match => {
            const card = document.createElement('div'); card.className = 'match-card';
            const draftTag = (isBoss && !match.is_published) ? `<span style="background:#F59E0B; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:10px;">DRAFT</span>` : '';
            const adminBtn = isBoss ? `<button onclick="openAdminPanel('${match.id}', '${match.away_team}', '${match.home_team}')" style="color:white; border:none; padding:8px 12px; font-weight:bold; cursor:pointer; margin-top:5px; background:#D50032; border-radius:8px;">⚙️ Admin</button>` : '';
            
            let scoreDisplay = `<span style="color:#6B7280; font-size:13px;">@</span>`;
            if (match.status === "Final" || match.status === "Game Over" || (match.status && match.status.includes("Final"))) {
                scoreDisplay = `<div style="font-weight: 800; font-size: 22px; color: #002D72; margin: 4px 0;">${match.score}</div><div style="color: #D50032; font-size: 11px; font-weight: 800;">FINAL</div>`;
            } else if ((match.status && match.status.includes("In Progress")) || match.status === "Live" || (match.status && match.status.includes("Warmup"))) {
                scoreDisplay = `<div style="font-weight: 800; font-size: 22px; color: #10B981; margin: 4px 0;">${match.score}</div><div style="color: #10B981; font-size: 11px; font-weight: 800;">LIVE</div>`;
            } else {
                // Пытаемся достать точное время матча и перевести в локальное
                let localTime = match.status; 
                const matchTime = match.game_datetime || match.game_date || match.datetime || match.time;
                
                if (matchTime) {
                    try {
                        const utcDate = new Date(matchTime);
                        // Авто-конвертация в местное время (например, 19:30 или 7:30 PM)
                        localTime = utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch (e) {}
                }
                scoreDisplay = `<div style="font-weight: 800; font-size: 16px; color: #002D72; margin: 4px 0;">${localTime}</div><div style="color: #6B7280; font-size: 11px; font-weight: 800; letter-spacing: 0.5px;">LOCAL TIME</div>`;
            }

            const pitchersHtml = match.manual_pitchers || match.pitchers ? `<div class="pitchers-text" style="margin-top: 10px;">⚾ ${match.manual_pitchers || match.pitchers}</div>` : '';

            card.innerHTML = `
                <div style="flex-grow: 1; display:flex; flex-direction:column; justify-content:center;">
                    <div class="team-names" style="display:flex; flex-direction:column; align-items:flex-start; line-height: 1.4;">
                        <div style="display:flex; align-items:baseline; gap:6px;"><span>${match.away_team} ${draftTag}</span><span style="font-size:13px; color:#6B7280;">(${match.away_record || '-'})</span></div>
                        <div style="margin: 4px 0;">${scoreDisplay}</div>
                        <div style="display:flex; align-items:baseline; gap:6px;"><span>${match.home_team}</span><span style="font-size:13px; color:#6B7280;">(${match.home_record || '-'})</span></div>
                    </div>
                    ${pitchersHtml}
                </div>
                <div class="btn-group" style="display: flex; flex-direction:column; justify-content:center; margin-left: 15px; gap:8px;">
                    <button class="analyze-btn" onclick="openMatchModal('${match.id}')" style="color:#002D72; background:#E5E7EB!important; border:1px solid #002D72; padding:10px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">📊 Box Score</button>
                    <button class="analyze-btn" onclick="openForecastModal('${match.id}')" style="color:white; background:#002D72!important; border:none; padding:10px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">📖 Forecast & Chat</button>
                    ${adminBtn}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) { 
        if (allMatches.length === 0) container.innerHTML = '<div class="loading-text" style="color:#D50032;">Server error.</div>'; 
    }
}

async function sendChatMessage() {
    if (!currentUser || !isUserVIP) return; 
    const input = document.getElementById('chat-user-input'); 
    const msg = input.value.trim(); 
    if (!msg || !currentChatMatchId) return;
    
    appendMessageToChat("You", msg); 
    input.value = ''; 
    renderChatControls();
    
    const container = document.getElementById('chat-messages-container'); 
    const loader = document.createElement('div'); 
    loader.id = "chat-loading"; 
    loader.innerHTML = "<em style='color:#6B7280; font-size: 14px;'>🧠 Crunching numbers...</em>"; 
    container.appendChild(loader); 
    scrollToBottom();
    
    try {
        const response = await fetch(`${API_URL}/matches/${currentChatMatchId}/chat`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ message: msg, user_id: currentUser.email }) 
        });
        const data = await response.json(); 
        document.getElementById('chat-loading').remove();
        
        if (response.ok) {
            appendMessageToChat("Buddy", data.reply); 
        } else {
            appendMessageToChat("Error", data.detail);
        }
    } catch (e) { 
        document.getElementById('chat-loading')?.remove(); 
        appendMessageToChat("Error", "Timeout."); 
    }
}

function appendMessageToChat(sender, text) {
    const container = document.getElementById('chat-messages-container'); 
    const msgDiv = document.createElement('div');
    if (sender === "You") {
        msgDiv.style = "align-self:flex-end; background:#002D72; color:white; padding:12px 16px; border-radius:16px 16px 4px 16px; max-width:80%; font-size:14px;";
    } else if (sender === "Buddy") {
        msgDiv.style = "align-self:flex-start; background:#FFFFFF; color:#111827; padding:12px 16px; border-radius:16px 16px 16px 4px; max-width:80%; font-size:14px; border-left:4px solid #D50032; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";
    } else {
        msgDiv.style = "align-self:center; background:#D50032; color:white; padding:8px 12px; border-radius:8px; font-size: 13px;";
    }
    msgDiv.innerHTML = `<strong style="color:${sender==='Buddy'?'#D50032':(sender==='You'?'#93C5FD':'#fff')}; font-size: 12px; text-transform: uppercase;">${sender}</strong><br><span style="margin-top:4px; display:inline-block;">${text.replace(/\n/g, '<br>')}</span>`;
    container.appendChild(msgDiv); 
    scrollToBottom();
}

function scrollToBottom() { 
    const scrollArea = document.getElementById('forecast-scroll-area'); 
    if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight; 
}

function openAdminPanel(matchId, awayTeam, homeTeam) { 
    currentAdminMatchId = matchId; 
    document.getElementById('admin-modal').style.display = 'flex'; 
}

async function submitAdminUpdate() { 
    if (document.getElementById('admin-password-field').value !== "admin123") return alert("Access Denied!"); 
    document.getElementById('admin-submit-btn').innerText = "Uploading..."; 
    try { 
        await fetch(`${API_URL}/matches/${currentAdminMatchId}/admin-update`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                ai_analysis: document.getElementById('admin-forecast-field').value, 
                preview_text: document.getElementById('admin-stats-field').value, 
                manual_pitchers: document.getElementById('admin-pitchers-field').value 
            }) 
        }); 
        closeAdminModal(); 
        loadMatches(); 
    } catch (e) { 
        alert("Error"); 
    } 
    document.getElementById('admin-submit-btn').innerText = "Save Draft"; 
}

function closeAdminModal() { 
    document.getElementById('admin-modal').style.display = 'none'; 
}

// === ЛОГИКА СТАТИЧНОЙ КНОПКИ PWA ===
let deferredPrompt = null;
let isPWAStandalone = false;

function rebindInstallCard() {
    const card = document.getElementById('static-install-card');
    const btn = document.getElementById('static-install-btn');
    const iosModal = document.getElementById('ios-install-modal');
    
    // Проверяем, установлено ли уже приложение
    isPWAStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Показываем кнопку только если юзер зашел через обычный браузер
    if (!isPWAStandalone && card) {
        card.style.display = 'flex';
        
        if (btn) {
            btn.onclick = async () => {
                if (isIOS) {
                    if (iosModal) iosModal.style.display = 'flex';
                } else {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === 'accepted') {
                            card.style.display = 'none';
                        }
                        deferredPrompt = null;
                    } else {
                        // Если браузер Инкогнито или заблокировал запрос
                        alert("To install the app, tap the 3 dots in your browser menu and select 'Add to Home Screen'.");
                    }
                }
            };
        }
    } else if (card) {
        card.style.display = 'none';
    }
}

// Ловим системное событие установки (сработает только НЕ в инкогнито)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    rebindInstallCard();
});

window.addEventListener('appinstalled', () => {
    const card = document.getElementById('static-install-card');
    if (card) card.style.display = 'none';
    deferredPrompt = null;
});

// Запускаем всё напрямую!
checkSession();
rebindInstallCard();
loadMatches();
setInterval(loadMatches, 30000);