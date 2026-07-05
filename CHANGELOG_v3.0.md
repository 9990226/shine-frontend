# SHINE v3.0 — Autorun + Telegram Daily Report

## Bug fixes (user-reported)

### Bug 1 — One-button full-month automation
- **「一鍵全月自動出擊」** hero button in automation section
- Flow: save settings → enable `daily_auto_enabled` → `POST /api/autorun` → immediate `run-now`
- Server dedup unchanged: `sent_applications` + `crossSiteDedupKey` — already-applied jobs skipped
- Daily scheduler: HK 09:00 via existing `scheduler.js`
- Toggle off: same button or uncheck「每日自動運行」

### Bug 2 — Telegram daily summary (HK 21:00)
- When `daily_auto_enabled=true`, patrol sends brief report to bound Telegram chat
- Report: thanks 2C-AI · jobs applied today · hours today/monthly (1 email = 1 hr) · subscription expiry
- Bind: send SHINE account ID to `@Shine2caiAIbot`, or auto-bind on bot approval
- Admin: `/report` forces patrol (admin chat)

## Backend

| File | Change |
|------|--------|
| `services/dailyTelegramReport.js` | **NEW** — HK 21:00 patrol, report builder |
| `services/growthStore.js` | `autorun`, `telegramBinds`, `dailyReports` |
| `routes/growth.js` | `GET/POST /api/autorun` |
| `routes/automation.js` | Sync `setAutorun` on daily-auto toggle; lv1 tier allowed |
| `db/index.js` | `getEligibleScheduledUsers`, `countSentApplicationsSince`, `getMonthlySentCount` |
| `accounts.js` | `listAll`, `daysLeft`, `hkToday` |
| `registration.js` | Telegram bind on account ID; auto-bind on approval; `startDailyReportLoop` |
| `__tests__/dailyReport.test.js` | **NEW** — autorun, bind, report text, sent stats |

## Frontend

| File | Change |
|------|--------|
| `index.html` | Autorun hero block; boot `v3.0-autorun` |
| `shine.css` | `.autorun-hero`, `.autorun-btn`, `.autorun-armed` |
| `assets/shine-app.js` | `armMonthlyAuto()`, `updateAutorunUI()`, checkbox sync |

## Deploy

```bash
cd Downloads/2c-ai-site/shine && bash DEPLOY_WITH_PW.sh
```

**Live (2026-07-05):** https://2c-ai.com/shine/ · boot `v3.0-autorun`

**Verify:**
```bash
curl -s https://2c-ai.com/shine/ | grep v3.0-autorun
curl -s https://2c-ai.com/shine-api/api/autorun   # 401 without token = route OK
```