# FinTrust Final — Identity & Access Management for FinTrust Bank Ltd.

A web platform for **one Indian bank** that controls **who can sign in**, **what they can open**, and **who approved it**.

Built with **React + TypeScript** (Vite, Tailwind CSS, Lucide icons, Recharts charts) for the web pages, **Node.js + Express** for the server, and (only when published) **Supabase PostgreSQL**. Everything used is free.

> **FinTrust Bank Ltd. is fictional.** Every person, phone number and code in the demo is invented. Real Indian banks (SBI, HDFC Bank, ICICI Bank, Axis Bank and others) appear only as *partner / settlement banks*. The app never pretends to be them.

---

## What it does (the core)

| Feature | What it means |
|---|---|
| **Two-step sign-in** | Password, then a 6-digit code sent by email. The code expires in 5 minutes, works once, and allows 5 tries. |
| **Account lockout** | 5 wrong passwords lock the account for 15 minutes. IT Helpdesk can unlock it. |
| **Invitation-only accounts** | No public sign-up. The admin invites a person, who sets their own password from a one-time link. |
| **Joiner, mover, leaver** | Invite a new joiner. Change role or branch for a mover. Disable a leaver, which also **revokes all of their access automatically**. |
| **5 roles (RBAC)** | Checked by the **server** on every request, not just hidden in the menu. |
| **Access requests** | Staff request access to bank applications. An Access Manager approves or rejects. Access can be revoked. |
| **Segregation of duties** | Nobody approves their own request. "Admin" on a critical system needs a System Administrator. Nobody changes their own role. |
| **Tamper-evident audit trail** | Every action is logged with a SHA-256 hash chain. "Verify integrity" proves nothing was edited or deleted. CSV export. |
| **Security policy** | Lockout, code expiry and session timeouts can be edited by the admin, and every change is audited. |
| **Dashboards** | A different dashboard for each role, decided by the server. |

### The 5 roles

| Role | Can do |
|---|---|
| **System Administrator** | Everything: invite staff, change roles and status, approve any request, edit the security policy, read the audit trail |
| **Access Manager** | Approve, reject and revoke application access; view staff and the access register |
| **IT Helpdesk** | Unlock accounts, send password-reset links, re-send invitations. **Cannot** change roles or touch admin accounts |
| **Auditor** | Read-only: audit trail, integrity check, access register, staff list, policy |
| **Employee** | Own profile, request access, see own requests and access |

### The bank (demo data)
- **Head office:** Nariman Point, Mumbai. **Branches:** Pune, Bengaluru, Chennai, New Delhi, Kolkata, Hyderabad, Ahmedabad, Jaipur, each with an IFSC-style code like `FTBL0000101`.
- **26 staff** with Indian names, 9 departments (Treasury, Loans & Advances, Compliance & Risk…).
- **11 bank applications:** Core Banking System, NEFT/RTGS Payment Gateway, UPI & IMPS Switch, Treasury Dealing, Loan Origination, KYC & CKYC Portal, AML Monitoring (FIU-IND), and more.
- **Partner banks:** SBI, HDFC Bank, ICICI Bank, Axis Bank, Kotak Mahindra Bank, PNB, Bank of Baroda, Canara Bank, Union Bank of India, IndusInd Bank.
- Ready-made scenarios: pending requests, a locked account (Pooja Patil), a suspended teller, a leaver whose access was removed, and 2 invited people.

---

## Part A — Run it on your laptop (about 5 minutes)

You need **Node.js** (version 20.19 or newer; the current **LTS 22** is best). Check in PowerShell: `node -v`. If it isn't installed, get the **LTS** version from <https://nodejs.org>.

1. Unzip `fintrust-final.zip` into a **new, empty** folder named `fintrust final` somewhere simple, for example `Documents\fintrust final`. Don't unzip it over an older copy.
2. Open **VS Code**, then **File → Open Folder…** and choose `fintrust final`.
3. Open the terminal with **Terminal → New Terminal** and run:
   ```powershell
   npm install
   ```
4. Start the app:
   ```powershell
   npm start
   ```
   You should see:
   ```
   FinTrust Bank Ltd. · Identity & Access Management
   Open:     http://localhost:5000
   ...
   Demo accounts (one per role):
    System Administrator   rohan.deshmukh@fintrustbank.example
    ...
   Password for all demo accounts: Mumbai@2026
   ```
