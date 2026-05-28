const API_URL = "https://mlb-ai-server.onrender.com";

// === ПОДКЛЮЧЕНИЕ К ТВОЕЙ БАЗЕ SUPABASE ===
const SUPABASE_URL = "https://fnuzgypznyzcphewmjdl.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_QihCry4fW9xq7S9cGJWCDg_TmUk46wP";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentChatMatchId = null;
let currentAdminMatchId = null;

const todayStr = new Date().toDateString();
const limitKey = 'vipMsgs_' + todayStr;
if (localStorage.getItem(limitKey) === null) localStorage.setItem(limitKey, '5');
let messagesLeft = parseInt(localStorage.getItem(limitKey));

const isBoss = new URLSearchParams(window.location.search).get('boss') === '1';

// ПРОВЕРКА: ВОШЕЛ ЛИ ПОЛЬЗОВАТЕЛЬ?
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session ? session.user : null;
    renderHeader();
    if (document.getElementById('unified-modal') && document.getElementById('unified-modal').style.display === 'flex') {
        renderChatControls();
    }
}

// ОТСЛЕЖИВАНИЕ ВХОДА/ВЫХОДА В РЕАЛЬНОМ ВРЕМЕНИ
supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session ? session.user : null;
    renderHeader();
    if (document.getElementById('unified-modal') && document.getElementById('unified-modal').style.display === 'flex') {
        renderChatControls();
    }
});

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
            <button onclick="publishBoard()" style="background-color: #10B981; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-left: 10px; box-shadow: 0 2px 4px rgba(16,185,129,0.3);">🚀 Publish Board</button>
            <button id="sync-stats-btn" onclick="loadSchedule()" style="background-color: #D50032; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-left: 10px;">Load DB</button>
        `;
    }

    if (currentUser) {
        const name = currentUser.email.split('@')[0];
        headerButtons += `<button onclick="signOut()" style="background-color: #002D72; color: white; border: 1px solid #ffffff; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-left: 10px;">👑 VIP: ${name} (Exit)</button>`;
    } else {
        headerButtons += `<button onclick="signInWithGoogle()" style="background-color: #E5E7EB; color: #111827; border: 1px solid #D1D5DB; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-left: 10px;">Sign In</button>`;
    }

    buttonsContainer.innerHTML = headerButtons;
}

// ФУНКЦИИ ВХОДА И ВЫХОДА
async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
}

async function signOut() {
    await supabase.auth.signOut();
}

// ЕДИНОЕ ОКНО ПРОГНОЗА
const unifiedModalHtml = `
    <div id="unified-modal" style="display: none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; z-index:1000;">
        <div style="background:#FFFFFF; width:95%; max-width:600px; height:85%; border-radius:16px; display:flex; flex-direction:column; overflow:hidden; position:relative; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <div style="background: #002D72; color:white; padding:15px; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                <span id="unified-modal-title" style="font-size: 18px; letter-spacing: 0.5px;">Match Center</span>
                <button onclick="closeUnifiedModal()" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            <div id="unified-scroll-area" style="flex-grow:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:20px; background:#F9FAFB;">
                <div style="background:#FFFFFF; border-left: 4px solid #D50032; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <h4 style="margin:0 0 10px 0; color:#002D72; text-transform:uppercase; font-size:14px;">Official VIP Forecast</h4>
                    <div id="unified-forecast-text" style="color:#111827; font-size:15px; line-height:1.6;">Loading...</div>
                </div>
                <div style="text-align: center; color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-top: 10px;">Live VIP Discussion</div>
                <div id="chat-messages-container" style="display:flex; flex-direction:column; gap:12px;"></div>
            </div>
            <div id="chat-controls" style="padding:15px; border-top:1px solid #E5E7EB; background:#FFFFFF; display:flex; gap:10px;"></div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', unifiedModalHtml);

