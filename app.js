/* ==========================================================================
   HITSTER GAME LOGIC
   ========================================================================== */

// DOM-Elemente
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');
const vinylDisc = document.getElementById('vinyl-disc');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const replayBtn = document.getElementById('replay-btn');
const progressBar = document.getElementById('progress-bar');
const currentCard = document.getElementById('current-card');
const revealCover = document.getElementById('reveal-cover');
const revealYear = document.getElementById('reveal-year');
const revealTitle = document.getElementById('reveal-title');
const revealArtist = document.getElementById('reveal-artist');
const timelineTrack = document.getElementById('timeline-track');
const actionPanel = document.getElementById('action-panel');
const feedbackMessage = document.getElementById('feedback-message');
const bonusFeedback = document.getElementById('bonus-feedback');
const nextRoundBtn = document.getElementById('next-round-btn');
const audioPlayer = document.getElementById('audio-player');

// Eingabefelder
const guessArtistInput = document.getElementById('guess-artist');
const guessTitleInput = document.getElementById('guess-title');
const guessYearInput = document.getElementById('guess-year');

// Modal-Elemente
const gameOverModal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const finalCardsCount = document.getElementById('final-cards-count');
const finalScore = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// Spielzustand
let state = {
  score: 0,
  lives: 3,
  timeline: [],       // Karten auf der Zeitachse, sortiert nach Jahr
  currentSong: null,  // Der Song, der gerade erraten wird
  currentSongDetails: null, // Detaildaten aus der iTunes-API (z.B. Cover, Audio-Link)
  selectedSlotIndex: null,
  playedSongs: [],    // Bereits verwendete Songs
  isRoundActive: false,
  isPlaying: false
};

// ==========================================================================
// INITIALISIERUNG
// ==========================================================================
function initGame() {
  state.score = 0;
  state.lives = 3;
  state.timeline = [];
  state.playedSongs = [];
  state.currentSong = null;
  state.currentSongDetails = null;
  state.selectedSlotIndex = null;
  state.isRoundActive = false;

  // UI zurücksetzen
  gameOverModal.classList.add('hidden');
  actionPanel.classList.add('hidden');
  resetGuessInputs();
  updateStatsUI();

  // 1. Zufälligen Start-Song wählen und in die Timeline legen
  const startSong = getRandomSong();
  state.playedSongs.push(startSong);

  // Daten für den Start-Song von iTunes holen, um Cover zu laden
  fetchSongDataFromITunes(startSong).then(details => {
    const timelineStartSong = {
      ...startSong,
      coverUrl: details ? details.coverUrl : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%231f1f2e"/%3E%3C/svg%3E'
    };
    state.timeline.push(timelineStartSong);
    renderTimeline();

    // 2. Die erste echte Spielrunde starten
    startNewRound();
  });
}

// ==========================================================================
// RUN-LOGIK
// ==========================================================================
function startNewRound() {
  state.isRoundActive = true;
  state.selectedSlotIndex = null;
  resetGuessInputs();
  currentCard.classList.remove('flipped');
  actionPanel.classList.add('hidden');
  document.getElementById('guessing-panel').classList.remove('hidden');
  
  // Nächsten Song auswählen
  const nextSong = getRandomSong();
  if (!nextSong) {
    // Falls alle Songs durchgespielt wurden
    endGame(true);
    return;
  }
  state.currentSong = nextSong;
  state.playedSongs.push(nextSong);

  // Visuelle Ladeanzeige
  vinylDisc.classList.add('playing');
  setVinylColor('var(--color-text-secondary)');

  // iTunes-API abfragen
  fetchSongDataFromITunes(nextSong).then(details => {
    if (details && details.previewUrl) {
      state.currentSongDetails = details;
      
      // Audio-Player vorbereiten
      audioPlayer.src = details.previewUrl;
      audioPlayer.volume = 0.5;
      
      // Start abspielen
      playAudio();
      
      // Kartenrückseite für später befüllen
      revealCover.src = details.coverUrl;
      revealYear.textContent = nextSong.year;
      revealTitle.textContent = nextSong.title;
      revealArtist.textContent = nextSong.artist;
    } else {
      // Fallback, falls iTunes den Song nicht findet
      console.warn("Song nicht bei iTunes gefunden, wähle einen anderen...", nextSong);
      startNewRound();
    }
  });

  renderTimeline(); // Slots leuchtend machen für die Platzierung
}

