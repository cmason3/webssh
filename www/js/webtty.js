(() => {
  window.addEventListener('load', (e) => {
    let terminal = new Terminal({
      theme: {
        foreground: '#b3b0d6',
        background: '#29283b'
      },
      cursorBlink: true,
      fullscreenWin: true,
      maximizeWin: true
    });

    terminal.open(document.getElementById('terminal'));

    let url = new URL('/tty', window.location.href);
    url.protocol = url.protocol.replace('http', 'ws');
    let ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      terminal.loadAddon(new AttachAddon.AttachAddon(ws));
    });

    ws.addEventListener('close', () => {
      terminal.write('\n\nConnection Closed\n');
    });
  });
})();
