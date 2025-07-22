# FBX to VRMA Converter UI

WebUIを使ってFBXアニメーションファイルをVRMA形式に簡単に変換できるツールです。

## 機能

- ドラッグ&ドロップによるFBXファイルアップロード
- フレームレート設定
- ワンクリック変換
- VRMAファイルの自動ダウンロード

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. FBX2glTFバイナリのセットアップ
```bash
./setup.sh
```

## 開発環境での実行

```bash
npm start
```

ブラウザで `http://localhost:3000` にアクセス

## Renderでのデプロイ

1. GitHubにリポジトリをプッシュ
2. [Render](https://render.com)にサインアップ
3. 「New Web Service」を選択
4. リポジトリを連携
5. 自動的に`render.yaml`の設定が読み込まれる
6. 「Deploy」をクリック

## 注意事項

- 作成されるVRMAファイルはVRoid Studioで再生できません
- Three.js VRMでの使用を前提としています
- 最大ファイルサイズ: 100MB

## ライセンス

MIT