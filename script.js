const API_BASE = 'https://api.quran.com/api/v4';

// State
let currentReciter = 7; // Mishary Rashid Alafasy
let currentTranslation = 85; // Sahih International (Correct ID)
let audioQueue = [];
let currentAudioIndex = 0;
let isPlaying = false;
let hadithInterval;

// Data Cache
let first10Data = [];
let last10Data = [];
let fullSurahData = [];

// DOM Elements
const first10Container = document.getElementById('first-10');
const last10Container = document.getElementById('last-10');
const fullSurahContainer = document.getElementById('full-surah');
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const progressBar = document.getElementById('progressBar');
const timeDisplay = document.getElementById('timeDisplay');
const reciterSelect = document.getElementById('reciterSelect');
const translationSelect = document.getElementById('translationSelect');
const hadithContainer = document.getElementById('hadith-container');
const tabBtns = document.querySelectorAll('.tab-btn');

// Hadith Data
const hadiths = [
    {
        text: "Whoever memorizes ten verses from the beginning of Surat al-Kahf will be protected from the Dajjal.",
        source: "Sahih Muslim 809"
    },
    {
        text: "Whoever reads Surat al-Kahf on Friday, he will be illuminated with light between the two Fridays.",
        source: "Al-Mustadrak 2/399 (Al-Hakim)"
    },
    {
        text: "Whoever recites Surat al-Kahf as it was revealed, it will be a light for him on the Day of Resurrection.",
        source: "Al-Sunan al-Kubra 5856 (Al-Nasa'i)"
    },
    {
        text: "One who memorizes the first ten verses of Surah Kahf will be secure against the Dajjal.",
        source: "Sahih Muslim 809"
    },
    {
        text: "Whoever reads the last ten verses of Surat al-Kahf, if the Dajjal emerges, he will not be harmed by him.",
        source: "Al-Sunan al-Kubra 10732"
    }
];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    startHadithRotation();
    loadVerses();
    setupEventListeners();
});

function startHadithRotation() {
    showRandomHadith();
    // Change every 10 seconds
    hadithInterval = setInterval(showRandomHadith, 10000);
}

function showRandomHadith() {
    // Fade out effect could be added here, but for now just swap
    const randomIndex = Math.floor(Math.random() * hadiths.length);
    const hadith = hadiths[randomIndex];

    // Simple fade animation
    hadithContainer.style.opacity = '0';
    setTimeout(() => {
        hadithContainer.innerHTML = `
            <p class="hadith-text">"${hadith.text}"</p>
            <span class="hadith-source">— ${hadith.source}</span>
        `;
        hadithContainer.style.opacity = '1';
    }, 500);
}

async function loadVerses() {
    first10Container.innerHTML = '<div class="loading">Loading verses...</div>';
    last10Container.innerHTML = '<div class="loading">Loading verses...</div>';
    fullSurahContainer.innerHTML = '<div class="loading">Loading verses...</div>';

    try {
        // Fetch First 10 (Verses 1-10)
        first10Data = await fetchVerses(1, 10);
        renderVerses(first10Data, first10Container);

        // Fetch Last 10 (Verses 101-110)
        last10Data = await fetchVerses(101, 110);
        renderVerses(last10Data, last10Container);

        // Fetch Full Surah (Verses 1-110)
        fullSurahData = await fetchVerses(1, 110);
        renderVerses(fullSurahData, fullSurahContainer);

        // Prepare Audio Queue (Default to first 10)
        updateAudioQueue(first10Data);

    } catch (error) {
        console.error('Error loading verses:', error);
        first10Container.innerHTML = '<div class="error">Failed to load verses. Please try again.</div>';
        last10Container.innerHTML = '<div class="error">Failed to load verses. Please try again.</div>';
        fullSurahContainer.innerHTML = '<div class="error">Failed to load verses. Please try again.</div>';
    }
}

async function fetchVerses(start, end) {
    // Fetch verses with Audio, Translation, and Transliteration (Resource 57)
    // Note: We request the specific translation ID.
    const perPage = end - start + 1;
    const page = Math.floor((start - 1) / perPage) + 1;
    const url = `${API_BASE}/verses/by_chapter/18?language=en&translations=${currentTranslation},57&audio=${currentReciter}&per_page=${perPage}&page=${page}&fields=text_uthmani,chapter_id`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    return data.verses.map(verse => {
        // Extract Translation
        // Filter out transliteration (id 57) to find actual translations
        const availableTranslations = verse.translations?.filter(t => t.resource_id !== 57);

        // Try to find the selected translation, or fallback to the first available one
        // We use loose equality for resource_id match just in case of string/number diff
        let translationObj = availableTranslations?.find(t => t.resource_id == currentTranslation) || availableTranslations?.[0];

        const translation = (translationObj?.text || "Translation unavailable").replace(/<[^>]*>/g, '');

        // Extract Transliteration
        const transliterationObj = verse.translations?.find(t => t.resource_id == 57);
        const transliteration = (transliterationObj?.text || "").replace(/<[^>]*>/g, '');

        return {
            id: verse.id,
            key: verse.verse_key,
            number: verse.verse_number,
            text: verse.text_uthmani,
            translation: translation,
            transliteration: transliteration,
            audioUrl: verse.audio?.url
        };
    });
}

