const WebApp = window.Telegram.WebApp;
WebApp.ready();

const MY_TON_ADDRESS = "UQB_rYz84GULTmhLKuOGa6731bsuT-nLELiem9p-u2qI_D98"; 
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYWMxZDM2Yy04MDVmLTQzYTQtYmQ5My1iNzhmNmM0NTI1MDAiLCJlbWFpbCI6InNhYnRpbThAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjBjNGVhZTZmZGZiYTVmYzM2OTZkIiwic2NvcGVkS2V5U2VjcmV0IjoiYjA0NmFiNjc5MTAyY2IzNGVjOGRjZDNmN2Q5N2Y2OWVhNTNmNDQ3MjUxMDI3NGRjYWU3MjJlYmI0YjAyOTU5MyIsImV4cCI6MTgwMDIwMjY0MH0.uC3hCpCcf2uuxBs3bY5u5d6KHNaGtngHufen-0HZnbw';

async function loadNFTs() {
    const grid = document.getElementById('nft-display-area');
    if (!grid) return;
    grid.innerHTML = '<p style="color: gold; grid-column: 1/3;">Loading Market...</p>'; 

    try {
        if (!window.fbMethods) {
            setTimeout(loadNFTs, 500);
            return;
        }
        const { getDocs, collection, query, orderBy } = window.fbMethods;
        const q = query(collection(window.db, "nfts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        grid.innerHTML = ''; 
        querySnapshot.forEach((doc) => {
            const nft = doc.data();
            const card = document.createElement('div');
            card.className = 'nft-card';
            card.innerHTML = `
                <img src="${nft.image}" alt="nft">
                <h3>${nft.name}</h3>
                <p>${nft.price} TON</p>
                <button class="buy-btn" onclick="sendTransaction('${nft.price}', '${nft.name}')">Buy Now</button>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        grid.innerHTML = '<p>Error loading NFTs</p>';
    }
}

loadNFTs();

// ФУНКЦИЯ ОПЛАТЫ
window.sendTransaction = async function(amount, nftName) {
    // 1. Проверяем, инициализирован ли интерфейс TON Connect
    if (!window.tonConnectUI) {
        WebApp.showAlert("System loading, please wait...");
        return;
    }

    // 2. Проверяем, подключен ли кошелек
    if (!window.tonConnectUI.connected) {
        WebApp.showAlert("Please connect your wallet first!");
        window.tonConnectUI.openModal(); // Сами открываем окно подключения
        return;
    }

    const nanoAmount = (parseFloat(amount) * 1000000000).toString();
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, 
        messages: [{ address: MY_TON_ADDRESS, amount: nanoAmount }]
    };

    try {
        await window.tonConnectUI.sendTransaction(transaction);
        WebApp.showAlert("Success! Transaction sent.");
    } catch (e) {
        WebApp.showAlert("Payment canceled.");
    }
}

// СОЗДАНИЕ NFT
window.startMinting = async function() {
    const name = document.getElementById('nft-name').value;
    const price = document.getElementById('nft-price').value;
    const fileInput = document.getElementById('nft-file');

    if(!name || !price || !fileInput.files[0]) {
        WebApp.showAlert("Fill all fields!");
        return;
    }

    const btn = document.getElementById('confirm-mint-btn');
    btn.innerText = "Minting...";
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
            body: formData
        });
        const data = await res.json();
        const imgUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;

        const { addDoc, collection } = window.fbMethods;
        await addDoc(collection(window.db, "nfts"), {
            name: name,
            price: price,
            image: imgUrl,
            createdAt: Date.now()
        });

        WebApp.showAlert("NFT Created!");
        document.getElementById('mint-modal').style.display = 'none';
        loadNFTs(); 
    } catch (e) {
        WebApp.showAlert("Error!");
    } finally {
        btn.innerText = "Create & Post";
        btn.disabled = false;
    }
}

document.getElementById('mint-btn-main').onclick = () => {
    document.getElementById('mint-modal').style.display = 'block';
};
window.closeModal = () => { document.getElementById('mint-modal').style.display = 'none'; };
