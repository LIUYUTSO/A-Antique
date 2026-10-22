# Blender:清理、手工補細節、做成可開合

Meshy 出來的 GLB 先自動清理,需要補內部印刷或可開合零件時再進 Blender 手工做,最後壓縮檢查才上傳。

```
out/models/<id>.glb     Meshy 或平面件的原始輸出(不改它)
   │  npm run blender -- clean <id>
out/clean/<id>.glb      焊接、去雜點、減面、真實尺寸、原點在底面中心   + <id>.report.json
   │  npm run blender -- work <id>
work/<id>.blend         在 Blender 開啟,手工補細節(可略過)
   │  npm run blender -- open <id> --part lid --hinge back-top
out/final/<id>.glb      手工完成,含 <part>.open / <part>.close 動畫(可略過)
   │  npm run finish -- <id> [--upload]
out/publish/<id>.glb    壓縮並通過預算檢查  + <id>.report.json  →  R2
```

沒有手工補細節的物件,從 `clean` 直接到 `finish`。`finish` 會自動挑最完成的階段(final、clean、models)。

## Blender 怎麼找

依序:環境變數 `BLENDER_BIN`、macOS 的 `/Applications/Blender.app/Contents/MacOS/Blender`、PATH 上的 `blender`。腳本不需要開視窗(`-b`)。

## 1. clean:自動清理

```bash
npm run blender -- clean 012 [--target-faces 30000] [--dry-run]
```

- 焊接距離 0.1 mm 內的頂點、移除退化面、刪掉沒連到面的點。
- **刪掉飄浮的小碎片**:比最大那塊小於 1% 面數的獨立部分(AI 模型常有)。
- 重算法線朝外。
- 面數超過 3 萬就用 Decimate 減到目標,貼圖與 UV 不動。
- **尺寸**:`data/objects.json` 的 `sizeMm` 第二個數字是實際高度(mm),有填就縮放成真實大小;沒填會在報告裡警告,維持 Meshy 原尺寸。
- 單位公尺、Y 軸朝上、原點在底面中心,所有變換都已套用到頂點。
- 報告 `out/clean/<id>.report.json` 記面數前後、焊接與刪除數量、最終尺寸、貼圖。

## 2. work:手工補細節

```bash
npm run blender -- work 012      # 產生 work/012.blend,然後用 Blender 開它
```

常見的兩件事:

**盒內印刷**(舊物盒子的內側圖案)
1. 在編輯模式選取內側的面,新增材質 `inside`。
2. 展 UV(Smart UV Project 或逐面投影),貼上 `shoot/<id>/extra/` 裡拍的內側照片。
3. 存檔。內側貼圖之後會跟著一起轉成 1024 的 WebP。

**可開合零件**(盒蓋、翻蓋)
1. 在編輯模式選取蓋子的面,`P` → 依選取分離,把新物件**命名為英文小寫**,例如 `lid`。
2. 補蓋子與盒身的內部厚度、內面。Meshy 從外觀照片建模,盒子內部通常沒有結構,要自己補。
3. 存檔,不用自己設樞軸或動畫,下一步會做。

這些手工步驟也可以透過你的 Blender MCP,在你 Mac 上的 Claude 工作階段裡做。**這個雲端工作階段看不到 Blender MCP**(ToolSearch 與資源清單裡都沒有 Blender 工具),所以我無法替你確認它有沒有連通;確認方式在下方。

## 3. open:做出開合動畫並輸出

```bash
npm run blender -- open 012 --part lid --hinge back-top [--angle 110]
```

- `--hinge` 是 `<邊>-<top|bottom>`,從物件正面看:`back-top`(一般盒蓋)、`front-bottom`(往下掀的翻蓋)、`left-top`、`right-top`(側邊鉸鏈)。
- 腳本把零件的原點移到鉸鏈邊,轉動方向**自動選成遠離物件其他部分的那一邊**,不用自己算正負號。
- 匯出兩段動畫 `lid.open`、`lid.close`(`<part>.open`、`<part>.close`),網站的檢視器用名字找。`finish` 會檢查它們成對。
- 輸出 `out/final/<id>.glb`。

## 4. finish:壓縮與檢查

```bash
npm run finish -- 012 [--stage clean] [--max-mb 3] [--max-triangles 30000] [--upload] [--dry-run]
```

1. `gltf-transform optimize`:貼圖縮到 1024 並轉 WebP、Draco 壓縮幾何。**不做** simplify、join、flatten、instance、palette:join 與 flatten 會弄壞有動畫的零件,palette 會合併材質。
2. 對成品跑 `gltf-transform validate`。
3. 檢查預算:**檔案 ≤ 3 MB、三角面 ≤ 3 萬、貼圖 ≤ 1024 px、動畫成對**。超過就報 `PROBLEM`、結束碼 1、**不上傳**。
4. `--upload` 才傳 R2 的 `models/<id>.glb`。
5. 報告 `out/publish/<id>.report.json`:前後的大小、面數、貼圖、動畫、使用的擴充。

## 測試與實測紀錄

- `blender/tests/test_blender.py` 用 Blender 的 Python 模組(`pip install bpy`,Blender 5.2)跑:焊接、去碎片、減面到目標、真實尺寸、原點、貼圖保留、三種鉸鏈的轉向、錯誤輸入。成品用 gltf-transform 讀回來檢查,不信任 Blender 自己的說法。
- 另外跑過一次完整演練:8.9 MB、8 萬三角面、2048 px 貼圖的模型,清理後 3 萬面,`finish` 後 0.58 MB,貼圖 1024 WebP;帶 `lid.open`/`lid.close` 的盒子經過壓縮後兩段動畫都還在。
- **沒驗證的**:實際在 Blender 桌面版裡跑過(版本差異,我只測了 5.2);Meshy 真實輸出的清理效果(還沒有真實模型);網站檢視器播放 `<part>.open`(檢視器還沒做)。

## 確認 Blender MCP 有沒有通

在你 Mac 上的 Claude 工作階段(不是這個雲端的)請它列出 Blender 場景物件或執行 `bpy.data.objects.keys()`,有回應就是通了。通了之後,「補盒內印刷」與「分離盒蓋」可以在那個工作階段互動做,做完存 `work/<id>.blend`,再跑 `open` 與 `finish`。
