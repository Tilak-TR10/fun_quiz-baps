// js/host.js
let qrInstance = null;
let currentTimerSeconds = 60;
let currentLeaderboard = [];
const broadcast = ('BroadcastChannel' in window) ? new BroadcastChannel('quiz_channel') : null;

window.addEventListener('DOMContentLoaded', () => {
  const savedTimer = localStorage.getItem('quiz_admin_timer');
  if (savedTimer) {
    currentTimerSeconds = parseInt(savedTimer, 10);
    const sel = document.getElementById('timer-select');
    if (sel) sel.value = currentTimerSeconds;
  }

  generateQrCode();
  listenToLeaderboard();
});

function getPlayerUrl() {
  const base = window.location.href.split('?')[0].replace(/index\.html$/, '').replace(/\/$/, '');
  return `${base}/game.html?time=${currentTimerSeconds}`;
}

function generateQrCode() {
  const url = getPlayerUrl();
  document.getElementById('game-link').textContent = url;

  const container = document.getElementById('qrcode');
  container.innerHTML = '';
  qrInstance = new QRCode(container, {
    text: url,
    width: 200,
    height: 200,
    colorDark: "#110323",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

function updateAdminTimer(val) {
  currentTimerSeconds = parseInt(val, 10);
  localStorage.setItem('quiz_admin_timer', currentTimerSeconds);
  generateQrCode();

  if (isFirebaseActive && db) {
    db.ref('settings/timer').set(currentTimerSeconds);
  }
}

function openPlayerWindow() {
  window.open(getPlayerUrl(), '_blank');
}

function listenToLeaderboard() {
  if (isFirebaseActive && db) {
    db.ref('leaderboard').on('value', (snap) => {
      const data = snap.val() || {};
      processLeaderboardData(Object.values(data));
    });
  } else {
    loadLocalLeaderboard();

    if (broadcast) {
      broadcast.onmessage = (event) => {
        if (event.data && event.data.type === 'NEW_SCORE') {
          loadLocalLeaderboard(true);
        }
      };
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'quiz_leaderboard') {
        loadLocalLeaderboard(true);
      }
    });
  }
}

function loadLocalLeaderboard(triggerAnim = false) {
  try {
    const raw = localStorage.getItem('quiz_leaderboard');
    const list = raw ? JSON.parse(raw) : [];
    processLeaderboardData(list, triggerAnim);
  } catch(e) {
    console.error(e);
  }
}

function processLeaderboardData(players, triggerAnim = false) {
  // Sort by highest score first; tiebreaker = lowest time taken
  players.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.totalTime - b.totalTime;
  });

  const prevLeader = currentLeaderboard.length > 0 ? currentLeaderboard[0].name : null;
  currentLeaderboard = players;

  // Confetti trigger if a new #1 leader emerges
  if (triggerAnim && currentLeaderboard.length > 0 && currentLeaderboard[0].name !== prevLeader) {
    fireConfetti();
  }

  renderLeaderboard();
}

function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  document.getElementById('player-count-badge').textContent = currentLeaderboard.length;
  tbody.innerHTML = '';

  if (currentLeaderboard.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; opacity: 0.6; padding: 40px;">Waiting for contestants to play...</td></tr>';
    return;
  }

  currentLeaderboard.forEach((p, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
    const finishedDate = p.timestamp ? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="rank-badge ${rankClass}">${rank}</span></td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td style="text-align: center; font-weight: 800; color: var(--accent); font-size: 1.2rem;">${p.score}</td>
      <td style="text-align: right; opacity: 0.9;">${Number(p.totalTime).toFixed(1)}s</td>
      <td style="text-align: right; opacity: 0.75; font-size: 0.85rem;">${finishedDate}</td>
    `;
    tbody.appendChild(tr);
  });
}

// REQUIREMENT 3: Export the leaderboard and played list to Excel (.xlsx)
function exportLeaderboardToExcel() {
  if (currentLeaderboard.length === 0) {
    alert("No player scores recorded yet to export.");
    return;
  }

  // Format dataset with full clean columns
  const excelData = currentLeaderboard.map((p, idx) => ({
    "Rank": idx + 1,
    "Full Name": p.name,
    "First Name": p.firstName || "",
    "Middle Name": p.middleName || "",
    "Last Name": p.lastName || "",
    "Questions Solved": p.score,
    "Time Taken (seconds)": Number(p.totalTime).toFixed(1),
    "Date & Time Finished": p.timestamp ? new Date(p.timestamp).toLocaleString() : new Date().toLocaleString()
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  
  // Set clean column widths
  worksheet['!cols'] = [
    { wch: 8 },  // Rank
    { wch: 25 }, // Full Name
    { wch: 15 }, // First Name
    { wch: 15 }, // Middle Name
    { wch: 15 }, // Last Name
    { wch: 18 }, // Questions Solved
    { wch: 20 }, // Time Taken
    { wch: 24 }  // Date Finished
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Played Leaderboard");

  const fileName = `Quiz_Leaderboard_Export_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

function clearLeaderboard() {
  if (confirm("Reset the entire leaderboard? This will clear all records and allow players to play again.")) {
    // 1. Clear Firebase
    if (isFirebaseActive && db) {
      db.ref('leaderboard').remove();
      db.ref('settings/lastReset').set(Date.now()); // Marks reset timestamp
    }
    
    // 2. Clear Local Storage
    localStorage.removeItem('quiz_leaderboard');
    currentLeaderboard = [];
    renderLeaderboard();
    
    if (broadcast) {
      broadcast.postMessage({ type: 'RESET' });
    }
  }
}

function fireConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.innerText = str || '';
  return d.innerHTML;
}
