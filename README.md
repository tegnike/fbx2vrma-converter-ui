# FBX2VRMA Converter UI

MixamoのFBXアニメーションをVRMA形式に変換するWebアプリケーションです。

## 特徴

- 📁 ドラッグ&ドロップでFBXファイルをアップロード
- ⚡ ワンクリックでVRMA形式に変換
- 🎛️ フレームレート調整機能
- 🌐 Webブラウザから簡単アクセス
- ☁️ Render.comでのデプロイ対応

## ⚠️ 注意事項

作成されるVRMAファイルは**VRoid Studioでは再生できません**。[Three.js VRM](https://github.com/pixiv/three-vrm)での使用を前提としています。

## ローカル開発

### 前提条件

- Node.js 16以上
- npm

### セットアップ

```bash
# リポジトリをクローン
git clone <your-repo-url>
cd fbx2vrma-converter-ui

# 依存関係をインストールしてセットアップ
chmod +x setup.sh
./setup.sh

# サーバーを起動
npm start
```

ブラウザで `http://localhost:3000` にアクセスしてください。

## Render.comへのデプロイ

1. [Render.com](https://render.com)にログイン
2. 「New Web Service」を選択
3. GitHubリポジトリを接続
4. 以下の設定を使用:
   - **Build Command**: `npm install && curl -L -o FBX2glTF-linux-x64 https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-linux-x64 && chmod +x FBX2glTF-linux-x64`
   - **Start Command**: `npm start`
   - **Environment**: Node

または、含まれている `render.yaml` ファイルを使用してInfrastructure as Codeでデプロイできます。

## API エンドポイント

### POST /convert
FBXファイルをVRMAに変換します。

**パラメータ:**
- `fbxFile`: FBXファイル (multipart/form-data)
- `framerate`: フレームレート (デフォルト: 30)

**レスポンス:**
```json
{
  "success": true,
  "downloadUrl": "/download/filename.vrma",
  "filename": "animation.vrma"
}
```

### GET /download/:filename
変換されたVRMAファイルをダウンロードします。

### GET /debug
システム情報とバイナリの状態を確認します。

## 技術スタック

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **File Upload**: Multer
- **Binary**: FBX2glTF (Meta)
- **Deployment**: Render.com

## ディレクトリ構造

```
fbx2vrma-converter-ui/
├── public/
│   └── index.html          # フロントエンドUI
├── uploads/                # アップロードされたFBXファイル (一時)
├── output/                 # 変換されたVRMAファイル (一時)
├── server.js               # メインサーバーアプリ
├── package.json            # Node.js依存関係
├── render.yaml             # Renderデプロイ設定
├── setup.sh                # セットアップスクリプト
└── README.md               # このファイル
```

## ライセンス

MIT License

## 関連リンク

- [FBX2glTF](https://github.com/facebookincubator/FBX2glTF)
- [VRM Specification](https://vrm.dev/)
- [Three.js VRM](https://github.com/pixiv/three-vrm)
- [Mixamo](https://www.mixamo.com/)