/*
 * WebTTY - Remote Terminal via WebSocket
 * Copyright (c) 2026 Chris Mason <chris@netnix.org>
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

package main

import (
  "os"
  "fmt"
  "net"
  "log"
  "time"
  "flag"
  "sync"
  "embed"
  "bytes"
  "io/fs"
  "bufio"
  "strings"
  "context"
  "syscall"
  "os/exec"
  "net/http"
  "os/signal"
  "html/template"
  "github.com/creack/pty"
  "github.com/gorilla/websocket"
)

const Version = "0.0.1"

//go:embed www
var www embed.FS
var logMutex sync.RWMutex
var logs = make([]string, 0, 512)

type httpWriter struct {
  http.ResponseWriter
  remoteHost string
  statusCode int
}
func responseWriter(w http.ResponseWriter) *httpWriter {
  return &httpWriter { w, "", http.StatusOK }
}
func (w *httpWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
  hj, _ := w.ResponseWriter.(http.Hijacker)
  return hj.Hijack()
}
func (w *httpWriter) WriteHeader(statusCode int) {
  if statusCode != http.StatusOK {
    for _, k := range []string {
      "Cache-Control",
      "ETag",
    } {
      w.ResponseWriter.Header().Del(k)
    }
  }
  w.statusCode = statusCode
  w.ResponseWriter.WriteHeader(w.statusCode)
}

func slog(f string, a ...any) {
  m := fmt.Sprintf(f, a...)
  logMutex.Lock()
  logs = append(logs, fmt.Sprintf("[%s] %s", time.Now().Format(time.StampMilli), m))
  if len(logs) == cap(logs) {
    i := int(cap(logs) / 2)
    copy(logs[0:], logs[i:])
    logs = logs[:i]
  }
  logMutex.Unlock()
  log.Print(m)
}

func logRequest(h http.Handler, xffPtr bool) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    _w := responseWriter(w)
    remoteHost, _, _ := net.SplitHostPort(r.RemoteAddr)
    if xffPtr && r.Header.Get("X-Forwarded-For") != "" {
      _w.remoteHost = r.Header.Get("X-Forwarded-For")

    } else {
      _w.remoteHost = remoteHost
    }
    h.ServeHTTP(_w, r)

    if _w.statusCode > 0 {
      var statusCode string

      if _w.statusCode >= 400 {
        statusCode = fmt.Sprintf("\033[31m%d\033[0m", _w.statusCode)

      } else if _w.statusCode >= 300 {
        statusCode = fmt.Sprintf("\033[33m%d\033[0m", _w.statusCode)

      } else {
        statusCode = fmt.Sprintf("\033[32m%d\033[0m", _w.statusCode)
      }
      slog("[%s] {%s} %s %s\n", _w.remoteHost, statusCode, r.Method, r.URL.Path)
    }
  })
}

func webTtyHandler(cPtr string) func(http.ResponseWriter, *http.Request) {
  return func(w http.ResponseWriter, r *http.Request) {
    if c, err := websocket.Upgrade(w, r, nil, 1024, 1024); err == nil {
      defer c.Close()

      w.(*httpWriter).statusCode = 0
      slog("[%s] {%s} %s %s\n", w.(*httpWriter).remoteHost, "\033[34m101\033[0m", r.Method, r.URL.Path)

      cmd := exec.Command(cPtr)
      cmd.Env = os.Environ()

      if tty, err := pty.Start(cmd); err == nil {
        go func() {
          for {
            buffer := make([]byte, 1024)
            if bytes, err := tty.Read(buffer); err == nil {
              if c.WriteMessage(websocket.BinaryMessage, buffer[:bytes]); err != nil {
                slog("error writing to socket\n")
                break
              }
            } else {
              slog("closed down due to error\n")

              if cmd.Process.Kill() == nil {
                if _, err := cmd.Process.Wait(); err == nil {
                  tty.Close()
                }
              }
              break
            }
          }
        }()

        for {
          if _, data, err := c.ReadMessage(); err == nil {
            buffer := bytes.Trim(data, "\x00")

            if buffer[0] == 1 {
              pty.Setsize(tty, &pty.Winsize{ Rows: uint16(buffer[1]) + 1, Cols: uint16(buffer[2]) })

            } else {
              if _, err := tty.Write(buffer); err != nil {
                slog("error writing to tty\n")
                break
              }
            }
          } else {
            slog("error reading from websocket\n")
          }
        }
      } else {
        http.Error(w, err.Error(), http.StatusInternalServerError)
      }
    } else {
      http.Error(w, err.Error(), http.StatusInternalServerError)
    }
  }
}

func logHandler(webLogToken string) func(http.ResponseWriter, *http.Request) {
  return func(w http.ResponseWriter, r *http.Request) {
    if c, err := websocket.Upgrade(w, r, nil, 1024, 1024); err == nil {
      defer c.Close()
      var lastMessage time.Time
      var n int

      w.(*httpWriter).statusCode = 0

      if cookie, err := r.Cookie("WebTTY-WebLog-Token"); err != nil || cookie.Value != webLogToken {
        slog("[%s] {%s} %s %s\n", w.(*httpWriter).remoteHost, "\033[31m401\033[0m", r.Method, r.URL.Path)
        c.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("%d %s", http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized))))
        return

      } else {
        slog("[%s] {%s} %s %s\n", w.(*httpWriter).remoteHost, "\033[34m101\033[0m", r.Method, r.URL.Path)
        if err := c.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("%d %s", http.StatusOK, http.StatusText(http.StatusOK)))); err != nil {
          return
        }
      }

      go func() {
        for {
          c.SetReadDeadline(time.Now().Add(time.Minute))
          if _, _, err := c.NextReader(); err != nil {
            c.Close()
            break
          }
        }
      }()

      for {
        logMutex.RLock()

        if len(logs) < n {
          n = len(logs) - 1
        }
        for i := n; i < len(logs); i, n = i+1, n+1 {
          if err := c.WriteMessage(websocket.TextMessage, []byte(logs[i])); err != nil {
            logMutex.RUnlock()
            return
          }
          lastMessage = time.Now()
        }
        logMutex.RUnlock()
        if time.Since(lastMessage).Seconds() >= 20 {
          if err := c.WriteMessage(websocket.TextMessage, []byte("PING")); err != nil {
            return
          }
          lastMessage = time.Now()
        }
        time.Sleep(time.Second)
      }
    } else {
      http.Error(w, err.Error(), http.StatusInternalServerError)
    }
  }
}

func wwwHandler(h http.Handler, tmpl *template.Template, eTag string) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.URL.Path == "/" {
      r.URL.Path = "/index.html"
    }

    if r.Header.Get("If-None-Match") == eTag {
      w.WriteHeader(http.StatusNotModified)

    } else {
      if strings.HasPrefix(r.URL.Path, fmt.Sprintf("/%s/", eTag)) {
        r.URL.Path = strings.TrimPrefix(r.URL.Path[1:], eTag)
        w.Header().Set("Cache-Control", "max-age=31536000, immutable")

      } else {
        w.Header().Set("Cache-Control", "max-age=0, must-revalidate")
        w.Header().Set("ETag", eTag)
      }

      if t := tmpl.Lookup(r.URL.Path[1:]); t != nil {
        var buf bytes.Buffer

        data := map[string]string {
          "Version": eTag,
        }

        if err := t.Execute(&buf, data); err == nil {
          w.Write(buf.Bytes())

        } else {
          http.Error(w, err.Error(), http.StatusInternalServerError)
        }
      } else {
        h.ServeHTTP(w, r)
      }
    }
  })
}

func main() {
  if _, defined := os.LookupEnv("JOURNAL_STREAM"); !defined {
    fmt.Fprintf(os.Stdout, "WebTTY v%s - Remote Terminal via WebSocket\n", Version)
    fmt.Fprintf(os.Stdout, "Copyright (c) 2026 Chris Mason <chris@netnix.org>\n\n")

  } else {
    log.SetFlags(log.Flags() &^ (log.Ldate | log.Ltime))
  }

  flag.Usage = func() {
    fmt.Fprintf(os.Stderr, "Usage: webtty [-l <address>] [-p <port>] [-xff] [-weblog] -c \"<command> [args]\"\n")
  }

  lPtr := flag.String("l", "127.0.0.1", "Listen Address")
  pPtr := flag.Int("p", 8080, "Listen Port")
  xffPtr := flag.Bool("xff", false, "Use X-Forwarded-For")
  webLogPtr := flag.Bool("weblog", false, "Enable /logs.html (uses WEBTTY_WEBLOG_TOKEN)")
  cPtr := flag.String("c", "", "Command to Execute")
  flag.Parse()

  if len(flag.Args()) > 0 {
    fmt.Fprintf(os.Stderr, "unknown flags provided: %s\n", strings.Join(flag.Args(), ", "))
    flag.Usage()
    os.Exit(0);

  } else if len(*cPtr) == 0 {
    fmt.Fprintf(os.Stderr, "mandatory flag not provided: -c\n")
    flag.Usage()
    os.Exit(0)
  }

  sCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
  defer stop()

  mux := http.NewServeMux()
  subFS, _ := fs.Sub(www, "www")
  if tmpl, err := template.ParseFS(subFS, "*.html"); err == nil {
    mux.Handle("GET /", wwwHandler(http.FileServer(http.FS(subFS)), tmpl, Version))
    mux.HandleFunc("GET /webtty", webTtyHandler(*cPtr))

    if *webLogPtr {
      if webLogToken, defined := os.LookupEnv("WEBTTY_WEBLOG_TOKEN"); defined {
        mux.HandleFunc("GET /logs", logHandler(webLogToken))

      } else {
        fmt.Fprintf(os.Stdout, "Error: Environment WEBTTY_WEBLOG_TOKEN is not defined\n")
        os.Exit(1)
      }
    } else {
      mux.HandleFunc("GET /logs.html", http.NotFound)
    }

    s := &http.Server {
      Addr: fmt.Sprintf("%s:%d", *lPtr, *pPtr),
      Handler: logRequest(mux, *xffPtr),
      BaseContext: func(net.Listener) context.Context {
        return sCtx 
      },
    }

    go func() {
      slog("Starting WebTTY (PID is %d) on http://%v...\n", os.Getpid(), s.Addr)

      if err := s.ListenAndServe(); err != http.ErrServerClosed {
        log.Fatalf("Error: %v\n", err)
      }
    }()

    <-sCtx.Done()
    slog("Caught Signal... Terminating...\n")
    cCtx, cancel := context.WithTimeout(context.Background(), 5 * time.Second)
    defer cancel()

    s.Shutdown(cCtx)

  } else {
    fmt.Fprintf(os.Stdout, "Error: %v\n", err)
    os.Exit(1)
  }
}

