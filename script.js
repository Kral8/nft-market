const WebApp = window.Telegram.WebApp;
WebApp.ready();
WebApp.expand();

// ТВОЙ КОШЕЛЕК ДЛЯ ПОЛУЧЕНИЯ ОПЛАТЫ
const MY_TON_ADDRESS = "UQB_rYz84GULTmhLKuOGa6731bsuT-nLELiem9p-u2qI_D98"; 

// ТВОЙ PINATA JWT (ДЛЯ КАРТИНОК)
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYWMxZDM2Yy04MDVmLTQzYTQtYmQ5My1iNzhmNmM0NTI1MDAiLCJlbWFpbCI6InNhYnRpbThAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjBjNGVhZTZmZGZiYTVmYzM2OTZkIiwic2NvcGVkS2V5U2VjcmV0IjoiYjA0NmFiNjc5MTAyY2IzNGVjOGRjZDNmN2Q5N2Y2OWVhNTNmNDQ3MjUxMDI3NGRjYWU3MjJlYmI0YjAyOTU5MyIsImV4cCI6MTgwMDIwMjY0MH0.uC3hCpCcf2uuxBs3bY5u5d6KHNaGtngHufen-0HZnbw';

// 1. ЗАГРУЗКА NFT С ВИТРИНЫ (ИЗ FIREBASE)
async function loadNFTs() {
    const grid = document.getElementById('nft-display-area');
    if (!grid) return;
    grid.innerHTML = '<p style="color: gold; text-align: center; grid-column: 1/3;">Loading Market...</p>'; 

    try {
        if (!window.fbMethods) {
            setTimeout(loadNFTs, 500);
            return;
        }

        const { getDocs, collection, query, orderBy } = window.fbMethods;
        const q = query(collection(window.db, "nfts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        grid.innerHTML = ''; 

        if (querySnapshot.empty) {
            grid.innerHTML = '<p style="grid-column: 1/3;">No NFTs found. Create one!</p>';
            return;
        }

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
        console.error("Firebase Error: ", e);
        grid.innerHTML = '<p style="color: red;">Error loading NFTs</p>';
    }
}

// ЗАПУСК ЗАГРУЗКИ ПРИ СТАРТЕ
loadNFTs();

// 2. ОТКРЫТИЕ И ЗАКРЫТИЕ МОДАЛКИ МИНТИНГА
document.getElementById('mint-btn-main').onclick = () => {
    document.getElementById('mint-modal').style.display = 'block';
};

window.closeModal = function() {
    document.getElementById('mint-modal').style.display = 'none';
}

// 3. ФУНКЦИЯ ОПЛАТЫ ЧЕРЕЗ TON CONNECT
window.sendTransaction = async function(amount, nftName) {
    if (!tonConnectUI.connected) {
        WebApp.showAlert("Please connect your wallet first using the button at the top!");
        return;
    }

    // Переводим цену в нанотоны
    const nanoAmount = (parseFloat(amount) * 1000000000).toString();

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, 
        messages: [
            {
                address: MY_TON_ADDRESS, 
                amount: nanoAmount,
            }
        ]
    };

    try {
        WebApp.showConfirm(`Confirm purchase: ${nftName} for ${amount} TON?`, async (confirm) => {
            if (confirm) {
                await tonConnectUI.sendTransaction(transaction);
                WebApp.showAlert("Transaction sent! Check your wallet.");
            }
        });
    } catch (e) {
        console.error(e);
        WebApp.showAlert("Transaction failed or canceled.");
    }
}

// 4. СОЗДАНИЕ НОВОГО NFT (IPFS + FIREBASE)
window.startMinting = async function() {
    const name = document.getElementById('nft-name').value;
    const price = document.getElementById('nft-price').value;
    const fileInput = document.getElementById('nft-file');

    if(!name || !price || !fileInput.files[0]) {
        WebApp.showAlert("Please fill all fields and select an image!");
        return;
    }

    const btn = document.getElementById('confirm-mint-btn');
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        // Загрузка в Pinata
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
            body: formData
        });
        const data = await res.json();
        const imgUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;

        // Сохранение в Firebase
        const { addDoc, collection } = window.fbMethods;
        await addDoc(collection(window.db, "nfts"), {
            name: name,
            price: price,
            image: imgUrl,
            createdAt: Date.now()
        });

        WebApp.showAlert("Success! Your NFT is now live on the market.");
        closeModal();
        loadNFTs(); 

    } catch (e) {
        console.error(e);
        WebApp.showAlert("Error creating NFT. Try again.");
    } finally {
        btn.innerText = "Create & Post";
        btn.disabled = false;
    }
}