// АДМИН ПАНЕЛЬ
const adminModalHtml = `
    <div id="admin-modal" style="display: none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; z-index:1001;">
        <div style="background:#FFFFFF; width:95%; max-width:550px; border-radius:12px; border-top: 4px solid #D50032; display:flex; flex-direction:column; padding:20px; gap:12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E5E7EB; padding-bottom:10px;">
                <h3 id="admin-modal-title" style="margin:0; color:#002D72;">Control Room</h3>
                <button onclick="closeAdminModal()" style="background:none; border:none; color:#6B7280; font-size:22px; cursor:pointer;">&times;</button>
            </div>
            <input type="password" id="admin-password-field" placeholder="Secret Key..." style="width:100%; padding:10px; background:#F3F4F6; border:1px solid #D1D5DB; color:#111827; border-radius:8px;">
            <label style="font-size:12px; font-weight:bold; color:#002D72;">Manual Pitcher Stats:</label>
            <input type="text" id="admin-pitchers-field" placeholder="e.g. #34 RHP, 4-3, 3.23 vs #22 LHP..." style="width:100%; padding:10px; background:#F3F4F6; border:1px solid #D1D5DB; color:#111827; border-radius:8px;">
            <textarea id="admin-forecast-field" placeholder="Public Forecast..." rows="3" style="width:100%; padding:10px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:8px; resize:vertical;"></textarea>
            <textarea id="admin-stats-field" placeholder="B-R Raw Tables..." rows="3" style="width:100%; padding:10px; background:#F3F4F6; border:1px solid #D1D5DB; border-radius:8px; resize:vertical; font-family:monospace; font-size:12px;"></textarea>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="closeAdminModal()" style="background:#E5E7EB; color:#374151; border:none; padding:10px 20px; border-radius:8px; font-weight:bold;">Cancel</button>
                <button id="admin-submit-btn" onclick="submitAdminUpdate()" style="background:#002D72; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold;">Save Draft</button>
            </div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', adminModalHtml);

async function loadSchedule() {
    const btn = document.getElementById('sync-stats-btn');
    if(btn) { btn.innerText = "Loading..."; btn.disabled = true; }
    try { await fetch(`${API_URL}/fetch-schedule`); await loadMatches(); } catch (e) {}
    if(btn) { btn.innerText = "Load DB"; btn.disabled = false; }
}

async function publishBoard() {
    if(confirm("Are you sure you want to GO LIVE with today's board?")) {
        await fetch(`${API_URL}/publish-board`, {method: 'POST'});
        alert("Success! Board is now LIVE.");
        loadMatches();
    }
}

async function loadMatches() {
    const container = document.getElementById('matches-container');
    container.innerHTML = '<div class="loading-text">Loading premium board...</div>';
    const fetchUrl = isBoss ? `${API_URL}/matches?boss=1` : `${API_URL}/matches?boss=0`;

    try {
        const response = await fetch(fetchUrl);
        const matches = await response.json();
        if (matches.length === 0) return container.innerHTML = '<div class="loading-text">No games found.</div>';

        container.innerHTML = ''; 
        matches.forEach(match => {
            const card = document.createElement('div');
            card.className = 'match-card';
            const draftTag = (isBoss && !match.is_published) ? `<span style="background:#F59E0B; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:10px; vertical-align:middle;">DRAFT</span>` : '';
            const btnText = match.ai_analysis ? "📖 Forecast & VIP Chat" : "⌛ Forecast & VIP Chat";
            const adminBtn = isBoss ? `<button onclick="openAdminPanel('${match.id}', '${match.away_team}', '${match.home_team}')" class="admin-upload-btn" style="color:white; border:none; padding:8px 12px; font-weight:bold; cursor:pointer; margin-top:5px; background:#D50032; border-radius:8px;">⚙️ Admin</button>` : '';

            let scoreDisplay = `<span style="color:#6B7280; font-size:13px; font-weight:normal;">@</span>`;
            if (match.status === "Final" || match.status === "Game Over") {
                scoreDisplay = `<div style="font-weight: 800; font-size: 22px; color: #002D72; margin: 4px 0;">${match.score}</div><div style="color: #D50032; font-size: 11px; font-weight: 800;">FINAL</div>`;
            } else if (match.status.includes("In Progress") || match.status === "Live") {
                scoreDisplay = `<div style="font-weight: 800; font-size: 22px; color: #002D72; margin: 4px 0;">${match.score}</div><div style="color: #10B981; font-size: 11px; font-weight: 800;">LIVE</div>`;
            }

            const displayPitchers = match.manual_pitchers ? match.manual_pitchers : (match.pitchers || "");
            const pitchersHtml = displayPitchers ? `<div class="pitchers-text" style="margin-top: 10px;">⚾ ${displayPitchers}</div>` : '';

            card.innerHTML = `
                <div style="flex-grow: 1; display:flex; flex-direction:column; justify-content:center;">
                    <div class="team-names" style="display:flex; flex-direction:column; align-items:flex-start; line-height: 1.4;">
                        <div style="display:flex; align-items:baseline; gap:6px;">
                            <span>${match.away_team} ${draftTag}</span>
                            <span style="font-size:13px; color:#6B7280; font-weight:normal;">(${match.away_record || '-'})</span>
                        </div>
                        <div style="margin: 4px 0;">${scoreDisplay}</div>
                        <div style="display:flex; align-items:baseline; gap:6px;">
                            <span>${match.home_team}</span>
                            <span style="font-size:13px; color:#6B7280; font-weight:normal;">(${match.home_record || '-'})</span>
                        </div>
                    </div>
                    ${pitchersHtml}
                </div>
                <div class="btn-group" style="display: flex; flex-direction:column; justify-content:center; margin-left: 15px;">
                    <button class="analyze-btn" onclick="openUnifiedModal('${match.id}', '${match.away_team}', '${match.home_team}')" style="color:white; border:none; padding:10px 12px; border-radius:8px; font-weight:bold; cursor:pointer;">${btnText}</button>
                    ${adminBtn}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        container.innerHTML = '<div class="loading-text" style="color:#D50032;">Server error.</div>';
    }
}

