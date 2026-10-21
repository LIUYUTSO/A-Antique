# Handoff

給新 session 的交接。先讀這份,再讀 `README.md`。

## 專案一句話

Edmonton + Toronto 挖到的 26 件舊物,做成「像展示架」的網頁。Landing 是單件物品的海報,點開成左頁(物件)右頁(故事)的書頁,另有一頁縮圖總覽(Index)。參照書:EO BOOKS《選物 General Selection》。

## 已鎖定的決定(Adam)

| 項目 | 決定 |
| --- | --- |
| 方向 | A:Index(整座架子)+ Spread(拿起一件) |
| 拍攝視角 | 全部俯視定裝照 |
| 3D | 26 件全做。17 件走 Meshy / 既有模型,9 件平面件本地生成 |
| 底版 | 淺灰 #F3F3F3(參考圖),白頁上內縮 |
| 內文 | 句首大寫;標籤、標題、編號全大寫 |
| 字體 | JetBrains Mono 300/400 |
| 動效 | transform 解除。expo.out,開場 900ms,不用彈跳 |
| 圖像 | 原色 |
| 全站語言 | 英文 |
| 風格 | Mode E(紙、墨、底版三個中性色,無圓角無陰影無 accent) |

## 連結

- Repo:https://github.com/LIUYUTSO/A-Antique,PR #1(draft,分支 `meshy-pipeline`)。**main 目前只有初始 commit,本檔與 pipeline 都在分支上,新 session 要先切到 `meshy-pipeline` 或先合併 PR #1。**
- Mood board(Rev. 4):https://claude.ai/artifact/SViKmxjU9FzDE713uYxw22,原始碼 `design/moodboard.html`
- 盤點清單(共用資料庫,26 件):https://claude.ai/artifact/PCXc3rRWTtpiBQPiTLN8AB。用 Artifact 工具 `ArtifactData`(collection `objects`,doc id `001` 到 `026`)讀寫。
- 舊專案 A-Stuff:https://github.com/LIUYUTSO/A-Stuff。裡面**沒有 Meshy**,只有 StableFast3D 本地腳本、`gltf-transform` 壓縮、R2 上傳。

## 環境變數

- `MESHY_APIKEY`(程式也讀 `MESHY_API_KEY`)。在雲端環境設定裡加,**不要貼在對話**。新 session 才會生效。
- R2(只有 `--upload` 需要):`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET`、`R2_PUBLIC_BASE_URL`。
- api.meshy.ai 從雲端環境連得到(未帶 key 回 401)。

## 模型現況

- Adam 的部分模型是在 Meshy 網頁版(SaaS)建的,**API 列不出來**(他之前試過)。要用,必須由 Adam 匯出 GLB 再交給我們。
- 點數:Adam 回報剩 774。Meshy 件帶貼圖 30 點,17 件最多 510 點。
- **尚未產生任何模型,尚未用真實 key 呼叫過 Meshy**(只有 dry-run 和 mock server 測試)。Adam 說「先不產模型,先計劃再執行」。

## 待執行計畫:匯入既有模型(未開工)

1. **盤點(唯讀)**:對每個 GLB 回報大小、面數、貼圖數與解析度、尺寸、原點與朝向、是否 PBR、是否已 Draco。
2. **對照 26 件**:在盤點清單頁把已有模型的物件標 `SAAS: HAVE`,清單 `method` 可加 `existing`。重算 Meshy 要跑的件數與點數。
3. **統一規格**:單位公尺、Y 軸朝上、原點在底面中心、正面朝 +Z、依 `sizeMm` 縮放、面數 ≤ 3 萬、貼圖 1024 WebP、Draco。不符的轉正,不改外觀。
4. **傳 R2**:`models/<id>.glb`、`thumbnails/<id>.png`。
5. **剩下沒模型的件**才送 Meshy,送出前先給 Adam 新的點數明細,等他說開始。

模型檔怎麼進這個環境還沒定。建議 Adam 放 R2 的 `incoming/`,並把 R2 變數加進環境設定。

## 程式在哪

```
scripts/meshy/   client.mjs(API、balance、輪詢)、pipeline.mjs(計畫、狀態、下載、壓縮、R2)、run.mjs(CLI)
scripts/flat/    flat.mjs(薄板 GLB 生成)、build.mjs(CLI)
data/objects.json  26 件清單;method: meshy | flat;flat 件有 kind、sizeMm
design/          moodboard.html、kodak.png(暫代去背圖)、dig-photo.jpg(原照)
```

- `npm install && npm test`:16 項,全過。
- `npm run meshy -- <id|all> --dry-run`:看計畫與 payload。
- 每次非 dry-run 都先查餘額,不夠就不送。預設一次只建 1 個新任務(`--limit`)。任務 id 在輪詢前寫入 `.meshy/state.json`,重跑會接續。
- `node --test` 在 Node 22 要指定檔案,不能給目錄(`package.json` 已處理)。
- 平面件 9 件:001、010、011、013、014、015、016、017、023。尺寸沒量前假設長邊 200 mm。

## 還在等 Adam 的事

1. 哪幾件已有 SaaS 模型?(在盤點清單頁標 `SAAS: HAVE`)
2. 模型檔怎麼交付?(R2 `incoming/` 或其他)
3. 9 件平面件的實際尺寸(寬 × 高,mm)。
4. 每件的出處(城市、年份、價格)與故事。
5. Rev. 3 / PR #1 是否算「這版完成」。完成後才把 pipeline 移植到 A-Stuff(開 draft PR,不動 main)。

## 給接手者的提醒

- 回覆用繁體中文台灣用語,先結論後理由,技術術語保留英文。
- Adam 是審邏輯不審語法,瓶頸是傳輸。收斂模式:先用「意圖/狀態/行為/關係/距離/節奏」複述,確認後交最小可看版本。
- 不要在對話裡索取 key。不要替 Adam 命名。
- 平面件、Kodak 暫代圖、物件名稱都是暫代或暫稱,別當成最終內容。
