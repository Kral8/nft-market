import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= FIREBASE ================= */
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

/* ================= TON ================= */
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
  manifestUrl: "https://cute-rugelach-0f683f.netlify.app/tonconnect-manifest.json",
  buttonRootId: "connect-wallet"
});

window.connectWallet = async () => {
  try {
    await tonConnectUI.openModal();
  } catch (e) {
    alert("Wallet connection error");
    console.error(e);
  }
};

tonConnectUI.onStatusChange(wallet => {
  if (wallet) {
    console.log("Connected:", wallet.account.address);
    document.getElementById("wallet-address").innerText =
      wallet.account.address.slice(0, 6) + "..." + wallet.account.address.slice(-4);
  }
});

/* ================= GLOBAL ================= */
const MARKET_OWNER = "UQB_rYz84GULTmhLKuOGa6731bsuT-nLELiem9p-u2qI_D98";
let CURRENT_USER = "";
let ALL_NFTS = [];
let CURRENT_TAB = "all";

/* ================= LOAD NFT ================= */
async function loadNFTs() {
    const grid = document.getElementById("nft-grid");
    grid.innerHTML = `<div class="loader"></div>`;

    try {
        const snap = await getDocs(collection(db, "nfts"));
        ALL_NFTS = [];

        snap.forEach(doc => {
            const d = doc.data();
            ALL_NFTS.push({
                id: doc.id,
                name: d.name,
                image: d.image,
                price: Number(d.price),
                owner: d.owner,
                creator: d.creator,
                listed: d.listed !== false,
                featured: d.featured === true,
                createdAt: d.createdAt || 0
            });
        });

        renderNFTs(ALL_NFTS);
        updateStats();

    } catch (e) {
        console.error(e);
        grid.innerHTML = "<p style='color:red;text-align:center'>Firebase read error</p>";
    }
}

/* ================= RENDER ================= */
function renderNFTs(list) {
    const grid = document.getElementById("nft-grid");
    if (!list.length) {
        grid.innerHTML = "<p style='text-align:center;color:#8a939b'>No NFTs yet</p>";
        return;
    }

    grid.innerHTML = list.map(nft => `
        <div class="nft-card">
            <div class="nft-image">
                <img src="${nft.image}">
            </div>
            <div class="nft-info">
                <h3>${nft.name}</h3>
                <div class="nft-price">${nft.price} TON</div>
                <p class="nft-owner">${short(nft.owner)}</p>
            </div>
            <div class="nft-actions">
                <button class="buy-btn" onclick="buyNFT('${nft.owner}', ${nft.price})">
                    Buy
                </button>
            </div>
        </div>
    `).join("");
}

function short(addr) {
    return addr.slice(0,6) + "..." + addr.slice(-4);
}

/* ================= FILTER ================= */
window.applyFilter = function(type) {
    CURRENT_TAB = type;
    let data = [...ALL_NFTS];

    if (type === "new") data.sort((a,b)=>b.createdAt-a.createdAt);
    if (type === "price_low") data.sort((a,b)=>a.price-b.price);
    if (type === "price_high") data.sort((a,b)=>b.price-a.price);
    if (type === "featured") data = data.filter(n=>n.featured);

    renderNFTs(data);
}

/* ================= BUY ================= */
window.buyNFT = async function(seller, price) {
    if (!tonConnectUI.connected) {
        alert("Connect wallet");
        return;
    }

    await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now()/1000)+300,
        messages: [{
            address: seller,
            amount: (price * 1e9).toString()
        }]
    });

    alert("Purchase success");
};

/* ================= CREATE NFT ================= */
window.runMinting = async function(name, image, price) {
    if (!CURRENT_USER) return alert("Connect wallet");

    // платёж маркету
    await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now()/1000)+300,
        messages: [{
            address: MARKET_OWNER,
            amount: (0.3 * 1e9).toString() // комиссия
        }]
    });

    await addDoc(collection(db, "nfts"), {
        name,
        image,
        price,
        owner: CURRENT_USER,
        creator: CURRENT_USER,
        listed: true,
        featured: false,
        createdAt: Date.now()
    });

    loadNFTs();
};

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
    loadNFTs();

    tonConnectUI.onStatusChange(wallet => {
        CURRENT_USER = wallet ? wallet.account.address : "";
    });
});
