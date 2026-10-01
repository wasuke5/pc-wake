# PC Wake

スマホのホーム画面に追加できる、PC起動要求用のWebアプリです。

**現在の公開版は画面のみです。起動信号を送る経路が未接続のため、PCをスリープから解除できません。起動ボタンは無効です。**

公開ページ: https://wasuke5.github.io/pc-wake/

## 現在できること

- スマホ向け画面を開く
- ホーム画面に追加して単独のアプリ画面として開く
- オフライン表示
- 起動経路が未接続であることの確認

## 起動機能の条件

GitHub Pagesは静的ファイルの配信サービスです。ページ自体には、Wi-Fi上のPCへWake-on-WLAN信号を送るサーバー機能がありません。

即時起動には、認証済みのバックエンドから、スリープ中のPCにMagic Packetを届けられるネットワーク経路が必要です。対象のWi-Fiが施設管理で設定変更できず、端末間の通信や外部からの受信が制限されている場合、Webアプリの作成だけでは解決できません。

現在の利用環境にはMeraki DHCP NATモードに一致する特徴があります。管理画面での確認は行っていません。このモードでは端末間通信と外部からの新規接続が遮断されます。[Cisco Merakiの仕様](https://documentation.meraki.com/Wireless/Design_and_Configure/Configuration_Guides/Client_Addressing_and_Bridging/NAT_Mode_with_Meraki_DHCP)

有線LAN、新しい機器の購入、定期的なPCの復帰は、この公開版に含めていません。実際のスリープ解除試験も完了していません。

## スマホに保存する

この操作はスマホ上で必要です。保存しても、現在の版ではPCは起動できません。

- iPhone: Safariで公開ページを開く → 共有 → ホーム画面に追加
- Android: Chromeで公開ページを開く → メニュー → ホーム画面に追加（またはアプリをインストール）

## 構成

- `site/`: HTML、CSS、JavaScript、PWAマニフェスト、サービスワーカー、アイコン
- `.github/workflows/pages.yml`: `site/`だけをGitHub Pagesに公開

ビルドやnpmのインストールは不要です。公開ファイルに登録コード、GitHubトークン、PCのMACアドレスなどの秘密情報を入れないでください。

`site/config.js`のAPI URLは空です。後日、実際に利用できる経路を確保した場合のAPI契約は[画面のREADME](site/README.md)を参照してください。APIの受付結果とPCの起動確認は別々に扱います。
