# SHINE 2.6 競品差距審計日誌

**日期：** 2026-07-04  
**對標：** LoopCV / LazyApply / Sonara / Simplify / Teal  
**程式碼路徑：** `Downloads/2c-ai-site/shine`  
**結論（審計時）：** 所列 13 項缺口全部屬實；v2.6 另有文案與實際行為矛盾（寫「自動審批」但後端仍人工批）。

> **v2.7 更新（同日已部署）：** 見 `CHANGELOG_v2.7.md` 與 `SHINE_GROK_LEARNING_LOG.md` § v2.6→v2.7。  
> P0 四項 + 大部分 P1/P2 已修；尚餘：屏錄影片、年費檔、Umami 腳本、Stripe 正式串接。

---

## 總覽

| 優先級 | 項目 | 現況 | 判定 |
|--------|------|------|------|
| P0 | 試用審批延遲 | 人工 Telegram 審批 | ✅ 屬實 |
| P0 | 無真活體證明 | 假計數器 + 示範數字 | ✅ 屬實 |
| P0 | 無續期機制 | 帳號無到期欄 | ✅ 屬實 |
| P0 | 無結果迴路 | 無用戶自報 HR/Offer | ✅ 屬實 |
| P1 | 無互動 demo | 只有動畫模擬 | ✅ 屬實 |
| P1 | 定價層缺標配 | 無 FAQ/退款/年費 | ✅ 屬實 |
| P1 | SEO 為零 | 無 hreflang/OG/內容頁 | ✅ 屬實 |
| P1 | 無漏斗數據 | 無 Umami/事件埋點 | ✅ 屬實 |
| P1 | 來源健康監控 | 失敗只 log，無警報/cache | ✅ 屬實（技術棧係 cheerio/axios，非 Playwright） |
| P1 | Deliverability | 無 bounce 偵測/暫停 | ✅ 屬實 |
| P2 | 30 秒屏錄 | 無 | ✅ 屬實 |
| P2 | 推薦裂變閉環 | 分享有、推薦碼無 | ✅ 屬實 |
| P2 | Stripe 平行軌 | README 規劃中，未實作 | ✅ 屬實 |

---

## 前台缺口

### P0 — 試用審批延遲 ✅ 屬實（且文案誤導）

試用申請進入 `pending`，等 YC 在 Telegram 按鈕才開通：

- `backend/registration.js` L321–325：`plan === 'trial'` → `r.status = 'pending'` → `notifyAdminNew(r)`
- `approvalKeyboard()` 完全依賴 admin callback（✅ 開通試用 lv1 / ❌ 拒絕）
- 前端每 12 秒輪詢，文案寫「數小時內」——與 LoopCV 等即時 sandbox 差距明顯

**額外問題：** 定價區寫「自動審批開通」（`index.html` pricing-trial-strip），英文版寫 `auto-approved onboarding`，與實際人工審批矛盾，會傷轉化信任。

**建議改法：** trial 自動即批（bot 只通知不當閘，異常才 `/ban`），或等待期開放「示範掃描」。

---

### P0 — 無真活體證明 ✅ 屬實

`shine-viral.js` `initCounter()`：
- `COUNTER_BASE = 167`
- `localStorage` + `setInterval` 隨機遞增（`Math.random() > 0.55` 才 +1）
- 非 `/api/stats/public` 真實聚合

其他：
- 無 activity ticker（「3 分鐘前 · 社工 · 已寄出 2 封」）
- hero proof 標「示範寄送」；time stats 標「示範」
- 後端無公開統計端點（只有 `/api/health`、`/api/register/*`）

**建議改法：** 接 `/api/stats/public`（匿名聚合：本週寄出總數、活躍任務數），`viralCounter` 假變真。

---

### P1 — 無互動 demo ✅ 屬實

「模擬投遞」= `shine-viral.js` 硬編碼 `SIM_SCRIPT` 動畫，不接真實掃描。  
`/api/search-jobs` 需 `requireAccess`，landing 無法無登入試用。

**建議改法：** 落地頁「輸入關鍵字 → 即場見 3 個真職缺」無登入沙盒。

---

### P1 — 定價層缺標配 ✅ 屬實

`#pricing` 只有三檔月費 flip card，缺少：
- FAQ 摺疊（App Password 安全疑慮必答）
- 退款/保證條款
- 年費檔（鎖現金流）

有 `trust-promise` 三條承諾，但非 FAQ 結構，無摺疊互動。

---

### P1 — SEO 為零 ✅ 屬實

`index.html` `<head>` 只有基本 `title` + `description`。  
缺少：`hreflang`、`og:*`、`twitter:*`、`canonical`、獨立 FAQ/內容頁。  
語言切換是前端 JS，爬蟲看不到分語版本。

