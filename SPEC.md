# SHINE v2.3 — Registration + Approval + UI/UX

## Goal 1: Auto registration + YC approval
- User fills: 姓名, Gmail, 職系 (社工 / PT / OT / 護士 / 文職), 電話 (optional)
- Server stores as `pending` (no login until approved)
- Telegram notifies YC (admin) with actions: [Approve Trial lv1] [Approve Paid lv2] [Reject]
- On approve: auto-generate line in `access-passwords.txt` format (`id|password|lv1|label|trial`)
- Notify user via email and/or Telegram with SHINE ID + password

## Goal 2: UI/UX enhancement
- Polish `#beta-access` registration + login flow
- Mobile-first dashboard improvements
- Clear trial vs paid tier messaging
- Better loading / empty / error states
- Keep white/hope theme, gold + ultra brand colors

## Constraints (SSOT — do not break)
- `access-passwords.txt` remains source of truth for login
- Trial = 10 emails per Gmail (`trialQuota.js` on server)
- Tier quotas: lv1 = 60/mo · lv2 = 500/mo · lv3 = unlimited
- Universal Cover Letter sent 100% unchanged (no AI rewrite)
- DeepSeek key hidden — company pays; user never sees API key
- Human pacing 30–180s between sends; quota decrements only on success
- One account = one sender (Gmail lock for paid accounts)

## Files in this package
| File | Purpose |
|------|---------|
| `index.html` | Landing + `#beta-access` login portal + dashboard shell |
| `shine.css` | All styles |
| `SHINE_BACKGROUND_LOGIC_SSOT.md` | Product rules & architecture |
| `access-passwords.txt.example` | Account format reference |
| `SPEC.md` | This brief |

## What to deliver
1. **Registration form HTML/CSS** — drop-in for `#beta-access` section
2. **Pending-approval UX** — what user sees after applying (before YC approves)
3. **Admin approval flow sketch** — API endpoints + Telegram message templates
4. **UI polish pass** — spacing, typography, mobile nav, CTA hierarchy
5. **Do NOT** rewrite `shine-app.js` logic unless necessary; focus on HTML/CSS + spec

## Account format reference
```
id|password|level|備註|flags
# trial flag → 10 free emails per Gmail
# testshine|SHINE-XXXX|lv1|Trial user|trial
```

## Tech context
- Frontend: static HTML + `assets/shine-app.js` (not included — keep API contracts stable)
- Backend: Node.js on VPS/Render, `accessControl.js` + SQLite
- Deploy: VPS `/var/www/2c-ai/shine/`, backend on Render