function openUnifiedModal(matchId, awayTeam, homeTeam) {
    currentChatMatchId = matchId;
    document.getElementById('unified-modal-title').innerText = `${awayTeam} @ ${homeTeam}`;
    const forecastContainer = document.getElementById('unified-forecast-text');
    const chatContainer = document.getElementById('chat-messages-container');
    forecastContainer.innerHTML = '<em style="color:#6B7280;">Loading...</em>';
    chatContainer.innerHTML = `<div style="background:#E5E7EB; color:#374151; padding:12px; border-radius:8px; font-size:14px; border-left: 4px solid #002D72;"><strong>System:</strong> Have a question about the line? Drop your sportsbook odds below to discuss with Buddy.</div>`;
    renderChatControls();
    document.getElementById('unified-modal').style.display = 'flex';
    fetch(`${API_URL}/matches${isBoss ? '?boss=1' : '?boss=0'}`).then(r => r.json()).then(matches => {
        const match = matches.find(m => m.id === matchId);
        if (match) {
            forecastContainer.innerHTML = match.ai_analysis ? match.ai_analysis.replace(/\n/g, '<br>') : `<span style="color:#6B7280; font-style:italic;">Forecast not published yet.</span>`;
            if (match.chat_history) match.chat_history.forEach(msg => appendMessageToChat(msg.role === "user" ? "You" : "Buddy", msg.text));
        }
    });
}

// УПРАВЛЕНИЕ ЧАТОМ ЧЕРЕЗ АВТОРИЗАЦИЮ
function renderChatControls() {
    const controls = document.getElementById('chat-controls');
    if (!currentUser) {
        controls.innerHTML = `
            <input type="text" disabled placeholder="🔒 Locked. VIP Subscription Required." style="flex-grow:1; padding:12px; border:1px solid #E5E7EB; border-radius:8px; background:#F3F4F6; color:#6B7280;">
            <button onclick="signInWithGoogle()" style="background:#002D72; color:white; border:none; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;">
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" style="width:16px; height:16px; background:white; border-radius:50%; padding:2px;">
                Unlock with Google
            </button>`;
    } else if (messagesLeft <= 0) {
        controls.innerHTML = `<input type="text" disabled placeholder="⏳ Daily limit reached (5/5). Come back tomorrow!" style="flex-grow:1; padding:12px; border:1px solid #F59E0B; border-radius:8px; background:#FEF3C7; color:#B45309;">`;
    } else {
        controls.innerHTML = `
            <input type="text" id="chat-user-input" placeholder="Ask Buddy about odds..." style="flex-grow:1; padding:12px; border:1px solid #D1D5DB; border-radius:8px; background:#FFFFFF; color:#111827; outline:none;">
            <button onclick="sendChatMessage()" style="background:#002D72; color:white; border:none; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">Send (${messagesLeft})</button>`;
        document.getElementById('chat-user-input').addEventListener('keydown', e => { if (e.key === "Enter") sendChatMessage(); });
    }
}

