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

    function connect() {
      let url = new URL("_webtty", window.location.href);
      url.protocol = url.protocol.replace("http", "ws");
      let ws = new WebSocket(url);
      let statusCode = 0;

      ws.addEventListener("message", (e) => {
        if (statusCode === 0) {
          statusCode = parseInt(e.data.split(' ')[0]);

          if (statusCode === 401) {
            ws.close();
            m = new bootstrap.Modal(document.getElementById('mpassword'), { keyboard: false });
            m.show();
          }
          else {
            ws.removeEventListener("message", this);

            terminal.write("\033[1;37mWebTTY - Remote Terminal\r\n");
            terminal.write("\033[1;37mURL https://github.com/cmason3/webtty\r\n");
            terminal.write("\033[1;37mCopyright (c) 2026 Chris Mason <chris@netnix.org>\r\n\n");

            if (document.getElementById("ft").value === "true") {
              terminal.write("\033[1;37mFile Upload\033[0m\r\n");
              terminal.write("$ curl -T \033[1;33m<file>\033[0m " + window.location + "ft/\r\n\n");
              terminal.write("\033[1;37mFile Download\033[0m\r\n");
              terminal.write("$ curl -Of " + window.location + "ft/\033[1;34m<uuid>\033[0m/\033[1;33m<file>\033[0m\r\n\n");
            }

            terminal.loadAddon(new AttachAddon.AttachAddon(ws));
            terminal.focus();

            terminal.onResize((e) => {
              if (ws.readyState == WebSocket.OPEN) {
                ws.send(new Uint8Array([1, e.rows, e.cols]));
              }
            });

            terminal.onTitleChange((e) => {
              document.title = e;
            });

            fitAddon.fit();
          }
        }
      });

      ws.addEventListener("close", () => {
        if (statusCode === 200) {
          if (terminal.buffer.active.cursorX > 0) {
            terminal.write("\r\n");
          }
          terminal.write("Connection Closed\033[?25l");
        }
      });
    }

    document.getElementById('mpassword').addEventListener('shown.bs.modal', (e) => {
      document.getElementById('password').focus();
    });

    document.getElementById('mpassword').addEventListener('hidden.bs.modal', (e) => {
      document.getElementById('password').value = '';
    });

    document.getElementById('bpassword').addEventListener('click', (e) => {
      if (document.getElementById('password').value.trim().length) {
        document.cookie = 'WebTTY-Password=' + document.getElementById('password').value + '; max-age=86400; path=/';
        m.hide();
        connect();
      }
      else {
        document.getElementById('password').focus();
      }
    });

    document.getElementById('password').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('bpassword').click();
      }
    });

    connect();
  });
})();
