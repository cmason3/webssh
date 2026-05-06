# WebTTY - Remote Terminal

WebTTY is a simple tool, which provides a web based terminal on http://localhost:8080. It is advisable to place HAProxy in front to provide TLS termination, as well as restricting this to internal use only, as making a remote root shell (or any shell for that matter) accessible over the Internet is asking for trouble.

### Usage

```
webtty [options] <command> [args]

Options:
  -l <address>           Listen Address (default is 127.0.0.1)
  -p <port>              Listen Port (default is 8080)
  -ft <dir>              File Transfer Directory
  -r <Nh|Nd|Nw|Nm|Ny>    File Retention Period
  -weblog                Enable WebLog via "/logs"
  -xff                   Use X-Forwarded-For in Logs

Environment Variables:
  WEBTTY_WEBLOG_TOKEN    Auth Token for WebLog
  WEBTTY_PASSWORD        Password for WebTTY
```

### Installation as a Service

The following commands will install WebTTY as a system service and will provide a password protected root shell via http://localhost:8080.

```
sudo useradd -r -d / webtty
```

```
sudo tee /etc/systemd/system/webtty.service >/dev/null <<-EOF
[Unit]
Description=WebTTY - Remote Terminal

[Service]
ExecStart=/usr/local/bin/webtty /usr/bin/su -l root
Restart=on-success
User=webtty

[Install]
WantedBy=default.target
EOF
```

```
sudo systemctl daemon-reload
sudo systemctl enable --now webtty.service
sudo systemctl status webtty.service
```

### WebTTY - File Transfer

WebTTY also supports a simple File Transfer capability using the `-ft` argument to specify a directory for storage with an optional retention period (`-r`) in hours, days, weeks, months or years.

#### Upload

```
curl -T <file> http://localhost:8080/ft/
```

```json
{
  "url": "http://localhost:8080/ft/<uuid>/<file>"
}
```

#### Download

```
curl -Of http://localhost:8080/ft/<uuid>/<file>
```

WebTTY will attempt to provide the correct download URL when uploading files within a JSON response, but when running with HAProxy in front, it is unable to determine the correct URL - in this scenario you should pass through the correct URL via the `X-URL` header using the following HAProxy syntax within your backend:

```
http-request set-header X-URL 'https://%[req.hdr(host)]%[path]'
```