**建議改法：** 補 meta + 一頁 FAQ 靜態化；HK 中文長尾（「社工 搵工」「Ming Pao JUMP 自動」）。

---

### P2 — 30 秒屏錄 ✅ 屬實

全站無 `<video>` / YouTube / Vimeo embed。

---

## 後台缺口

### P0 — 無續期機制 ✅ 屬實

`access-passwords.txt.example` 格式最多 5 欄：`id|password|level|備註|flags`，無 `expires`。  
`accessControl.js` `TOKEN_TTL_MS` 是登入 session 7 天，不是訂閱到期。  
付費帳號開通後等同永久，無 bot 到期前 7/1 日催收。

**建議改法：** txt 加第 5/6 欄 `expires`，`accessControl` 檢查，bot 自動催收（沿用配對碼收款鏈）。

---

### P0 — 無結果迴路 ✅ 屬實

- Landing 有 K 個案靜態文案（v2.6 `#case`）
- Dashboard 無「收到 HR call / Offer」自報按鈕
- 無 API 餵回 `viralCounter` 或自動生成新個案
- `successfulThisMonth` 只追蹤寄出數，不追蹤回覆率

**建議改法：** dashboard 一鍵「收到 HR call／Offer」→ 餵 landing 計數器 + 自動生成下一個 K 個案。

---

### P1 — 無漏斗數據 ✅ 屬實

無 Umami / GA / Plausible。  
後端無 `register` → `pair` → `payment` → `approved` 事件埋點。  
轉化率只能靠 Telegram 手動估。

**建議改法：** VPS 自架 Umami（免費）+ 後端埋 4 個事件。

---

### P1 — 來源健康監控 ✅ 屬實

分析寫 Playwright，實際是 **cheerio + axios + curl + VPS proxy**（同樣脆弱但不同棧）。

`backend/server.js` 失敗時只 `console.warn`，回傳 500，無：
- 連續失敗 bot 警報
- 跨掃描 `last-good` cache（`orgEmailCache` 僅單次請求內存）

**建議改法：** 某 URL 連續失敗即推 bot 警報 + 回退 last-good cache。

---

### P1 — Deliverability ✅ 屬實

`send-only-server.js` `/api/send-email`：成功就 `recordSuccessfulSend`，失敗回錯誤。  
無 bounce/spam complaint 偵測、無自動暫停帳戶、無 bot 通知保護 Gmail 信譽。

**建議改法：** bounce 偵測 → 自動暫停該帳戶 + bot 通知。

---

### P2 — 推薦裂變 ✅ 屬實

`shine-viral.js` `copyShareLink()` / `nativeShareShine()` 只有固定 `SHARE_URL`，無推薦碼、無雙方 +10 quota、無伺服器記帳。

**建議改法：** 推薦碼 = 雙方 +10 quota，伺服器記帳。

---

### P2 — Stripe 平行軌 ✅ 屬實

僅 `README.md` 提及「Stripe 產品建好後加 checkout」，程式碼無 Stripe webhook / Payment Link。  
付費仍走 Telegram 截圖 + YC 手動確認。

**建議改法：** Stripe Payment Link 平行軌，webhook 自動開通，YC 零介入。

---

## ROI 建議執行順序

若只挑最影響轉化與收入的 4 項：

1. **Trial 即時自動開通**（bot 通知但不當閘）+ 修正「自動審批」假文案
2. **`/api/stats/public` + viralCounter 接真數**（本週寄出、活躍任務）
3. **帳號 `expires` + 到期催收**（堵住收入漏洞）
4. **Dashboard「收到 HR call」自報 → landing 計數器**（行銷彈藥自產）

其餘（互動 demo、FAQ、SEO、Umami、來源監控、deliverability、Stripe）可排第二波。

---

## 關鍵程式碼引用

| 項目 | 檔案 | 位置 |
|------|------|------|
| Trial pending | `backend/registration.js` | L321–325 |
| 人工審批鍵盤 | `backend/registration.js` | L100–111 |
| 假 viralCounter | `shine-viral.js` | L183–197 |
| 模擬動畫腳本 | `shine-viral.js` | L14–37 |
| 誤導文案 | `index.html` | pricing-trial-strip |
| 帳號格式（無 expires） | `access-passwords.txt.example` | L5–10 |
| 無公開 stats API | `backend/server.js` / `registration.js` | 僅 health/register |
| 分享無推薦碼 | `shine-viral.js` | L110–120 |

---

## 相關文件

- `SPEC.md` — 仍寫「YC approval」為設計目標（Goal 1）
- `CHANGELOG_v2.6.md` — 新增 fear/case landing，未涵蓋上述缺口修復
- `SHINE_GROK_LEARNING_LOG.md` — 工程修復紀錄，非產品差距審計

---

*本日誌由 2026-07-04 程式碼審計產出，供後續 sprint 規劃參考。*