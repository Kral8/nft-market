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

// 1. Сразу инициализируем TON Connect, не дожидаясь базы
try {
    window.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: 'https://kral8.github.io/nft-market/tonconnect-manifest.json',
        buttonRootId: 'ton-connect-btn'
    });
} catch (e) {
    console.error("TON Connect Error:", e);
}

const MY_WALLET = "UQB_rYz84GULTmhLKuOGa6731bsuT-nLELiem9p-u2qI_D98";
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYWMxZDM2Yy04MDVmLTQzYTQtYmQ5My1iNzhmNmM0NTI1MDAiLCJlbWFpbCI6InNhYnRpbThAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjBjNGVhZTZmZGZiYTVmYzM2OTZkIiwic2NvcGVkS2V5U2VjcmV0IjoiYjA0NmFiNjc5MTAyY2IzNGVjOGRjZDNmN2Q5N2Y2OWVhNTNmNDQ3MjUxMDI3NGRjYWU3MjJlYmI0YjAyOTU5MyIsImV4cCI6MTgwMDIwMjY0MH0.uC3hCpCcf2uuxBs3bY5u5d6KHNaGtngHufen-0HZnbw";

// 2. Функция загрузки
async function loadNFTs() {
    const grid = document.getElementById('nft-grid');
    if (!grid) return;

    // Таймер на случай зависания
    const timer = setTimeout(() => {
        if (grid.innerHTML.includes('Connecting')) {
            grid.innerHTML = '<button onclick="location.reload()" style="background:#ffd700; border:none; padding:10px; border-radius:8px; grid-column:1/-1;">Connection slow, tap to retry</button>';
        }
    }, 7000);

    try {
        const q = query(collection(db, "nfts"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        clearTimeout(timer);
        grid.innerHTML = '';
        
        if (snap.empty) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #8a939b;">No NFTs found. Create the first one!</p>';
            return;
        }

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
    } catch (e) { 
        console.error("Firebase Error:", e);
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">Connection Error. Check your internet.</p>`;
    }
}

// 3. Глобальные функции
window.processPayment = async (amount) => {
    if (!window.tonConnectUI.connected) {
        await window.tonConnectUI.openModal();
        return;
    }
    const tx = {
        validUntil: Math.floor(Date.now()/1000) + 600,
        messages: [{ address: MY_WALLET, amount: (parseFloat(amount)*1000000000).toString() }]
    };
    try { 
        await window.tonConnectUI.sendTransaction(tx); 
        alert("Success!"); 
    } catch (e) { 
        alert("Transaction canceled"); 
    }
};

window.startMinting = async () => {
    const name = document.getElementById('nft-name').value;
    const price = document.getElementById('nft-price').value;
    const file = document.getElementById('nft-file').files[0];
    
    if(!name || !price || !file) return alert("Fill all fields!");
    
    const btn = document.getElementById('submit-mint');
    const originalText = btn.innerText;
    btn.innerText = "Processing..."; btn.disabled = true;

    try {
        const fd = new FormData(); 
        fd.append('file', file);
        
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
        alert("Upload error. Try a smaller image."); 
    } finally { 
        btn.innerText = originalText; 
        btn.disabled = false; 
    }
};

// Запуск
loadNFTs();
