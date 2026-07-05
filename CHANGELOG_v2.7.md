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