(() => {
  window.addEventListener('load', (e) => {
    const t = new Terminal();
    t.open(document.getElementById('terminal'));
    t.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ')
  });
})();
