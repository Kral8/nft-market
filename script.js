import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Initialize TON Connect
window.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://kral8.github.io/nft-market/tonconnect-manifest.json',
    buttonRootId: 'ton-connect-btn'
});

const MY_WALLET = "UQB_rYz84GULTmhLKuOGa6731bsuT-nLELiem9p-u2qI_D98";
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYWMxZDM2Yy04MDVmLTQzYTQtYmQ5My1iNzhmNmM0NTI1MDAiLCJlbWFpbCI6InNhYnRpbThAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjBjNGVhZTZmZGZiYTVmYzM2OTZkIiwic2NvcGVkS2V5U2VjcmV0IjoiYjA0NmFiNjc5MTAyY2IzNGVjOGRjZDNmN2Q5N2Y2OWVhNTNmNDQ3MjUxMDI3NGRjYWU3MjJlYmI0YjAyOTU5MyIsImV4cCI6MTgwMDIwMjY0MH0.uC3hCpCcf2uuxBs3bY5u5d6KHNaGtngHufen-0HZnbw";

// Load NFTs
async function loadNFTs() {
    const grid = document.getElementById('nft-grid');
    grid.innerHTML = '<p>Searching blockchain...</p>';
    
    try {
        const q = query(collection(db, "nfts"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        grid.innerHTML = '';
        
        snap.forEach(doc => {
            const nft = doc.data();
            const card = document.createElement('div');
            card.className = 'nft-card';
            card.innerHTML = `
                <img src="${nft.image}" alt="nft">
                <div class="nft-info">
                    <h3>Royal Collection</h3>
                    <span class="name">${nft.name}</span>
                    <span class="price-tag">${nft.price} TON</span>
                </div>
                <button class="buy-btn" onclick="processPayment('${nft.price}')">Buy Now</button>
            `;
            grid.appendChild(card);
        });
    } catch (e) { grid.innerHTML = '<p>Error loading NFTs.</p>'; }
}

window.processPayment = async (amount) => {
    if (!window.tonConnectUI.connected) {
        await window.tonConnectUI.openModal();
        return;
    }
    const tx = {
        validUntil: Math.floor(Date.now()/1000) + 600,
        messages: [{ address: MY_WALLET, amount: (parseFloat(amount)*1000000000).toString() }]
    };
    try { await window.tonConnectUI.sendTransaction(tx); alert("Victory! NFT is yours."); }
    catch (e) { alert("Payment declined."); }
}

window.openMintModal = () => document.getElementById('mint-modal').style.display = 'block';
window.closeMintModal = () => document.getElementById('mint-modal').style.display = 'none';

window.startMinting = async () => {
    const name = document.getElementById('nft-name').value;
    const price = document.getElementById('nft-price').value;
    const file = document.getElementById('nft-file').files[0];
    
    if(!name || !price || !file) return alert("Complete all fields!");
    
    const btn = document.getElementById('submit-mint');
    btn.innerText = "Uploading to IPFS..."; btn.disabled = true;

    try {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
            body: fd
        });
        const data = await res.json();
        const imgUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;

        await addDoc(collection(db, "nfts"), { name, price, image: imgUrl, createdAt: Date.now() });
        window.closeMintModal();
        loadNFTs();
    } catch (e) { alert("Minting failed."); }
    finally { btn.innerText = "Create & List"; btn.disabled = false; }
}

loadNFTs();
