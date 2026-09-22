
'use strict';
const $ = id => document.getElementById(id);
let activeImages = [], acceptedAnswers = [], displayAnswer = '', stage = 0, viewedStage = 0, playing = false;
let shareHistory = [], resultRevealed = false;
let playHistory = [], progressDate = '';
const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[\s\u3000]/g, '').replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
function render() {
  const canShare = resultRevealed;
  $('share-result').hidden = !canShare;
  $('share-result').disabled = !canShare;
  $('share-status').hidden = !canShare;
  $('pass').hidden = resultRevealed;
  $('stage-label').textContent = `STEP ${String(stage + 1).padStart(2, '0')} / 06`;
  $('progress').replaceChildren();
  for (let i = 0; i < 6; i++) { const dot = document.createElement('span'); dot.className = `step${i === viewedStage ? ' current' : i <= stage ? ' seen' : ''}`; $('progress').append(dot); }
  if (activeImages.length) { $('quiz-image').src = activeImages[viewedStage]; $('quiz-image').alt = viewedStage === 6 ? '正解画像' : `クイズ画像：${viewedStage + 1} / 6段階目${viewedStage === 5 ? '（全体）' : ''}`; $('quiz-image').hidden = false; $('empty').hidden = true; }
  $('answer').disabled = $('submit').disabled = $('pass').disabled = !playing;
  $('previous-image').disabled = !activeImages.length || viewedStage === 0;
  $('next-image').disabled = !activeImages.length || viewedStage >= (playing ? stage : activeImages.length - 1);
  $('image-position').textContent = activeImages.length ? viewedStage === 6 ? '正解画像' : `${viewedStage + 1} / ${playing ? stage + 1 : activeImages.length}枚` : '';
  $('pass').textContent = stage === 5 ? '答えを見る' : '次のヒント';
}
function restart() { playHistory = []; resultRevealed = false; shareHistory = []; $('share-status').textContent = ''; stage = 0; viewedStage = 0; playing = true; $('history').replaceChildren(); $('answer').value = ''; $('status').className = 'status'; $('status').textContent = ''; render(); $('answer').focus(); }
function addHistory(text, correct, passed = false) { playHistory.push({ text, correct, passed }); shareHistory.push(correct ? 'O' : passed ? 'ー' : 'X'); const li = document.createElement('li'); li.textContent = `${stage + 1}. ${text} ${correct ? '✓' : passed ? '—' : '×'}`; if (correct) li.className = 'correct'; else if (!passed) li.className = 'incorrect'; $('history').append(li); }
function finish(correct, restoring = false) {
  if (resultRevealed) return;
  resultRevealed = true;
  const solvedAt = stage + 1; playing = false; stage = 5; viewedStage = activeImages.length - 1; render();
  $('status').className = correct ? 'status win' : 'status';
  $('status').textContent = correct ? `正解！ 答えは「${displayAnswer}」。${solvedAt}段階目で見抜きました。` : `答え　「${displayAnswer}」`;
  saveProgress();
  if (!restoring) trackGameEvent(correct ? 'game_clear' : 'game_failed', correct ? solvedAt : undefined);
}
function advance() {
  $('answer').value = '';
  if (stage === 5) { finish(false); return; }
  stage++; viewedStage = stage; render(); $('status').textContent = ''; saveProgress();
}
$('answer-form').addEventListener('submit', event => {
  event.preventDefault(); if (!playing) return;
  const answer = $('answer').value.trim(); if (!normalize(answer)) { $('status').textContent = '答えを入力してください。'; return; }
  const correct = acceptedAnswers.includes(normalize(answer)); addHistory(answer, correct);
  if (correct) finish(true); else { trackGameEvent('answer_wrong', stage + 1); advance(); }
});
$('pass').addEventListener('click', () => { if (!playing) return; addHistory('パス', false, true); trackGameEvent('pass', stage + 1); advance(); });
$('previous-image').addEventListener('click', () => { if (activeImages.length && viewedStage > 0) { viewedStage--; render(); } });
$('next-image').addEventListener('click', () => { if (activeImages.length && viewedStage < (playing ? stage : activeImages.length - 1)) { viewedStage++; render(); } });
async function loadQuestion(question) {
  try {
    if (!question) return;
    if (!Array.isArray(question.images) || question.images.length !== 6 || !question.images.every(src => typeof src === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(src)) || !Array.isArray(question.answers) || !question.answers.length || !question.answers.every(a => typeof a === 'string' && normalize(a))) throw new Error('Invalid question');
    $('status').textContent = '画像を読み込んでいます…';
    const images = [...question.images];
    if (question.answerImage) {
      if (typeof question.answerImage !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(question.answerImage)) throw new Error('Invalid answer image');
      images.push(question.answerImage);
    }
    await Promise.all(images.map(src => { const img = new Image(); img.src = src; return img.decode(); }));
    $('question-label').textContent = typeof question.label === 'string' ? question.label.trim() : '';
    $('question-label').hidden = !$('question-label').textContent;
    activeImages = images; acceptedAnswers = question.answers.map(normalize); displayAnswer = question.answers[0]; progressDate = question.label; restart(); const restored = restoreProgress(); saveProgress(); if (!restored) trackGameEvent('game_start');
  } catch { $('status').textContent = '問題を読み込めませんでした。時間をおいて再度お試しください。'; }
}
// Explicit allowlist: never pass answers, titles, history or image data to GA4.
function trackGameEvent(name, step) {
  if (!['game_start', 'answer_wrong', 'pass', 'game_clear', 'game_failed'].includes(name)) return;
  const params = { quiz_date: progressDate };
  if (['answer_wrong', 'pass', 'game_clear'].includes(name)) params.step = step;
  try { if (typeof window.gtag === 'function') window.gtag('event', name, params); } catch { /* Analytics must never interrupt play. */ }
}
function progressKey() { return `daily-chunithm:progress:v1:${progressDate}`; }
function storageWarning() {
  $('storage-status').textContent = 'このブラウザでは進捗を保存できません。再読み込みすると最初からになります。';
}
function saveProgress() {
  if (!progressDate || !activeImages.length) return;
  try {
    localStorage.setItem(progressKey(), JSON.stringify({ version: 1, date: progressDate, step: stage, completed: resultRevealed, history: playHistory }));
    $('storage-status').textContent = '';
  } catch { storageWarning(); }
}
function restoreProgress() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(progressKey())); }
  catch { storageWarning(); return; }
  if (!saved) return;
  // Validate before applying any state. Never inject saved answer text as HTML.
  if (saved.version !== 1 || saved.date !== progressDate || !Array.isArray(saved.history) || saved.history.length > 6 || typeof saved.completed !== 'boolean') return;
  const entries = saved.history;
  if (!entries.every(e => e && typeof e.text === 'string' && e.text.length <= 80 && typeof e.correct === 'boolean' && typeof e.passed === 'boolean' && !(e.correct && e.passed))) return;
  const winIndex = entries.findIndex(e => e.correct);
  if (winIndex !== -1 && winIndex !== entries.length - 1) return;
  const completed = winIndex !== -1 || entries.length === 6;
  if (saved.completed !== completed || saved.step !== (completed ? 5 : entries.length)) return;
  for (let i = 0; i < entries.length; i++) {
    stage = i;
    addHistory(entries[i].text, entries[i].correct, entries[i].passed);
  }
  if (completed) finish(winIndex !== -1, true);
  else { stage = entries.length; viewedStage = stage; render(); }
  return true;
}
function buildShareText() {
  const results = Array.from({ length: 6 }, (_, i) => `${'１２３４５６'[i]}．${shareHistory[i] || 'ー'}`).join('　');
  return ['Daily CHUNITHM', $('question-label').textContent, shareHistory.includes('O') ? '⭕正解！' : '❌不正解...', results, 'Daily-CHUNITHM.com'].join('\n');
}
function shareResult() {
  if (!resultRevealed) return;
  const link = document.createElement('a');
  link.href = 'https://x.com/intent/tweet?text=' + encodeURIComponent(buildShareText());
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  document.body.append(link); link.click(); link.remove();
}
$('share-result').addEventListener('click', shareResult);
function tokyoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}.${value('month')}.${value('day')}`;
}
function showUnavailable() {
  $('empty').textContent = '本日の問題はまだ公開されていません。';
  $('status').textContent = '';
}
function loadDailyQuestion() {
  const date = tokyoDate();
  $('question-label').textContent = date; $('question-label').hidden = false;
  $('status').textContent = '本日の問題を読み込んでいます…';
  window.DAILY_CHUNITHM_QUIZ = undefined;
  const script = document.createElement('script');
  script.src = `quizzes/${date}.js`;
  script.onload = () => {
    const question = window.DAILY_CHUNITHM_QUIZ;
    if (!question || question.label !== date) { showUnavailable(); return; }
    loadQuestion(question);
  };
  script.onerror = showUnavailable;
  document.body.append(script);
}
render();
installSongAutocomplete(window.CHUNITHM_SONGS || []);
loadDailyQuestion();










