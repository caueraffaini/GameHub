#!/bin/bash
set -e

# 1. Initialize git tree
cd /home/caue/GameHub
if [ ! -d ".git" ]; then
    git init
    echo "Git repository initialized."
fi

# 2. Stage Phase 0 files and manifests
git add backend/init-structure.sh
git add backend/schema.sql
git add backend/src/modules/identity/domain/models/User.ts
git add backend/src/modules/facilities/domain/models/PlayArea.ts
git add backend/src/modules/matchmaking/domain/models/Match.ts
git add .gitignore
git add LICENSE
git add README.md
git add architecture/gamehub_architecture_v3_fixed.md

# 3. Output staged status and diff overview
echo "=========================================================="
echo "STAGED STATUS OVERVIEW"
echo "=========================================================="
git status

echo ""
echo "=========================================================="
echo "STAGED DIFF SUMMARY"
echo "=========================================================="
git diff --cached --stat

# 4. Interactive confirmation prompt
echo ""
read -p "Do you approve these staged changes for initial commit and remote release? (y/n): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Deployment aborted by user."
    exit 1
fi

# 5. Commit and push to remote
echo "Proceeding with commit..."
git checkout -b main || git branch -M main
git commit -m "feat: bootstrap modular monolith backend structure and corrected domain specifications"

echo "Initializing public repository on GitHub..."
# Using gh repo create to create a public repository. 
# --source=. creates it from the current local repository and pushes it.
gh repo create GameHub --public --source=. --remote=origin --push

echo "Deployment complete."
