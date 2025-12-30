# Pre-Deployment Checklist

Complete these steps **BEFORE** running the deployment scripts.

## ☑️ 1. Purchase Domain (Namecheap)

- [ ] Go to https://www.namecheap.com
- [ ] Search for and purchase your domain (e.g., `mysite.com`)
- [ ] Note your domain name: `_________________`

**Cost:** ~$12/year for .com

---

## ☑️ 2. Create Linode Server

### 2.1 Sign Up / Log In
- [ ] Go to https://www.linode.com
- [ ] Sign up or log in

### 2.2 Create Linode
- [ ] Click "Create" → "Linode"
- [ ] **Distribution:** Ubuntu 24.04 LTS
- [ ] **Region:** Choose closest to your users
- [ ] **Plan:** Nanode 1GB ($5/month) - sufficient for small-medium traffic
- [ ] **Label:** `patreon-submissions` (or your choice)
- [ ] **Root Password:** Create a strong password (you'll use this once)
- [ ] **SSH Keys:** 
  - If you have an SSH key, add it now
  - If not, we'll set it up in the script
- [ ] Click "Create Linode"

### 2.3 Wait for Server to Boot
- [ ] Wait ~30 seconds for server to boot
- [ ] Note your server IP: `_________________`

**Cost:** $5/month

---

## ☑️ 3. Configure DNS (Namecheap → Linode)

### 3.1 Get Linode Nameservers
Linode's nameservers are:
- `ns1.linode.com`
- `ns2.linode.com`
- `ns3.linode.com`
- `ns4.linode.com`
- `ns5.linode.com`

### 3.2 Point Namecheap to Linode Nameservers
- [ ] Log into Namecheap
- [ ] Go to **Domain List** → **Manage** (for your domain)
- [ ] Find **Nameservers** section
- [ ] Select **Custom DNS**
- [ ] Add Linode nameservers:
  - `ns1.linode.com`
  - `ns2.linode.com`
  - `ns3.linode.com`
  - `ns4.linode.com`
  - `ns5.linode.com`
- [ ] Click **Save** (green checkmark)

### 3.3 Configure DNS in Linode
- [ ] Log into Linode Cloud Manager
- [ ] Go to **Domains** (left sidebar)
- [ ] Click **Create Domain**
- [ ] **Domain:** `yourdomain.com`
- [ ] **SOA Email:** `your-email@example.com`
- [ ] Click **Create Domain**

### 3.4 Add DNS Records in Linode
Your Linode IP from step 2.3: `_________________`

Add these records:

| Type | Hostname | IP Address / Target | TTL |
|------|----------|---------------------|-----|
| A | (blank) | `YOUR_LINODE_IP` | Default |
| A | www | `YOUR_LINODE_IP` | Default |
| A | api | `YOUR_LINODE_IP` | Default |

**Example:**
- If your domain is `mysite.com` and IP is `123.45.67.89`:
  - A Record: blank → `123.45.67.89` (creates mysite.com)
  - A Record: `www` → `123.45.67.89` (creates www.mysite.com)
  - A Record: `api` → `123.45.67.89` (creates api.mysite.com)

- [ ] Click **Save** for each record

**Note:** DNS propagation takes 15-30 minutes. You can run scripts 1-4 while waiting.

**Why use Linode nameservers?**
- Faster DNS resolution (same datacenter)
- Easier management (everything in one place)
- Better integration with Linode services
- Free DNS hosting

---

## ☑️ 4. Create Patreon OAuth App

### 4.1 Go to Patreon Developer Portal
- [ ] Go to https://www.patreon.com/portal/registration/register-clients
- [ ] Log in with your Patreon account

### 4.2 Create New Client
- [ ] Click "Create Client"
- [ ] Fill in the form:

**App Name:** `_________________` (e.g., "My Character Submissions")

**Description:** `Character submission site for Patreon supporters`

**App Category:** `Community`

**Author or Organization Name:** `_________________` (your name/org)

**Icon URL:** (optional, can leave blank)

**Privacy Policy URL:** (optional, can leave blank)

**Terms of Service URL:** (optional, can leave blank)

**Redirect URIs:** (IMPORTANT - add BOTH)
```
https://yourdomain.com/auth/callback
https://api.yourdomain.com/api/auth/callback
```
Replace `yourdomain.com` with your actual domain!

**Client API Version:** `2`

**Requested Scopes:** Check these boxes:
- [ ] `identity`
- [ ] `identity[email]`
- [ ] `identity.memberships`

### 4.3 Save and Note Credentials
- [ ] Click "Create Client"
- [ ] **Client ID:** `_________________` (copy this)
- [ ] **Client Secret:** `_________________` (copy this - keep it secret!)

**IMPORTANT:** Keep these credentials safe! You'll need them in script 03.

---

## ☑️ 5. Get Patreon Tier IDs

You need to know your Patreon tier IDs to configure the backend.

### 5.1 Find Your Tier IDs
- [ ] Go to your Patreon creator page
- [ ] Go to **Settings** → **Membership Tiers**
- [ ] Note the tier IDs (usually visible in the URL or tier settings)

**Your Tier IDs:**
- Tier 1 (Free/NSFW Art! Tier 1): `_________________`
- Tier 2 (NSFW Art! Tier 2): `_________________`
- Tier 3 (NSFW Art! Tier 3): `_________________`
- Tier 4 (NSFW Art! support ^^): `_________________`

**Note:** You can update these later in the `.env` file if needed.

---

## ☑️ 6. Prepare Your Local Machine

### 6.1 Check SSH Key
Do you have an SSH key?

```bash
# On your local machine (Mac/Linux)
ls -la ~/.ssh/id_*.pub
```

- [ ] **If you see files:** You have SSH keys! Note the path.
- [ ] **If not:** Generate one:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter for all prompts (use default location, no passphrase)
```

### 6.2 Get Your Public Key
```bash
cat ~/.ssh/id_ed25519.pub
# or
cat ~/.ssh/id_rsa.pub
```

Copy this entire line - you'll need it!

---

## ☑️ 7. Prepare GitHub Repository (Optional)

If you haven't pushed your code to GitHub yet:

```bash
# On your local machine
cd /Users/joelee/projects/vamasubmissions

# Initialize git (if not done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Create GitHub repo at https://github.com/new
# Then push:
git remote add origin git@github.com:colblitz/vamasubmissions.git
git branch -M master
git push -u origin master
```

- [ ] GitHub repository URL: `git@github.com:colblitz/vamasubmissions.git`

---

## ✅ Pre-Deployment Checklist Complete!

You should now have:

- ✅ Domain purchased from Namecheap
- ✅ Linode server created and running
- ✅ DNS records configured (may still be propagating)
- ✅ Patreon OAuth app created with Client ID and Secret
- ✅ Patreon tier IDs noted
- ✅ SSH key ready
- ✅ Code pushed to GitHub

## 🚀 Ready to Deploy!

You can now proceed with the deployment scripts:

1. **SSH into your server as root:**
   ```bash
   ssh root@YOUR_LINODE_IP
   ```

2. **Download and run the first script:**
   ```bash
   wget https://raw.githubusercontent.com/colblitz/vamasubmissions/master/deployment-scripts/01-initial-server-setup.sh
   bash 01-initial-server-setup.sh
   ```

3. **Follow the prompts and continue with scripts 02-07**

See `README.md` in this directory for full deployment instructions.

---

## 📝 Information Summary

Keep this information handy for the deployment scripts:

| Item | Value |
|------|-------|
| Domain | `_________________` |
| Server IP | `_________________` |
| Patreon Client ID | `_________________` |
| Patreon Client Secret | `_________________` |
| Tier 1 ID | `_________________` |
| Tier 2 ID | `_________________` |
| Tier 3 ID | `_________________` |
| Tier 4 ID | `_________________` |
| GitHub Repo URL | `_________________` |
| Your Email (for SSL) | `_________________` |

**Estimated Total Cost:** $6-7/month ($5 Linode + ~$1/month domain)
