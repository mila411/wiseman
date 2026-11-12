# WISEMAN 引き継ぎ

## 保存基準

- リポジトリは [mila411/wiseman](https://github.com/mila411/wiseman)。作業ブランチは `production/research-session-001`、最新コミットは [4e82810](https://github.com/mila411/wiseman/commit/4e8281002121f3645408735042db851b6e03d0c5)（Use Entra ID for Foundry speech generation）。
- ローカル HEAD、追跡ブランチ、GitHub [ドラフト PR #6](https://github.com/mila411/wiseman/pull/6) の先端が一致。PR #6 のベースは `phase-1.1-ui-refinement`（PR #5 のブランチ）。
- 追跡中の25ファイルで HEAD・インデックス・作業コピーの内容の差分は検出されなかった。通常の `git status` は実行環境の権限エラーで確認できなかったため、インデックス比較、Git のファイルハッシュ、対象外ディレクトリを除いたファイル一覧で照合した。無視対象外の未追跡ファイルは見つからなかった。
- 正常動作のソース基準は上記コミット。ローカル生成物の基準は下記のファイルと SHA-256。本編を再現するには、Git から取得したソースに加えてローカルの素材が必要。

## 実装と依存関係

| ファイル | 役割 |
| --- | --- |
| `docs/SCRIPT_SESSION_001.md` | 正式脚本 ACT I〜VII の原文 |
| `docs/SESSION_001_FACT_CHECK.md` | Apple 公表内容との照合と未確認事項 |
| `src/main.tsx`、`src/style.css` | React の会議画面、素材の取り込み、再生操作、本編表示 |
| `src/timeline.ts`、`src/scenario.json`、`src/import-scenario.ts` | 時刻別の状態計算、起動時の30秒デモ、取り込むシナリオの検証 |
| `src/session-frame.ts`、`src/scenario-audio.ts`、`src/waveform.ts`、`src/audio.ts` | 画面フレーム、音声取り込み・再生スケジュール、実音声・演出用の波形、既存音声キューの解決 |
| `scripts/session-001.mjs` | 脚本をキューに変換し、仮尺または WAV 実測尺でシナリオを生成 |
| `scripts/foundry-tts.mjs` | Azure CLI の Entra ID トークンで Azure OpenAI TTS を呼び出す |
| `package.json`、`package-lock.json`、`tsconfig.json`、`index.html` | npm コマンド、依存の固定、TypeScript 設定、Web アプリの入口 |

- Node.js 22 以上が README の要件。今回の検証環境は Node.js 26.13.0。主な依存は React、Vite、TypeScript、Vitest。
- Foundry と Azure CLI は新規音声の生成に使用する。既存 WAV の取り込み・再生はローカルで動作する。

## ローカル素材

Windows 側の `%USERPROFILE%\repos\wiseman\production\session-001` に存在を確認した。ディレクトリ全体は `.gitignore` の対象で、GitHub に本番素材は入っていない。

| ファイル | 内容 |
| --- | --- |
| `audio-foundry/*.wav` | 本番76本。ファイル名はキューの音声アセット ID。ROOT の音声ファイルはない |
| `cues.json` | 実測済み102キューと字幕・発話時刻 |
| `scenario.json` | 514.095秒のイベント列と、発話に対応する音声アセット ID |
| `foundry-smoke.wav` | Entra ID 接続テストの3.750秒 WAV |
| `wiseman-session-001.mp4` | 本番 MP4、18,796,536 bytes |

SHA-256

```text
3ca81930798583e43d1cc68f55cf16dd09d43b9fd63f274e2f6046f39c7d98ef  scenario.json
665f35ee5d0074049870774da3c7673e461a7c0ad1432c6b0aff149c73db4bba  cues.json
93b0b8a8511534c86e543ea7c6c662b11b864361f094a7cfbf2b9e6c5bce213e  wiseman-session-001.mp4
```

別環境への引き継ぎでは、同じブランチのソースと `production/session-001` を揃える。音声アセット ID とファイル名は対応を維持する。

## 起動

Windows PowerShell でリポジトリのルートから実行する。

```powershell
npm.cmd ci
npm.cmd run dev
```

表示されたローカル URL を開くと、本編のシナリオと WAV が読み込まれる。macOS のシェルでは `npm.cmd` を `npm` に置き換える。

```powershell
npm.cmd test
npm.cmd run build
```


### 音声を変更するとき

- 声や喋り方は `scripts/foundry-tts.mjs` の話者ごとの設定。既存のバッチ処理は同名 WAV を再利用するため、変更した設定の比較は別の出力先で行う。発話尺が変わったらタイムラインを再計算する。
- 本番生成の接続手順は [README.md](../README.md)。`WISEMAN_OPENAI_ENDPOINT` と `WISEMAN_OPENAI_DEPLOYMENT` を環境で指定し、対象リソースの `Cognitive Services OpenAI User` 権限を持つ ID で Azure CLI にサインインする。短い `smoke` が成功し、料金が承認されてから `synthesize ... --approve-paid-tts` を使う。
- 引数なしの `npm run session:001` は既定の出力先に仮タイムラインを書き込む。現在の実測済み JSON を保持するには、仮生成時に別ディレクトリを指定する。

## 確認結果と残作業

- 同じソース・設定を確認した作業用コピーでテスト15件とビルドが成功。実測素材は WAV 76本と字幕102キューの対応、各 WAV 長と発話区間の一致、発話区間の非重複、ROOT 26キューに音声割当がないことを照合した。
- 本番 MP4 を FFmpeg で全編デコード。30,846フレーム、1920×1080、60 fps、H.264／AAC 44.1 kHz モノラル、コンテナ表示は8:34.12。04:18.500 の抽出フレームで ROOT の Speaking・波形・ロシア語原文・ルビを確認し、04:18.250 から1秒間の音声が無音相当であることを確認した。全字幕・全発話の目視と聴取による同期確認は未実施。
- Work 側ではヘッドレス Edge 起動と Azure CLI プロファイルの書き込みが制限された。Windows のローカル PowerShell では接続テスト、本番 WAV 生成、60 fps の MP4 書き出しを確認済み。
- macOS の `.app` 化、会話の分岐は未実装。現時点の確定仕様は [SPEC.md](SPEC.md)。

## 秘密情報の確認

ローカル Git 参照から到達できる12コミットについて、追跡テキストの秘密鍵、主要なトークン形式、API キー等への長い値の代入、および機密設定ファイル名をパターン検査した。該当は0件。コードは Azure CLI から実行時にトークンを取得し、認証ヘッダーに使用する。リソース URL とデプロイ名は接続先情報。検査の範囲外にある秘密や、既知の形式に当てはまらない値の有無は未確認。