async function sendChatMessage() {
    if (!currentUser || messagesLeft <= 0) return;
    const input = document.getElementById('chat-user-input');
    const msg = input.value.trim();
    if (!msg || !currentChatMatchId) return;
    appendMessageToChat("You", msg);
    input.value = '';
    messagesLeft--; localStorage.setItem(limitKey, messagesLeft.toString());
    renderChatControls();
    const container = document.getElementById('chat-messages-container');
    const loader = document.createElement('div'); loader.id = "chat-loading"; loader.innerHTML = "<em style='color:#6B7280; font-size: 14px;'>Buddy is crunching the numbers... 🧠</em>";
    container.appendChild(loader); scrollToBottom();
    try {
        const response = await fetch(`${API_URL}/matches/${currentChatMatchId}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
        const data = await response.json();
        document.getElementById('chat-loading').remove();
        if (response.ok) appendMessageToChat("Buddy", data.reply); else appendMessageToChat("System Error ❌", data.detail);
    } catch (e) { document.getElementById('chat-loading')?.remove(); appendMessageToChat("System Error ❌", "Timeout."); }
}

function appendMessageToChat(sender, text) {
    const container = document.getElementById('chat-messages-container');
    const msgDiv = document.createElement('div');
    if (sender === "You") msgDiv.style = "align-self:flex-end; background:#002D72; color:white; padding:12px 16px; border-radius:16px 16px 4px 16px; max-width:80%; font-size:14px;";
    else if (sender === "Buddy") msgDiv.style = "align-self:flex-start; background:#FFFFFF; color:#111827; padding:12px 16px; border-radius:16px 16px 16px 4px; max-width:80%; font-size:14px; border-left:4px solid #D50032; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";
    else msgDiv.style = "align-self:center; background:#D50032; color:white; padding:8px 12px; border-radius:8px; font-size: 13px;";
    msgDiv.innerHTML = `<strong style="color:${sender==='Buddy'?'#D50032':(sender==='You'?'#93C5FD':'#fff')}; font-size: 12px; text-transform: uppercase;">${sender}</strong><br><span style="margin-top:4px; display:inline-block;">${text.replace(/\n/g, '<br>')}</span>`;
    container.appendChild(msgDiv); scrollToBottom();
}

function scrollToBottom() { const scrollArea = document.getElementById('unified-scroll-area'); scrollArea.scrollTop = scrollArea.scrollHeight; }
function closeUnifiedModal() { document.getElementById('unified-modal').style.display = 'none'; }

function openAdminPanel(matchId, awayTeam, homeTeam) {
    currentAdminMatchId = matchId;
    document.getElementById('admin-password-field').value = '';
    document.getElementById('admin-pitchers-field').value = '';
    document.getElementById('admin-forecast-field').value = '';
    document.getElementById('admin-stats-field').value = '';
    document.getElementById('admin-modal').style.display = 'flex';
}

async function submitAdminUpdate() {
    if (document.getElementById('admin-password-field').value !== "admin123") return alert("Access Denied!");
    document.getElementById('admin-submit-btn').innerText = "Uploading...";
    try {
        await fetch(`${API_URL}/matches/${currentAdminMatchId}/admin-update`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ai_analysis: document.getElementById('admin-forecast-field').value, 
                preview_text: document.getElementById('admin-stats-field').value,
                manual_pitchers: document.getElementById('admin-pitchers-field').value
            })
        });
        closeAdminModal(); loadMatches();
    } catch (e) { alert("Error"); }
    document.getElementById('admin-submit-btn').innerText = "Save Draft";
}

function closeAdminModal() { document.getElementById('admin-modal').style.display = 'none'; }

// Запуск процесса
checkSession();
loadMatches();
