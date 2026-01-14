/* Configuration */
// Change this to the actual start date of the 175-day period (YYYY-MM-DD)
const START_DATE = "2026-01-15";
const TOTAL_DAYS = 175;
const STORAGE_KEY = "advent_unlocked";

/* DOM Elements */
const grid = document.getElementById('calendar-grid');
const dayModal = document.getElementById('day-modal');
const modalTitle = document.getElementById('modal-title');
const surpriseCards = document.querySelectorAll('.surprise-card');
const closeModalBtn = document.querySelector('.close-modal');

// Unlock Modal Elements
const unlockModal = document.getElementById('unlock-modal');
const unlockHint = document.getElementById('unlock-hint');
const passwordInput = document.getElementById('password-input');
const unlockBtn = document.getElementById('unlock-btn');
const closeUnlockBtn = document.querySelector('.close-unlock');
const errorMsg = document.getElementById('error-msg');

// Content Modal Elements
const contentModal = document.getElementById('content-modal');
const contentDisplay = document.getElementById('content-display');
const closeContentBtn = document.querySelector('.close-content');

/* State */
let currentOpenDay = null; // The day currently being viewed in the modal
let currentSurpriseId = null; // 'dayXsurpriseY'

/* Initialization */
document.addEventListener('DOMContentLoaded', () => {
    initStars();
    renderCalendar();
    setupEventListeners();
});

/* Core Logic */

function getDayDiff(startDate) {
    const start = new Date(startDate);
    const now = new Date();
    // Reset times to midnight for accurate day diff
    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = nowMidnight - startMidnight;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Day 1 is the start date itself, so if diff is 0 days (same time), it's day 1?? 
    // Math.ceil of (0) is 0. If it's same day, diff is 0. So Day is diff + 1.
    return diffDays + 1;
}

function renderCalendar() {
    const currentDay = getDayDiff(START_DATE);
    grid.innerHTML = '';

    for (let i = 1; i <= TOTAL_DAYS; i++) {
        const dayEl = document.createElement('div');
        dayEl.classList.add('day-card');
        dayEl.textContent = i;

        if (i < currentDay) {
            dayEl.classList.add('completed');
            dayEl.onclick = () => openDayModal(i);
        } else if (i === currentDay) {
            dayEl.classList.add('active');
            dayEl.onclick = () => openDayModal(i);
        } else {
            dayEl.classList.add('locked');
            dayEl.title = "Wait for this day!";
        }

        grid.appendChild(dayEl);
    }
}

function openDayModal(day) {
    currentOpenDay = day;
    modalTitle.textContent = `Day ${day}`;
    updateSurpriseCards(day);

    dayModal.classList.remove('hidden');
    // small delay to allow display:flex to apply before opacity transition
    setTimeout(() => dayModal.classList.add('visible'), 10);
}

function updateSurpriseCards(day) {
    const now = new Date();
    // If viewing a past day, all times are unlocked logic-wise (but might still be password locked)
    // If viewing TODAY, check hours.
    const currentDay = getDayDiff(START_DATE);
    const isPast = day < currentDay;
    const isToday = day === currentDay;

    surpriseCards.forEach((card, index) => {
        // index 0 -> Surprise 1 (Midnight) -> requires 00:00
        // index 1 -> Surprise 2 (6 AM) -> requires 06:00
        // index 2 -> Surprise 3 (Noon)     -> requires 12:00
        // index 3 -> Surprise 4 (6 PM)     -> requires 18:00

        const requiredHour = [0, 6, 12, 18][index];
        const surpriseNum = index + 1;
        const surpriseId = `day${day}surprise${surpriseNum}`;
        const type = card.dataset.type;

        // Check time lock
        let timeUnlocked = false;
        if (isPast) {
            timeUnlocked = true;
        } else if (isToday) {
            if (now.getHours() >= requiredHour) {
                timeUnlocked = true;
            }
        }

        // Check if already unlocked via password
        const isFullyUnlocked = isSurpriseUnlocked(surpriseId);

        // Reset classes
        card.classList.remove('locked-surprise', 'unlocked-surprise');
        const statusText = card.querySelector('.status-text');

        if (isFullyUnlocked) {
            card.classList.add('unlocked-surprise');
            statusText.textContent = "Opened";
            card.onclick = () => showContent(day, surpriseNum, type);
        } else if (timeUnlocked) {
            // Time is passed, but password needed
            statusText.textContent = "Tap to Unlock";
            card.onclick = () => initiateUnlock(day, surpriseNum);
        } else {
            // Time locked
            card.classList.add('locked-surprise');
            statusText.textContent = `Available at ${requiredHour}:00`;
            card.onclick = null;
        }
    });
}

