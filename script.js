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

// ================== ЗАГРУЗКА NFT С РЫНКА ==================
async function loadNFTs() {
    const grid = document.getElementById('nft-grid');
    
    // Показываем загрузчик
    grid.innerHTML = `
        <div class="loading-state">
            <div class="loader"></div>
            <p>Loading marketplace...</p>
        </div>
    `;
    
    try {
        // Оптимизированный запрос с сортировкой
        const nftsQuery = query(
            collection(db, "nfts"),
            orderBy("createdAt", "desc"),
            limit(50) // Ограничиваем количество для скорости
        );
        
        const querySnapshot = await getDocs(nftsQuery);
        
        // Сбрасываем массив NFT
        ALL_NFTS = [];
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            ALL_NFTS.push({ 
                id: doc.id, 
                ...data,
                price: parseFloat(data.price || 0)
            });
        });
        
        console.log(`✅ Loaded ${ALL_NFTS.length} NFTs from Firestore`);
        
        // Обновляем статистику
        updateStats();
        
        // Применяем текущий фильтр
        applyFilter(CURRENT_FILTER);
        
    } catch (error) {
        console.error("❌ Error loading NFTs:", error);
        
        // Сообщение об ошибке
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color:#ff4757;">❌</div>
                <h3>Connection Error</h3>
                <p>Could not connect to database. Please refresh.</p>
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
            filteredNFTs.sort((a, b) => a.price - b.price);
            break;
        case 'highest':
            filteredNFTs.sort((a, b) => b.price - a.price);
            break;
        default:
            // 'all' - уже отсортировано по дате при загрузке
            break;
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
    
    nfts.forEach((nft, index) => {
        const div = document.createElement('div');
        div.className = 'nft-card';
        
        // Форматируем адрес владельца
        const ownerShort = nft.owner ? 
            `${nft.owner.slice(0, 4)}...${nft.owner.slice(-4)}` : 
            "Unknown";
        
        // Форматируем цену
        const price = nft.price.toFixed(2);
        
        // Проверяем URL изображения
        const imageUrl = nft.image && nft.image.startsWith('http') ? nft.image : 
            'https://via.placeholder.com/300x300/18202a/8a939b?text=Royal+NFT';
        
        div.innerHTML = `
            <div class="nft-image">
                <img src="${imageUrl}" alt="${nft.name}" 
                     loading="lazy" 
                     style="width:100%; height:100%; object-fit:cover;"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/300x300/18202a/8a939b?text=Royal+NFT';">
            </div>
            <div class="nft-info">
                <h3 class="nft-title">${nft.name || 'Unnamed NFT'}</h3>
                <div class="nft-price">${price} TON</div>
                <p class="nft-owner">Seller: <span>${ownerShort}</span></p>
            </div>
            <div class="nft-actions">
                <button class="buy-btn" onclick="buyNFT('${nft.id}', '${nft.price}', '${nft.owner}')">
                    Buy Now
                </button>
            </div>
        `;
        
        // Добавляем анимацию появления
        div.style.animationDelay = `${index * 0.05}s`;
        grid.appendChild(div);
    });
}

