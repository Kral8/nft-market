import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

/* ================= TON CONNECT ================= */
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
  manifestUrl: "https://cute-rugelach-0f683f.netlify.app/tonconnect-manifest.json"
});

let CURRENT_USER = "";

/* ================= CONNECT ================= */
window.connectWallet = async () => {
  try {
    await tonConnectUI.openModal();
  } catch (e) {
    alert("Wallet connection failed");
    console.error(e);
  }
};

tonConnectUI.onStatusChange(wallet => {
  if (wallet && wallet.account?.address) {
    CURRENT_USER = wallet.account.address;
    document.getElementById("wallet-address").innerText =
      CURRENT_USER.slice(0, 6) + "..." + CURRENT_USER.slice(-4);
  } else {
    CURRENT_USER = "";
    document.getElementById("wallet-address").innerText = "";
  }
});

/* ================= GLOBAL ================= */
const MARKET_OWNER = "UQB_rYz84GULTmhLKuOGa6731bsuT-nLELiem9p-u2qI_D98";
let ALL_NFTS = [];

/* ================= LOAD NFT ================= */
async function loadNFTs() {
  const grid = document.getElementById("nft-grid");
  grid.innerHTML = `<div class="loader"></div>`;

  try {
    const snap = await getDocs(collection(db, "nfts"));
    ALL_NFTS = [];

    snap.forEach(d => {
      const n = d.data();
      ALL_NFTS.push({
        id: d.id,
        ...n
      });
    });

    renderNFTs(ALL_NFTS);

  } catch (e) {
    console.error(e);
    grid.innerHTML = "<p style='color:red'>Firebase error</p>";
  }
}

/* ================= RENDER ================= */
function renderNFTs(list) {
  const grid = document.getElementById("nft-grid");

  if (!list.length) {
    grid.innerHTML = "<p>No NFTs yet</p>";
    return;
  }

  grid.innerHTML = list.map(nft => `
    <div class="nft-card">
      <img src="${nft.image}">
      <h3>${nft.name}</h3>
      <p>${short(nft.owner)}</p>
      <strong>${nft.price} TON</strong>
      ${nft.owner !== CURRENT_USER ? `
        <button onclick="buyNFT('${nft.id}', '${nft.owner}', ${nft.price})">
          Buy
        </button>` : `<span>Your NFT</span>`}
    </div>
  `).join("");
}

function short(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

/* ================= BUY NFT ================= */
window.buyNFT = async (id, seller, price) => {
  if (!tonConnectUI.connected || !CURRENT_USER) {
    alert("Connect wallet first");
    return;
  }

  await tonConnectUI.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [{
      address: seller,
      amount: (price * 1e9).toString()
    }]
  });

  await updateDoc(doc(db, "nfts", id), {
    owner: CURRENT_USER
  });

  loadNFTs();
};

/* ================= MINT NFT ================= */
window.runMinting = async (name, image, price) => {
  if (!CURRENT_USER) {
    alert("Connect wallet");
    return;
  }

  // комиссия маркету
  await tonConnectUI.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [{
      address: MARKET_OWNER,
      amount: (0.3 * 1e9).toString()
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
document.addEventListener("DOMContentLoaded", loadNFTs);