// ==========================================================================
// ITUNES-API ANBINDUNG
// ==========================================================================
async function fetchSongDataFromITunes(song) {
  const searchTerm = `${song.artist} ${song.title}`;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=musicTrack&limit=1`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Netzwerkfehler");
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const track = data.results[0];
      return {
        previewUrl: track.previewUrl,
        // Größeres Cover-Bild abrufen (100x100 durch 400x400 ersetzen)
        coverUrl: track.artworkUrl100.replace('100x100bb', '400x400bb'),
        trackName: track.trackName,
        artistName: track.artistName
      };
    }
  } catch (err) {
    console.error("Fehler beim Laden von iTunes:", err);
  }
  return null;
}

// ==========================================================================
// AUDIO-STEUERUNG
// ==========================================================================
function playAudio() {
  audioPlayer.play()
    .then(() => {
      state.isPlaying = true;
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      vinylDisc.classList.add('playing');
      setVinylColor('var(--color-secondary)');
    })
    .catch(err => {
      console.warn("Autoplay blockiert oder Fehler beim Laden des Audio-Streams:", err);
    });
}

function pauseAudio() {
  audioPlayer.pause();
  state.isPlaying = false;
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
  vinylDisc.classList.remove('playing');
  setVinylColor('var(--color-text-secondary)');
}

function togglePlay() {
  if (state.isPlaying) {
    pauseAudio();
  } else {
    playAudio();
  }
}

// Fortschrittsanzeige aktualisieren
audioPlayer.addEventListener('timeupdate', () => {
  if (audioPlayer.duration) {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = `${progress}%`;
  }
});

// Wenn der 30s-Stream zu Ende ist
audioPlayer.addEventListener('ended', () => {
  pauseAudio();
  progressBar.style.width = '0%';
});

playPauseBtn.addEventListener('click', togglePlay);
replayBtn.addEventListener('click', () => {
  audioPlayer.currentTime = 0;
  playAudio();
});

function setVinylColor(color) {
  const label = vinylDisc.querySelector('.vinyl-label');
  if (label) {
    label.style.background = `linear-gradient(135deg, ${color}, var(--color-accent))`;
  }
}

// ==========================================================================
// TIMELINE DISPLAY & SELECTION
// ==========================================================================
function renderTimeline() {
  timelineTrack.innerHTML = '';
  const n = state.timeline.length;

  // Wir haben n platzierte Karten und benötigen n + 1 Slots
  for (let i = 0; i <= n; i++) {
    // Steckplatz (Slot) erstellen
    const slot = document.createElement('div');
    slot.className = 'timeline-slot';
    slot.textContent = '+';
    slot.dataset.index = i;
    
    if (state.isRoundActive) {
      slot.addEventListener('click', () => selectSlot(i));
    } else {
      slot.style.pointerEvents = 'none';
    }

    if (state.selectedSlotIndex === i) {
      slot.classList.add('selected');
    }

    timelineTrack.appendChild(slot);

    // Dazugehörige Karte (falls nicht am Ende)
    if (i < n) {
      const cardData = state.timeline[i];
      const card = document.createElement('div');
      card.className = 'timeline-card';
      card.innerHTML = `
        <img class="timeline-card-cover" src="${cardData.coverUrl}" alt="Cover">
        <div class="timeline-card-info">
          <div class="timeline-card-year">${cardData.year}</div>
          <div class="timeline-card-title">${cardData.title}</div>
          <div class="timeline-card-artist">${cardData.artist}</div>
        </div>
      `;
      timelineTrack.appendChild(card);
    }
  }

  // Automatischer Scroll zum gewählten Slot oder zum Ende der Timeline
  setTimeout(() => {
    const selectedElement = timelineTrack.querySelector('.timeline-slot.selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, 100);
}

function selectSlot(index) {
  if (!state.isRoundActive) return;
  
  state.selectedSlotIndex = index;
  renderTimeline();
  
  // Wenn ein Slot ausgewählt wurde, werten wir die Runde direkt aus!
  evaluateGuess();
}

// ==========================================================================
// RUNDE AUSWERTEN
// ==========================================================================
function evaluateGuess() {
  state.isRoundActive = false;
  pauseAudio();

  const chosenIndex = state.selectedSlotIndex;
  const currentYear = state.currentSong.year;
  
  // Logik zur Prüfung der korrekten Jahres-Position
  let isCorrect = false;

  // Bestimme die Grenzjahre links und rechts vom Slot
  const yearLeft = chosenIndex > 0 ? state.timeline[chosenIndex - 1].year : -Infinity;
  const yearRight = chosenIndex < state.timeline.length ? state.timeline[chosenIndex].year : Infinity;

  // Der Tipp ist korrekt, wenn das Jahr des aktuellen Songs zwischen den beiden Nachbarn liegt
  if (currentYear >= yearLeft && currentYear <= yearRight) {
    isCorrect = true;
  }

  // Karte im 3D-Blick umdrehen
  currentCard.classList.add('flipped');

  // Optionale Tipps prüfen
  const bonusPoints = evaluateBonusGuesses();
  
  let roundPoints = 0;
  let bonusMsg = "";

  if (isCorrect) {
    roundPoints += 100;
    feedbackMessage.textContent = "Korrekt platziert! +100 XP";
    feedbackMessage.className = "feedback-message feedback-correct";
    
    // Karte an der richtigen Stelle in die Timeline einfügen
    const newCard = {
      ...state.currentSong,
      coverUrl: state.currentSongDetails ? state.currentSongDetails.coverUrl : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%231f1f2e"/%3E%3C/svg%3E'
    };
    
    // Einfügen an der gewählten Position
    state.timeline.splice(chosenIndex, 0, newCard);
  } else {
    state.lives -= 1;
    feedbackMessage.textContent = `Falsche Position! Das Jahr war ${currentYear}`;
    feedbackMessage.className = "feedback-message feedback-wrong";
  }

  // Bonuspunkte dazurechnen
  if (bonusPoints > 0) {
    roundPoints += bonusPoints;
    bonusMsg = `Zusatz-Tipps: +${bonusPoints} XP erhalten!`;
  }
  
  state.score += roundPoints;
  bonusFeedback.textContent = bonusMsg;

  // Stats aktualisieren
  updateStatsUI();

  // Slot visuell hervorheben
  const slotElements = timelineTrack.querySelectorAll('.timeline-slot');
  slotElements.forEach(slot => slot.style.pointerEvents = 'none');

  // Action Panel (Weiter-Knopf) anzeigen
  actionPanel.classList.remove('hidden');
  document.getElementById('guessing-panel').classList.add('hidden');

  // Timeline neu rendern, um die neue Karte (falls korrekt) anzuzeigen
  // Wir verzögern das Rendern kurz, damit der Flip-Effekt im Fokus bleibt
  setTimeout(() => {
    renderTimeline();
    
    // Visueller Flash-Effekt auf der neu hinzugefügten Karte
    if (isCorrect) {
      const cards = timelineTrack.querySelectorAll('.timeline-card');
      // Die Karte liegt nun an Position chosenIndex
      if (cards[chosenIndex]) {
        cards[chosenIndex].classList.add('success-flash');
      }
    }
  }, 600);
}

function evaluateBonusGuesses() {
  let bonus = 0;
  
  const artistGuess = normalizeString(guessArtistInput.value);
  const titleGuess = normalizeString(guessTitleInput.value);
  const yearGuess = parseInt(guessYearInput.value);

  const correctArtist = normalizeString(state.currentSong.artist);
  const correctTitle = normalizeString(state.currentSong.title);
  const correctYear = state.currentSong.year;

  // Ähnlichkeit mit Levenshtein-Distanz berechnen
  const artistSimilarity = getSimilarity(artistGuess, correctArtist);
  const titleSimilarity = getSimilarity(titleGuess, correctTitle);

  // Leichte Rechtschreibfehler erlauben (Ähnlichkeit >= 0.75 oder gegenseitiges Enthaltensein)
  if (artistGuess.length > 2 && (artistSimilarity >= 0.75 || correctArtist.includes(artistGuess) || artistGuess.includes(correctArtist))) {
    bonus += 50;
    guessArtistInput.style.borderColor = 'var(--color-success)';
  } else if (guessArtistInput.value.trim() !== '') {
    guessArtistInput.style.borderColor = 'var(--color-error)';
  }

  if (titleGuess.length > 2 && (titleSimilarity >= 0.75 || correctTitle.includes(titleGuess) || titleGuess.includes(correctTitle))) {
    bonus += 50;
    guessTitleInput.style.borderColor = 'var(--color-success)';
  } else if (guessTitleInput.value.trim() !== '') {
    guessTitleInput.style.borderColor = 'var(--color-error)';
  }

  if (yearGuess === correctYear) {
    bonus += 50;
    guessYearInput.style.borderColor = 'var(--color-success)';
  } else if (!isNaN(yearGuess)) {
    guessYearInput.style.borderColor = 'var(--color-error)';
  }

  return bonus;
}

// ==========================================================================
// EVENTS & NÄCHSTE RUNDE
// ==========================================================================
nextRoundBtn.addEventListener('click', () => {
  if (state.lives <= 0) {
    endGame(false);
  } else if (state.timeline.length >= 10) {
    endGame(true);
  } else {
    startNewRound();
  }
});

// ==========================================================================
// SPIELENDE
// ==========================================================================
function endGame(isWin) {
  pauseAudio();
  
  if (isWin) {
    modalTitle.textContent = "🏆 Glückwunsch! 🏆";
    modalTitle.style.color = "var(--color-success)";
    modalTitle.style.textShadow = "0 0 15px rgba(57, 255, 20, 0.6)";
  } else {
    modalTitle.textContent = "💥 Game Over 💥";
    modalTitle.style.color = "var(--color-error)";
    modalTitle.style.textShadow = "0 0 15px rgba(255, 49, 49, 0.6)";
  }

  finalCardsCount.textContent = state.timeline.length;
  finalScore.textContent = state.score;
  
  gameOverModal.classList.remove('hidden');
}

restartBtn.addEventListener('click', initGame);

// ==========================================================================
// HILFSFUNKTIONEN
// ==========================================================================
function getRandomSong() {
  // Filtere alle Songs heraus, die noch nicht gespielt wurden
  const availableSongs = songsDatabase.filter(
    song => !state.playedSongs.some(
      played => played.artist === song.artist && played.title === song.title
    )
  );

  if (availableSongs.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * availableSongs.length);
  return availableSongs[randomIndex];
}

function normalizeString(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an)\s+/i, '') // Artikel am Anfang entfernen
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Satzzeichen entfernen
    .replace(/\s{2,}/g, " "); // Doppelte Leerzeichen entfernen
}

function resetGuessInputs() {
  guessArtistInput.value = '';
  guessTitleInput.value = '';
  guessYearInput.value = '';
  
  guessArtistInput.style.borderColor = 'var(--glass-border)';
  guessTitleInput.style.borderColor = 'var(--glass-border)';
  guessYearInput.style.borderColor = 'var(--glass-border)';
}

function updateStatsUI() {
  scoreDisplay.textContent = state.score;
  
  // Leben mit Herz-Symbolen anzeigen
  let hearts = '';
  for (let i = 0; i < 3; i++) {
    if (i < state.lives) {
      hearts += '❤️';
    } else {
      hearts += '🖤';
    }
  }
  livesDisplay.textContent = hearts;
}

// ==========================================================================
// ÄHNLICHKEITSBERECHNUNG (LEVENSHTEIN-DISTANZ)
// ==========================================================================
function getSimilarity(s1, s2) {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

// Start des Spiels beim Laden der Seite
window.addEventListener('DOMContentLoaded', initGame);