5. Open <http://localhost:5000> in your browser.
6. Click a role in the **Demo accounts** box, type the password `Mumbai@2026`, and press **Continue**.
7. **The 6-digit code is printed in the VS Code terminal** (in a box starting with `✉ EMAIL`). Type it in and you're signed in.

That's all. **No `.env`, no Supabase and no email setup are needed on your laptop.** Data is saved in `data/fintrust-data.json`.

The finished web pages are already built into the `public` folder, so `npm start` works straight away. **Only if you change something in `client/`**, rebuild them with `npm run build` (or use `npm run dev` while editing, see below).

Useful commands:

| Command | What it does |
|---|---|
| `npm start` | Start the app (stop with **Ctrl + C**) |
| `npm run build` | Rebuild the React web pages into `public/` after you edit `client/` |
| `npm run dev` | Live-reloading web pages at <http://localhost:5173> while editing (keep `npm start` running in a second terminal) |
| `npm run typecheck` | Check the TypeScript code for mistakes |
| `npm test` | Run 101 automated security tests on a separate copy of the data |
| `npm run check` | Check your settings |
| `npm run wallet` | Create the blockchain test wallet (or show its balance), see Part E |
| `npm run reset-demo` | Delete all data and start again with fresh demo data at the next `npm start` |

---

## Part B — Demo script for your presentation (about 10 minutes)

| Sign in as | Show this |
|---|---|
| **Employee** (Sneha Kulkarni) | Dashboard → **My Access** → request *KYC & CKYC Portal (Read)*. Open **My Profile**: only the mobile number can be changed. Type `/app#/users` in the address bar and the page says "Not available". |
| **Access Manager** (Priya Nair) | **Approvals**: approve Sneha's request. Point out that Priya **cannot** approve her *own* AML request, and cannot approve Nikhil's *Admin on Core Banking* (critical, so a System Admin must do it). |
| **System Administrator** (Rohan Deshmukh) | Approve Nikhil's critical request. **Staff & Accounts → + Invite staff member**: invite someone and open the link to set a password. Change a role (a reason is required). **Disable** Sanjay-style leavers and show that the access was revoked automatically. Edit the **Security Policy**. |
| **New staff member** (the person you invited) | Open the invitation link, set a password and sign in. The app asks for a **profile photo** and nothing else works until one is saved. The photo then appears in the header, the staff list and the approvals. As the System Administrator, **Remove photo** on their page forces them to upload a new one. |
| **IT Helpdesk** (Arjun Reddy) | Staff → filter **locked** → open *Pooja Patil* → **Unlock account**, then **Send password reset**. Show that there is **no** "Change role" button. |
| **Auditor** (Kavita Menon) | **Audit Trail** → **Verify integrity** ✔. Filter *Result = denied* to see every blocked attempt from the demo. **Export CSV**. Dashboard: privileged access, dormant accounts, leavers with access. |
| **Anyone** | Type a wrong password 5 times and the account locks. Type a wrong code and see "4 tries left". |

---

## Part C — Real emails from your Gmail (optional, laptop only)

1. Turn on 2-Step Verification for your Google account, then create an **App Password** at <https://myaccount.google.com/apppasswords> (name it `FinTrust`). Copy the 16 letters.
2. In VS Code's terminal: `Copy-Item .env.example .env`
3. Open `.env` and set:
   ```
   EMAIL_MODE=gmail
   GMAIL_USER=yourname@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   ADMIN_EMAIL=yourname@gmail.com
   ```
4. Save (**Ctrl + S**). Test it: `npm run check -- yourname@gmail.com`
5. Because the demo accounts were already created with `@fintrustbank.example` emails, run `npm run reset-demo` and then `npm start`. The 5 demo accounts now use `yourname+access@gmail.com`, `yourname+helpdesk@gmail.com` and so on. **Gmail delivers all of them to your own inbox.**

> Never share or screenshot `.env`. It is listed in `.gitignore`, so it won't be uploaded to GitHub.

---

## Part D — Publish it online for free

