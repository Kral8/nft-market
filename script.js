const WebApp = window.Telegram.WebApp;
WebApp.ready();
WebApp.expand();

// ТВОЙ PINATA ТОКЕН
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYWMxZDM2Yy04MDVmLTQzYTQtYmQ5My1iNzhmNmM0NTI1MDAiLCJlbWFpbCI6InNhYnRpbThAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjBjNGVhZTZmZGZiYTVmYzM2OTZkIiwic2NvcGVkS2V5U2VjcmV0IjoiYjA0NmFiNjc5MTAyY2IzNGVjOGRjZDNmN2Q5N2Y2OWVhNTNmNDQ3MjUxMDI3NGRjYWU3MjJlYmI0YjAyOTU5MyIsImV4cCI6MTgwMDIwMjY0MH0.uC3hCpCcf2uuxBs3bY5u5d6KHNaGtngHufen-0HZnbw';

// ФУНКЦИЯ ЗАГРУЗКИ КАРТОЧЕК С САЙТА
async function loadNFTs() {
    const grid = document.getElementById('nft-display-area');
    if (!grid) return;
    grid.innerHTML = '<p style="color: gold;">Loading Market...</p>'; 

    try {
        // Проверяем, готовы ли методы Firebase
        if (!window.fbMethods) {
            setTimeout(loadNFTs, 500); // Если не готовы, ждем еще полсекунды
            return;
        }

        const { getDocs, collection, query, orderBy } = window.fbMethods;
        const q = query(collection(window.db, "nfts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        grid.innerHTML = ''; // Чистим перед выводом

        if (querySnapshot.empty) {
            grid.innerHTML = '<p>No NFTs found. Be the first to list!</p>';
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
                <button class="buy-btn" onclick="WebApp.showAlert('Purchase logic: Sending ${nft.price} TON to seller...')">Buy Now</button>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error("Firebase Load Error: ", e);
        grid.innerHTML = '<p style="color: red;">Error loading data</p>';
    }
}

// Запускаем загрузку сразу
loadNFTs();

// ОТКРЫТИЕ И ЗАКРЫТИЕ МОДАЛКИ
document.getElementById('mint-btn-main').onclick = () => {
    document.getElementById('mint-modal').style.display = 'block';
};

window.closeModal = function() {
    document.getElementById('mint-modal').style.display = 'none';
}

// ФУНКЦИЯ ЗАГРУЗКИ В PINATA
async function uploadToIPFS(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
        body: formData
    });
    const json = await res.json();
    if (!json.IpfsHash) throw new Error("Pinata error");
    return json.IpfsHash;
}

// ГЛАВНАЯ ФУНКЦИЯ СОЗДАНИЯ NFT
window.startMinting = async function() {
    const name = document.getElementById('nft-name').value;
    const price = document.getElementById('nft-price').value;
    const fileInput = document.getElementById('nft-file');

    if(!name || !price || !fileInput.files[0]) {
        WebApp.showAlert("Please fill all fields, brother!");
        return;
    }

    const btn = document.getElementById('confirm-mint-btn');
    const originalText = btn.innerText;
    btn.innerText = "1. Uploading Image...";
    btn.disabled = true;

    try {
        // 1. В Pinata
        const hash = await uploadToIPFS(fileInput.files[0]);
        const imgUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
        
        btn.innerText = "2. Saving to Database...";

        // 2. В Firebase
        const { addDoc, collection } = window.fbMethods;
        await addDoc(collection(window.db, "nfts"), {
            name: name,
            price: price,
            image: imgUrl,
            createdAt: Date.now()
        });

        WebApp.showAlert("Victory! NFT '"+name+"' is now live!");
        closeModal();
        loadNFTs(); // Перезагружаем витрину

    } catch (e) {
        console.error(e);
        WebApp.showAlert("Error creating NFT. Check console.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
