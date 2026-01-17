import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    buttonRootId: 'ton-connect-btn',
    actionsConfiguration: {
        twaReturnUrl: 'https://t.me/royal_nft_market_bot/royal'
    }
});

// ================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==================
let PINATA_JWT = "";
let CURRENT_USER_ADDRESS = "";
let ALL_NFTS = [];
let CURRENT_FILTER = 'all';

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
                console.log("✅ Pinata JWT loaded from Telegram CloudStorage");
                return true;
            }
        } catch (e) {
            console.log("ℹ️ Telegram CloudStorage not available");
        }
    }
    
    // Если нет в Telegram, пробуем LocalStorage
    try {
        const jwt = localStorage.getItem('pinata_jwt');
        if (jwt && jwt !== 'undefined') {
            PINATA_JWT = jwt;
            console.log("✅ Pinata JWT loaded from LocalStorage");
            return true;
        }
    } catch (e) {
        console.log("ℹ️ LocalStorage not available");
    }
    
    // Если ничего не нашли
    console.log("⚠️ Pinata JWT not found");
    return false;
}

// ================== БЫСТРАЯ ЗАГРУЗКА NFT ==================
async function loadNFTs() {
    const grid = document.getElementById('nft-grid');
    
    // Быстрый загрузчик - показываем 1 секунду максимум
    grid.innerHTML = `
        <div class="loading-state">
            <div class="loader"></div>
            <p>Loading marketplace...</p>
        </div>
    `;
    
    // Начинаем загрузку сразу
    setTimeout(async () => {
        try {
            console.log("🔥 Loading NFTs from Firestore...");
            
            // Простой запрос без сортировки для скорости
            const nftsRef = collection(db, "nfts");
            const querySnapshot = await getDocs(nftsRef);
            
            // Сбрасываем массив NFT
            ALL_NFTS = [];
            
            querySnapshot.forEach(doc => {
                const data = doc.data();
                console.log("📦 NFT data:", data); // Для отладки
                
                ALL_NFTS.push({ 
                    id: doc.id, 
                    name: data.name || "Unnamed NFT",
                    price: parseFloat(data.price || 0),
                    image: data.image || "https://via.placeholder.com/300x300/18202a/8a939b?text=Royal+NFT",
                    owner: data.owner || "Unknown",
                    createdAt: data.createdAt || Date.now()
                });
            });
            
            console.log(`✅ Loaded ${ALL_NFTS.length} NFTs from Firestore`);
            
            // Обновляем статистику
            updateStats();
            
            // Применяем фильтр и показываем
            applyFilter(CURRENT_FILTER);
            
        } catch (error) {
            console.error("❌ Error loading NFTs:", error);
            
            // Показываем ошибку
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon" style="color:#ff4757;">⚠️</div>
                    <h3>Connection Error</h3>
                    <p>Firebase error: ${error.message}</p>
                    <button class="empty-btn" onclick="loadNFTs()" style="background:#ff4757;">Retry</button>
                </div>
            `;
        }
    }, 300); // Минимальная задержка для UX
}

// ================== ФИЛЬТРАЦИЯ NFT ==================
window.applyFilter = function(filterType) {
    CURRENT_FILTER = filterType;
    const grid = document.getElementById('nft-grid');
    
    if (ALL_NFTS.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🖼️</div>
                <h3>No NFTs Found</h3>
                <p>The marketplace is empty. Create the first NFT!</p>
                <button class="empty-btn" onclick="openMintModal()">+ Create NFT</button>
            </div>
        `;
        return;
    }
    
    let filteredNFTs = [...ALL_NFTS];
    
    // Применяем фильтры
    switch(filterType) {
        case 'newest':
            filteredNFTs.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'lowest':
            filteredNFTs.sort((a, b) => a.price - b.price);
            break;
        case 'highest':
            filteredNFTs.sort((a, b) => b.price - a.price);
            break;
        default: // 'all'
            filteredNFTs.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    // Отображаем отфильтрованные NFT
    displayNFTs(filteredNFTs);
}

// ================== ОТОБРАЖЕНИЕ NFT ==================
function displayNFTs(nfts) {
    const grid = document.getElementById('nft-grid');
    
    if (nfts.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🖼️</div>
                <h3>No NFTs Found</h3>
                <p>No NFTs match your filter.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = '';
    
    nfts.forEach((nft, index) => {
        const div = document.createElement('div');
        div.className = 'nft-card';
        
        // Форматируем адрес владельца
        const ownerShort = nft.owner && nft.owner.length > 10 ? 
            `${nft.owner.slice(0, 6)}...${nft.owner.slice(-4)}` : 
            nft.owner || "Unknown";
        
        // Форматируем цену
        const price = nft.price.toFixed(2);
        
        div.innerHTML = `
            <div class="nft-image">
                <img src="${nft.image}" alt="${nft.name}" 
                     loading="lazy" 
                     style="width:100%; height:100%; object-fit:cover;"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/300x300/18202a/8a939b?text=Royal+NFT';">
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
        `;
        
        grid.appendChild(div);
    });
}

// ================== ОБНОВЛЕНИЕ СТАТИСТИКИ ==================
function updateStats() {
    const totalNFTs = ALL_NFTS.length;
    document.getElementById('total-nfts').textContent = totalNFTs;
    
    // Считаем уникальных продавцов
    const uniqueSellers = new Set(ALL_NFTS.map(nft => nft.owner)).size;
    document.getElementById('active-sellers').textContent = uniqueSellers;
    
    // Считаем общий объем
    const totalVolume = ALL_NFTS.reduce((sum, nft) => sum + nft.price, 0);
    document.getElementById('total-volume').textContent = totalVolume.toFixed(1);
}

// ================== РАБОЧЕЕ ПОДКЛЮЧЕНИЕ КОШЕЛЬКА ==================
async function connectWallet() {
    try {
        if (!tonConnectUI.connected) {
            console.log("🔗 Opening wallet connection modal...");
            await tonConnectUI.openModal();
        } else {
            console.log("✅ Wallet already connected");
            updateUserInfo();
        }
    } catch (error) {
        console.error("❌ Wallet connection error:", error);
        if (window.showNotification) {
            showNotification("Failed to connect wallet", "error");
        }
    }
}

// Обновляем информацию о пользователе
function updateUserInfo() {
    if (tonConnectUI.connected && tonConnectUI.account?.address) {
        CURRENT_USER_ADDRESS = tonConnectUI.account.address;
        
        const userAddressEl = document.getElementById('user-address');
        const userBalanceEl = document.getElementById('user-balance');
        
        if (userAddressEl) {
            const shortAddr = CURRENT_USER_ADDRESS.slice(0, 6) + '...' + CURRENT_USER_ADDRESS.slice(-4);
            userAddressEl.textContent = shortAddr;
            userAddressEl.style.color = '#00b09b';
        }
        
        if (userBalanceEl) {
            userBalanceEl.textContent = "Connected";
            userBalanceEl.style.color = '#ffd700';
        }
        
        console.log("✅ Wallet info updated:", CURRENT_USER_ADDRESS);
    }
}

// ================== ПОКУПКА NFT ==================
window.buyNFT = async function(nftId, price, sellerAddress) {
    console.log("🛒 Buying NFT:", nftId, price, sellerAddress);
    
    if (!tonConnectUI.connected) {
        console.log("🔗 Wallet not connected, opening modal...");
        await connectWallet();
        return;
    }
    
    const buyerAddress = tonConnectUI.account?.address;
    if (!buyerAddress) {
        alert("Please connect your wallet");
        return;
    }
    
    if (buyerAddress === sellerAddress) {
        alert("You can't buy your own NFT!");
        return;
    }
    
    const confirmBuy = confirm(`Buy NFT for ${price} TON?\n\nThis will open your wallet to confirm.`);
    if (!confirmBuy) return;
    
    try {
        if (window.showLoader) showLoader("Processing transaction...");
        
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [
                {
                    address: sellerAddress,
                    amount: (parseFloat(price) * 1000000000).toString()
                }
            ]
        };
        
        console.log("📤 Sending transaction:", transaction);
        
        const result = await tonConnectUI.sendTransaction(transaction);
        
        console.log("✅ Transaction result:", result);
        
        if (window.hideLoader) hideLoader();
        if (window.showNotification) {
            showNotification("✅ Purchase successful!", "success");
        }
        
        alert(`✅ Purchase completed!\nTransaction sent successfully.`);
        
        // Обновляем список NFT
        await loadNFTs();
        
    } catch (error) {
        console.error("❌ Transaction error:", error);
        
        if (window.hideLoader) hideLoader();
        
        if (error.message?.includes("cancel") || error.message?.includes("Cancelled")) {
            alert("❌ Transaction cancelled by user");
        } else if (error.message?.includes("rejected")) {
            alert("❌ Transaction rejected");
        } else {
            alert(`❌ Transaction failed: ${error.message}`);
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
        alert("NFT name must be at least 2 characters");
        return;
    }
    
    if (!price || parseFloat(price) <= 0) {
        alert("Price must be greater than 0 TON");
        return;
    }
    
    if (!file) {
        alert("Please select an image");
        return;
    }
    
    if (!tonConnectUI.connected) {
        alert("Please connect your wallet first!");
        await connectWallet();
        return;
    }
    
    CURRENT_USER_ADDRESS = tonConnectUI.account?.address;
    if (!CURRENT_USER_ADDRESS) {
        alert("Wallet connection error");
        return;
    }
    
    const mintButton = document.getElementById('submit-mint');
    const originalText = mintButton.innerText;
    mintButton.innerText = "Uploading...";
    mintButton.disabled = true;
    
    if (window.showLoader) showLoader("Creating NFT...");
    
    try {
        if (!PINATA_JWT) {
            await loadSecureKeys();
        }
        
        if (!PINATA_JWT) {
            throw new Error("Please configure Pinata JWT in Admin Settings");
        }
        
        // Загрузка на IPFS
        const formData = new FormData();
        formData.append('file', file);
        
        console.log("📤 Uploading to IPFS...");
        const ipfsResponse = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`
            },
            body: formData
        });
        
        if (!ipfsResponse.ok) {
            throw new Error(`IPFS upload failed: ${ipfsResponse.status}`);
        }
        
        const ipfsData = await ipfsResponse.json();
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsData.IpfsHash}`;
        console.log("✅ Image uploaded:", imageUrl);
        
        // Сохранение в Firestore
        const nftData = {
            name: name,
            price: parseFloat(price).toFixed(2),
            image: imageUrl,
            owner: CURRENT_USER_ADDRESS,
            createdAt: Date.now(),
            sold: false,
            ipfsHash: ipfsData.IpfsHash
        };
        
        console.log("💾 Saving to Firestore:", nftData);
        await addDoc(collection(db, "nfts"), nftData);
        
        if (window.hideLoader) hideLoader();
        if (window.showNotification) {
            showNotification(`🎉 NFT "${name}" created!`, 'success');
        }
        
        alert(`✅ NFT "${name}" listed for ${price} TON!`);
        
        // Очистка формы
        closeMintModal();
        document.getElementById('nft-name').value = '';
        document.getElementById('nft-price').value = '';
        fileInput.value = '';
        
        // Обновление списка
        await loadNFTs();
        
    } catch (error) {
        console.error("❌ Minting error:", error);
        
        if (window.hideLoader) hideLoader();
        
        alert(`❌ Error: ${error.message}`);
        
    } finally {
        mintButton.innerText = originalText;
        mintButton.disabled = false;
    }
};

// ================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==================
async function initApp() {
    console.log("🚀 Initializing Royal NFT Market...");
    
    try {
        // 1. Сразу начинаем загрузку NFT
        loadNFTs();
        
        // 2. Загружаем ключи в фоне
        loadSecureKeys().catch(() => {});
        
        // 3. Настраиваем слушатели кошелька
        tonConnectUI.onStatusChange((walletInfo) => {
            if (walletInfo) {
                CURRENT_USER_ADDRESS = walletInfo.account.address;
                console.log("✅ Wallet connected:", CURRENT_USER_ADDRESS);
                
                updateUserInfo();
                
                if (window.showNotification) {
                    showNotification("Wallet connected successfully!", "success");
                }
            } else {
                CURRENT_USER_ADDRESS = "";
                console.log("🔒 Wallet disconnected");
                updateUserInfo();
            }
        });
        
        // 4. Восстанавливаем сессию если была
        if (tonConnectUI.connected) {
            CURRENT_USER_ADDRESS = tonConnectUI.account?.address;
            updateUserInfo();
        }
        
        console.log("✅ Marketplace ready!");
        
    } catch (error) {
        console.error("❌ Initialization error:", error);
    }
}

// ================== ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ==================
document.addEventListener('DOMContentLoaded', initApp);

// ================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==================
// Экспортируем функции для index.html
if (typeof window !== 'undefined') {
    window.loadNFTs = loadNFTs;
    window.applyFilter = applyFilter;
    window.buyNFT = buyNFT;
    window.runMinting = runMinting;
    window.connectWallet = connectWallet;
    window.updateUserInfo = updateUserInfo;
    window.showNotification = showNotification;
    window.showLoader = showLoader;
    window.hideLoader = hideLoader;
}
