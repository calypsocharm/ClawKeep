---
description: How to commit changes and deploy to the VPS
---
// turbo-all

## Git Remote
- **Repo**: https://github.com/calypsocharm/ClawKeep.git
- **Local folder**: `C:\Users\Calyp\Downloads\OpenShell`

## Commit & Deploy Workflow

### 1. Ensure git is initialized with remote
```powershell
git init
git remote add origin https://github.com/calypsocharm/ClawKeep.git 2>$null
git remote set-url origin https://github.com/calypsocharm/ClawKeep.git
```

### 2. Stage and commit changes
```powershell
git add -A; git status
git commit -m "feat: <description of changes>"
```

### 3. Push to GitHub
```powershell
git push -u origin main
```

### 4. Build with API key
```powershell
$env:API_KEY="AIzaSyBnxYc29cwOMi6SznzAdZchp-Z1PNrVTCQ"; npx vite build
```

### 5. SCP dist to VPS
```powershell
scp -r dist root@72.62.129.226:/opt/openclaw/
```
Password: `5f91779909372dfefc8b43ceefaed0ab9c9015f42927dcb8`

### 6. Restart server
```powershell
ssh root@72.62.129.226 "pm2 restart openclaw"
```
Same password as above.
