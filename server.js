const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticator } = require('otplib');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ACCOUNTS_FILE = process.env.ACCOUNTS_FILE || path.join(__dirname, 'accounts.json');
const ALLOWED_IPS = new Set(
  (process.env.ALLOWED_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
);

const app = express();
app.set('trust proxy', true);

function normalizeIp(ip) {
  if (!ip) return '';
  return ip.replace(/^::ffff:/, '');
}

function getClientIp(req) {
  return normalizeIp(req.ip || req.socket.remoteAddress);
}

function ipWhitelist(req, res, next) {
  const clientIp = getClientIp(req);
  if (!ALLOWED_IPS.has(clientIp)) {
    return res.status(403).send('Access denied');
  }
  next();
}

function loadAccounts() {
  const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
  const accounts = JSON.parse(raw);
  if (!Array.isArray(accounts)) {
    throw new Error('accounts.json must be an array');
  }
  return accounts.filter((item) => item && item.name && item.secret);
}

function getTokens() {
  const accounts = loadAccounts();
  const step = authenticator.options.step || 30;
  const now = Math.floor(Date.now() / 1000);
  const remaining = step - (now % step);

  return accounts.map(({ name, secret }) => ({
    name,
    token: authenticator.generate(secret),
    remaining,
  }));
}

app.use(ipWhitelist);

app.get('/api/tokens', (req, res) => {
  try {
    res.json(getTokens());
  } catch (err) {
    console.error('Failed to generate tokens:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MFA Tokens</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      max-width: 1200px;
      margin: 24px auto;
      padding: 0 16px 24px;
      background: #f5f5f5;
      color: #222;
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.75rem; }
    .toolbar {
      margin-bottom: 16px;
    }
    .search {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 1rem;
      background: #fff;
    }
    .list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .card {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 14px;
      min-width: 0;
    }
    .name { font-weight: 600; margin-bottom: 8px; }
    .token {
      font-family: ui-monospace, monospace;
      font-size: 1.6rem;
      letter-spacing: 0.14em;
    }
    .timer { color: #666; font-size: 0.875rem; margin-top: 8px; }
    .error { color: #b00020; }
    .empty {
      color: #666;
      padding: 12px 2px;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #0f1115;
        color: #f3f4f6;
      }
      .search {
        background: #171a21;
        border-color: #303643;
        color: #f3f4f6;
      }
      .search::placeholder {
        color: #98a2b3;
      }
      .card {
        background: #171a21;
        border-color: #303643;
      }
      .timer,
      .empty {
        color: #98a2b3;
      }
      .error {
        color: #ff8a80;
      }
    }
  </style>
</head>
<body>
  <h1>MFA Tokens</h1>
  <div class="toolbar">
    <input id="search" class="search" type="search" placeholder="Search accounts" autocomplete="off">
  </div>
  <div id="list" class="list"></div>
  <script>
    const list = document.getElementById('list');
    const search = document.getElementById('search');
    let allTokens = [];

    function formatToken(token) {
      return token.slice(0, 3) + ' ' + token.slice(3);
    }

    function render() {
      const query = search.value.trim().toLowerCase();
      const filtered = allTokens.filter(function(item) {
        return item.name.toLowerCase().includes(query);
      });

      if (!filtered.length) {
        list.innerHTML = '<div class="empty">No matching accounts</div>';
        return;
      }

      list.innerHTML = filtered.map(function(item) {
        return '<div class="card">' +
          '<div class="name">' + item.name + '</div>' +
          '<div class="token">' + formatToken(item.token) + '</div>' +
          '<div class="timer">Refreshes in ' + item.remaining + 's</div>' +
        '</div>';
      }).join('');
    }

    async function refresh() {
      try {
        const res = await fetch('/api/tokens');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load tokens');
        allTokens = data;
        render();
      } catch (err) {
        list.innerHTML = '<p class="error">' + err.message + '</p>';
      }
    }

    search.addEventListener('input', render);
    refresh();
    setInterval(refresh, 1000);
  </script>
</body>
</html>`);
});

app.listen(PORT, HOST, () => {
  console.log('MFA app running on http://' + HOST + ':' + PORT);
  if (ALLOWED_IPS.size === 0) {
    console.warn('No allowed IPs configured. Set ALLOWED_IPS in the environment.');
  } else {
    console.log('Configured allowed IP count:', ALLOWED_IPS.size);
  }
  console.log('Accounts file:', ACCOUNTS_FILE);
});
