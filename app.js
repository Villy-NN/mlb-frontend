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
        <div style="background:#FFFFFF; width:95%; max-width:600
