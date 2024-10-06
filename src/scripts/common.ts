let darkmode = localStorage.getItem('darkmode') === '1';
if (!darkmode) localStorage.setItem('darkmode', '0');
loadDarkmode();
(document.querySelector(`a[href="${window.location.pathname.split('/').pop() || 'index.html'}"]`) as HTMLElement).classList.add('underline');

function toggleDarkmode(): void {
  darkmode = !darkmode;
  localStorage.setItem('darkmode', darkmode ? '1' : '0');
  document.querySelector('body')!.dataset.darkmode = String(darkmode);
  loadDarkmode();
}

function loadDarkmode(): void {
  if (darkmode) document.querySelector('body')!.dataset.darkmode = String(darkmode);
  (document.querySelector('footer img') as HTMLImageElement).src = `./imgs/${darkmode ? 'sun' : 'moon'}.png`;
}
