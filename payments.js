// payments.js
const MY_WALLET = "UQB_rYz84GULTmhLKuOGa6731bsuT-nLELiem9p-u2qI_D98";

// Инициализация кошелька
window.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://kral8.github.io/nft-market/tonconnect-manifest.json',
    buttonRootId: 'ton-connect-btn'
});

// Глобальная функция оплаты
window.processPayment = async (amount) => {
    console.log("Attempting to pay:", amount);
    
    if (!window.tonConnectUI.connected) {
        alert("Please connect your TON wallet first!");
        await window.tonConnectUI.openModal();
        return;
    }

    // Переводим TON в нанотонны
    const nanoAmount = (parseFloat(amount) * 1000000000).toString();

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 минут
        messages: [
            {
                address: MY_WALLET,
                amount: nanoAmount,
            }
        ]
    };

    try {
        const result = await window.tonConnectUI.sendTransaction(transaction);
        alert("Success! Transaction sent.");
        console.log("Transaction result:", result);
    } catch (e) {
        console.error("Payment error:", e);
        alert("Transaction failed or canceled.");
    }
};
