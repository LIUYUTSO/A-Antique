# shoot — iPhone 當固定攝影機

在 Mac 上把 iPhone(Continuity Camera)當成固定不動的相機,依拍攝清單逐角度拍照,檔案直接放進 Meshy pipeline 讀的位置。

## 先備

- Mac:macOS 14 以上,Xcode 或 Command Line Tools(Swift 5.9 以上)。
- iPhone:iOS 17 以上,與 Mac 登入同一個 Apple ID,兩邊都開 Wi-Fi 與藍牙。iPhone 固定在腳架上,鏡頭對著物件。
- 第一次執行時 macOS 會問相機權限。**授權給你用的終端機**(系統設定 → 隱私權與安全性 → 相機)。

## 用法

在 repo 根目錄執行:

```bash
swift run --package-path capture -c release shoot 012
swift run --package-path capture -c release shoot --list-cameras
```

| 參數 | 說明 |
| --- | --- |
| `<id>` | 物件編號,必須在 `data/objects.json`。併成一組的編號(例如 004 屬於 003)會被擋下並告訴你用哪個 |
| `--out` | 輸出資料夾,預設 `shoot` |
| `--catalog` | 物件清單,預設 `data/objects.json` |
| `--plan` | 自訂拍攝清單(JSON),見下 |
| `--delay N` | 按鍵後等 N 秒再拍(0 到 30),讓手離開畫面 |
| `--camera 名稱` | 指定相機,名稱包含此字串即可,例如 `--camera iPhone` |

## 按鍵

| 鍵 | 動作 |
| --- | --- |
| Space | 拍當前角度,存檔後跳到下一個還沒拍的角度 |
| R | 重拍當前角度(不前進) |
| ← → | 在角度之間移動 |
| D | 拍一張細節照,放 `extra/`(盒內印刷、標籤、鉸鏈) |
| L | 鎖定對焦、曝光、白平衡(再按一次解除)。**拍第一張前先鎖** |
| G | 顯示或隱藏取景輔助框(畫面中央一半,物件大約填滿這個範圍) |
| Q / Esc | 離開 |

## 拍什麼、放哪裡

預設清單(`ShotPlan.standard`):

```
shoot/<id>/views/1-front.jpg   正面,Meshy 的主視角
shoot/<id>/views/2-left.jpg
shoot/<id>/views/3-back.jpg
shoot/<id>/views/4-top.jpg
shoot/<id>/still.jpg           網站用的俯視定裝照
shoot/<id>/extra/001.jpg ...   細節照,不送 Meshy
shoot/<id>/capture.json        相機、鎖定狀態、解析度、拍攝時間
```

- **Meshy 的 multi-image-to-3d 接受 1 到 4 張**(官方文件),第一張是正面主視角,其餘順序不拘。所以 `views/` 最多 4 張,程式會拒絕超過 4 個 views 的拍攝清單。
- 想多拍的角度、細節一律放 `extra/`,拿來在 Blender 補貼圖,不會浪費 Meshy 點數。
- `views/` 的檔名就是 pipeline 的順序(`1-`、`2-`⋯),所以命名只在 `OutputLayout` 定義一處。
- 重跑同一個編號會接續:已存在的角度視為拍過,從第一個沒拍的開始。

自訂拍攝清單(`--plan plan.json`)是一個陣列:

```json
[
  { "key": "front", "label": "Front", "hint": "Straight on", "destination": "views" },
  { "key": "left-45", "label": "Left 45°", "hint": "", "destination": "views" },
  { "key": "still", "label": "Still", "hint": "Top-down", "destination": "still" },
  { "key": "lid-inside", "label": "Inside the lid", "hint": "", "destination": "extra" }
]
```

`key` 只能是小寫英數與連字號;`destination` 是 `views`、`still` 或 `extra`。

## 拍攝要點

- **光線與背景固定**:同一盞光、同一塊淺灰背景(#F3F3F3),每個角度只轉物件、不動相機與燈。
- **先鎖再拍**:按 L,否則轉動物件時自動曝光會讓每張亮度不同,Meshy 建出來的貼圖會有色塊。`capture.json` 會記每張拍攝時有沒有鎖住。
- 物件佔畫面約一半,四邊留白;反光物(銀壺、琺瑯碗)用柔光或偏光,避免亮點被當成材質。
- 預覽不鏡像,印刷文字讀起來是正的。

## 驗證狀態

- `CaptureCore`(拍攝清單、檔名、物件清單、manifest、進度狀態)有 20 項單元測試,在 Linux 與 macOS 都能跑:`swift test`。
- `shoot` 的相機與視窗部分(`Sources/shoot/App.swift`)**已在 GitHub 的 macOS runner 上編譯通過**(`swift build` 與 `swift test`),所以 AVFoundation、AppKit 的 API 用法沒有錯。**但沒有實際跑過**:CI 上沒有相機。第一次請接上 iPhone 實測:能否列出相機、預覽是否出現、Space 是否存檔、L 是否真的鎖住(狀態列會顯示哪些項目鎖住了;有些相機不支援鎖定,會維持自動)。

## 程式結構

```
Sources/CaptureCore/   純 Foundation:ShotPlan、OutputLayout、ObjectCatalog、CaptureManifest、SessionState
Sources/shoot/         main.swift、Config.swift(參數與檢查)、App.swift(僅 macOS:相機、視窗、按鍵)
Tests/CaptureCoreTests/
```
