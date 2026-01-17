const WebApp = window.Telegram.WebApp;
WebApp.ready();
WebApp.expand();

const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYWMxZDM2Yy04MDVmLTQzYTQtYmQ5My1iNzhmNmM0NTI1MDAiLCJlbWFpbCI6InNhYnRpbThAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjBjNGVhZTZmZGZiYTVmYzM2OTZkIiwic2NvcGVkS2V5U2VjcmV0IjoiYjA0NmFiNjc5MTAyY2IzNGVjOGRjZDNmN2Q5N2Y2OWVhNTNmNDQ3MjUxMDI3NGRjYWU3MjJlYmI0YjAyOTU5MyIsImV4cCI6MTgwMDIwMjY0MH0.uC3hCpCcf2uuxBs3bY5u5d6KHNaGtngHufen-0HZnbw';

// 1. ЗАГРУЗКА NFT ПРИ ОТКРЫТИИ
async function loadNFTs() {
    const grid = document.getElementById('nft-display-area');
    grid.innerHTML = ''; // Чистим перед загрузкой

    try {
        const { getDocs, collection, query, orderBy } = window.fbMethods;
        const q = query(collection(window.db, "nfts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const nft = doc.data();
            const card = document.createElement('div');
            card.className = 'nft-card';
            card.innerHTML = `
                <img src="${nft.image}" alt="nft">
                <h3>${nft.name}</h3>
                <p>${nft.price} TON</p>
                <button class="buy-btn" onclick="WebApp.showAlert('Purchase logic is coming!')">Buy Now</button>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error("Error loading NFTs: ", e);
    }
}

// Вызываем загрузку сразу
loadNFTs();

// 2. ОТКРЫТИЕ МОДАЛКИ
document.getElementById('mint-btn-main').onclick = () => {
    document.getElementById('mint-modal').style.display = 'block';
};

function closeModal() {
    document.getElementById('mint-modal').style.display = 'none';
}

// 3. ФУНКЦИЯ СОХРАНЕНИЯ
async function startMinting() {
    const name = document.getElementById('nft-name').value;
    const price = document.getElementById('nft-price').value;
    const fileInput = document.getElementById('nft-file');

    if(!name || !price || !fileInput.files[0]) {
        WebApp.showAlert("Fill all fields!");
        return;
    }

    const btn = document.getElementById('confirm-mint-btn');
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        // Сначала в Pinata
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
            body: formData
        });
        const data = await res.json();
        const imgUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;

        // Затем в Firebase
        const { addDoc, collection } = window.fbMethods;
        await addDoc(collection(window.db, "nfts"), {
            name: name,
            price: price,
            image: imgUrl,
            createdAt: Date.now()
        });

        WebApp.showAlert("Success! Your NFT is saved forever.");
        closeModal();
        loadNFTs(); // Обновляем витрину
    } catch (e) {
        WebApp.showAlert("Error! Check console.");
        console.error(e);
    } finally {
        btn.innerText = "Create & Post";
        btn.disabled = false;
    }
}
