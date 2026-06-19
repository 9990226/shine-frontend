# SHINE 背景邏輯 SSOT（Single Source of Truth）

**版本：** 2026-06-16  
**網址：** `http://2c-ai.com/shine/`（子網頁 `/shine`）

---

## 1. 用戶流程

1. 用戶以 **Gmail 帳號登入**（同時作為寄信 sender）
2. 進入**設定頁**，填寫變數（每位用戶獨立儲存於 localStorage）
3. 手動或 **每日 09:00 自動掃描**（可開關）
4. SHINE 依來源 URL **跟隨職缺超連結** → 擷取申請 email
5. 用戶在 Dashboard **預覽任務** → 確認後自動寄信（真人節奏）
6. 每完成一個申請，**Dashboard + LOG.txt** 顯示紀錄

---

## 2. 設定變數（Settings）

| 變數 | 說明 | 限制 |
|------|------|------|
| NAME | 申請人姓名 | 必填 |
| Applicant email | Gmail 登入帳號 + 寄信信箱 | 必填 |
| Gmail App Password | 應用程式密碼 | 必填，僅記憶體/session，不寫入後端 |
| Keywords | 定位相關職缺 | **最多 3 個**，逗號分隔；**任 match 1 個**即處理 |
| Blacklist | 排除機構 | 例：`YWCA` |
| Universal Cover Letter | 求職信正文 | **100% 原樣**，上限 **2000 字** |
| CV URL | 履歷連結（文字附於信末） | 可選，可隨時更換 |
| Target URLs | 職缺搜尋結果頁 | Lv1=1 / Lv2=2 / **Lv3=3** |
| Auto Scan 09:00 | 每日自動掃描開關 | 關閉則不觸發（省資源） |

**主旨（Subject）：** `Application to {target post}`（職缺標題）

---

## 3. 等級與配額

| 等級 | 月配額 | 同時來源 URL |
|------|--------|--------------|
| Lv1 | 60 封 | 1 |
| Lv2 | 100 封 | 2 |
| Lv3 | 無限 | 3 |

- 跨 URL **去重**（相同 title+company+email 只申請一次）
- 已寄職缺寫入 **LOG / sentHistory**，重掃跳過

---

## 4. 自動化任務邏輯（核心）

```
用戶提供 1–3 個已篩選的搜尋結果 URL
  → 後端抓取列表頁（先收連結，再清 DOM）
  → 跟隨 /job/detail 等詳情連結（最多 12 個/來源）
  → 從詳情頁擷取：標題(<title>/h1)、機構、mailto email
  → 關鍵字過濾（任 1 匹配）+ 黑名單排除
  → 同一頁多個 email（如 SAGE 兩職位）→ 拆成多個 Mission
  → DeepSeek 補充分析（失敗不影響詳情頁結果）
  → 前端預覽 → 用戶確認
  → 每封間隔 30–180 秒隨機等待
  → Gmail 寄出：正文=萬用信+CV URL，主旨=Application to {職位}
  → Dashboard 顯示 Mission 進度 + 寫入 LOG
```

---

## 5. 測試案例：YCLAU（劉易聰）

- **帳號：** Yikchung2026@gmail.com（Lv3）
- **關鍵字：** social worker, ASWO, 社工
- **黑名單：** YWCA
- **來源 URL：** `https://jump.mingpao.com/job/search/Jobs/2?Keyword=社工`

**Mission 1：** 全職學位駐校社工 → 詳情頁 → `recruit@tpbcss.org` → 自動寄信  
**Mission 2：** 社工 Social Worker（含兩職位）→ `twdeccinfo@sage.org.hk` + `cwdeccinfo@sage.org.hk` → 各寄一封  
**排除：** 僅瀏覽資訊網站連結，不當申請 email

---

## 6. 技術架構

| 層 | 位置 |
|----|------|
| 前端 | VPS `/var/www/2c-ai/shine/` 靜態檔 |
| 後端 | Render `shine-backend-byii.onrender.com` |
| AI | DeepSeek（公司 API Key，用戶不可見） |
| 寄信 | Nodemailer + 用戶 Gmail App Password |

---

## 7. 2026-06-16 修復摘要

- **根因：** 列表頁在移除 DOM 後才收連結 → `detailLinks=0` → 無 email
- **修復：** 先收連結再清 DOM；詳情頁以 `<title>`/mailto 建職缺；關鍵字/黑名單後端過濾
- **前端：** Gmail 登入、多用戶 localStorage、09:00 自動掃描開關、Mission Dashboard

---

*本文件為 SHINE 產品背景邏輯之正式 SSOT。實作以 `backend/server.js` + `assets/shine-app.js` 為準。*