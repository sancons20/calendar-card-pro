# 📌 Calendar Card Pro - End-to-End Development & Release Workflow

This document outlines the **complete** workflow for developing, testing, handling pull requests, and releasing updates to the **Calendar Card Pro** custom Home Assistant card.

---

## 📂 Repository Structure

```plaintext
calendar-card-pro-dev/
│── .github/
│   ├── workflows/
│   │   ├── release.yml               # GitHub Actions workflow for building and releasing
│   │   ├── hacs-validate.yml         # GitHub Actions workflow for HACS validation
│── dist/                             # Minified build output (ignored in git)
│   ├── calendar-card-pro.js
│   ├── calendar-card-pro.js.map
│── logs/                             # Stores ESLint logs
│   ├── eslint.log
│── src/                              # Source code (TypeScript)
│   ├── calendar-card-pro.ts
│── docs/                             # Documentation (ignored in git)
│   ├── workflow.md
│── .gitignore                        # Ignored files and folders
│── .prettierignore                   # Files ignored by Prettier
│── .prettierrc                       # Prettier formatting rules
│── CONTRIBUTING.md                   # Contribution guidelines
│── eslint.config.mjs                 # ESLint configuration
│── hacs.json                         # HACS metadata
│── LICENSE                           # License file
│── package.json                      # Project dependencies & scripts
│── package-lock.json                 # Dependency lock file
│── README.md                         # Main project documentation
│── rollup.config.mjs                 # Rollup build configuration
│── tsconfig.json                     # TypeScript configuration
```

## 🛠 Development Workflow

### 1️⃣ Local Development & Testing

This section covers the process of **developing and testing** changes before they are pushed to GitHub.

#### 1. Make Code Changes

- Modify files in the `src/` directory (TypeScript).
- Run:

  ```sh
  npm run dev
  ```

- This compiles the TypeScript code and builds the `calendar-card-pro.js` file in the `dist/` folder.
- It also **watches for changes**, rebuilding automatically on file save.

#### 2. Lint & Format Code

- Ensure code quality by running:

  ```sh
  npm run lint --fix
  ```

- `lint` checks for code errors and applies automatic fixes.
- `npm run format` is skipped since Prettier ensures consistent styling when it auto-runs in VS Code on save.

#### 3. Test in Home Assistant

1. Place the `dist/calendar-card-pro.js` file in:

   ```
   /config/www/community/calendar-card-pro-dev/
   ```

2. Add the resource in Home Assistant:

   ```yaml
   url: /local/community/calendar-card-pro-dev/calendar-card-pro.js
   type: module
   ```

3. Use the card in your dashboard:

   ```yaml
   type: custom:calendar-card-pro-dev
   ```

- The `-dev` suffix ensures that the development version does not conflict with the release version installed via HACS.

## 🚀 Releasing a New Version

### 2️⃣ Preparing a Public Release

Once development is complete, a **release version** must be created and published.

#### 1. Ensure Code is Clean

- Run:

  ```sh
  npm run lint --fix  # Fixes linting errors
  npm run build       # Creates production build
  ```

  _(`npm run format` is skipped since Prettier auto-runs in VS Code on save.)_

- This compiles a **clean, minified** `calendar-card-pro.js` in `dist/`.

#### 2. Commit & Push Changes

- Push changes **from the private repo’s `dev` branch** to GitHub.

#### 3. Push to Public Release Repo

- Instead of maintaining a `main` branch in the **private repo**, we push directly to `main` **in the public repo**:

  ```sh
  git push public-repo dev:main
  ```

- **This ensures that only production-ready code is ever in the public repo.**

#### 4. GitHub Actions Build & Release

- The `release.yml` workflow in **GitHub Actions** automatically:
  1. Installs dependencies.
  2. Builds the **minified** `calendar-card-pro.js`.
  3. Creates a new **GitHub Release**.
  4. Uploads the release for **HACS** distribution.

## 🔄 Handling Pull Requests (PRs)

### 3️⃣ Accepting Contributions

This section explains how to **manage pull requests (PRs) from contributors** while keeping the private `dev` branch up to date.

#### Scenario 1: Accepting a Small Fix PR

1. **Review the PR** in the **public repo**.
2. **Test the changes** locally if needed.
3. **Merge the PR into `main` in the public repo.**
4. **Sync the changes back to the private dev repo:**

   ```sh
   git fetch public-repo
   git checkout dev
   git merge public-repo/main
   ```

5. Continue development as usual.

#### Scenario 2: PR Conflicts with Ongoing Work

If you have ongoing changes in `dev`, but a PR is merged into `main`:

1. **Commit your unfinished work** (so it’s not lost).
2. **Switch to `main` in the private repo**:

   ```sh
   git fetch public-repo
   git checkout -b temp-merge-branch
   git merge public-repo/main
   ```

3. **Resolve any conflicts manually.**
4. **Merge into `dev`** and delete the temporary branch:

   ```sh
   git checkout dev
   git merge temp-merge-branch
   git branch -d temp-merge-branch
   ```

5. Continue working as normal.

## 📌 Managing Releases & Versioning

### 4️⃣ Releasing a New Version in GitHub

Once your code is finalized and pushed to the **public repo's `main` branch**, a new **GitHub Release** must be created.

#### 1. Draft a Release