You'll use three free services: **Supabase** (database), **GitHub** (stores the code) and **Render** (runs the website). Email is optional. Without it, use demo mode.

### D1. Supabase: create the database (5 min)

1. Sign up at <https://supabase.com>, then **New project**.
   - Name: `fintrust-final`
   - Database password: anything strong (you won't need it again)
   - Region: **South Asia (Mumbai)**
2. When it's ready, open **SQL Editor → New query**. Open `supabase/schema.sql` in VS Code, select everything (**Ctrl + A**), copy it, paste it into Supabase, and click **Run**. You should see `Success. No rows returned`.
3. Go to **Project Settings → API Keys** and copy two values:
   - **Project URL**, like `https://abcdefghijkl.supabase.co` (also shown under **Data API** or the **Connect** button)
   - The **secret key**, `sb_secret_...` (click *Reveal*). On older dashboards it's the legacy **`service_role`** key. **Not** the publishable/anon key.

*Optional: test it from your laptop first.* Add `SUPABASE_URL=` and `SUPABASE_SECRET_KEY=` to `.env`, then run `npm run check` and `npm start`. The demo data is created in Supabase. Remove the two lines afterwards to go back to the local file.

### D2. GitHub: upload the code (no Git install needed)

1. Sign up at <https://github.com>, then **+ → New repository**. Name it `fintrust-final`, choose **Private** (or Public), and click **Create repository**.
2. Click **uploading an existing file** and drag in everything from your folder **except `node_modules`, `data` and `.env`**: `client`, `public`, `src`, `scripts`, `supabase`, `server.js`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example` and `README.md`.
3. Click **Commit changes**.

### D3. Email online (choose one)

- **Simplest (classroom demo):** use `DEMO_MODE=true`. The 6-digit code and invitation links appear on screen with a yellow "Demo mode" note. No email account is needed.
- **Real emails:** Render's free plan blocks Gmail's SMTP ports, so use **Brevo** (free, 300 emails/day):
  1. Sign up at <https://www.brevo.com>.
  2. Go to **Senders, Domains & Dedicated IPs → Senders → Add a sender**, enter your Gmail, and confirm it.
  3. Go to **SMTP & API → API Keys → Generate a new API key** and copy it (`xkeysib-...`).
  4. The first emails may land in Spam. Mark them **Not spam**.

### D4. Render: start the website

1. Sign up at <https://render.com> with **Sign in with GitHub**.
2. **New → Web Service**, then pick your `fintrust-final` repository.
3. Fill in:
   - **Name:** `fintrust-final` (your address becomes `https://fintrust-final.onrender.com`, or similar)
   - **Region:** Singapore (closest to India)
   - **Runtime:** Node · **Build Command:** `npm install && npm run build` · **Start Command:** `npm start`
   - **Instance Type:** **Free**
4. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_SECRET_KEY` | your `sb_secret_...` key |
   | `DEMO_PASSWORD` | a password for the demo accounts, e.g. `Kesar#Mango47` (10+ characters) |
   | `APP_BASE_URL` | `https://fintrust-final.onrender.com` (your real Render address) |
   | `DEMO_MODE` | `true` (if you chose the simplest option) |
   | `EMAIL_MODE` | `brevo` (only if you set up Brevo) |
   | `BREVO_API_KEY` | your Brevo key (only with Brevo) |
   | `MAIL_FROM` | the Gmail you verified in Brevo (only with Brevo) |
   | `ADMIN_EMAIL` | your Gmail (only with Brevo, so codes reach your inbox) |
   | `ANCHOR_PRIVATE_KEY` | from your `.env` (only if you set up blockchain anchoring, Part E) |

5. Under **Advanced → Health Check Path**, enter `/api/health`.
6. Click **Create Web Service** and wait for **Live** (2–4 minutes).
7. Open `https://your-address.onrender.com/api/health`. You should see `"status":"ok"`.
8. If Render gave you a different address, update `APP_BASE_URL` under **Environment**, then click **Save, rebuild and deploy**.

**Good to know:**
- The free Render plan **sleeps after 15 minutes** without visitors, and the first visit afterwards takes about a minute. Open the site a few minutes before your presentation. Sessions are kept in memory, so after a sleep everyone simply signs in again.
- Free Supabase projects **pause after 7 days** without activity. Open the Supabase dashboard and click **Restore**.
- To update the website, upload the changed files to GitHub (**Add file → Upload files**). Render redeploys automatically.
- To reset the online demo data, run `supabase/schema.sql` again in Supabase, then **Manual Deploy → Restart** in Render.

---

## Part E — Blockchain anchoring of the audit trail (optional, free)

**Why:** the audit trail is a hash chain, so editing one entry is detected. But someone with full database access could rewrite *everything* and recompute every hash. Anchoring publishes the latest hash on a public blockchain (the free **Ethereum Sepolia test network**), where nobody, not even the bank, can change it. **Verify on blockchain** reads it back and proves the history up to that point is unchanged. Only hashes go on-chain, never names or emails.

**Cost:** nothing. Test coins are free and have no value. Only the **Anchor now** button sends a transaction (one click covers the whole trail). Sign-ins and everything else never touch the blockchain. Anchoring refuses if nothing is new, allows one anchor per minute, and pauses with a clear message when the balance is low. The rest of the app keeps working either way.

1. In the VS Code terminal: `npm run wallet`. It creates the bank's test wallet, saves its secret key into `.env` as `ANCHOR_PRIVATE_KEY` and prints the **wallet address** (`0x...`, safe to share).
2. Get free Sepolia test ETH for that address from a faucet, for example Google Cloud's **Web3 faucet → Ethereum Sepolia** (sign in with Google, paste the address). Run `npm run wallet` again to see the balance, or open the address on <https://sepolia.etherscan.io>.
3. `npm start` → sign in as System Administrator or Auditor → **Audit Trail** → **Anchor now**. After about 15 seconds the status becomes *confirmed*. Click the transaction link to see it on Etherscan, then **Verify on blockchain**.
4. Online: in Render → **Environment**, add `ANCHOR_PRIVATE_KEY` with the value from your `.env`.

> The key controls a TEST wallet only. Never send real money to it, never reuse it, never upload `.env` to GitHub or paste the key in a chat.

---

## Troubleshooting

| You see | Do this |
|---|---|
| `Cannot find module` inside `node_modules` | The installed packages are broken or left over from an older copy. Delete the `node_modules` folder, then run `npm install` and `npm start` again |
| `npm` is not recognised | Install Node.js LTS, then **close and reopen VS Code** |
| `EADDRINUSE: port 5000` | The app is already running in another terminal. Close it, or add `PORT=5001` to `.env` |
| I don't see the 6-digit code | Look in the VS Code **terminal** for the `✉ EMAIL` box, and scroll up if needed |
| "That code is not correct" | Use the **newest** code. "Send a new code" makes older codes stop working |
| Account locked | Sign in as IT Helpdesk → Staff → filter *locked* → Unlock, or wait 15 minutes |
| "Too many attempts…" | This is FinTrust's own protection. Wait the time shown |
| Certificate error with Supabase | In PowerShell run `$env:NODE_USE_SYSTEM_CA="1"`, then `npm start` (needed when antivirus inspects HTTPS) |
| "Supabase rejected the key" | You copied the publishable/anon key, or a key from another project |
| "Database tables are missing" | Run `supabase/schema.sql` in the Supabase SQL Editor |
| Gmail rejected the login | Create a new App Password and paste it with no spaces |
| Render shows *needs attention* at `/api/health` | Read Render's **Logs**: the first lines list exactly which setting is missing |
| Something got messed up locally | `npm run reset-demo`, then `npm start` |

---

## How it works (for your project report)

```
 Browser (React app)    ──HTTPS──▶  Express server (Node.js)  ──▶  Storage
  no secrets, no database           • checks the session cookie          laptop: data/fintrust-data.json
  only draws what the               • checks the role's permission       online: Supabase PostgreSQL
  server sends                        (src/rbac.js) on EVERY request       (RLS on, no public access,
                                    • writes the audit trail               append-only audit trigger)
```

**Security features:**
- **Passwords:** bcrypt with cost 12, never stored or logged in plain text. Password rules: minimum length, 3 character types, no name or email inside.
- **Two-factor sign-in:** 6-digit code, HMAC-hashed in memory, 5-minute expiry, 5 attempts, single use, 30-second resend cooldown.
- **Sessions:** a random 256-bit token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` and `__Host-` online). The server keeps only its SHA-256 hash. There's an idle timeout of 15 minutes and a maximum of 8 hours. Changing a role, suspending or disabling someone signs them out immediately.
- **RBAC:** every permission is defined in **one file**, `src/rbac.js`. Each API route calls `requirePermission(...)`. Every denied attempt is written to the audit trail.
- **Segregation of duties:** no self-approval, no self role or status change, critical "Admin" access needs a System Administrator, helpdesk cannot act on admin accounts, and at least one System Administrator must always be active. The database enforces no self-review too.
- **Profile photos (required):** until someone saves a photo, the server answers every other request with 403. Only JPEG, PNG or WebP is accepted, checked from the file's own bytes, so an SVG or a renamed file is refused. Photos are at most 300 KB and shrunk to 320 × 320 in the browser. They are served with `nosniff` and a sandbox CSP. Staff see only their own photo, while directory roles see everyone's. Uploads and removals are audited.
- **Invitations and resets:** a one-time token in the link's `#fragment`, so it never reaches server logs. Only its hash is stored, it expires, and a newer link cancels the older one.
- **Audit trail:** each entry contains the hash of the previous one (like a blockchain). Editing or deleting any entry breaks the chain, and **Verify integrity** shows where. In Supabase, a trigger also blocks UPDATE and DELETE.
- **Web protections:** a strict Content-Security-Policy (no inline scripts), a CSRF origin check, JSON-only APIs, rate limits on sign-in, codes and resets, HTML escaping of all output, and formula-safe CSV export.
- **No user enumeration:** "unknown email" and "wrong password" give the same message and take the same time. "Forgot password" always gives the same answer.

**Blockchain (optional):** ethers.js publishes the audit head hash on the Ethereum Sepolia testnet; see Part E.

**Tech stack:**
- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router, Recharts (charts), Lucide (icons), Inter font. The browser only draws what the server sends; it never decides permissions.
- **Backend:** Node.js, Express 4, bcryptjs, Nodemailer.
- **Database (online):** Supabase PostgreSQL with Row Level Security.
- **Hosting:** Render (free web service).

**Project files:**
```
server.js                  starts Express and connects everything
src/config.js              reads settings (.env optional) and checks them
src/rbac.js                roles, permissions, menus  ← the heart of access control
src/middleware.js          sessions, permission checks, rate limits, security headers
src/security.js            password hashing, codes, tokens
src/audit.js               hash-chained audit trail
src/policies.js            security policy values
src/tokens.js              invitation and reset links
src/mailer.js              console / Gmail / Brevo email
src/seed.js                the FinTrust Bank demo organisation
src/store/                 data storage (file on laptop, Supabase online)
src/routes/auth.js         sign-in, code, sign-out, reset, set password
src/routes/users.js        staff accounts: invite, role, status, unlock, reset
src/routes/access.js       access requests, approvals, revocation
src/routes/governance.js   audit trail, security policy, bank information
src/routes/dashboard.js    role-based dashboards
src/routes/photos.js       required profile photos: upload, checks, serving
src/blockchain.js          optional blockchain anchoring of the audit trail (Sepolia)
scripts/wallet.js          npm run wallet: creates the test wallet, shows its balance
client/                    React + TypeScript source of the web pages
client/src/pages/          one file per screen (Login, Dashboard, Approvals, Staff, Audit...)
client/src/components/     shared UI: layout, buttons, cards, tables, charts
public/                    the built web pages (made by npm run build)
scripts/test.js            101 automated security tests (npm test)
supabase/schema.sql        database tables for publishing
```

## Scaling later (next steps after the core)

As the mentor suggested, this version is deliberately **one bank and one server**. Natural next steps:
1. **Multiple organisations:** add an `org_id` to every table and to every permission check.
2. **Several servers:** read from PostgreSQL on every request instead of the in-memory copy, and keep sessions in the database or Redis.
3. **Periodic access reviews:** every quarter, managers confirm or remove their team's access.
4. **Finance module:** payments with maker–checker approval, using the existing RBAC and audit trail.
5. **Stronger sign-in:** authenticator apps (TOTP) or passkeys instead of email codes.