function renderVerses(verses, container) {
    container.innerHTML = '';
    verses.forEach(verse => {
        const card = document.createElement('div');
        card.className = 'verse-card';
        card.id = `verse-${verse.key.replace(':', '-')}`;

        card.innerHTML = `
            <div class="verse-header">
                <span class="verse-number">Ayah ${verse.number}</span>
                <button class="play-verse-btn" onclick="playSingleVerse('${verse.key}')">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                </button>
            </div>
            <div class="arabic-text">${verse.text}</div>
            <div class="transliteration">${verse.transliteration}</div>
            <div class="translation">${verse.translation}</div>
        `;
        container.appendChild(card);
    });
}

function setupEventListeners() {
    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.verses-container').forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            // Update Audio Queue based on tab
            if (targetId === 'first-10') {
                updateAudioQueue(first10Data);
            } else if (targetId === 'last-10') {
                updateAudioQueue(last10Data);
            } else if (targetId === 'full-surah') {
                updateAudioQueue(fullSurahData);
            }

            stopAudio();
        });
    });

    // Audio Player
    playBtn.addEventListener('click', togglePlay);

    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', playNextVerse);

    // Settings
    reciterSelect.addEventListener('change', (e) => {
        const map = {
            'ar.alafasy': 7,
            'ar.abdulbasit': 1,
            'ar.sudais': 3,
            'ar.husary': 4
        };
        currentReciter = map[e.target.value];
        if (isPlaying) stopAudio();
        loadVerses(); // Reload to get new audio URLs
    });

    translationSelect.addEventListener('change', (e) => {
        const map = {
            'en.sahih': 85, // Updated to 85
            'en.yusufali': 22,
            'en.pickthall': 19
        };
        currentTranslation = map[e.target.value] || 85;
        loadVerses(); // Reload to get new translations
    });
}

function updateAudioQueue(verses) {
    audioQueue = verses;
    currentAudioIndex = 0;
}

function togglePlay() {
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        updatePlayBtn();
    } else {
        playAudio();
    }
}

function playAudio() {
    if (!audioPlayer.src || audioPlayer.ended) {
        playVerseAtIndex(currentAudioIndex);
    } else {
        audioPlayer.play();
        isPlaying = true;
        updatePlayBtn();
    }
}

function playVerseAtIndex(index) {
    if (index >= audioQueue.length) {
        isPlaying = false;
        updatePlayBtn();
        return;
    }

    const verse = audioQueue[index];

    // Highlight
    document.querySelectorAll('.verse-card').forEach(c => c.style.borderColor = 'transparent');
    const currentCard = document.getElementById(`verse-${verse.key.replace(':', '-')}`);
    if (currentCard) {
        currentCard.style.borderColor = 'var(--accent-gold)';
        currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (verse.audioUrl) {
        const finalUrl = verse.audioUrl.startsWith('http') ? verse.audioUrl : `https://verses.quran.com/${verse.audioUrl}`;
        audioPlayer.src = finalUrl;
        audioPlayer.play();
        isPlaying = true;
        updatePlayBtn();
    }
}

function playNextVerse() {
    currentAudioIndex++;
    playVerseAtIndex(currentAudioIndex);
}

function stopAudio() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
    updatePlayBtn();
}

function updatePlayBtn() {
    playBtn.innerHTML = isPlaying
        ? '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
}

function updateProgress() {
    if (audioPlayer.duration) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBar.style.width = `${percent}%`;

        const curMins = Math.floor(audioPlayer.currentTime / 60);
        const curSecs = Math.floor(audioPlayer.currentTime % 60);
        const durMins = Math.floor(audioPlayer.duration / 60);
        const durSecs = Math.floor(audioPlayer.duration % 60);

        timeDisplay.textContent = `${curMins}:${curSecs.toString().padStart(2, '0')} / ${durMins}:${durSecs.toString().padStart(2, '0')}`;
    }
}

// Global function for the individual play buttons
window.playSingleVerse = (key) => {
    // Find verse in current queue
    const index = audioQueue.findIndex(v => v.key === key);
    if (index !== -1) {
        currentAudioIndex = index;
        playVerseAtIndex(index);
    } else {
        // If not in current queue (e.g. clicking verse in other tab? unlikely if hidden), 
        // check if it's in the other list and switch?
        // For now, assume user only clicks visible verses.
        console.warn('Verse not found in current queue');
    }
};
