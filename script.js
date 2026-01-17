import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const MY_WALLET = "UQB_rYz84GULTmhLKuOGa6731bsuT-nLELiem9p-u2qI_D98";
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYWMxZDM2Yy04MDVmLTQzYTQtYmQ5My1iNzhmNmM0NTI1MDAiLCJlbWFpbCI6InNhYnRpbThAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjBjNGVhZTZmZGZiYTVmYzM2OTZkIiwic2NvcGVkS2V5U2VjcmV0IjoiYjA0NmFiNjc5MTAyY2IzNGVjOGRjZDNmN2Q5N2Y2OWVhNTNmNDQ3MjUxMDI3NGRjYWU3MjJlYmI0YjAyOTU5MyIsImV4cCI6MTgwMDIwMjY0MH0.uC3hCpCcf2uuxBs3bY5u5d6KHNaGtngHufen-0HZnbw";

const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://kral8.github.io/nft-market/tonconnect-manifest.json',
    buttonRootId: 'ton-connect-btn'
});

window.openMintModal = () => document.getElementById('mint-modal').style.display = 'block';
window.closeMintModal = () => document.getElementById('mint-modal').style.display = 'none';

window.processPayment = async (price) => {
    if (!tonConnectUI.connected) {
        await tonConnectUI.openModal();
        return;
    }
    const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address: MY_WALLET, amount: (parseFloat(price) * 1000000000).toString() }]
    };
    try { await tonConnectUI.sendTransaction(tx); alert("Success!"); } catch (e) { alert("Canceled"); }
};

async function loadNFTs() {
    const grid = document.getElementById('nft-grid');
    try {
        const snap = await getDocs(collection(db, "nfts")); // Упрощенный запрос
        grid.innerHTML = '';
        
        if (snap.empty) {
            grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:gray; padding:20px;">No NFTs in database. Create your first one!</p>';
            return;
        }

        snap.forEach(doc => {
            const nft = doc.data();
            const div = document.createElement('div');
            div.className = 'nft-card';
            div.innerHTML = `
                <img src="${nft.image}" style="width:100%; border-radius:10px 10px 0 0; aspect-ratio:1/1; object-fit:cover;">
                <div style="padding:10px; background: #18202a;">
                    <b style="color:white; display:block; font-size:16px;">${nft.name}</b>
                    <span style="color:#ffd700; font-weight:bold;">${nft.price} TON</span>
                </div>
                <button onclick="window.processPayment('${nft.price}')" style="width:100%; background:#2081e2; color:white; border:none; padding:12px; border-radius:0 0 10px 10px; font-weight:bold; cursor:pointer;">Buy Now</button>
            `;
            grid.appendChild(div);
        });
    } catch (e) {
        grid.innerHTML = '<p style="color:red; text-align:center; grid-column:1/-1;">Error: ' + e.message + '</p>';
    }
}

window.startMinting = async () => {
    const name = document.getElementById('nft-name').value;
    const price = document.getElementById('nft-price').value;
    const file = document.getElementById('nft-file').files[0];
    if(!name || !price || !file) return alert("Please fill all fields and select a file.");

    const btn = document.getElementById('submit-mint');
    btn.innerText = "Minting..."; btn.disabled = true;

    try {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
            body: fd
        });
        const data = await res.json();
        const imgUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
        
        await addDoc(collection(db, "nfts"), { 
            name: name, 
            price: price, 
            image: imgUrl, 
            createdAt: Date.now() 
        });
        
        window.closeMintModal();
        await loadNFTs();
    } catch (e) {
        alert("Upload Error: " + e.message);
    } finally {
        btn.innerText = "Create"; btn.disabled = false;
    }
};

loadNFTs();
