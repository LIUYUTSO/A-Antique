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

每件拍 4 張,放在 `shoot/<id>/views/`,檔名排序決定順序:

```
1-front.jpg   正面,Meshy 的主視角
2-left.jpg
3-back.jpg
4-top.jpg
```

網站用的俯視定裝照另存 `shoot/<id>/still.jpg`,不會送 Meshy。只有 1 到 4 張同一物件的不同角度才吃得進去,單張俯視會得到很差的模型。`shoot/` 不進 git。

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

- 帶貼圖的任務 30 點(`meshy-7.1` / `meshy-6`),只要網格 20 點。26 件 = 780 點。失敗的任務退點。
- Pro 方案同時最多 10 個 PENDING / IN_PROGRESS 任務,與 Meshy 網頁版共用。遇到 429 會等待後重試。
- 任務 id 會在輪詢前寫入 `.meshy/state.json`。中斷後重跑會接續同一個任務,不會重複扣點。
- Meshy 的下載網址會過期,完成後立即下載到 `out/`。

### 狀態

- `npm test`:7 項,用本機 mock server 驗證建立、輪詢、下載、接續、失敗重建、429 重試、多件並行。
- 尚未用真實 API key 跑過。第一次請先用 `--dry-run`,再單件試跑 012,確認成品後再放大。
- 平面紙品(樂譜、優惠券、照片、廣告頁)會得到很薄的板狀模型,是否值得做 3D 待你決定。
