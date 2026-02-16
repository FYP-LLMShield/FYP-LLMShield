# How to Remove "Cursor Agent" from GitHub Contributors

GitHub’s **Contributors** list is built from commit history and (when applicable) GitHub App attribution. You can’t delete a contributor in repo settings. Here are your options.

---

## 1. Check why Cursor Agent appears

- **Cursor GitHub App**  
  If the repo is connected to Cursor (e.g. Cursor’s GitHub integration), some commits or pushes may be attributed to “Cursor Agent” on GitHub even if your local `git log` shows your name.

- **How you push**  
  Pushing from inside Cursor can use Cursor’s identity on GitHub. Pushing from a normal terminal with your own Git config usually uses your identity.

---

## 2. Prevent Cursor Agent on future commits

- **Use your identity for commits and pushes**
  - In Cursor (or your project): set Git user name and email to **your** name and email (e.g. in Cursor Settings → Git, or in the project’s `.gitconfig`).
  - Prefer pushing from your machine with your GitHub account (HTTPS or SSH), not through Cursor’s “push” if it uses Cursor’s account.

- **Disconnect Cursor’s GitHub App (optional)**  
  - Repo: **Settings → Integrations → GitHub Apps** (or **Applications**).  
  - If “Cursor” (or similar) is installed for this repo, you can remove it so future activity isn’t attributed to Cursor.  
  - This only affects future attribution; it won’t remove past contributions.

---

## 3. Remove Cursor Agent from existing contributors list

GitHub doesn’t let you “hide” a user from the Contributors list. The only way to make them disappear is to change the history that GitHub uses to build that list.

### Option A: Rewrite history (advanced, use with care)

If you know which commits are attributed to “Cursor Agent” on GitHub:

1. **Clone the repo** (or use your existing clone).
2. **Rewrite author** of those commits to your name/email, e.g.:
   ```bash
   git filter-branch --env-filter '
   export GIT_AUTHOR_NAME="AlishaaShahid"
   export GIT_AUTHOR_EMAIL="alishashahidkhan77@gmail.com"
   export GIT_COMMITTER_NAME="AlishaaShahid"
   export GIT_COMMITTER_EMAIL="alishashahidkhan77@gmail.com"
   ' --tag-name-filter cat -- --all
   ```
   Or use **git filter-repo** (recommended) to change author only for specific commits.
3. **Force-push**: `git push --force origin main` (and any other branches you rewrote).
4. **Warn collaborators**: Everyone else must re-clone or reset their branches; history will have changed.

This is disruptive; only do it if you’re sure and you coordinate with the team.

### Option B: Ask GitHub Support

- Go to [GitHub Support](https://support.github.com).
- Ask to **remove “Cursor Agent” (or the Cursor app user) from the Contributors list** for the repo, explaining that it’s an IDE/app and you want only human contributors shown.
- They may be able to adjust attribution or suggest the right steps.

---

## 4. Summary

| Goal | Action |
|------|--------|
| Stop Cursor appearing on **new** commits | Use your Git name/email in Cursor and push with your account; optionally remove Cursor’s GitHub App from the repo. |
| Remove Cursor from **existing** contributors | Rewrite history (force-push) or contact GitHub Support. |

Your local `git log` already shows your name (AlishaaShahid); the “Cursor Agent” entry on GitHub is from how GitHub attributes commits (e.g. Cursor app). Fixing future attribution and, if you want, asking Support is usually enough.
