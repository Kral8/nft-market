import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================== FIREBASE CONFIG ================== */
const firebaseConfig = {
    apiKey: "AIzaSyBT0bsUtte387SIkm3N2hddlvEFSVhB9RU",
    authDomain: "royal-nft.firebaseapp.com",
    projectId: "royal-nft",
    storageBucket: "royal-nft.firebasestorage.app",
    messagingSenderId: "616712040035",
    appId: "1:616712040035:web:59e449b2215e4126951256"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================== TON CONNECT ================== */
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: window.location.origin + '/tonconnect-manifest.json',
    buttonRootId: 'ton-connect-btn'
});

/* ================== STATE ================== */
let ALL_NFTS = [];
let CURRENT_USER_ADDRESS = "";

/* ================== LOAD NFTS ================== */
async function loadNFTs() {
    const grid = document.getElementById('nft-grid');

    grid.innerHTML = `
        <div class="loading-state">
            <div class="loader"></div>
            <p>Loading marketplace...</p>
        </div>
    `;

    try {
        console.log("🔥 Loading NFTs from Firestore...");

        const snapshot = await getDocs(collection(db, "nfts"));

        if (snapshot.empty) {
            console.warn("⚠️ No NFTs in database");
            showNoNFTs();
            return;
        }

        ALL_NFTS = [];

        snapshot.forEach(doc => {
            const d = doc.data();

            ALL_NFTS.push({
                id: doc.id,
                name: d.name || "Unnamed NFT",
                image: d.image || "",
                owner: d.owner || "Unknown",
                createdAt: Number(d.createdAt) || Date.now(),
                price: Number(d.price) || 0
            });
        });

        console.log("✅ Loaded NFTs:", ALL_NFTS);
        displayNFTs(ALL_NFTS);
        updateStats();

    } catch (err) {
        console.error("❌ Firestore READ FAILED:", err);

        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Database Error</h3>
                <p>${err.message}</p>
                <button class="empty-btn" onclick="loadNFTs()">Retry</button>
            </div>
        `;
    }
}

/* ================== DISPLAY ================== */
function displayNFTs(list) {
    const grid = document.getElementById('nft-grid');
    if (!list.length) {
        showNoNFTs();
        return;
    }

    grid.innerHTML = list.map(nft => `
        <div class="nft-card">
            <div class="nft-image">
                <img src="${nft.image}" alt="${nft.name}" loading="lazy">
            </div>
            <div class="nft-info">
                <h3 class="nft-title">${nft.name}</h3>
                <div class="nft-price">${nft.price.toFixed(2)} TON</div>
                <p class="nft-owner">Owner: <span>${shortAddr(nft.owner)}</span></p>
            </div>
            <div class="nft-actions">
                <button class="buy-btn"
                    onclick="buyNFT('${nft.id}', '${nft.price}', '${nft.owner}')">
                    Buy Now
                </button>
            </div>
        </div>
    `).join('');
}

/* ================== HELPERS ================== */
function shortAddr(addr) {
    if (!addr || addr.length < 10) return addr;
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function showNoNFTs() {
    document.getElementById('nft-grid').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🖼️</div>
            <h3>No NFTs yet</h3>
            <p>Create the first NFT on Royal Market</p>
        </div>
    `;
}

/* ================== STATS ================== */
function updateStats() {
    document.getElementById('total-nfts').textContent = ALL_NFTS.length;
    document.getElementById('active-sellers').textContent =
        new Set(ALL_NFTS.map(n => n.owner)).size;
    document.getElementById('total-volume').textContent =
        ALL_NFTS.reduce((s, n) => s + n.price, 0).toFixed(2);
}

/* ================== BUY ================== */
window.buyNFT = async function(id, price, seller) {
    if (!tonConnectUI.connected) {
        alert("Connect wallet first");
        return;
    }

    if (tonConnectUI.account.address === seller) {
        alert("You own this NFT");
        return;
    }

    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
            address: seller,
            amount: (price * 1e9).toString()
        }]
    };

    try {
        await tonConnectUI.sendTransaction(tx);
        alert("Purchase successful");
    } catch (e) {
        alert("Transaction failed");
    }
};

/* ================== INIT ================== */
document.addEventListener('DOMContentLoaded', () => {
    loadNFTs();

    tonConnectUI.onStatusChange(w => {
        CURRENT_USER_ADDRESS = w ? w.account.address : "";
    });
});