function initiateUnlock(day, surpriseNum) {
    currentSurpriseId = `day${day}surprise${surpriseNum}`;

    // Fetch Hint
    const hintPath = `assets/hints/${currentSurpriseId}.txt`;
    unlockHint.textContent = "Loading hint...";
    unlockModal.classList.remove('hidden');
    setTimeout(() => unlockModal.classList.add('visible'), 10);
    passwordInput.value = "";
    errorMsg.classList.add('hidden');

    fetch(hintPath)
        .then(res => {
            if (!res.ok) throw new Error("Hint not found");
            return res.text();
        })
        .then(text => {
            unlockHint.textContent = text;
        })
        .catch(err => {
            unlockHint.textContent = "No hint available (or file missing).";
            console.error(err);
        });
}

function handleUnlockAttempt() {
    const userPass = passwordInput.value.trim().toLowerCase();
    const answerPath = `assets/answers/${currentSurpriseId}.txt`;

    fetch(answerPath)
        .then(res => res.text())
        .then(correctAnswer => {
            if (userPass === correctAnswer.trim().toLowerCase()) {
                // Success
                markSurpriseUnlocked(currentSurpriseId);
                closeUnlockModal();
                // Refresh the day modal to show it's opened
                const [d, s] = currentSurpriseId.replace('day', '').split('surprise').map(Number);
                updateSurpriseCards(d);
                // Immediately show content? Or let them click again? 
                // Let's let them click again to savor the victory, or just open it.
                // User requirement: "If correct -> Reveal the content"
                const type = document.getElementById(`surprise-${s}`).dataset.type;
                showContent(d, s, type);
            } else {
                // Fail
                passwordInput.classList.add('shake');
                errorMsg.classList.remove('hidden');
                setTimeout(() => passwordInput.classList.remove('shake'), 500);
            }
        })
        .catch(err => {
            console.error("Answer file missing!", err);
            alert("Error verifying password. Please check console.");
        });
}

function showContent(day, surpriseNum, type) {
    const ext = (type === 'letter' || type === 'reason') ? 'pdf' : 'png';
    const folder = type; // haiku, letter, picture, reason
    // Start numbering from 001. Pad day with zeros if needed (e.g. 001, 010, 100)
    // Actually the user specified filenames like 001.png. It implies mapped to Day 1 = 001.
    const paddedDay = String(day).padStart(3, '0');
    const path = `assets/content/${folder}/${paddedDay}.${ext}`;

    contentDisplay.innerHTML = '';

    if (ext === 'pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = path;
        contentDisplay.appendChild(iframe);
    } else {
        const img = document.createElement('img');
        img.src = path;
        img.alt = `Day ${day} ${type}`;
        contentDisplay.appendChild(img);
    }

    contentModal.classList.remove('hidden');
    setTimeout(() => contentModal.classList.add('visible'), 10);
}

/* Storage Helpers */
function getUnlockedData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function isSurpriseUnlocked(id) {
    const data = getUnlockedData();
    return data.includes(id);
}

function markSurpriseUnlocked(id) {
    const data = getUnlockedData();
    if (!data.includes(id)) {
        data.push(id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
}

/* UI Helpers */
function closeDayModal() {
    dayModal.classList.remove('visible');
    setTimeout(() => dayModal.classList.add('hidden'), 300);
}

function closeUnlockModal() {
    unlockModal.classList.remove('visible');
    setTimeout(() => unlockModal.classList.add('hidden'), 300);
}

function closeContent() {
    contentModal.classList.remove('visible');
    setTimeout(() => contentModal.classList.add('hidden'), 300);
}

function setupEventListeners() {
    closeModalBtn.onclick = closeDayModal;
    closeUnlockBtn.onclick = closeUnlockModal;
    closeContentBtn.onclick = closeContent;

    unlockBtn.onclick = handleUnlockAttempt;
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUnlockAttempt();
    });

    // Close on click outside
    window.onclick = (e) => {
        if (e.target === dayModal) closeDayModal();
        if (e.target === unlockModal) closeUnlockModal();
        if (e.target === contentModal) closeContent();
    };
}

function initStars() {
    // Optional: Add dynamic JS stars if CSS isn't enough, but CSS is usually smoother.
    // The CSS stars are handled by the background image in styles.css
}
