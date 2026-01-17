import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Конфиг Firebase - лучше вынести в переменные окружения
const firebaseConfig = {
    // Твой конфиг
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Инициализация TON Connect
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: window.location.origin + '/tonconnect-manifest.json',
    buttonRootId: 'ton-connect-btn'
});

// Загружаем NFT с рынка
async function loadNFTs() {
    const grid = document.getElementById('nft-grid');
    grid.innerHTML = '<p style="text-align:center; grid-column:1/-1; padding: 20px;">Loading NFTs...</p>';
    
    try {
        const snap = await getDocs(collection(db, "nfts"));
        grid.innerHTML = '';
        
        if (snap.empty) {
            grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:gray;">Market is empty. Be the first to list!</p>';
            return;
        }
        
        snap.forEach(docItem => {
            const nft = docItem.data();
            const div = document.createElement('div');
            div.className = 'nft-card';
            div.innerHTML = `
                <img src="${nft.image}" loading="lazy" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:10px 10px 0 0;">
                <div style="padding:10px;">
                    <b style="color:white;">${nft.name}</b><br>
                    <span style="color:#ffd700;">${nft.price} TON</span>
                    <small style="display:block; color:#8a939b; font-size:12px;">By: ${nft.owner?.slice(0, 6)}...</small>
                </div>
                <button onclick="processPayment('${nft.price}', '${nft.owner}', '${docItem.id}')" 
                        style="width:100%; background:#2081e2; color:white; border:none; padding:10px; border-radius:0 0 10px 10px; font-weight:bold; cursor:pointer;">
                    Buy Now
                </button>
            `;
            grid.appendChild(div);
        });
    } catch (e) {
        console.error("Error loading NFTs:", e);
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:red;">Error loading NFTs</p>';
    }
}

// Функция покупки NFT
window.processPayment = async (price, ownerAddress, nftId) => {
    if (!tonConnectUI.connected) {
        await tonConnectUI.openModal();
        return;
    }
    
    const userAddress = tonConnectUI.account?.address;
    if (!userAddress) return alert("Connect wallet first!");
    
    // Покупатель не может купить у себя
    if (userAddress === ownerAddress) {
        return alert("You can't buy your own NFT!");
    }
    
    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
            address: ownerAddress, // Платеж идет продавцу
            amount: (parseFloat(price) * 1000000000).toString()
        }]
    };
    
    try {
        await tonConnectUI.sendTransaction(tx);
        alert("Purchase successful! NFT will be transferred to you.");
        
        // Здесь можно обновить владельца в базе
        // await updateOwner(nftId, userAddress);
        
    } catch (e) {
        console.error("Transaction error:", e);
        if (e.message?.includes("cancel")) {
            alert("Transaction cancelled");
        } else {
            alert("Transaction failed: " + e.message);
        }
    }
};

// Создание нового NFT
window.runMinting = async () => {
    const name = document.getElementById('nft-name').value.trim();
    const price = document.getElementById('nft-price').value.trim();
    const file = document.getElementById('nft-file').files[0];
    
    if (!name || !price || !file) {
        return alert("Please fill all fields and select an image!");
    }
    
    if (parseFloat(price) <= 0) {
        return alert("Price must be greater than 0!");
    }
    
    if (!tonConnectUI.connected) {
        alert("Please connect your wallet first!");
        await tonConnectUI.openModal();
        return;
    }
    
    const userAddress = tonConnectUI.account?.address;
    if (!userAddress) return;
    
    const btn = document.getElementById('submit-mint');
    const originalText = btn.innerText;
    btn.innerText = "Uploading to IPFS...";
    btn.disabled = true;
    
    try {
        // Получаем JWT из безопасного источника
        const pinataJWT = await Telegram.WebApp.CloudStorage.getItem('pinata_jwt') || "YOUR_PINATA_JWT_HERE";
        
        // Загрузка на IPFS
        const fd = new FormData();
        fd.append('file', file);
        
        const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${pinataJWT}` },
            body: fd
        });
        
        if (!res.ok) throw new Error(`IPFS upload failed: ${res.status}`);
        
        const data = await res.json();
        const imgUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
        
        // Сохраняем в Firestore
        await addDoc(collection(db, "nfts"), {
            name,
            price: parseFloat(price).toFixed(2),
            image: imgUrl,
            owner: userAddress,
            createdAt: Date.now(),
            sold: false
        });
        
        alert("NFT listed successfully!");
        document.getElementById('mint-modal').style.display = 'none';
        
        // Очищаем форму
        document.getElementById('nft-name').value = '';
        document.getElementById('nft-price').value = '';
        document.getElementById('nft-file').value = '';
        
        loadNFTs();
        
    } catch (e) {
        console.error("Minting error:", e);
        alert("Error: " + (e.message || "Unknown error"));
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    loadNFTs();
    
    // Обновляем NFT при подключении кошелька
    tonConnectUI.onStatusChange(wallet => {
        if (wallet) {
            console.log("Wallet connected:", wallet.account.address);
            loadNFTs();
        }
    });
    
    // Закрытие модалки при клике вне ее
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('mint-modal');
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});
