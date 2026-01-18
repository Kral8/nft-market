import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let PINATA_JWT = "";
let CURRENT_USER_ADDRESS = "";
let ALL_NFTS = [];
let CURRENT_FILTER = 'all';

// ================== БЫСТРАЯ ЗАГРУЗКА NFT С ТАЙМАУТОМ ==================
async function loadNFTs() {
    const grid = document.getElementById('nft-grid');
    
    // Показываем быстрый загрузчик
    grid.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loader"></div>
            <p style="color: #8a939b; margin-top: 15px;">Loading marketplace...</p>
        </div>
    `;
    
    // Создаем таймаут для запроса
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Firebase timeout after 5 seconds")), 5000);
    });
    
    try {
        console.log("🔥 Starting Firebase query...");
        
        // Пробуем загрузить с таймаутом
        const queryPromise = getDocs(collection(db, "nfts"));
        const querySnapshot = await Promise.race([queryPromise, timeoutPromise]);
        
        console.log("✅ Firebase query successful!");
        
        ALL_NFTS = [];
        
        if (querySnapshot.empty) {
            console.log("📭 No NFTs found in database");
            showNoNFTs();
            return;
        }
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            console.log("📦 Found NFT:", data.name);
            
            ALL_NFTS.push({
                id: doc.id,
                name: data.name || "Unnamed NFT",
                price: parseFloat(data.price) || 0,
                image: data.image || "https://via.placeholder.com/300x300/18202a/8a939b?text=Royal+NFT",
                owner: data.owner || "Unknown",
                createdAt: data.createdAt || Date.now()
            });
        });
        
        console.log(`✅ Loaded ${ALL_NFTS.length} NFTs`);
        
        // Немедленно показываем NFT
        displayNFTs(ALL_NFTS);
        updateStats();
        
    } catch (error) {
        console.error("❌ Firebase error:", error);
        
        // Показываем тестовые данные если Firebase не работает
        if (error.message.includes("timeout") || error.message.includes("permission")) {
            console.log("⚠️ Using fallback test data...");
            showTestNFTs();
        } else {
            grid.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 60px; color: #ff4757; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: white;">Connection Error</h3>
                    <p style="color: #8a939b;">Could not connect to database</p>
                    <p style="color: #666; font-size: 12px; margin-top: 10px;">${error.message}</p>
                    <button onclick="retryLoadNFTs()" style="margin-top: 20px; padding: 10px 20px; background: #2081e2; color: white; border: none; border-radius: 10px; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

// ================== ПОКАЗАТЬ ТЕСТОВЫЕ NFT ==================
function showTestNFTs() {
    const grid = document.getElementById('nft-grid');
    
    // Тестовые данные (твои реальные NFT)
    ALL_NFTS = [
        {
            id: "test1",
            name: "Trump",
            price: 2.0,
            image: "https://gateway.pinata.cloud/ipfs/QmbbsqaTgq3oDa5oMKXMZJzzfULbuc8Ngwmy1Cqf7s5agm",
            owner: "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            createdAt: 1768672526045
        },
        {
            id: "test2",
            name: "Crypto King",
            price: 1.5,
            image: "https://gateway.pinata.cloud/ipfs/QmZcH4YvBVVRJtdn4RdbaqgspFU8gH6P9vomDpBVpAL3u4",
            owner: "UQBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
            createdAt: 1768672526045 - 86400000
        }
    ];
    
    displayNFTs(ALL_NFTS);
    updateStats();
}

// ================== ПУСТОЙ МАРКЕТ ==================
function showNoNFTs() {
    const grid = document.getElementById('nft-grid');
    
    grid.innerHTML = `
        <div style="text-align: center; padding: 80px 20px; grid-column: 1 / -1;">
            <div style="font-size: 80px; margin-bottom: 20px; color: #8a939b;">🖼️</div>
            <h3 style="color: white; margin-bottom: 15px;">Marketplace is Empty</h3>
            <p style="color: #8a939b; max-width: 400px; margin: 0 auto 30px; line-height: 1.6;">
                Be the first to create an NFT! Start your digital collection now.
            </p>
            <button onclick="openMintModal()" style="padding: 12px 30px; background: linear-gradient(135deg, #2081e2, #1a73e8); color: white; border: none; border-radius: 25px; font-weight: bold; cursor: pointer;">
                + Create First NFT
            </button>
        </div>
    `;
    
    updateStats();
}

// ================== ОТОБРАЖЕНИЕ NFT ==================
function displayNFTs(nfts) {
    const grid = document.getElementById('nft-grid');
    
    if (!nfts || nfts.length === 0) {
        showNoNFTs();
        return;
    }
    
    let html = '';
    
    nfts.forEach(nft => {
        const ownerShort = nft.owner && nft.owner.length > 10 ? 
            `${nft.owner.slice(0, 6)}...${nft.owner.slice(-4)}` : 
            nft.owner || "Unknown";
        
        const price = nft.price.toFixed(2);
        
        html += `
            <div class="nft-card">
                <div class="nft-image">
                    <img src="${nft.image}" alt="${nft.name}" 
                         loading="lazy" 
                         style="width:100%; height:100%; object-fit:cover;"
                         onerror="this.src='https://via.placeholder.com/300x300/18202a/8a939b?text=NFT+Image';">
                </div>
                <div class="nft-info">
                    <h3 class="nft-title">${nft.name}</h3>
                    <div class="nft-price">${price} TON</div>
                    <p class="nft-owner">Seller: <span>${ownerShort}</span></p>
                </div>
                <div class="nft-actions">
                    <button class="buy-btn" onclick="buyNFT('${nft.id}', '${nft.price}', '${nft.owner}')">
                        Buy Now
                    </button>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// ================== ОБНОВЛЕНИЕ СТАТИСТИКИ ==================
function updateStats() {
    const totalNFTs = ALL_NFTS.length;
    document.getElementById('total-nfts').textContent = totalNFTs;
    
    const uniqueSellers = new Set(ALL_NFTS.map(nft => nft.owner)).size;
    document.getElementById('active-sellers').textContent = uniqueSellers;
    
    const totalVolume = ALL_NFTS.reduce((sum, nft) => sum + nft.price, 0);
    document.getElementById('total-volume').textContent = totalVolume.toFixed(1);
}

// ================== ФИЛЬТРАЦИЯ ==================
window.applyFilter = function(filterType) {
    CURRENT_FILTER = filterType;
    
    let filtered = [...ALL_NFTS];
    
    switch(filterType) {
        case 'newest':
            filtered.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'lowest':
            filtered.sort((a, b) => a.price - b.price);
            break;
        case 'highest':
            filtered.sort((a, b) => b.price - a.price);
            break;
        default:
            filtered.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    displayNFTs(filtered);
}

// ================== РЕТРИ ЗАГРУЗКИ ==================
window.retryLoadNFTs = function() {
    console.log("🔄 Retrying Firebase connection...");
    loadNFTs();
}

// ================== ИНИЦИАЛИЗАЦИЯ ==================
async function initApp() {
    console.log("🚀 Royal NFT Market starting...");
    
    // 1. Сразу загружаем NFT
    loadNFTs();
    
    // 2. Настраиваем кошелек
    tonConnectUI.onStatusChange((wallet) => {
        if (wallet) {
            CURRENT_USER_ADDRESS = wallet.account.address;
            console.log("✅ Wallet connected:", CURRENT_USER_ADDRESS);
            updateUserInfo();
        } else {
            CURRENT_USER_ADDRESS = "";
            console.log("🔒 Wallet disconnected");
            updateUserInfo();
        }
    });
    
    console.log("✅ App initialized");
}

// ================== ОБНОВИТЬ ИНФО ПОЛЬЗОВАТЕЛЯ ==================
function updateUserInfo() {
    const addressEl = document.getElementById('user-address');
    const balanceEl = document.getElementById('user-balance');
    
    if (CURRENT_USER_ADDRESS) {
        const shortAddr = CURRENT_USER_ADDRESS.slice(0, 6) + '...' + CURRENT_USER_ADDRESS.slice(-4);
        if (addressEl) addressEl.textContent = shortAddr;
        if (balanceEl) balanceEl.textContent = "Connected";
    } else {
        if (addressEl) addressEl.textContent = "Not connected";
        if (balanceEl) balanceEl.textContent = "0 TON";
    }
}

// ================== ПОКУПКА NFT ==================
window.buyNFT = async function(nftId, price, sellerAddress) {
    if (!tonConnectUI.connected) {
        alert("Please connect your wallet first!");
        return;
    }
    
    const buyerAddress = tonConnectUI.account.address;
    
    if (buyerAddress === sellerAddress) {
        alert("You can't buy your own NFT!");
        return;
    }
    
    const confirmBuy = confirm(`Buy for ${price} TON?`);
    if (!confirmBuy) return;
    
    try {
        const tx = {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [{
                address: sellerAddress,
                amount: (price * 1000000000).toString()
            }]
        };
        
        const result = await tonConnectUI.sendTransaction(tx);
        alert(`✅ Purchase successful!\nTransaction: ${result.boc.slice(0, 20)}...`);
        
    } catch (error) {
        alert("❌ Transaction failed: " + error.message);
    }
};

// ================== СОЗДАНИЕ NFT ==================
window.runMinting = async function() {
    const name = document.getElementById('nft-name').value;
    const price = document.getElementById('nft-price').value;
    const file = document.getElementById('nft-file').files[0];
    
    if (!name || !price || !file) {
        alert("Please fill all fields");
        return;
    }
    
    alert("NFT creation will work after fixing Firebase connection");
    closeMintModal();
};

// ================== СТАРТ ==================
document.addEventListener('DOMContentLoaded', initApp);

// Экспортируем функции
window.loadNFTs = loadNFTs;
window.applyFilter = applyFilter;
window.buyNFT = buyNFT;
window.runMinting = runMinting;
window.updateUserInfo = updateUserInfo;
