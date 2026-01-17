import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================== КОНФИГУРАЦИЯ ==================
const firebaseConfig = {
    apiKey: "AIzaSyBT0bsUtte387SIkm3N2hddlvEFSVhB9RU",
    authDomain: "royal-nft.firebaseapp.com",
    projectId: "royal-nft",
    storageBucket: "royal-nft.firebasestorage.app",
    messagingSenderId: "616712040035",
    appId: "1:616712040035:web:59e449b2215e4126951256"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================== TON CONNECT ==================
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: window.location.origin + '/tonconnect-manifest.json',
    buttonRootId: 'ton-connect-btn'
});

// ================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==================
let PINATA_JWT = ""; // Будет загружено из CloudStorage
let CURRENT_USER_ADDRESS = "";

// ================== TELEGRAM WEB APP INIT ==================
let tg = window.Telegram?.WebApp;

if (tg) {
    tg.expand();
    tg.disableVerticalSwipes();
    
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
        tg.close();
    });
}

// ================== ФУНКЦИЯ ПОЛУЧЕНИЯ КЛЮЧЕЙ ==================
async function loadSecureKeys() {
    // Сначала пробуем получить из Telegram CloudStorage
    if (window.Telegram?.WebApp?.CloudStorage) {
        try {
            const jwt = await Telegram.WebApp.CloudStorage.getItem('pinata_jwt');
            if (jwt && jwt !== 'undefined') {
                PINATA_JWT = jwt;
                console.log("Pinata JWT loaded from Telegram CloudStorage");
                return true;
            }
        } catch (e) {
            console.log("Telegram CloudStorage not available");
        }
    }
    
    // Если нет в Telegram, пробуем LocalStorage
    try {
        const jwt = localStorage.getItem('pinata_jwt');
        if (jwt && jwt !== 'undefined') {
            PINATA_JWT = jwt;
            console.log("Pinata JWT loaded from LocalStorage");
            return true;
        }
    } catch (e) {
        console.log("LocalStorage not available");
    }
    
    // Если ничего не нашли
    console.warn("Pinata JWT not found");
    return false;
}
// ================== ЗАГРУЗКА NFT С РЫНКА ==================
async function loadNFTs() {
    const grid = document.getElementById('nft-grid');
    
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px;"><div class="loader"></div><p style="color:gray; margin-top:10px;">Loading marketplace...</p></div>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "nfts"));
        grid.innerHTML = '';
        
        if (querySnapshot.empty) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:gray;"><p>🏜️ Marketplace is empty</p><p style="font-size:14px; margin-top:10px;">Be the first to list an NFT!</p></div>';
            return;
        }
        
        const nfts = [];
        querySnapshot.forEach(doc => {
            nfts.push({ id: doc.id, ...doc.data() });
        });
        
        nfts.sort((a, b) => b.createdAt - a.createdAt);
        
        nfts.forEach(nft => {
            const div = document.createElement('div');
            div.className = 'nft-card';
            
            const ownerShort = nft.owner ? 
                `${nft.owner.slice(0, 4)}...${nft.owner.slice(-4)}` : 
                "Unknown";
            
            div.innerHTML = `
                <img src="${nft.image}" alt="${nft.name}" 
                     loading="lazy" 
                     style="width:100%; height:180px; object-fit:cover; border-radius:10px 10px 0 0;">
                <div style="padding:12px;">
                    <h3 style="margin:0 0 5px 0; color:white; font-size:16px;">${nft.name}</h3>
                    <div style="color:#ffd700; font-weight:bold; font-size:18px;">${parseFloat(nft.price).toFixed(2)} TON</div>
                    <div style="color:#8a939b; font-size:12px; margin-top:5px;">Seller: ${ownerShort}</div>
                </div>
                <button onclick="buyNFT('${nft.id}', '${nft.price}', '${nft.owner}')" 
                        style="width:100%; background:#2081e2; color:white; border:none; padding:12px; border-radius:0 0 10px 10px; font-weight:bold; cursor:pointer; font-size:14px;">
                    Buy Now
                </button>
            `;
            
            grid.appendChild(div);
        });
        
    } catch (error) {
        console.error("Error loading NFTs:", error);
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#ff4757;"><p>❌ Error loading NFTs</p><p style="font-size:14px;">' + error.message + '</p></div>';
    }
}

