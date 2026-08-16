### Task 1: Create and Verify the Pre-Change Backup

**Files:**
- Create: `docs/backups/2026-07-22-pre-light-ui.md`
- Do not modify: `knowledge/fengshui_extracts/`
- Do not modify: `兑换码.txt`
- Verify: `.env`

**Interfaces:**
- Consumes: current `main` commit `94058e0`, `origin/main`, local `.env`, and existing untracked user files.
- Produces: Git tag `backup/pre-light-ui-2026-07-22`, a verified Git bundle, a tracked-source ZIP, a local protected secrets/untracked backup, and a backup manifest committed on the feature branch.

- [ ] **Step 1: Verify the exact production baseline and dirty state**

Run from the repository root:

```powershell
git status --short
git rev-parse HEAD
git rev-parse origin/main
git remote -v
```

Expected: `HEAD` and `origin/main` both print `94058e0...`; status lists only `knowledge/fengshui_extracts/` and `兑换码.txt` as untracked. Stop if tracked files are modified or the two commit hashes differ.

- [ ] **Step 2: Create the immutable Git and offline backups**

```powershell
$stamp = '2026-07-22-pre-light-ui'
$backupRoot = Join-Path $env:USERPROFILE "Documents\ZhishiBackups\$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
git tag -a "backup/pre-light-ui-2026-07-22" 94058e0 -m "Backup before light UI redesign"
git bundle create (Join-Path $backupRoot 'zhishi-bazi-94058e0.bundle') --all
git archive --format=zip --output=(Join-Path $backupRoot 'zhishi-bazi-94058e0.zip') 94058e0
Copy-Item -LiteralPath '.env' -Destination (Join-Path $backupRoot '.env.local.backup')
Copy-Item -LiteralPath '兑换码.txt' -Destination (Join-Path $backupRoot '兑换码.local.backup.txt')
Copy-Item -LiteralPath 'knowledge\fengshui_extracts' -Destination (Join-Path $backupRoot 'fengshui_extracts') -Recurse
icacls $backupRoot /inheritance:r /grant:r "$env:USERNAME:(OI)(CI)F"
$hashes = Get-FileHash (Join-Path $backupRoot 'zhishi-bazi-94058e0.bundle'), (Join-Path $backupRoot 'zhishi-bazi-94058e0.zip') -Algorithm SHA256
$hashes | Format-Table Path,Hash -AutoSize | Out-File -LiteralPath (Join-Path $backupRoot 'checksums.sha256.txt') -Encoding utf8
```

Expected: bundle, ZIP, protected environment file, redemption-code copy, and fengshui extracts exist under `Documents\ZhishiBackups\2026-07-22-pre-light-ui` and do not appear in repository status.

- [ ] **Step 3: Verify that the backup can restore and test**

```powershell
$backupRoot = Join-Path $env:USERPROFILE 'Documents\ZhishiBackups\2026-07-22-pre-light-ui'
git bundle verify (Join-Path $backupRoot 'zhishi-bazi-94058e0.bundle')
$restoreRoot = Join-Path $backupRoot 'restore-check'
Expand-Archive -LiteralPath (Join-Path $backupRoot 'zhishi-bazi-94058e0.zip') -DestinationPath $restoreRoot -Force
npm ci --prefix $restoreRoot
node --test "$restoreRoot\tests\*.test.js"
```

Expected: bundle verification succeeds and all nine current baseline tests pass from the restored ZIP.

- [ ] **Step 4: Push the backup tag and create the isolated feature worktree**

```powershell
git push origin backup/pre-light-ui-2026-07-22
```

Then invoke `superpowers:using-git-worktrees` and create branch `feat/light-ui-redesign` from `94058e0`. Do not implement in the TRAE-managed working directory containing the untracked user files.

- [ ] **Step 5: Record the backup manifest**

Create `docs/backups/2026-07-22-pre-light-ui.md` with this exact structure and the hashes returned by `Get-FileHash`:

```markdown
# Pre-Light-UI Backup Manifest

- Production commit: `94058e0`
- Remote: `https://github.com/Eriver111/zhishi-bazi.git`
- Git tag: `backup/pre-light-ui-2026-07-22`
- Bundle: `zhishi-bazi-94058e0.bundle`
- Source archive: `zhishi-bazi-94058e0.zip`
- Restore test: `node --test tests/*.test.js` passed
- Sensitive local backup: stored outside Git under `Documents/ZhishiBackups/2026-07-22-pre-light-ui`
- Original untracked files: preserved and excluded from commits
- SHA-256 checksums: stored beside the archives in `checksums.sha256.txt`
```

Before committing, compare `checksums.sha256.txt` with fresh `Get-FileHash` output and require both hashes to match.

- [ ] **Step 6: Commit the verified manifest on the feature branch**

```powershell
git add docs/backups/2026-07-22-pre-light-ui.md
git commit -m "docs: record pre-redesign recovery point"
```

Expected: the commit contains only the manifest.

---

