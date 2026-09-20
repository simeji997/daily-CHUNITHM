'use strict';
// Self-contained so the editor can embed this function in the exported HTML.
function installSongAutocomplete(songs, options = {}) {
  const input = document.getElementById(options.inputId || 'answer');
  if (!input || !Array.isArray(songs)) return;
  const form = options.containerId ? document.getElementById(options.containerId) : input.form;
  if (!form) return;
  const list = document.createElement('ul');
  list.id = options.inputId ? options.inputId + '-suggestions' : 'song-suggestions'; list.className = 'song-suggestions'; list.hidden = true;
  list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', '曲名候補'); form.append(list);
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id); input.setAttribute('aria-expanded', 'false');
  input.setAttribute('spellcheck', 'false');
  const fold = text => text.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s/g, '');
  const seen = new Set();
  const index = songs.filter(song => {
    if (!song || typeof song.title !== 'string' || seen.has(song.title)) return false;
    seen.add(song.title); return true;
  }).map(song => ({ title: song.title, keys: [song.title, song.reading, ...(Array.isArray(song.readings) ? song.readings : [])].filter(s => typeof s === 'string' && s).map(fold) }));
  let matches = [], active = -1, composing = false, justComposed = false;
  function close() {
    list.hidden = true; list.replaceChildren(); matches = []; active = -1;
    input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
  }
  function highlight(next) {
    active = next;
    [...list.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) { input.setAttribute('aria-activedescendant', list.children[active].id); list.children[active].scrollIntoView({ block: 'nearest' }); }
  }
  function segment() {
    if (!options.multiple) return { start: 0, end: input.value.length };
    const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, caret);
    const start = Math.max(before.lastIndexOf('、'), before.lastIndexOf(',')) + 1;
    const tail = input.value.slice(caret).search(/[、,]/);
    return { start, end: tail < 0 ? input.value.length : caret + tail };
  }
  function choose(i) {
    if (!matches[i]) return;
    const { start, end } = segment();
    const title = matches[i].title;
    input.value = input.value.slice(0, start) + title + input.value.slice(end);
    close(); input.focus();
    if (options.multiple) input.setSelectionRange(start + title.length, start + title.length);
    options.onSelect?.();
  }
  function update() {
    close();
    const { start, end } = segment();
    const query = fold(input.value.slice(start, end));
    if (!query || input.disabled || composing) return;
    // Prefix matches first, then substring matches. Search both source title and reading.
    matches = index.filter(song => song.keys.some(key => key.includes(query))).sort((a, b) => Number(b.keys.some(key => key.startsWith(query))) - Number(a.keys.some(key => key.startsWith(query))));
    if (!matches.length) return;
    matches.forEach((song, i) => {
      const option = document.createElement('li'); option.id = options.inputId ? `${options.inputId}-option-${i}` : `song-option-${i}`; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false'); option.textContent = song.title;
      option.addEventListener('pointerdown', event => { if (event.pointerType === 'mouse') event.preventDefault(); });
      option.addEventListener('click', () => choose(i)); list.append(option);
    });
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); highlight(0);
  }
  input.addEventListener('input', update);
  input.addEventListener('compositionstart', () => { composing = true; close(); });
  input.addEventListener('compositionend', () => { composing = false; justComposed = true; setTimeout(() => { justComposed = false; }, 0); update(); });
  input.addEventListener('keydown', event => {
    if (composing || justComposed || event.isComposing || event.keyCode === 229) {
      if (event.key === 'Enter') event.preventDefault(); return;
    }
    if (event.key === 'Escape') { close(); return; }
    if (event.key === 'Tab') { close(); return; }
    if (list.hidden) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); highlight((active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
    } else if (event.key === 'Enter') { event.preventDefault(); choose(active); }
  });
  // Keep the quiz's existing submit handler. Only IME confirmation is intercepted.
  form.addEventListener('submit', event => {
    if (composing || justComposed) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    close();
  }, true);
  document.addEventListener('pointerdown', event => { if (!form.contains(event.target)) close(); });
  document.addEventListener('focusin', event => { if (!form.contains(event.target)) close(); });
  document.getElementById('pass')?.addEventListener('click', close);
  new MutationObserver(() => { if (input.disabled) close(); }).observe(input, { attributes: true, attributeFilter: ['disabled'] });
}
if (typeof module !== 'undefined') module.exports = { installSongAutocomplete };


