(() => {
  let m = undefined;

  function quote(str) {
    str = str.replaceAll(/&/g, '&amp;');
    str = str.replaceAll(/>/g, '&gt;');
    return str.replaceAll(/</g, '&lt;');
  }

  function ansiToRGB(str) {
    str = str.replaceAll('\033[31m', '<span style="color: rgb(239, 100, 135);">'); // Red
    str = str.replaceAll('\033[32m', '<span style="color: rgb(94, 202, 137);">'); // Green
    str = str.replaceAll('\033[33m', '<span style="color: rgb(253, 216, 119);">'); // Yellow
    str = str.replaceAll('\033[34m', '<span style="color: rgb(101, 174, 247);">'); // Blue
    str = str.replaceAll('\033[35m', '<span style="color: rgb(170, 127, 240);">'); // Magenta
    str = str.replaceAll('\033[36m', '<span style="color: rgb(67, 193, 190);">'); // Cyan
    return str.replaceAll('\033[0m', '</span>');
  }

  function add(str) {
    document.getElementById('logs').innerHTML += ansiToRGB(quote(str));
    window.scrollTo({ 'left': 0, 'top': document.body.scrollHeight, 'behavior': 'instant' });
  }

  window.addEventListener('load', (e) => {
    let lastPongMessage = 0;
    let lastMessage = 0;

    function connect() {
      let url = new URL('_logs', window.location.href);
      url.protocol = url.protocol.replace('http', 'ws');
      let ws = new WebSocket(url);
      let statusCode = 0;

      ws.addEventListener('open', () => {
        let h = setInterval(() => {
          if ((Date.now() - lastMessage) > 60000) {
            clearInterval(h);
            ws.close();
          }
        }, 6000);
      });

      ws.addEventListener('message', (e) => {
        if (statusCode === 0) {
          statusCode = parseInt(e.data.split(' ')[0]);

          if (statusCode === 401) {
            m = new bootstrap.Modal(document.getElementById('mtoken'), { keyboard: false });
            m.show();
            ws.close();
          }
        }
        else {
          lastMessage = Date.now();

          if (e.data != 'PING') {
            add(e.data) 
          }
          if ((lastMessage - lastPongMessage) >= 20000) {
            lastPongMessage = lastMessage;
            ws.send('PONG');
          }
        }
      });

      ws.addEventListener('close', () => {
        if (statusCode === 200) {
          add('Connection Closed\n')
        }
      });
    }

    document.getElementById('mtoken').addEventListener('shown.bs.modal', (e) => {
      document.getElementById('token').focus();
    });

    document.getElementById('mtoken').addEventListener('hidden.bs.modal', (e) => {
      document.getElementById('token').value = '';
    });

    document.getElementById('btoken').addEventListener('click', (e) => {
      if (document.getElementById('token').value.trim().length) {
        document.cookie = 'WebTTY-Token=' + document.getElementById('token').value + '; max-age=86400; path=/';
        m.hide();
        connect();
      }
      else {
        document.getElementById('token').focus();
      }
    });

    document.getElementById('token').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btoken').click();
      }
    });

    connect();
  });
})();