- Navigate to **GitHub → Releases** in the public repo.

- Click **"Draft a new release"**.

- Choose the latest commit **on the `main` branch**.

- Set the **tag name** as the new version number (`vX.Y.Z`).

- Add a **title** (e.g., `Calendar Card Pro vX.Y.Z`).

- Write the **release notes** (see below).

#### 2. Writing Release Notes

- Use a consistent format:

  ```markdown
  ## 🚀 New in vX.Y.Z

  - 🆕 Feature 1: Description
  - 🔧 Fix: Description
  - 💄 UI Improvement: Description
  - 🛠️ Internal changes: Description
  ```

- Keep changes **clear and concise**.
- **Link to related issues** (e.g., `Fixes #42`).
- **Save & Publish** the release.

#### 3. Automatic Deployment via GitHub Actions

Once the release is published:

- **GitHub Actions** (`release.yml`) automatically:

  1. Builds the final **minified** `calendar-card-pro.js`.

  2. **Uploads it to the release assets.**

  3. Makes the release **available for HACS** users.

## 📦 Managing HACS Releases

### 5️⃣ Keeping HACS Updated

HACS automatically picks up new releases **from GitHub**.

#### 1. **Ensure `hacs.json` is up to date**

- Located in the public repo:
  ```json
  {
    "name": "Calendar Card Pro",
    "filename": "calendar-card-pro.js"
  }
  ```
- No version number required—HACS reads from **GitHub releases**.

#### 2. Announcing a New Version

After releasing a new version:

- **Post in the Home Assistant forum thread** (if applicable).
- Update the **README.md** with the latest changes.

## 🛠 Handling Issues & Feature Requests

### 6️⃣ Managing Bug Reports

**Issues should be tracked in the public repo’s GitHub Issues.**

#### 1. Triage New Issues

- Label issues accordingly:
  - 🐞 **Bug** → Something is broken.
  - 💡 **Enhancement** → A suggested improvement.
  - 📚 **Docs** → Documentation issue.
- Check if it’s **already reported**.

#### 2. Debugging & Fixing

- Try **reproducing the issue** in your test setup.
- If a fix is required:
  - Create a **branch in the private repo**.
  - Fix the issue.
  - Push the fix **to `dev` in private** and **release via GitHub Actions**.

## 🔄 Handling Pull Requests (Advanced)

### 7️⃣ Managing PRs from Contributors

#### 1. Review Process

- Every PR in the public repo should be **reviewed before merging**.
- Steps:
  - **Check the code changes.**
  - **Ensure it follows ESLint & Prettier rules.**
  - **Manually test in Home Assistant.**

#### 2. Merging a PR

- If the PR is good to go:
  - **Merge it into `main` in the public repo.**

#### 3. Syncing the Changes Back to Private

- After merging into `main` in the public repo:
  ```sh
  git fetch public-repo
  git checkout dev
  git merge public-repo/main
  ```
- This ensures **your private repo stays up to date**.

#### 4. Handling Conflicts

If there are conflicts:

1. **Save your current dev work.**

2. Create a **temporary merge branch:**
   ```sh
   git checkout -b temp-merge-branch
   git merge public-repo/main
   ```
3. **Fix conflicts manually.**

4. **Merge into `dev`:**
   ```sh
   git checkout dev
   git merge temp-merge-branch
   git branch -d temp-merge-branch
   ```

## 🛠 Overview of Tools Used

| Tool               | Purpose                                      |
| ------------------ | -------------------------------------------- |
| **GitHub Actions** | Automates build & release process            |
| **Rollup**         | Bundles & minifies the code                  |
| **ESLint**         | Checks for code quality issues               |
| **Prettier**       | Ensures consistent code formatting           |
| **HACS**           | Distributes the card to Home Assistant users |
| **Git**            | Version control for private & public repos   |

## 🔄 Full Workflow Summary

### 🔹 Development Cycle

1. **Develop & test locally:**

   - `npm run dev`

2. **Lint & format:**
   - `npm run lint --fix`
   - `npm run format`
3. **Test in Home Assistant.**

### 🔹 Releasing a New Version

1. Ensure the code is **clean & tested.**

2. Push from **private dev branch → public main**.

```sh
git push public-repo dev:main
```

3. **GitHub Actions** builds & releases automatically.

### 🔹 Handling PRs & Issues

1. **Review & test PRs** before merging.

2. **Sync merged changes back to the private repo.**

## 📌 FAQ

### 1. How do I revert a release?

- Find the previous version in **GitHub Releases**.

- Manually **upload the old `calendar-card-pro.js`**.

- Update HACS users via a new release.

### 2. What happens if I forget to sync a PR back to private?

- The private repo **won’t have the latest fixes**.

- **Run:**
  ```sh
  git fetch public-repo
  git checkout dev
  git merge public-repo/main
  ```

### 3. Why is the dev version named differently?

- Prevents **conflicts** when testing in Home Assistant.

- Uses `calendar-card-pro-dev` internally, while release uses `calendar-card-pro`.

## 🎯 Conclusion

This workflow ensures:

- ✅ **A structured, professional development process**

- ✅ **Clear separation between dev & release versions**

- ✅ **Automated builds & releases**

- ✅ **Efficient handling of PRs & bug fixes**

🚀 **Happy coding!**
