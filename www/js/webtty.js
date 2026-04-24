(() => {
  window.addEventListener("load", (e) => {
    let terminal = new Terminal({
      theme: {
        foreground: "#b3b0d6",
        background: "#29283b",
        cusorAccent: "#535178",
        cursor: "#b3b0d6",
        black: "#535178",
        blue: "#65aef7",
        cyan: "#43c1be",
        green: "#5eca89",
        magenta: "#aa7ff0",
        red: "#ef6487",
        white: "#ffffff",
        yellow: "#fdd877",
        brightBlack: "#535178",
        brightBlue: "#65aef7",
        brightCyan: "#43c1be",
        brightGreen: "#5eca89",
        brightMagenta: "#aa7ff0",
        brightRed: "#ef6487",
        brightWhite: "#ffffff",
        brightYellow: "#fdd877"
      },
      lineHeight: 1.2,
      cursorInactiveStyle: "none",
      fontWeightBold: "normal"
    });

    let fitAddon = new FitAddon.FitAddon();
    terminal.open(document.getElementById("terminal"));
    terminal.loadAddon(fitAddon);

    window.addEventListener("resize", () => {
      fitAddon.fit();
    });

    let url = new URL("webtty", window.location.href);
    url.protocol = url.protocol.replace("http", "ws");
    let ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      terminal.loadAddon(new AttachAddon.AttachAddon(ws));
      terminal.focus();

      terminal.onResize((e) => {
        if (ws.readyState == WebSocket.OPEN) {
          ws.send(new Uint8Array([1, e.rows, e.cols]));
        }
        terminal.write(" ");
        terminal.write("\b");
      });

      terminal.onTitleChange((e) => {
        document.title = e;
      });

      fitAddon.fit();
    });

    ws.addEventListener("close", () => {
      if (terminal.buffer.active.cursorX > 0) {
        terminal.write("\r\n");
      }
      terminal.write("Connection Closed\033[?25l");
    });
  });
})();
