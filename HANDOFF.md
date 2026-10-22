# Handoff

給新 session 的交接。先讀這份,再讀 `README.md`。

## 專案一句話

Edmonton + Toronto 挖到的 23 件舊物,做成「像展示架」的網頁。Landing 是單件物品的海報,點開成左頁(物件)右頁(故事)的書頁,另有一頁縮圖總覽(Index)。參照書:EO BOOKS《選物 General Selection》。

## 已鎖定的決定(Adam)

| 項目 | 決定 |
| --- | --- |
| 方向 | A:Index(整座架子)+ Spread(拿起一件) |
| 拍攝視角 | 全部俯視定裝照 |
| 3D | 23 件全做。14 件走 Meshy / 既有模型,9 件平面件本地生成。03+04、05+06、21+22 三組各併成一件(Adam 2026-10-22),保留較小編號,另一個記在 `aliases` |
| 底版 | 淺灰 #F3F3F3(參考圖),白頁上內縮 |
| 內文 | 句首大寫;標籤、標題、編號全大寫 |
| 字體 | JetBrains Mono 300/400 |
| 動效 | transform 解除。expo.out,開場 900ms,不用彈跳 |
| 圖像 | 原色 |
| 全站語言 | 英文 |
| 風格 | Mode E(紙、墨、底版三個中性色,無圓角無陰影無 accent) |
| 技術棧 | **固定技術棧**(Adam 2026-10-21 確認):Next.js App Router、Tailwind v4、GSAP、Lenis、Three.js;部署 Vercel;DB Neon;檔案 R2。2026-10-21 曾評估 Cloudflare + Astro 並搭過骨架,Adam 研究後決定回到固定棧。評估骨架留在分支 `site-skeleton`(PR #2 已關閉) |

## 連結

- Repo:https://github.com/LIUYUTSO/A-Antique,PR #1(draft,分支 `meshy-pipeline`)。**main 目前只有初始 commit,本檔與 pipeline 都在分支上,新 session 要先切到 `meshy-pipeline` 或先合併 PR #1。**
- Mood board(Rev. 4):https://claude.ai/artifact/SViKmxjU9FzDE713uYxw22,原始碼 `design/moodboard.html`
- 盤點清單(共用資料庫,23 件):https://claude.ai/artifact/PCXc3rRWTtpiBQPiTLN8AB。用 Artifact 工具 `ArtifactData`(collection `objects`,doc id `001` 到 `026`,缺 004、006、022(已併入 003、005、021))讀寫。
- A-Brain PR #67(🧽📶「技術棧寫成固定與可替換矛盾」):**已由 Adam 取消並關閉**(他決定維持固定棧)。正本裡「固定」與「可替換」兩種說法並存仍是事實,但 Adam 沒有要處理。
- 舊專案 A-Stuff:https://github.com/LIUYUTSO/A-Stuff。裡面**沒有 Meshy**,只有 StableFast3D 本地腳本、`gltf-transform` 壓縮、R2 上傳。

## 環境變數

- `MESHY_APIKEY`(程式也讀 `MESHY_API_KEY`)。在雲端環境設定裡加,**不要貼在對話**。新 session 才會生效。
- R2(只有 `--upload` 需要):`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET`、`R2_PUBLIC_BASE_URL`。
- api.meshy.ai 從雲端環境連得到(未帶 key 回 401)。

## 模型現況

- Adam 的部分模型是在 Meshy 網頁版(SaaS)建的,**API 列不出來**(他之前試過)。要用,必須由 Adam 匯出 GLB 再交給我們。
- 點數:Adam 回報剩 774。Meshy 件帶貼圖 30 點,14 件最多 420 點。
- **尚未產生任何模型,尚未用真實 key 呼叫過 Meshy**(只有 dry-run 和 mock server 測試)。Adam 說「先不產模型,先計劃再執行」。

## 待執行計畫:匯入既有模型(未開工)

1. **盤點(唯讀)**:對每個 GLB 回報大小、面數、貼圖數與解析度、尺寸、原點與朝向、是否 PBR、是否已 Draco。
2. **對照 23 件**:在盤點清單頁把已有模型的物件標 `SAAS: HAVE`,清單 `method` 可加 `existing`。重算 Meshy 要跑的件數與點數。
3. **統一規格**:單位公尺、Y 軸朝上、原點在底面中心、正面朝 +Z、依 `sizeMm` 縮放、面數 ≤ 3 萬、貼圖 1024 WebP、Draco。不符的轉正,不改外觀。
4. **傳 R2**:`models/<id>.glb`、`thumbnails/<id>.png`。
5. **剩下沒模型的件**才送 Meshy,送出前先給 Adam 新的點數明細,等他說開始。

模型檔怎麼進這個環境還沒定。建議 Adam 放 R2 的 `incoming/`,並把 R2 變數加進環境設定。

## 網站骨架(已搭,Next.js)

- 頁面:`/`(Landing,海報式單件)、`/shelf`(Index 縮圖總覽)、`/objects/<id>`(書頁,23 頁),全部靜態預先生成,未知 id 回 404。
- 資料:`src/lib/objects.ts` 用 Zod 驗證 `data/objects.json`;故事在 `content/stories/<id>.md`(目前只有 012,草稿)。
- 動效:Lenis 接 GSAP ticker;右頁區塊用 GSAP 淡入(expo/power3,500ms)。
- 預留 `listing`(狀態、價格)欄位給之後的 yard sale,目前不渲染。
- **尚未做**:Three.js GLB 檢視器、Landing 到書頁的 GSAP 轉場、Square、Neon 資料庫、連到 Vercel(還沒匯入專案)。
- 已驗證:`npm test` 16/16、`tsc --noEmit`、`next build`(31 頁)、`npm audit --omit=dev` 0 個漏洞;Chromium 桌面與手機截圖。**未驗證**:實際部署到 Vercel。
- 備註:Vercel Hobby 限非商業。接 Square 賣東西前要升 Pro;函式請求內容上限 4.5 MB(A-Stuff 已撞過,所以大檔一律瀏覽器直傳 R2)。

## 程式在哪

```
scripts/meshy/   client.mjs(API、balance、輪詢)、pipeline.mjs(計畫、狀態、下載、壓縮、R2)、run.mjs(CLI)
scripts/flat/    flat.mjs(薄板 GLB 生成)、build.mjs(CLI)
data/objects.json  23 件清單;method: meshy | flat;flat 件有 kind、sizeMm
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

- 技術棧固定(見上表),不要再提議換棧。
- 回覆用繁體中文台灣用語,先結論後理由,技術術語保留英文。
- Adam 是審邏輯不審語法,瓶頸是傳輸。收斂模式:先用「意圖/狀態/行為/關係/距離/節奏」複述,確認後交最小可看版本。
- 不要在對話裡索取 key。不要替 Adam 命名。
- 平面件、Kodak 暫代圖、物件名稱都是暫代或暫稱,別當成最終內容。Adam 說有些物件識別有誤,會自己更正:**名稱以盤點清單資料庫為準**(`data/objects.json` 只是初始值,更正後要同步回來)。若某件識別改變,要重新確認它的 `group` 與 `method`(flat 或 model),Meshy 的點數也會跟著變。

## 拍攝與 Blender 工具(2026-10-22,Adam 要求)

- **Swift 拍攝工具** `capture/`:Mac 上用 iPhone(Continuity Camera)當固定相機,依清單拍 `views/`(最多 4 張給 Meshy)、`still.jpg`、`extra/`(細節),記錄鎖定狀態到 `capture.json`。純邏輯有 20 項測試;相機與視窗部分已在 CI 的 macOS runner 編譯通過,**但沒有實際用 iPhone 跑過**,要由 Adam 在 Mac 上實測。
- **Meshy 可接受幾張**:`multi-image-to-3d` 是 1 到 4 張,第一張是正面主視角(官方文件)。
- **Blender 流程** `blender/`:`clean`(焊接、去碎片、減面到 3 萬、真實尺寸、原點)、`work`(產生 .blend)、`open`(零件做成 `<part>.open`/`<part>.close` 動畫)。用 bpy(Blender 5.2)測過,成品用 gltf-transform 讀回檢查。
- **壓縮與檢查** `scripts/publish/`:`npm run finish -- <id>`,預算檔案 ≤ 3 MB、三角面 ≤ 3 萬、貼圖 ≤ 1024 px、動畫成對,超過不上傳。壓縮設定刻意不做 join、flatten、palette,避免弄壞有動畫的零件。
- **Blender MCP**:Adam 說他已開。**這個雲端工作階段看不到任何 Blender 工具**,無法確認連通;要在他 Mac 上的 Claude 工作階段確認(見 `blender/README.md` 最後一節)。手工步驟(分離盒蓋、補盒內印刷)適合在那裡做。
- **還沒做**:網站的 Three.js 檢視器(要播 `<part>.open`/`<part>.close`)、Meshy 真實 key 試跑、真實模型的清理效果。
- 共用的壓縮函式改成可指定輸出路徑(`compressGlb(file, log, outFile)`、`uploadToR2({ file })`),Meshy 與平面件原本的 `--compress`、`--upload` 行為不變,但壓縮參數多了 `--flatten false --instance false --palette false`。

