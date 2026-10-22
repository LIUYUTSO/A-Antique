# Decisions

單一來源:哪些已鎖定、哪些還沒決定。來源是三份 artifact(前端發想、Mood board Rev. 4、盤點清單)、`HANDOFF.md` 與 Adam 在對話中的裁決。改決定時改這份,不要在別處另寫一份。

## 已鎖定

| 項目 | 決定 | 來源 |
| --- | --- | --- |
| 範圍 | Edmonton + Toronto 挖到的舊物,做成「像展示架」的網頁。**23 件**(原 26 件,三組併件後) | 盤點、對話 2026-10-22 |
| 方向 | A:Index(整座架子)+ Spread(拿起一件) | 前端發想 |
| 拍攝視角 | 全部俯視定裝照 | Mood board |
| 3D | 23 件全做:14 件 Meshy / 既有模型,9 件平面件本地生成 | Mood board、盤點 |
| 併件 | 003+004、005+006、021+022 各併成一件。保留較小編號,另一個記在 `aliases`。編號因此缺 004、006、022 | 對話 2026-10-22 |
| 風格 | Mode E:紙、墨、底版三個中性色,無圓角、無陰影、無 accent。顏色只活在照片裡 | 前端發想、Mood board |
| 底版 | 淺灰 `#F3F3F3`,白頁上內縮。重拍後以實際背景為準,改一個 token | Mood board |
| 字體 | JetBrains Mono 300/400。前端發想階段的 Martian Mono 已作廢 | Mood board |
| 文字 | 全站英文。標籤、標題、編號全大寫;內文句首大寫 | Mood board |
| 圖像 | 原色 | 前端發想 |
| 動效 | transform 解除。開場 900ms `expo.out`;右頁區塊淡入上升 14px、間隔 60ms、350ms 起、500ms `power3.out`;關閉同 timeline 反向 1.6 倍速。禁用彈跳、hover 浮起、hover 變色(hover 只有底線)。reduced-motion 時 timeline 直接跳到終態 | Mood board |
| 主題 | 網站在任何 color scheme 都維持紙色,不做深色反轉 | `globals.css` |
| 技術棧 | **固定**:Next.js App Router、Tailwind v4、GSAP、Lenis、Three.js;Vercel;Neon;R2。Astro 評估已放棄,骨架留在分支 `site-skeleton`(PR #2 已關) | Adam 2026-10-21 |
| 價格 | 網站不顯示價格。`found` 只放城市(與年份,若有) | 對話 2026-10-22 |
| 名稱 | 暫稱。以盤點資料庫為準,`data/objects.json` 只是初始值 | 盤點 |
| 識別更正 | 003/004 鹽巴胡椒罐組、005/006 派對哨子組、014 與 015 各兩本同系列、021/022 膝反射錘組、024 為 Husky Tower 打火機(非鑰匙圈)、020 為鞋拔 | 對話與 Edmonton artifact |
| 3D 拍攝規格 | Meshy 件:1 張俯視定裝照(網站用)加 1 到 4 張角度照(Meshy 用,第一張為正面)。平面件:正面加選用背面 | Mood board |
| Meshy 守則 | 每次非 dry-run 先查餘額;預設一次只建 1 個任務;任務 id 先寫入 `.meshy/state.json` 再輪詢 | 已建在 `scripts/meshy/` |

## 還沒決定

| # | 項目 | 目前狀態 | 影響 |
| --- | --- | --- | --- |
| 1 | **Index 的分組軸** | Mood board 寫「依出處地(加拿大、美國、德國…)」,盤點資料與網站程式用「依類型」(紙、偶與玩具、金屬、攝影、小物)。兩者矛盾 | 決定 Index 版面與 `data/objects.json` 要加的欄位 |
| 2 | Index 縮圖格數 | Mood board 是 13×2 / 7×4 / 5×6,按 26 件算。現在 23 件,桌面版最後一排空 3 格 | 版面收尾 |
| 3 | Landing 主角是哪一件 | 程式暫定 012(Kodak 盒),Mood board 也只是暫代 | `FEATURED_ID` |
| 4 | 模型交付與規格 | 檢視器假設:`public/models/<id>.glb`、公尺、Y 軸朝上、原點在底面中心、正面朝 +Z、Draco。`HANDOFF.md` 的規格(面數 ≤ 3 萬、貼圖 1024 WebP)**是提案,Adam 沒確認**。交付路徑(R2 `incoming/` 或其他)也沒定。照片改由 Adam 另一條 pipeline 產 | 檢視器、R2 變數 |
| 5 | 14 件 `model` 的 SAAS 狀態 | 全部是 `?`,沒有任何一件標 HAVE / NEED | Meshy 點數(最多 420,餘額 774) |
| 6 | 02 計時器、07 青蛙組的識別 | 仍是我標的「疑為」 | `group`、`method` |
| 7 | 024 的 `group` | 現為 `S` 徽章小物,但它是打火機 | 分組 |
| 8 | 014、015 兩本怎麼拍 | 同一張 still,還是各拍一張 | 平面件規格 |
| 9 | 9 件平面件實際尺寸 | 全部假設長邊 200 mm | 平面件模型比例 |
| 10 | 出處與年份 | 只有 7 件有出處(Edmonton),全部沒有年份。其餘 16 件的城市(Edmonton / Toronto)未知 | `found` |
| 11 | 故事 | 只有 7 件有草稿,另有 012 的語氣樣本。其餘無。右頁「Related story」小標內容也沒有 | `content/stories/` |
| 12 | Landing 到 Spread 的 GSAP 轉場 | 規格已定(見上表動效),**尚未實作** | 動效 |
| 13 | Vercel 部署 | 尚未匯入專案,未驗證實際部署 | 上線 |
| 14 | Neon 資料庫 | 目前沒有用到 | 之後的 yard sale |
| 15 | Yard sale / Square | 只預留 `listing` 欄位,未設計、未渲染。接 Square 前 Vercel 要升 Pro(Hobby 限非商業) | 變現 |
| 16 | Meshy 與平面件腳本的角色 | 照片 pipeline 改由 Adam 另一條產出後,這兩組腳本是否保留為選用工具未定 | repo 結構 |
| 17 | 行動裝置的 3D 手勢 | 檢視器的 canvas 設 `touch-action: none`,手指放在底版上會拖曳旋轉而不是捲頁。目前只在底版範圍內,捲頁可從其他區域進行 | 行動版體驗,待真機驗證 |
| 18 | 無障礙量測 | 內文 12px、字重 300。**沒有跑過 APCA**,只確認了 focus 可見與 reduced-motion | 無障礙硬指標,可否決審美 |
