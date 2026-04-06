# Git Installation Guide for Windows

## Problem
You got an error: `git : The term 'git' is not recognized...`

This means **Git is not installed** or **not in your PATH**.

---

## Solution Options

### Option 1: Download & Install (Recommended)

1. **Visit**: https://git-scm.com/download/win
2. **Download** Git for Windows (the .exe file)
3. **Run the installer** - use default options or:
   - Install for all users
   - Use Git from the Windows Command Prompt
   - Use the default editor (VS Code or Notepad++)
4. **Restart PowerShell** completely (close and reopen)
5. **Verify** it worked:
   ```powershell
   git --version
   ```

---

### Option 2: Use Package Manager

#### If you have **Chocolatey** installed:
```powershell
choco install git
```

#### If you have **Scoop** installed:
```powershell
scoop install git
```

#### If you have **Windows Package Manager**:
```powershell
winget install --id Git.Git -e --source winget
```

---

### Option 3: Use Git Bash (Alternative)

After installing Git for Windows from Option 1:
- Open "Git Bash" instead of PowerShell
- You can run all git commands there
- Git will work perfectly in Git Bash

---

## Verify Installation

After installing, verify git is working:

```powershell
git --version
# Should show: git version 2.x.x.windows.x

git config --global user.name
git config --global user.email
```

---

## Configure Git (First Time Only)

After git is installed, configure it:

```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Or for just this project:
```powershell
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

---

## Initialize Your Project

Once git is installed and configured:

```powershell
cd E:\tariff_compare

# Initialize a git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - meter type normalization complete"

# (Optional) Add remote repository
git remote add origin https://github.com/yourusername/tariff_compare.git

# (Optional) Push to GitHub
git branch -M main
git push -u origin main
```

---

## Recommended Git Workflow

### Create a new branch for your work:
```powershell
git checkout -b feature/meter-type-cleanup
```

### Make changes, then commit:
```powershell
git add .
git commit -m "Add meter type normalization"
```

### View your history:
```powershell
git log --oneline
```

### Switch between branches:
```powershell
git checkout main
git checkout feature/meter-type-cleanup
```

---

## Useful Git Commands

```powershell
# Check status
git status

# See changes
git diff

# Undo recent changes
git restore <filename>

# View commit history
git log

# Create a tag (for releases)
git tag v1.0.0
git push origin v1.0.0
```

---

## Troubleshooting

### Still not working after install?
1. **Restart PowerShell completely** (close and reopen)
2. **Add git to PATH manually**:
   - Search "Environment Variables"
   - Edit System Environment Variables
   - Click "Environment Variables..."
   - Add git path to PATH variable (usually `C:\Program Files\Git\cmd`)

### Permission denied errors?
- Run PowerShell as Administrator

### Line ending issues?
- Configure: `git config --global core.autocrlf true`

---

## Integration with JetBrains PyCharm

PyCharm has built-in git support:
1. Go to: **File → Settings → Version Control → Git**
2. Set path to git executable (usually auto-detected)
3. Click **Test** to verify
4. Now you can use git inside PyCharm

---

## Summary

After installing git, you'll be able to:
- ✅ Track code changes
- ✅ Commit work with messages
- ✅ Create branches for features
- ✅ Merge changes
- ✅ Push to GitHub/GitLab
- ✅ Collaborate with others
- ✅ Revert changes if needed

---

**Recommended:** Install from https://git-scm.com/download/win, restart PowerShell, then you're ready to go!

