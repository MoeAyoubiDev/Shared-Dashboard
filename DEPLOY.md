# Deploying Shared Dashboard on an Ubuntu server (port 8003)

This guide deploys the app so it listens on **port 8003**, managed by **pm2**.

## 0. Requirements

- An Ubuntu server (20.04 / 22.04 / 24.04) with SSH access.
- A reachable **PostgreSQL** database (host, port, user, password, db name).
- Outbound internet on the server (to install packages).

## 1. Install Node.js 20 + git (once per server)

```bash
sudo apt-get update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node --version    # should print v20.x
```

## 2. Get the project onto the server

Either clone it, or copy a tarball from your machine.

**Option A — git:**
```bash
sudo mkdir -p /var/www && sudo chown "$USER":"$USER" /var/www
cd /var/www
git clone <your-repo-url> shared-dashboard
cd shared-dashboard
```

**Option B — copy from your PC (run on your PC):**
```bash
tar czf shared-dashboard.tgz --exclude=node_modules --exclude=.next --exclude=.git .
scp -i <your-key.pem> shared-dashboard.tgz ubuntu@<server-ip>:/tmp/
# then on the server:
sudo mkdir -p /var/www/shared-dashboard && sudo chown "$USER":"$USER" /var/www/shared-dashboard
tar xzf /tmp/shared-dashboard.tgz -C /var/www/shared-dashboard
cd /var/www/shared-dashboard
```

## 3. First run — generate the .env

```bash
bash deploy/deploy.sh
```

The first run creates a `.env` (with auto-generated `JWT_SECRET` and
`CREDENTIAL_ENCRYPTION_KEY`) and then stops. Open `.env` and set your database:

```bash
nano .env
```

Set `DATABASE_URL`, for example:
```
DATABASE_URL=postgres://postgres:YourPassword@10.0.0.5:5432/Shared-Dashboard?sslmode=prefer
```
- If the password contains special characters, URL-encode them (`@` → `%40`).
- If the DB uses a self-signed certificate, use `?sslmode=no-verify`.
- `PORT=8003` is already set.

> Keep `CREDENTIAL_ENCRYPTION_KEY` safe and backed up — if it changes, stored
> site credentials can no longer be decrypted.

## 4. Deploy

```bash
bash deploy/deploy.sh
```

This installs dependencies, builds, runs database migrations, and starts the app
under pm2 on **port 8003**. To use a different port:

```bash
PORT=8003 bash deploy/deploy.sh
```

## 5. Create the first admin (trainer) account

```bash
node scripts/create-trainer.mjs admin "Ahmad Bitar" "a-strong-password"
```

## 6. Keep it running after reboot

```bash
pm2 startup systemd -u "$USER" --hp "$HOME"   # run the command it prints (with sudo)
pm2 save
```

## 7. Open the port

```bash
sudo ufw allow 8003/tcp     # if the ufw firewall is enabled
```
If the server is on a cloud provider (AWS/GCP/Azure), also add an **inbound rule
for TCP 8003** in its security group / firewall.

## 8. Verify

```bash
curl -I http://127.0.0.1:8003/login        # on the server -> HTTP 200
```
Then open `http://<server-ip>:8003` in a browser.

---

## Updating later (redeploy a new version)

```bash
cd /var/www/shared-dashboard
git pull           # or copy a new tarball as in step 2
bash deploy/deploy.sh
```

## Useful pm2 commands

```bash
pm2 status                     # list processes
pm2 logs shared-dashboard      # tail logs
pm2 restart shared-dashboard   # restart
pm2 stop shared-dashboard      # stop
```

## Optional: serve on port 80/443 with nginx

Run the app on 8003 (as above) and put nginx in front:

```nginx
server {
    listen 80;
    server_name dashboard.example.com;
    location / {
        proxy_pass         http://127.0.0.1:8003;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-Host  $host;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }
}
```
When served over HTTPS, set `SECURE_COOKIES=true` in `.env` and redeploy.