// ================== ПОКУПКА NFT ==================
window.buyNFT = async function(nftId, price, sellerAddress) {
    if (!tonConnectUI.connected) {
        alert("⚠️ Please connect your wallet first!");
        await tonConnectUI.openModal();
        return;
    }
    
    const buyerAddress = tonConnectUI.account?.address;
    if (!buyerAddress) {
        alert("Wallet not connected properly");
        return;
    }
    
    if (buyerAddress === sellerAddress) {
        alert("🤔 You can't buy your own NFT!");
        return;
    }
    
    const confirmBuy = confirm(`Buy "${nftId}" for ${price} TON?\n\nThis will open your wallet to confirm the transaction.`);
    if (!confirmBuy) return;
    
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
            {
                address: sellerAddress,
                amount: (parseFloat(price) * 1000000000).toString()
            }
        ]
    };
    
    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        
        alert(`✅ Purchase successful!\nTransaction: ${result.boc.slice(0, 20)}...`);
        
        loadNFTs();
        
    } catch (error) {
        console.error("Transaction error:", error);
        
        if (error.message?.includes("cancel") || error.message?.includes("Cancelled")) {
            alert("❌ Transaction cancelled");
        } else {
            alert("❌ Transaction failed: " + (error.message || "Unknown error"));
        }
    }
};

// ================== СОЗДАНИЕ НОВОГО NFT ==================
window.runMinting = async function() {
    const name = document.getElementById('nft-name').value.trim();
    const price = document.getElementById('nft-price').value.trim();
    const fileInput = document.getElementById('nft-file');
    const file = fileInput.files[0];
    
    if (!name || name.length < 2) {
        alert("❌ NFT name must be at least 2 characters");
        return;
    }
    
    if (!price || parseFloat(price) <= 0) {
        alert("❌ Price must be greater than 0 TON");
        return;
    }
    
    if (!file) {
        alert("❌ Please select an image for your NFT");
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        alert("❌ Image size should be less than 10MB");
        return;
    }
    
    if (!tonConnectUI.connected) {
        alert("🔗 Please connect your wallet first!");
        await tonConnectUI.openModal();
        return;
    }
    
    CURRENT_USER_ADDRESS = tonConnectUI.account?.address;
    if (!CURRENT_USER_ADDRESS) {
        alert("Wallet connection error");
        return;
    }
    
    const mintButton = document.getElementById('submit-mint');
    const originalText = mintButton.innerText;
    mintButton.innerText = "⏳ Uploading...";
    mintButton.disabled = true;
    
    try {
        if (!PINATA_JWT) {
            await loadSecureKeys();
        }
        
        if (!PINATA_JWT) {
            throw new Error("Pinata JWT not configured. Please set it in Admin Settings.");
        }
        
        mintButton.innerText = "📤 Uploading to IPFS...";
        
        const formData = new FormData();
        formData.append('file', file);
        
        const ipfsResponse = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`
            },
            body: formData
        });
        
        if (!ipfsResponse.ok) {
            const errorText = await ipfsResponse.text();
            throw new Error(`IPFS upload failed: ${ipfsResponse.status} - ${errorText}`);
        }
        
        const ipfsData = await ipfsResponse.json();
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsData.IpfsHash}`;
        
        console.log("✅ Image uploaded to IPFS:", imageUrl);
        
        mintButton.innerText = "💾 Saving to marketplace...";
        
        const nftData = {
            name: name,
            price: parseFloat(price).toFixed(2),
            image: imageUrl,
            owner: CURRENT_USER_ADDRESS,
            ownerName: tonConnectUI.account?.chain || "TON User",
            createdAt: Date.now(),
            sold: false,
            ipfsHash: ipfsData.IpfsHash
        };
        
        const docRef = await addDoc(collection(db, "nfts"), nftData);
        
        console.log("✅ NFT listed with ID:", docRef.id);
        
        alert(`🎉 NFT "${name}" successfully listed!\n\nPrice: ${price} TON\nView it in the marketplace.`);
        
        closeMintModal();
        
        document.getElementById('nft-name').value = '';
        document.getElementById('nft-price').value = '';
        fileInput.value = '';
        
        await loadNFTs();
        
    } catch (error) {
        console.error("❌ Minting error:", error);
        
        let errorMessage = "Failed to create NFT: ";
        if (error.message.includes("JWT")) {
            errorMessage += "Pinata JWT not configured. ";
            errorMessage += "Go to Admin Settings to configure.";
        } else if (error.message.includes("quota")) {
            errorMessage += "Pinata storage limit reached.";
        } else {
            errorMessage += error.message;
        }
        
        alert(`❌ ${errorMessage}`);
        
    } finally {
        mintButton.innerText = originalText;
        mintButton.disabled = false;
    }
};

// ================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==================
async function initApp() {
    console.log("🚀 Initializing Royal NFT Market...");
    
    await loadSecureKeys();
    await loadNFTs();
    
    tonConnectUI.onStatusChange((walletInfo) => {
        if (walletInfo) {
            CURRENT_USER_ADDRESS = walletInfo.account.address;
            console.log("✅ Wallet connected:", CURRENT_USER_ADDRESS);
            
            if (window.showNotification) {
                showNotification("Wallet connected!", "success");
            }
        } else {
            CURRENT_USER_ADDRESS = "";
            console.log("🔒 Wallet disconnected");
        }
        
        loadNFTs();
    });
    
    console.log("✅ App initialized successfully");
}

// ================== ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ==================
document.addEventListener('DOMContentLoaded', initApp);
