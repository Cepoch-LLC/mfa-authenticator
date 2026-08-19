# MFA Authenticator

This is a small Node.js web app for viewing TOTP/MFA codes from a local JSON file. It is built to stay simple: one server, one page, Docker Compose support, and IP-based access control.

## What it does

- Reads accounts from a JSON file
- Generates MFA codes on the server
- Refreshes tokens automatically
- Shows multiple accounts in a compact grid
- Includes a search box to filter by account name
- Restricts access to a fixed list of allowed IPs

## Project files

- `server.js` - Express app and minimal frontend
- `accounts.template.json` - example input file
- `.env.example` - example runtime configuration
- `docker-compose.yml` - local container setup
- `Dockerfile` - app image

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create your secrets file from the template:

```bash
cp accounts.template.json accounts.json
```

3. Create your local environment file:

```bash
cp .env.example .env
```

4. Edit `accounts.json` and replace the sample values with your own Base32 secrets:

```json
[
  {
    "name": "GitHub",
    "secret": "YOUR_BASE32_SECRET"
  }
]
```

5. Set `ALLOWED_IPS` in `.env` as a comma-separated list:

```env
ALLOWED_IPS=192.0.2.10,198.51.100.20
```

6. Start the app:

```bash
npm start
```

Then open `http://localhost:3000`.

## Docker

Run the app with Docker Compose:

```bash
docker compose up --build
```

The app listens on port `3000`.

## Notes

- `accounts.json` is intentionally ignored by git so secrets do not get committed.
- `.env` is intentionally ignored by git so local runtime settings stay out of the repo.
- The server only allows requests from the IPs configured in `ALLOWED_IPS`.
- If you run this behind a reverse proxy, make sure the proxy forwards the client IP correctly.