// ================== ПУСТОЕ СОСТОЯНИЕ ==================
function displayEmptyState() {
    const grid = document.getElementById('nft-grid');
    
    grid.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🖼️</div>
            <h3>No NFTs Found</h3>
            <p>The marketplace is currently empty. Be the first to create an NFT!</p>
            <button class="empty-btn" onclick="openMintModal()">+ Create NFT</button>
        </div>
    `;
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

// ================== АВТОМАТИЧЕСКОЕ ПОДКЛЮЧЕНИЕ КОШЕЛЬКА ==================
async function autoConnectWallet() {
    try {
        // Проверяем, есть ли сохраненное соединение
        if (tonConnectUI.connected) {
            CURRENT_USER_ADDRESS = tonConnectUI.account?.address;
            console.log("✅ Wallet already connected:", CURRENT_USER_ADDRESS);
            updateUserInfo();
            return;
        }
        
        // Пробуем восстановить соединение из localStorage
        const savedConnection = localStorage.getItem('tonconnect');
        if (savedConnection) {
            console.log("🔄 Restoring wallet connection...");
            // tonConnectUI автоматически восстановит соединение при инициализации
        }
        
    } catch (error) {
        console.log("ℹ️ No saved wallet connection");
    }
}

// ================== ПОКУПКА NFT ==================
window.buyNFT = async function(nftId, price, sellerAddress) {
    if (!tonConnectUI.connected) {
        // Автоматически открываем модалку подключения
        await tonConnectUI.openModal();
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
    
    // Подтверждение покупки
    const confirmBuy = confirm(`Buy NFT for ${price} TON?\n\nClick OK to confirm in your wallet.`);
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
        
        alert(`✅ Purchase completed!\nTransaction: ${result.boc.slice(0, 10)}...`);
        
        // Обновляем список NFT
        await loadNFTs();
        
    } catch (error) {
        console.error("Transaction error:", error);
        
        if (window.hideLoader) hideLoader();
        
        if (error.message?.includes("cancel") || error.message?.includes("Cancelled")) {
            alert("❌ Transaction cancelled");
        } else {
            alert("❌ Transaction failed: " + error.message);
        }
    }
};

// ================== СОЗДАНИЕ НОВОГО NFT ==================
window.runMinting = async function() {
    const name = document.getElementById('nft-name').value.trim();
    const price = document.getElementById('nft-price').value.trim();
    const fileInput = document.getElementById('nft-file');
    const file = fileInput.files[0];
    
    // Валидация
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
    
    // Проверяем подключение кошелька
    if (!tonConnectUI.connected) {
        alert("Please connect your wallet first!");
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
    mintButton.innerText = "Uploading...";
    mintButton.disabled = true;
    
    if (window.showLoader) showLoader("Creating NFT...");
    
    try {
        // Загружаем JWT если не загружен
        if (!PINATA_JWT) {
            await loadSecureKeys();
        }
        
        if (!PINATA_JWT) {
            throw new Error("Please configure Pinata JWT in Admin Settings");
        }
        
        // Загрузка на IPFS
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
            throw new Error(`IPFS upload failed: ${ipfsResponse.status}`);
        }
        
        const ipfsData = await ipfsResponse.json();
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsData.IpfsHash}`;
        
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
        console.error("Minting error:", error);
        
        if (window.hideLoader) hideLoader();
        
        alert(`❌ Error: ${error.message}`);
        
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
            const shortAddress = `${CURRENT_USER_ADDRESS.slice(0, 4)}...${CURRENT_USER_ADDRESS.slice(-4)}`;
            userAddressEl.textContent = shortAddress;
            userAddressEl.style.color = "#00b09b";
        }
        
        if (userBalanceEl) {
            userBalanceEl.textContent = "Connected";
            userBalanceEl.style.color = "#ffd700";
        }
    }
}

// ================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==================
async function initApp() {
    console.log("🚀 Initializing Royal NFT Market...");
    
    try {
        // 1. Сразу показываем интерфейс
        const grid = document.getElementById('nft-grid');
        grid.innerHTML = `
            <div class="loading-state">
                <div class="loader"></div>
                <p>Initializing marketplace...</p>
            </div>
        `;
        
        // 2. Загружаем ключи (не блокируем основную загрузку)
        loadSecureKeys().catch(() => {});
        
        // 3. Автоматически пробуем подключить кошелек
        autoConnectWallet();
        
        // 4. Загружаем NFT
        await loadNFTs();
        
        // 5. Настраиваем слушатели кошелька
        tonConnectUI.onStatusChange((walletInfo) => {
            if (walletInfo) {
                CURRENT_USER_ADDRESS = walletInfo.account.address;
                console.log("✅ Wallet connected:", CURRENT_USER_ADDRESS);
                
                updateUserInfo();
                
                // Сохраняем соединение
                localStorage.setItem('tonconnect', 'connected');
                
                if (window.showNotification) {
                    showNotification("Wallet connected!", "success");
                }
            } else {
                CURRENT_USER_ADDRESS = "";
                console.log("🔒 Wallet disconnected");
                localStorage.removeItem('tonconnect');
                updateUserInfo();
            }
        });
        
        // 6. Автоматически открываем подключение если не подключены
        setTimeout(() => {
            if (!tonConnectUI.connected && !CURRENT_USER_ADDRESS) {
                console.log("🔄 Auto-opening wallet connection...");
                // tonConnectUI.openModal(); // Раскомментировать если нужно автоподключение
            }
        }, 2000);
        
        console.log("✅ Marketplace ready!");
        
    } catch (error) {
        console.error("❌ Initialization error:", error);
        
        const grid = document.getElementById('nft-grid');
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color:#ff4757;">⚠️</div>
                <h3>Initialization Error</h3>
                <p>Please refresh the page</p>
                <button class="empty-btn" onclick="window.location.reload()" style="background:#2081e2;">Refresh</button>
            </div>
        `;
    }
}

// ================== ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ==================
document.addEventListener('DOMContentLoaded', initApp);

// ================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==================
// Эти функции уже есть в index.html, но экспортируем их для доступа
if (typeof window !== 'undefined') {
    window.loadNFTs = loadNFTs;
    window.applyFilter = applyFilter;
    window.buyNFT = buyNFT;
    window.runMinting = runMinting;
    window.showNotification = showNotification;
    window.showLoader = showLoader;
    window.hideLoader = hideLoader;
}
