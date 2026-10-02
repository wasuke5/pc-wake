# PC Wake のスマホ画面

GitHub Pages のプロジェクトURLにそのまま置ける、ビルド不要のPWAです。`index.html` をページのルートに公開します。Windowsが日本時間の毎時00分に起き、サーバーへ要求を確認する方式です。ボタン操作から次の確認まで最大約1時間かかります。

`config.js` の `apiBase` にHTTPSバックエンドのURLを設定します。URLが空の間は、起動ボタンと登録機能を無効にします。公開ファイルに登録コードやPC用の認証情報を入れないでください。

初回は非公開の設定用リンク `https://<公開URL>/#key=<登録コード>` をスマホで開きます。コードはURLからすぐに除去し、このブラウザーのローカルストレージに保存します。

Androidでは`SYSTEM`内の「ホーム画面に追加」ボタン、iPhoneではSafariの共有 →「ホーム画面に追加」を使います。ホーム画面版で再登録を求められた場合は、設定用リンクか登録コードを一度だけ貼り付けます。ホーム画面への追加操作はスマホ側で必要です。

`cosmos.js`はCanvasによる星空と立体的なAIコアの演出です。外部の描画ライブラリーは不要です。30fpsを上限とし、画面非表示時と端末の動きを減らす設定に対応します。表示色は予約済み（アンバー）・PCオンライン（グリーン）・通常（シアン）です。演出はAI処理や通信量などを計測するものではありません。

API契約は `GET /api/status` と `POST /api/wake`（JSON `{}`）です。どちらも `Authorization: Bearer <登録コード>` を送ります。

GETの応答:

```json
{
  "schedule": {
    "mode": "hourly",
    "minute": 0,
    "timeZone": "Asia/Tokyo",
    "enabled": true,
    "nextCheckAt": "2026-10-02T01:00:00+09:00",
    "agentLastCheckAt": null
  },
  "device": { "name": "あなたのPC", "mode": "unknown", "lastSeenAt": null },
  "request": null
}
```

`request` は `null` または `{id, status, createdAt, expiresAt, acknowledgedAt}` です。`status` は `pending`、`acknowledged`、`expired`、`cancelled` を受け付けます。POSTは `{request, estimatedWaitSeconds, nextCheckAt}` を返します。

API接続後は、画面が開いている間、状態を10秒ごとに取得します。PCが応答していなくても、認証と定期確認の有効設定が確認できれば起動を要求できます。要求の受付だけでは成功と表示しません。未受信の要求がある間は、以前のPCの応答が新しくても「受付済み」の表示を保ちます。`acknowledged` で「PCが要求を受信」と表示し、それ以降の90秒以内のPCの応答を確認して「オンライン」にします。

確認時刻はスマホの地域設定によらず日本時間で表示します。タイマー設定、実際のスリープ解除と要求確認はWindows側のエージェントが行います。

サービスワーカーは画面と画像だけをキャッシュします。API、登録コード、設定ファイルはキャッシュしません。オフラインでは起動ボタンを無効にします。画面更新時は`sw.js`のCACHE名を変更します。新しい画面の取得後、既存のアプリにも自動で適用して再読み込みします。登録情報はそのまま残ります。
