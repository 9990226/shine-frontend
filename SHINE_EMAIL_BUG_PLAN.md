# SHINE 電郵無法寄出 — 除錯計劃

**日期：** 2026-06-16  
**測試案例：** `https://jump.mingpao.com/job/search/Jobs/2?Keyword=社工`

---

## 一、問題現象

| 步驟 | 預期 | 實際 |
|------|------|------|
| 掃描 | 找到多個職缺 + 申請 email | 常見「找到 N 個職缺，但 **0 個有明確 email**」 |
| 預覽 | 顯示可寄送清單 | 紅色提示，無「確認發送」批次 |
| 寄送 | Gmail 批次寄出 | **根本不會進入** `confirmAndSendBatch()` |

> 寄送邏輯本身（Nodemailer + App Password）未觸發，因為上游 `currentBatch.length === 0`。

---

## 二、根因鏈（已用線上 API 驗證）

```
掃描 URL
  → POST /api/extract-from-search-urls（Render）
  → 回傳 jobs[].apply_email = null、confidence ≈ 0.1
  → 前端過濾：需 apply_email 且 confidence ≥ 0.6
  → currentBatch = [] → 無法寄信
```

### P0：後端擷取失敗（主因）

**線上實測回應（2026-06-16）：**
```json
{
  "jobs": [{
    "title": "社工",
    "apply_email": null,
    "confidence": 0.1,
    "reason": "Only keyword match, no job details"
  }]
}
```

**明報詳情頁實際有 email（curl 驗證）：**
- `mailto:recruit@tpbcss.org` ✓
- 標題在 `<h1>` / `<title>`，**沒有**「職位：」標籤

**程式缺陷（`backend/server.js` 約 293–316 行）：**
- 詳情頁 fallback 用 regex `職位[：:]` / `Job Title[：:]` 取標題
- 明報不符合 → `if (!title) continue` → **即使有 email 也整筆跳過**
- `enrichJobsWithDetailEmails()` 只補既有 AI 職缺；AI 若只回關鍵字「社工」且無 link，無法對應詳情頁

### P1：前端閘門（設計正確，放大問題）

`shine-app.js`：`hasEmail = apply_email && confidence >= 0.6`  
→ 後端 0 email 時，UI 正確顯示 0 批次，用戶以為「壞了」。

### P2：快取舊版前端（次要）

若仍見「開始 Safe Scan & Apply」或 `null (reading 'value')`，為舊 `shine.js` 快取。  
應載入 `shine-app.js?v=20260615fix3` 並強制重新整理。

### P3：HTTPS 逾時（環境）

`https://2c-ai.com/shine/` 可能逾時；`http://` 正常。不直接阻擋寄信，但易載入舊檔。

---

## 三、修復計劃（按優先順序）

### 步驟 1 — 後端 P0（必做）

**檔案：** `backend/server.js`

1. **詳情頁 fallback 改標題來源：**
   - 優先 `<h1>`、`<title>`（去掉「 - Jobs Search - JUMP」後綴）
   - 次選 URL slug 解碼
   - 公司名：`<meta>`、正文機構欄、或從 title 分割
   - **有 `pickBestApplyEmail()` 即建立職缺，勿再要求「職位：」**

2. **詳情頁優先建 job（建議）：**
   - 對每個 `detailPages` 有 email 者直接 `push` job
   - AI 結果僅作補充/合併，非唯一來源

3. **連結比對：** 正規化 URL（含編碼差異）以提升 `enrichJobsWithDetailEmails` 命中率

### 步驟 2 — 部署後端

```bash
cd shine/backend && git add server.js && git commit -m "fix: Mingpao detail fallback title from h1/title" && git push origin main
```
Render 自動部署 → 確認 `https://shine-backend-byii.onrender.com/` 健康

### 步驟 3 — 驗證 API（通過才可測前端）

```bash
curl -X POST 'https://shine-backend-byii.onrender.com/api/extract-from-search-urls' \
  -H 'Content-Type: application/json' \
  -d '{"urls":["https://jump.mingpao.com/job/search/Jobs/2?Keyword=%E7%A4%BE%E5%B7%A5"],"keywords":"社工"}'
```
**通過標準：** `apply_email` 含 `recruit@tpbcss.org`，`confidence ≥ 0.6`，職缺數 ≥ 1

### 步驟 4 — 前端（可選）

- 0-email 時顯示「後端未擷取到 email，請確認 Render 已更新」
- 同步 tier 顯示（定價 Lv3 vs 表單 Lv2）

### 步驟 5 — 完整寄送測試

1. 無痕視窗開 `http://2c-ai.com/shine/`
2. 填明報 URL、關鍵字「社工」、Gmail + App Password、萬用信
3. 掃描 → 預覽應見 `recruit@tpbcss.org`
4. 確認發送 → Mission Process 顯示寄送進度
5. 下載 LOG.txt 確認記錄

---

## 四、成功標準

- [ ] API 回傳含 `recruit@tpbcss.org` 的職缺
- [ ] 前端 `currentBatch.length > 0`
- [ ] 至少 1 封經 Gmail 成功寄出
- [ ] LOG.txt 有對應記錄
- [ ] 重掃同 URL → 已寄職缺被 dedup 跳過

---

## 五、相關檔案

| 檔案 | 角色 |
|------|------|
| `backend/server.js` | 擷取 + 詳情頁 fallback（**修這裡**） |
| `assets/shine-app.js` | 過濾 `currentBatch`、呼叫 `/api/send-email` |
| `SHINE_GROK_LEARNING_LOG.md` | 英文 SSOT / 歷史除錯記錄 |

---

*本檔為 2026-06-16 電郵無法寄出之繁體中文除錯計劃。詳細英文脈絡見 `SHINE_GROK_LEARNING_LOG.md`。*