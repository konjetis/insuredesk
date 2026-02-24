# 🚀 GitHub Setup Instructions — InsureDesk 360°

Follow these steps exactly to get your project on GitHub in under 10 minutes.

---

## STEP 1 — Install Git (if not already installed)

**Mac:**
```bash
brew install git
```

**Windows:**
Download from: https://git-scm.com/download/win

**Ubuntu/Linux:**
```bash
sudo apt-get install git
```

Verify installation:
```bash
git --version
# Should print: git version 2.x.x
```

---

## STEP 2 — Configure Git with your identity

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## STEP 3 — Create a GitHub Account & New Repository

1. Go to https://github.com and sign in (or sign up)
2. Click the **+** button → **New repository**
3. Fill in:
   - **Repository name:** `insuredesk`
   - **Description:** `InsureDesk 360° — Real-time insurance customer service platform`
   - **Visibility:** Private ✅ (recommended for insurance data)
   - **DO NOT** check "Add a README" (we have our own)
4. Click **Create repository**
5. Copy the repository URL — it looks like:
   `https://github.com/YOUR_USERNAME/insuredesk.git`

---

## STEP 4 — Initialize Git in the Project Folder

Open your terminal and navigate to the `insuredesk` folder you downloaded:

```bash
cd path/to/insuredesk
```

Initialize Git:
```bash
git init
git branch -M main
```

---

## STEP 5 — Add All Files & Make First Commit

```bash
# Stage all files
git add .

# Verify what's being committed (optional)
git status

# Make your first commit
git commit -m "🚀 Initial commit — InsureDesk 360° Dashboard

- Frontend: 3-portal 360° dashboard (Agent, Customer, Manager)
- Backend: Node.js + Express + Socket.io server
- Salesforce integration: OAuth + Streaming API + PushTopics
- Zendesk integration: REST API + Talk API + Webhook processor
- JWT authentication with role-based access
- Full API documentation in /docs"
```

---

## STEP 6 — Connect to GitHub & Push

Replace `YOUR_USERNAME` with your actual GitHub username:

```bash
# Add GitHub as the remote origin
git remote add origin https://github.com/YOUR_USERNAME/insuredesk.git

# Push to GitHub
git push -u origin main
```

You'll be prompted to enter your GitHub username and password.
> ⚠️ **Note:** GitHub no longer accepts passwords — use a **Personal Access Token** instead.
> Create one at: https://github.com/settings/tokens → Generate new token → Check `repo` scope

---

## STEP 7 — Verify on GitHub

1. Go to `https://github.com/YOUR_USERNAME/insuredesk`
2. You should see all your files:
   ```
   📁 frontend/
   📁 backend/
   📁 docs/
   📄 .env.example
   📄 .gitignore
   📄 README.md
   📄 GITHUB_SETUP.md
   ```

---

## STEP 8 — Install Backend & Run Locally

```bash
# Navigate to backend
cd backend

# Install all dependencies
npm install

# Copy environment template
cp ../.env.example .env

# Open .env and fill in your credentials
nano .env   # or use VS Code: code .env

# Start the development server
npm run dev
```

You should see:
```
✓ InsureDesk server running on port 3001
✓ Salesforce authenticated successfully
✓ Salesforce streaming active
✓ Zendesk queue polling started (every 3000ms)
```

---

## STEP 9 — Open the Dashboard

```bash
# From the project root
npx serve frontend

# Then open in your browser:
# http://localhost:3000
```

---

## STEP 10 — Future Updates (Git Workflow)

Every time you make changes:

```bash
# Check what changed
git status

# Stage your changes
git add .

# Commit with a meaningful message
git commit -m "✨ Add real-time sentiment analysis feature"

# Push to GitHub
git push
```

---

## 🔒 IMPORTANT: What NEVER Goes on GitHub

These files are in `.gitignore` and will NEVER be committed:
- `.env` — contains your API keys and passwords
- `node_modules/` — install these locally with `npm install`
- `*.log` — log files

Always use `.env.example` to share the structure without the actual secrets.

---

## 🛠 Useful Git Commands

| Command | What it does |
|---|---|
| `git status` | See changed files |
| `git log --oneline` | See commit history |
| `git diff` | See exact changes |
| `git checkout -b feature/my-feature` | Create a new branch |
| `git pull` | Get latest changes from GitHub |
| `git stash` | Temporarily save changes |

---

## 📞 Need Help?

- Git documentation: https://git-scm.com/doc
- GitHub guides: https://docs.github.com
- GitHub Desktop (visual tool): https://desktop.github.com
