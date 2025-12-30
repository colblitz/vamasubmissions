# 🚀 Quick Start Deployment Guide

Deploy your Patreon Character Submission site in **~45 minutes** with minimal manual work.

## 📝 Before You Start

1. **Read:** `00-pre-deployment-checklist.md` (5 min)
2. **Purchase:** Domain from Namecheap (~$12/year)
3. **Create:** Linode server ($5/month)
4. **Setup:** Patreon OAuth app (free)

## ⚡ One-Command Deployment

Once you have the prerequisites, deployment is mostly automated:

### 1️⃣ Initial Setup (as root)
```bash
ssh root@YOUR_SERVER_IP
wget https://raw.githubusercontent.com/YOUR_USERNAME/vamasubmissions/main/deployment-scripts/01-initial-server-setup.sh
bash 01-initial-server-setup.sh
```

### 2️⃣ Deploy Everything (as deploy user)
```bash
ssh deploy@YOUR_SERVER_IP
git clone https://github.com/YOUR_USERNAME/vamasubmissions.git
cd vamasubmissions/deployment-scripts

# Run all scripts in order
bash 02-configure-database.sh
bash 03-deploy-application.sh
bash 04-setup-services.sh
bash 05-setup-ssl.sh  # Wait for DNS first!
bash 06-setup-firewall.sh
bash 07-setup-backups.sh
```

## ✅ Done!

Your site is live at `https://yourdomain.com`

## 🎯 What Gets Automated

✅ System updates & security hardening
✅ User creation with SSH keys
✅ Database setup & configuration
✅ Application deployment (backend + frontend)
✅ Service management (systemd)
✅ Web server configuration (Nginx)
✅ SSL certificates (Let's Encrypt)
✅ Firewall setup (UFW)
✅ Automated daily backups

## 📊 Time Breakdown

| Task | Time | Your Effort |
|------|------|-------------|
| Pre-deployment checklist | 15 min | 15 min |
| Script 01 (server setup) | 10 min | 1 min |
| Script 02 (database) | 2 min | 1 min |
| Script 03 (deploy app) | 15 min | 2 min |
| Script 04 (services) | 2 min | 1 min |
| Wait for DNS propagation | 5-30 min | 0 min |
| Script 05 (SSL) | 3 min | 1 min |
| Script 06 (firewall) | 1 min | 30 sec |
| Script 07 (backups) | 2 min | 30 sec |
| **Total** | **~45 min** | **~10 min** |

## 💡 Tips

- **DNS:** Configure DNS early, let it propagate while running scripts 1-4
- **SSH Keys:** Have your SSH key ready before starting
- **Credentials:** Keep Patreon Client ID/Secret handy
- **Testing:** Open a second terminal to test SSH access before closing root session

## 📚 Documentation

- **`00-pre-deployment-checklist.md`** - Complete before starting
- **`README.md`** - Detailed script documentation
- **`DEPLOYMENT.md`** - Full manual deployment guide

## 🆘 Help

Something went wrong? Check:
1. Script output for error messages
2. Logs: `sudo journalctl -u patreon-backend -n 50`
3. Troubleshooting section in `README.md`

## 💰 Total Cost

**$6-7/month** ($5 Linode + ~$1/month domain)

---

**Ready?** Start with `00-pre-deployment-checklist.md` 👉
