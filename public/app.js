let currentDate = new Date();
let logs = {};

async function loadMissions() {
    const res = await fetch('/api/missions');
    const missions = await res.json();
    const select = document.getElementById('missionSelect');
    select.innerHTML = '';
    missions.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.title;
        select.appendChild(opt);
    });
    renderCalendar();
}

async function addMission() {
    const input = document.getElementById('newMissionInput');
    if (!input.value.trim()) return;
    await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: input.value })
    });
    input.value = '';
    loadMissions();
}

async function renderCalendar() {
    const missionId = document.getElementById('missionSelect').value;
    if (missionId) {
        const res = await fetch(`/api/logs/${missionId}`);
        logs = await res.json();
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    document.getElementById('monthYearDisplay').textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    // Get today's date in YYYY-MM-DD local format
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Blank boxes before the 1st of the month
    for (let i = 0; i < firstDayIndex; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-box empty-slot';
        grid.appendChild(empty);
    }

    // Actual days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const status = logs[dateStr];

        const box = document.createElement('div');
        box.className = 'day-box';
        
        // Highlight today or fade future days
        if (dateStr === todayStr) {
            box.classList.add('today');
        } else if (dateStr > todayStr) {
            box.classList.add('future');
        }
        
        if (status === 'completed') box.classList.add('completed');
        if (status === 'missed') box.classList.add('missed');

        const icon = status === 'completed' ? '✔' : (status === 'missed' ? '✖' : '');
        box.innerHTML = `<span class="day-number">${day}</span><span class="status-icon">${icon}</span>`;
        
        box.onclick = () => toggleDayStatus(missionId, dateStr, status);
        grid.appendChild(box);
    }
}

async function toggleDayStatus(missionId, dateStr, currentStatus) {
    if (!missionId) return alert("Create a mission first!");
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (dateStr > todayStr) return alert("You cannot log future days yet!");

    // Cycle: Empty -> completed (Green ✔) -> missed (Red ✖) -> none (Empty)
    let nextStatus = 'completed';
    if (currentStatus === 'completed') {
        nextStatus = 'missed';
    } else if (currentStatus === 'missed') {
        nextStatus = 'none';
    }

    await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mission_id: parseInt(missionId),
            log_date: dateStr,
            status: nextStatus
        })
    });
    renderCalendar();
}

function changeMonth(step) {
    currentDate.setMonth(currentDate.getMonth() + step);
    renderCalendar();
}

// Initialize on load
loadMissions();