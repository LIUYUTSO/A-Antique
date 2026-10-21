# A-Antique

Edmonton + Toronto 挖到的 26 件舊物,做成「像展示架」的網頁:Landing 是單件物品的海報,點開成左頁(物件)右頁(故事)的書頁,另有一頁縮圖總覽(Index)。

- 設計:`design/moodboard.html`(mood board,Rev. 3)
- 物件清單:`data/objects.json`(名稱為暫稱)
- 3D:`scripts/meshy/`(Meshy multi-image-to-3d pipeline)

## 3D pipeline

每件物件從照片到 GLB:

```
shoot/<id>/views/*.jpg  →  Meshy multi-image-to-3d  →  out/models/<id>.glb  →  (--compress)  →  (--upload) R2
```

### 拍攝規則

`data/objects.json` 的 `method` 決定走哪條路:`meshy` 17 件、`flat` 9 件(見下方)。

**Meshy 件**每件拍 4 張,放在 `shoot/<id>/views/`,檔名排序決定順序:

```
1-front.jpg   正面,Meshy 的主視角
2-left.jpg
3-back.jpg
4-top.jpg
```

網站用的俯視定裝照另存 `shoot/<id>/still.jpg`,不會送 Meshy。

**平面件**(紙品、書冊、卡片、圓盤):只要 `shoot/<id>/still.jpg`(正面,貼齊物件裁切),選用 `shoot/<id>/back.jpg`。圓盤的正面請裁成正方形。只有 1 到 4 張同一物件的不同角度才吃得進去,單張俯視會得到很差的模型。`shoot/` 不進 git。

### 指令

```bash
cp .env.example .env          # 填 MESHY_API_KEY
npm install                   # 只有 --upload 需要 @aws-sdk/client-s3

npm run meshy -- 012 --dry-run            # 看計畫與 payload,不送出
npm run meshy -- 012                      # 單件試跑(預設每次只建 1 個新任務)
npm run meshy -- all --limit 5            # 最多建 5 個新任務
npm run meshy -- all --limit all --concurrency 5 --compress --upload
```

| Flag | 說明 |
| --- | --- |
| `--dry-run` | 只印計畫與 payload |
| `--limit N\|all` | 本次最多建立幾個新任務,預設 1 |
| `--concurrency N` | 同時輪詢幾件,1 到 10,預設 3 |
| `--force` | 已完成或進行中的物件也重建(會再扣點數) |
| `--model` | 預設 `meshy-7.1` |
| `--compress` | `gltf-transform optimize`:1024px WebP + Draco(與 A-Stuff 相同配方) |
| `--upload` | 傳 R2:`models/<id>.glb`、`thumbnails/<id>.png`(環境變數同 A-Stuff) |

### 成本與限制

- 帶貼圖的任務 30 點(`meshy-7.1` / `meshy-6`),只要網格 20 點。17 件走 Meshy = 510 點,帳戶剩 774 點,餘裕 264 點。失敗的任務退點。
- 每次非 dry-run 都會先查餘額(`GET /openapi/v1/balance`),不夠就不送出。
- Pro 方案同時最多 10 個 PENDING / IN_PROGRESS 任務,與 Meshy 網頁版共用。遇到 429 會等待後重試。
- 任務 id 會在輪詢前寫入 `.meshy/state.json`。中斷後重跑會接續同一個任務,不會重複扣點。
- Meshy 的下載網址會過期,完成後立即下載到 `out/`。

### 平面件

```bash
npm run flat -- 017          # 單件
npm run flat -- all          # 全部 flat,缺照片的會跳過
```

用 `@gltf-transform/core` 直接生成薄板 GLB:正面貼定裝照,背面貼 `back.jpg`(沒有就用紙色),側邊用紙色。`kind` 決定預設厚度(sheet 0.4、card 1.2、booklet 3、disc 1.5 mm),`sizeMm` 填 `[寬, 高]` 毫米。沒量過就先假設長邊 200 mm 並提示。不用 Meshy,不花點數。支援 `--compress`、`--upload`。

### 狀態

- `npm test`:15 項。Meshy 部分用本機 mock server 驗證建立、輪詢、下載、接續、失敗重建、429 重試、多件並行、flat 不送 Meshy、餘額不足拒絕;flat 部分驗證尺寸、材質、圓盤、讀寫來回,產出的 GLB 通過 glTF validator。
- 尚未用真實 API key 跑過。第一次請先用 `--dry-run`,再單件試跑 012,確認成品後再放大。
