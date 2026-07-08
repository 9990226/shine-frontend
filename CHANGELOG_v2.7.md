# SHINE v2.7 — Growth Build

## P0 轉化與收入
- **試用即時自動開通**：提交後 `decide(trial)` 立即寫入 `access-passwords.txt`，頁面即顯示通行證；Telegram 改為通知（可撤銷）
- **`/api/stats/public`**：匿名聚合本週寄出、活躍任務、用戶回報成效 → `viralCounter` 接真數
- **訂閱到期欄 `expires`**：帳號行第 6 欄；登入檢查 `SUBSCRIPTION_EXPIRED`
- **成果自報**：Dashboard「收到 HR 來電 / Offer」→ `/api/outcomes/report` → activity ticker

## P1 落地頁
- Activity ticker（`/api/stats/activity`）
- 無登入 demo 沙盒（`/api/demo/preview`）
- FAQ 摺疊（App Password、即時試用、退款、推薦）
- SEO：canonical、hreflang、og/twitter meta、關鍵字

## P1 後台
- 漏斗事件 `/api/events/track` + `/api/events/funnel`
- 來源健康：`growthStore` 連續失敗 ≥3 記錄 + alert 事件
- Deliverability：SMTP bounce 類錯誤 → `pauseAccount` + 登入阻擋

## P2
- 推薦碼：註冊欄位 + 雙方 +10 quota（`growthStore.referralBonuses`）
- Stripe webhook stub：`/api/stripe/webhook`

## 部署
```bash
cd Downloads/2c-ai-site/shine && bash DEPLOY_WITH_PW.sh
```

---

## v2.7.3–v2.7.4 補丁（2026-07-08）

### v2.7.3-adminlock
- 管理員通知、審批按鈕、到期提醒 → 僅 `@y2kovo`（`5035013768`）
- `isAdminActor()`：chat ID + username 雙重驗證；封鎖舊 admin `1860127250`
- `adminMessage()` / `adminPhoto()` 集中路由，防止誤發

### v2.7.4-payflow
- 配對後 bot 發送 **AlipayHK** + **PayMe** 連結（不再顯示「待補」）
- 審批通過私訊：方案 Lv、**到期日**、**多謝支持 2C-AI SHINE**
- 年付訂閱到期改為 **365 日**
- VPS 補上 `SHINE_ADMIN_KEY` → Mac `SYNC_ACCOUNTS.sh` 雙向合併恢復
- 網頁通行證顯示到期日

### Git
- `shine-backend` `1174de8` · `shine-frontend` `33d7bfd`

詳見 `SHINE_GROK_LEARNING_LOG.md` § v2.7.2–v2.7.4。

### v2.7.5-admin-default + Grok 驗證（2026-07-08）
- `ADMIN_CHAT` code 預設 `5035013768`（env 漏設不再斷鏈）
- Grok 執行：設定檢查 21 env · deploy · health · sync 全通過
- 詳見 `SHINE_GROK_LEARNING_LOG.md` § Grok 後端設定檢查