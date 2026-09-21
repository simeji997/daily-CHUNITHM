'use strict';
(() => {
  const open = document.getElementById('help-open');
  const dialog = document.getElementById('help-dialog');
  open.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => open.focus());
})();
