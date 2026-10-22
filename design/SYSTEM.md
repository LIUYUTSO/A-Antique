# A-Antique design system

Mode E。這個網站是一本書:紙、墨、底版三個中性色,一種等寬字,沒有圓角、陰影和 accent。顏色只活在照片裡。決定的出處見 `../DECISIONS.md`;這份只描述「怎麼用」。程式裡的 token 在 `src/app/globals.css`。

## 原則

1. **一種外觀,不隨主題反轉。** 網站在任何 color scheme 都是紙色。
2. **介面沒有顏色。** 物件原色只出現在照片和模型裡,所以每頁的色彩由那一件物件決定。
3. **階層靠位置與字重,不靠大小或顏色。** 只用 300 與 400 兩種字重。
4. **動效只做一件事:讓東西從 A 到 B。** 不彈跳、不浮起、不變色。

## Tokens

| Token | 值 | 用途 |
| --- | --- | --- |
| `paper` | `oklch(1 0 0)` | 頁面底 |
| `plate` | `oklch(0.965 0 0)`(約 `#F3F3F3`) | 物件底版、Index 縮圖底 |
| `ink` | `oklch(0 0 0)` | 文字、分隔線、focus 外框、hover 反白底 |
| `font-mono` | JetBrains Mono,300 / 400,含 italic | 全站唯一字體 |

底版是從參考書目測的,重拍後以實際背景為準,改 `plate` 一個 token 即可。

## 字型階層

| 角色 | 規格 | 大小寫 |
| --- | --- | --- |
| 基底 | 12px / 行高 1.7 / 字距 0.08em / 字重 300 | 全大寫 |
| 編號(右頁右上) | `text-xl`、400、行高 1 | 全大寫 |
| 標題 | `text-base`、400、行高 snug | 全大寫 |
| 標籤(Item: Brand: …) | 同基底、italic | 全大寫 |
| 內文段落 | 同基底、300、字距 0.03em、行高 1.75 | **句首大寫**,全站唯一不是全大寫的文字 |
| 圖說、頁碼 | 11px | 全大寫 |
| 說明小字 | 11px、italic | 全大寫 |

## 版面

- **Spread:** 兩欄(桌面)。中縫是 1px 的 `ink` 線。左頁是物件,右頁是文字。頁面內距 24px,桌面 40px。
- **左頁:** 白頁上內縮一塊 `plate`,物件置中,圖說在底版外下方。
- **右頁由上而下:** 返回連結、編號、標題、故事、Item / Printed / Dimensions / Found、上一件與下一件。沒有 Group 列,網站不顯示分組。頁碼在外側下角(左頁偶數、右頁奇數)。
- **Index:** 一件一格,依編號排成**單列,橫向移動**,不分組。tile 寬 `min(38vw, 200px)`。滑鼠滾輪在列上轉成橫向捲動,到頭才放行給頁面。
- **Landing:** 一個物件放在一塊 `plate` 上,四個標籤,別無他物。

## 元件

| 元件 | 檔案 | 說明 |
| --- | --- | --- |
| Spread | `src/app/objects/[id]/page.tsx` | 書頁。伺服器端渲染,build 時預先生成 |
| SpreadPlate | `src/components/SpreadPlate.tsx` | 左頁底版。`[3D]` / `[Still]` 切換。有模型才出現按鈕 |
| ModelViewer | `src/components/ModelViewer.tsx` | Three.js 檢視器,按需載入。透明背景,讓 `plate` 透出來 |
| Entrance | `src/components/Entrance.tsx` | 右頁區塊淡入上升 |
| SmoothScroll | `src/components/SmoothScroll.tsx` | Lenis 接 GSAP ticker |
| Index tile | `src/app/shelf/page.tsx` | 方格,左上角編號,hover 反白 |
| ShelfRow | `src/components/ShelfRow.tsx` | Index 的橫向列。滾輪轉橫向,`data-lenis-prevent` 讓 Lenis 不介入 |

## 狀態

| 狀態 | 規則 |
| --- | --- |
| hover | 文字連結只加底線。Index 縮圖反白(`ink` 底、`paper` 字)。不浮起、不變色 |
| focus | `outline: 2px solid ink`,offset 0。永遠可見 |
| 無照片 | `plate` 上顯示 `No photo yet`,透明度 0.6 |
| 無模型 | 不出現 `[3D]` 按鈕,不報錯 |
| 模型載入中 / 失敗 | 底版中央顯示 `Loading model` / `Model failed to load` |
| 草稿故事 | 內文後加 `[Draft]` |

## 動效

| 動作 | 規格 |
| --- | --- |
| 開啟(Landing 到 Spread) | 底版縮進左頁、物件移到中心並縮小。900ms,`expo.out` |
| 中縫 | 從頂邊畫下來,同 900ms |
| 右頁區塊 | 淡入並上升 14px,間隔 60ms,350ms 起,500ms `power3.out` |
| 關閉 | 同 timeline 反向,1.6 倍速 |
| 禁止 | 彈跳、elastic、hover 浮起、hover 變色 |
| reduced-motion | 全部跳到終態,不位移。目前由 CSS 把 duration 壓到 0.01ms,Entrance 直接略過 |

**實作狀態:** 右頁區塊淡入已完成。開啟的 Landing 到 Spread 轉場**尚未實作**。

## 3D 檢視器

- **模型規格(檢視器的假設):** `public/models/<id>.glb`,單位公尺,Y 軸朝上,正面朝 +Z,可含 Draco。原點由 Adam 在 Blender 設定;檢視器本身以包圍盒置中,所以不依賴原點。正式模型放 R2,檔案可含多個物件組成的場景。
- **鏡頭:** 所有物件共用一組。模型縮放到最長邊為 1,鏡頭從正面略高處看,距離 2.1,可縮放範圍 1.05 到 4.2。
- **互動:** 拖曳旋轉、滾輪縮放、方向鍵旋轉。無平移、無自動旋轉。觸控:橫向拖曳旋轉,縱向拖曳仍可捲頁(`touch-action: pan-y`)。
- **光:** 中性的 RoomEnvironment,不加方向光,避免每件物件的陰影方向不同。
- **效能:** 只在動的時候渲染。靜止的場景不花 GPU。
- **載入:** 按下 `[3D]` 才載入 three.js 與模型。Still 是第一個畫面。
- **無障礙:** canvas 可 focus、有 `aria-label`,說明操作方式。

## 無障礙底線

硬指標可以否決審美:

- focus 可見(已做)。
- reduced-motion(已做)。
- 對比與 APCA:Adam 決定不量測。內文是 12px、字重 300 的黑字白底,**沒有量過,不宣稱通過**。
