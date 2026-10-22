# Decisions

單一來源:哪些已鎖定、哪些還沒決定。來源是三份 artifact(前端發想、Mood board Rev. 4、盤點清單)、`HANDOFF.md`、決定表 artifact 與 Adam 在對話中的裁決。改決定時改這份,不要在別處另寫一份。

## 已鎖定

| 項目 | 決定 | 來源 |
| --- | --- | --- |
| 範圍 | Edmonton + Toronto 挖到的舊物,做成「像展示架」的網頁。**23 件**(原 26 件,三組併件後) | 盤點、對話 2026-10-22 |
| 方向 | A:Index(整座架子)+ Spread(拿起一件) | 前端發想 |
| 拍攝視角 | 全部俯視定裝照 | Mood board |
| 3D | 23 件全做。照片與模型改由 Adam 另一條 pipeline 產出 | 決定表 2026-10-22 |
| 併件 | 003+004、005+006、021+022 各併成一件。保留較小編號,另一個記在 `aliases`。編號因此缺 004、006、022 | 對話 2026-10-22 |
| **Index 版面** | **不分組,依編號排成單列,橫向移動。** 取代 Mood board 的 13×2 縮圖總覽與「依出處地分組」 | 決定表 #1、#2 |
| **分組** | 網站不顯示分組。Spread 沒有 Group 列。資料裡的 `group` 欄位保留,但不用於版面 | 決定表 #1、#7 |
| **Landing 主角** | 暫定 012(Kodak 盒),「目前先 012」,之後再決定 | 決定表 #3 |
| **模型** | 正式模型放 R2。原點由 Adam 在 Blender 設定。規格假設:公尺、Y 軸朝上、正面朝 +Z、可含 Draco | 決定表 #4 |
| **平面件的兩本書** | 014、015 的每本書各自建模,整合到一個場景,仍是一頁一件 | 決定表 #8 |
| **尺寸** | 由 Adam 的 pipeline 以畫面中放置的尺為標準。不再用「假設長邊 200 mm」 | 決定表 #9 |
| **Found** | 只顯示城市,不顯示年份 | 決定表 #10 |
| **故事** | Adam 給事實,Claude 起草,Adam 改 | 決定表 #11 |
| **轉場** | Landing → Spread 已實作(Adam 2026-10-22 決定開始做,原定等真實照片)。規格不變:900ms `expo.out`。**Spread → Landing 的反向尚未做**。參數之後在 Artifacts 畫布細調 | 決定表 #12、對話 2026-10-22 |
| **Vercel** | 已匯入,專案 `a-antique`,推 `main` 自動部署。線上版 https://a-antique.vercel.app 已驗證(2026-10-22):頁面 200、Index 單列、無 Group 列、無價格、Draco 解碼器可取得。**未驗證**:真實瀏覽器的動效與 3D,因為還沒有任何模型檔 | 決定表 #13 |
| **Neon** | 要接。Adam 的本機有 Vercel 權限,由他那邊執行 | 決定表 #14 |
| **Yard sale / Square** | 先不做。`listing` 欄位維持預留 | 決定表 #15 |
| **Meshy 與平面件腳本** | 留在原位不動。**專案尾聲要決定是否清理**(提醒項) | 決定表 #16 |
| **3D 觸控** | 橫向拖曳旋轉,縱向拖曳仍可捲頁 | 決定表 #17 |
| **無障礙量測** | Adam 決定不量 APCA。focus 可見與 reduced-motion 已做,維持不動 | 決定表 #18 |
| **識別** | 002 是 X 光計時器(對話中討論過) | 決定表 #6 |
| 風格 | Mode E:紙、墨、底版三個中性色,無圓角、無陰影、無 accent。顏色只活在照片裡 | 前端發想、Mood board |
| 底版 | 淺灰 `#F3F3F3`,白頁上內縮。重拍後以實際背景為準,改一個 token | Mood board |
| 字體 | JetBrains Mono 300/400。前端發想階段的 Martian Mono 已作廢 | Mood board |
| 文字 | 全站英文。標籤、標題、編號全大寫;內文句首大寫 | Mood board |
| 圖像 | 原色 | 前端發想 |
| 動效 | transform 解除。開場 900ms `expo.out`;右頁區塊淡入上升 14px、間隔 60ms、350ms 起、500ms `power3.out`;關閉同 timeline 反向 1.6 倍速。禁用彈跳、hover 浮起、hover 變色(hover 只有底線)。reduced-motion 時 timeline 直接跳到終態 | Mood board |
| 主題 | 網站在任何 color scheme 都維持紙色,不做深色反轉 | `globals.css` |
| 技術棧 | **固定**:Next.js App Router、Tailwind v4、GSAP、Lenis、Three.js;Vercel;Neon;R2。Astro 評估已放棄,骨架留在分支 `site-skeleton`(PR #2 已關) | Adam 2026-10-21 |
| 價格 | 網站不顯示價格 | 對話 2026-10-22 |
| 名稱 | 暫稱。以盤點資料庫為準,`data/objects.json` 只是初始值 | 盤點 |
| 識別更正 | 003/004(彩繪木偶)與 07(陶瓷青蛙跟鼓)是**兩組不同的鹽巴胡椒罐**、005/006 派對哨子組、014 與 015 各兩本同系列、021/022 膝反射錘組、024 為 Husky Tower 打火機、020 為鞋拔、002 為 X 光計時器 | 對話、決定表與 Edmonton artifact |

## 還沒決定

| # | 項目 | 目前狀態 |
| --- | --- | --- |
| 1 | 14 件 `model` 的 SaaS 狀態 | Adam 說「先忽略,我會持續更新」。維持 `?` |
| 2 | `method`(meshy / flat)與 Meshy 點數是否還有意義 | 照片與模型改由 Adam 的 pipeline 產出,而「兩本書各自建模整合到一個場景」說明模型已不限於單張貼片。`method` 欄位、flat 類型、420 點的算法都可能作廢 |
| 3 | 尺寸怎麼回到資料裡 | Adam 的 pipeline 會用尺當標準,但輸出格式與交付方式未定。`sizeMm` 現在是 `[寬, 高]`,對多件或立體物件不夠 |
| 4 | 其餘 16 件的城市 | 7 件有城市(Edmonton),其餘沒有出處。Claude 不猜 |
| 5 | 故事的事實 | 7 件有依 Edmonton 文件寫的草稿。其餘 16 件等 Adam 給事實。右頁「Related story」小標內容也沒有 |
| 6 | Neon 要存什麼 | 已決定要接,但目前沒有任何功能用到資料庫。接了之後的資料模型沒定 |
| 7 | 單列 Index 在頁面上的垂直位置 | 現在貼在頁面上方,下方留白。要不要置中或加大 tile 沒決定 |
| 8 | 專案尾聲清理 | Meshy 與平面件腳本要不要刪,等專案尾聲(提醒項) |
| 9 | Spread → Landing 的反向轉場 | 規格已定(同一條 timeline 反向 1.6 倍速)。Landing → Spread 已做,反向尚未做 |
