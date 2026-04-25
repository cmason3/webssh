# WebTTY - Remote Terminal

```
CGO_ENABLED=0; go build -o webtty -ldflags="-s -w" -trimpath main.go
```

To provide a password protected root terminal on http://localhost:8080 you can use the following:

```
sudo useradd -r -d / webtty
sudo runuser -l webtty -c "/usr/local/bin/webtty /usr/bin/su -l root"
```

To configure it as a service use the following:

```
cat <<EOF | sudo tee /etc/systemd/system/webtty.service 1>/dev/null
[Unit]
Description=WebTTY - Remote Terminal

[Service]
ExecStart=/usr/local/bin/webtty /usr/bin/su -l root
Restart=on-success
User=webtty

[Install]
WantedBy=default.target
EOF

sudo systemctl daemon-reload

sudo systemctl enable --now webtty.service

sudo systemctl status webtty.service
```
