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
    
    // Показываем загрузчик
    grid.innerHTML = `
        <div class="loading-state">
            <div class="loader"></div>
            <p>Loading NFTs from marketplace...</p>
        </div>
    `;
    
    try {
        const querySnapshot = await getDocs(collection(db, "nfts"));
        
        // Сбрасываем массив NFT
        ALL_NFTS = [];
        
        querySnapshot.forEach(doc => {
            ALL_NFTS.push({ id: doc.id, ...doc.data() });
        });
        
        // Обновляем статистику
        updateStats(ALL_NFTS.length);
        
        // Применяем текущий фильтр
        applyFilter(CURRENT_FILTER);
        
    } catch (error) {
        console.error("Error loading NFTs:", error);
        
        // Сообщение об ошибке
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color:#ff4757;">❌</div>
                <h3>Error Loading NFTs</h3>
                <p>Failed to load marketplace. Please check your connection.</p>
                <button class="empty-btn" onclick="loadNFTs()" style="background:#ff4757;">Try Again</button>
            </div>
        `;
    }
}

// ================== ФИЛЬТРАЦИЯ NFT ==================
window.applyFilter = function(filterType) {
    CURRENT_FILTER = filterType;
    
    if (ALL_NFTS.length === 0) {
        displayEmptyState();
        return;
    }
    
    let filteredNFTs = [...ALL_NFTS];
    
    // Применяем фильтры
    switch(filterType) {
        case 'newest':
            filteredNFTs.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'lowest':
            filteredNFTs.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
            break;
        case 'highest':
            filteredNFTs.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
            break;
        default:
            // 'all' - оставляем как есть или сортируем по дате
            filteredNFTs.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    // Отображаем отфильтрованные NFT
    displayNFTs(filteredNFTs);
}

// ================== ОТОБРАЖЕНИЕ NFT ==================
function displayNFTs(nfts) {
    const grid = document.getElementById('nft-grid');
    
    if (nfts.length === 0) {
        displayEmptyState();
        return;
    }
    
    grid.innerHTML = '';
    
    nfts.forEach(nft => {
        const div = document.createElement('div');
        div.className = 'nft-card';
        
        // Форматируем адрес владельца
        const ownerShort = nft.owner ? 
            `${nft.owner.slice(0, 6)}...${nft.owner.slice(-4)}` : 
            "Unknown";
        
        // Форматируем цену
        const price = parseFloat(nft.price || 0).toFixed(2);
        
        // Проверяем URL изображения
        const imageUrl = nft.image && nft.image.startsWith('http') ? nft.image : 
            'https://via.placeholder.com/300x300/18202a/8a939b?text=Royal+NFT';
        
        div.innerHTML = `
            <div class="nft-image">
                <img src="${imageUrl}" alt="${nft.name}" 
                     loading="lazy" style="width:100%; height:100%; object-fit:cover;"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/300x300/18202a/8a939b?text=Royal+NFT';">
            </div>
            <div class="nft-info">
                <h3 class="nft-title">${nft.name || 'Unnamed NFT'}</h3>
                <div class="nft-price">${price} TON</div>
                <p class="nft-owner">By: <span>${ownerShort}</span></p>
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

// ================== ПУСТОЕ СОСТОЯНИЕ ==================
function displayEmptyState() {
    const grid = document.getElementById('nft-grid');
    
    grid.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🖼️</div>
            <h3>Marketplace is Empty</h3>
            <p>Be the first to list an NFT! Create unique digital assets and start trading.</p>
            <button class="empty-btn" onclick="openMintModal()">Create First NFT</button>
        </div>
    `;
}

// ================== ОБНОВЛЕНИЕ СТАТИСТИКИ ==================
function updateStats(count) {
    document.getElementById('total-nfts').textContent = count;
    
    // Считаем уникальных продавцов
    const uniqueSellers = new Set(ALL_NFTS.map(nft => nft.owner)).size;
    document.getElementById('active-sellers').textContent = uniqueSellers;
    
    // Считаем общий объем
    const totalVolume = ALL_NFTS.reduce((sum, nft) => sum + parseFloat(nft.price || 0), 0);
    document.getElementById('total-volume').textContent = totalVolume.toFixed(1);
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
    
    const confirmBuy = confirm(`Buy this NFT for ${price} TON?\n\nThis will open your wallet to confirm the transaction.`);
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
        if (window.showLoader) showLoader("Processing transaction...");
        
        const result = await tonConnectUI.sendTransaction(transaction);
        
        if (window.hideLoader) hideLoader();
        if (window.showNotification) {
            showNotification(`✅ Purchase successful!`, 'success');
        }
        
        alert(`✅ Purchase successful!\nTransaction completed.`);
        
        // Перезагружаем список NFT
        await loadNFTs();
        
    } catch (error) {
        console.error("Transaction error:", error);
        
        if (window.hideLoader) hideLoader();
        
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
    
    if (window.showLoader) showLoader("Creating NFT...");
    
    try {
        if (!PINATA_JWT) {
            await loadSecureKeys();
        }
        
        if (!PINATA_JWT) {
            throw new Error("Pinata JWT not configured. Please set it in Admin Settings.");
        }
        
        // Загружаем изображение на IPFS
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
        
        // Сохраняем данные в Firestore
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
        
        if (window.hideLoader) hideLoader();
        if (window.showNotification) {
            showNotification(`🎉 NFT "${name}" listed successfully!`, 'success');
        }
        
        alert(`🎉 NFT "${name}" successfully listed!\n\nPrice: ${price} TON\nView it in the marketplace.`);
        
        // Закрываем модалку и очищаем форму
        closeMintModal();
        document.getElementById('nft-name').value = '';
        document.getElementById('nft-price').value = '';
        fileInput.value = '';
        
        // Обновляем список NFT
        await loadNFTs();
        
    } catch (error) {
        console.error("❌ Minting error:", error);
        
        if (window.hideLoader) hideLoader();
        
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

// ================== ОБНОВЛЕНИЕ ИНФОРМАЦИИ ПОЛЬЗОВАТЕЛЯ ==================
function updateUserInfo() {
    if (CURRENT_USER_ADDRESS) {
        const userAddressEl = document.getElementById('user-address');
        const userBalanceEl = document.getElementById('user-balance');
        
        if (userAddressEl) {
            userAddressEl.textContent = `${CURRENT_USER_ADDRESS.slice(0, 6)}...${CURRENT_USER_ADDRESS.slice(-4)}`;
        }
        
        if (userBalanceEl) {
            // Здесь можно добавить получение баланса кошелька
            userBalanceEl.textContent = "0 TON"; // Заглушка
        }
    }
}

// ================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==================
async function initApp() {
    console.log("🚀 Initializing Royal NFT Market...");
    
    // Загружаем безопасные ключи
    await loadSecureKeys();
    
    // Загружаем NFT
    await loadNFTs();
    
    // Настраиваем слушатели для TON Connect
    tonConnectUI.onStatusChange((walletInfo) => {
        if (walletInfo) {
            CURRENT_USER_ADDRESS = walletInfo.account.address;
            console.log("✅ Wallet connected:", CURRENT_USER_ADDRESS);
            
            // Обновляем информацию в меню
            updateUserInfo();
            
            if (window.showNotification) {
                showNotification("Wallet connected!", "success");
            }
        } else {
            CURRENT_USER_ADDRESS = "";
            console.log("🔒 Wallet disconnected");
            updateUserInfo();
        }
    });
    
    console.log("✅ App initialized successfully");
}

// ================== ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ==================
document.addEventListener('DOMContentLoaded', initApp);
