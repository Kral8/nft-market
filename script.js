const WebApp = window.Telegram.WebApp;
WebApp.ready();
WebApp.expand();

const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYWMxZDM2Yy04MDVmLTQzYTQtYmQ5My1iNzhmNmM0NTI1MDAiLCJlbWFpbCI6InNhYnRpbThAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjBjNGVhZTZmZGZiYTVmYzM2OTZkIiwic2NvcGVkS2V5U2VjcmV0IjoiYjA0NmFiNjc5MTAyY2IzNGVjOGRjZDNmN2Q5N2Y2OWVhNTNmNDQ3MjUxMDI3NGRjYWU3MjJlYmI0YjAyOTU5MyIsImV4cCI6MTgwMDIwMjY0MH0.uC3hCpCcf2uuxBs3bY5u5d6KHNaGtngHufen-0HZnbw';

document.getElementById('mint-btn-main').onclick = () => {
    document.getElementById('mint-modal').style.display = 'block';
};

function closeModal() {
    document.getElementById('mint-modal').style.display = 'none';
}

async function uploadToIPFS(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
        body: formData
    });
    const json = await res.json();
    return json.IpfsHash;
}

async function startMinting() {
    const name = document.getElementById('nft-name').value;
    const price = document.getElementById('nft-price').value;
    const fileInput = document.getElementById('nft-file');

    if(!name || !price || !fileInput.files[0]) {
        WebApp.showAlert("Please fill all fields!");
        return;
    }

    const btn = document.getElementById('confirm-mint-btn');
    btn.innerText = "Uploading to Cloud...";
    btn.disabled = true;

    try {
        const hash = await uploadToIPFS(fileInput.files[0]);
        const imgUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;

        // Добавляем на витрину
        const grid = document.getElementById('nft-display-area');
        const card = document.createElement('div');
        card.className = 'nft-card';
        card.innerHTML = `
            <img src="${imgUrl}" alt="nft">
            <h3>${name}</h3>
            <p>${parseFloat(price).toFixed(2)} TON</p>
            <button class="buy-btn" onclick="WebApp.showAlert('Purchase initialized!')">Buy Now</button>
        `;
        grid.prepend(card);

        WebApp.showAlert("Success! Your NFT is now live.");
        closeModal();
    } catch (e) {
        WebApp.showAlert("Error uploading image.");
    } finally {
        btn.innerText = "Create & Post";
        btn.disabled = false;
    }
}
