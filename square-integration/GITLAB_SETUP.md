# GitLab Setup Guide

## Quick Setup (Automated)

Run the interactive script:

```bash
./setup-gitlab.sh
```

It will ask for:
1. GitLab repository URL
2. Your GitLab username
3. Your GitLab email
4. Your Personal Access Token

## Manual Setup (Step-by-Step)

### 1. Create GitLab Personal Access Token

Go to: `GitLab → Settings → Access Tokens`
- Name: `square-cre-project`
- Scopes: `write_repository`, `read_repository`
- Copy the token

### 2. Initialize and Configure

```bash
# Initialize git (if not already)
git init

# Set local config (won't affect global)
git config --local user.name "YourUsername"
git config --local user.email "your@email.com"

# Add remote with token
git remote add origin https://YourUsername:YOUR_TOKEN@gitlab.com/username/repo.git
```

### 3. Push to GitLab

```bash
# Stage all files
git add .

# Commit
git commit -m "Initial commit: Square-Chainlink CRE integration"

# Push
git branch -M main
git push -u origin main
```

## Verify Local Config

```bash
# Check local settings (repo-only)
git config --local --list

# Check global settings (unchanged)
git config --global --list
```

## Security Notes

✅ **Local credentials only** - Won't affect your global Git config
✅ **Token in remote URL** - Secure for this repo only
✅ **Sensitive files excluded** - `.env` and secrets in `.gitignore`

## Remove Later

```bash
# Remove git completely from this project
rm -rf .git
```

## Alternative: SSH Keys

If you prefer SSH instead of tokens:

```bash
# Add SSH remote
git remote add origin git@gitlab.com:username/repo.git

# Push
git push -u origin main
```

This uses your SSH keys without any username/password.
