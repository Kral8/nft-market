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
  manifestUrl: "https://kral8.github.io/nft-market/tonconnect-manifest.json" // Исправил на твой рабочий манифест
});

// АДРЕС ТВОЕГО КОНТРАКТА КОЛЛЕКЦИИ
const COLLECTION_ADDRESS = "kQAauN1VLtEh9x9aZkOHqWnngiNwSe0bVkYhM6-cqtGqVU8Y";
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
    const addr = document.getElementById("wallet-address");
    if(addr) addr.innerText = CURRENT_USER.slice(0, 6) + "..." + CURRENT_USER.slice(-4);
  } else {
    CURRENT_USER = "";
    const addr = document.getElementById("wallet-address");
    if(addr) addr.innerText = "";
  }
});

/* ================= LOAD NFT ================= */
async function loadNFTs() {
  const grid = document.getElementById("nft-grid");
  if (!grid) return;
  grid.innerHTML = `<div class="loader"></div>`;

  try {
    const snap = await getDocs(collection(db, "nfts"));
    let all_nfts = [];

    snap.forEach(d => {
      all_nfts.push({ id: d.id, ...d.data() });
    });

    renderNFTs(all_nfts);
  } catch (e) {
    console.error(e);
    grid.innerHTML = "<p style='color:red'>Firebase error</p>";
  }
}

/* ================= RENDER ================= */
function renderNFTs(list) {
  const grid = document.getElementById("nft-grid");
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = "<p>No NFTs yet</p>";
    return;
  }

  grid.innerHTML = list.map(nft => `
    <div class="nft-card">
      <img src="${nft.image}">
      <h3>${nft.name}</h3>
      <p>Owner: ${short(nft.owner)}</p>
      <strong>${nft.price} TON</strong>
      ${nft.owner !== CURRENT_USER ? `
        <button class="buy-btn" onclick="buyNFT('${nft.id}', '${nft.owner}', ${nft.price})">
          Buy
        </button>` : `<span class="badge">Your NFT</span>`}
    </div>
  `).join("");
}

function short(addr) {
  if(!addr) return "Unknown";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

/* ================= MINT NFT (Взаимодействие с контрактом) ================= */
window.runMinting = async (name, image, price) => {
  if (!tonConnectUI.connected || !CURRENT_USER) {
    alert("Please connect wallet first!");
    tonConnectUI.openModal();
    return;
  }

  try {
    // Payload для сообщения "Mint" (тот самый код для твоего контракта)
    const payload = "te6cckEBAQEADgAAGJRqmLYAAAAAAAAAAOnNeQ0=";

    // Отправляем транзакцию именно в СМАРТ-КОНТРАКТ
    await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [{
        address: COLLECTION_ADDRESS, 
        amount: (0.2 * 1e9).toString(), // Контракт ждет 0.2 TON для минта
        payload: payload
      }]
    });

    // Если транзакция прошла, записываем данные в Firebase
    await addDoc(collection(db, "nfts"), {
      name,
      image,
      price: 0.2, // Цена минта
      owner: CURRENT_USER,
      creator: CURRENT_USER,
      createdAt: Date.now()
    });

    alert("NFT Minting started! Check your wallet in a minute.");
    loadNFTs();
  } catch (e) {
    console.error(e);
    alert("Minting failed or cancelled.");
  }
};

/* ================= BUY NFT (Вторичный рынок) ================= */
window.buyNFT = async (id, seller, price) => {
  if (!tonConnectUI.connected) { alert("Connect wallet!"); return; }

  try {
    await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [{
        address: seller,
        amount: (price * 1e9).toString()
      }]
    });

    await updateDoc(doc(db, "nfts", id), { owner: CURRENT_USER });
    loadNFTs();
  } catch (e) { console.error(e); }
};

document.addEventListener("DOMContentLoaded", loadNFTs);
