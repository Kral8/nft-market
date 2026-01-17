const WebApp = window.Telegram.WebApp;
WebApp.ready();

document.getElementById('connect-btn').onclick = () => {
    WebApp.showAlert("Connecting to TON Wallet...");
};

document.getElementById('mint-btn').onclick = () => {
    WebApp.showConfirm("Do you want to mint a new NFT?");
};
