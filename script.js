const WebApp = window.Telegram.WebApp;
WebApp.ready();

// ТВОИ ДАННЫЕ PINATA (Замени JWT_HERE на свой полный JWT токен)
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYWMxZDM2Yy04MDVmLTQzYTQtYmQ5My1iNzhmNmM0NTI1MDAiLCJlbWFpbCI6InNhYnRpbThAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjBjNGVhZTZmZGZiYTVmYzM2OTZkIiwic2NvcGVkS2V5U2VjcmV0IjoiYjA0NmFiNjc5MTAyY2IzNGVjOGRjZDNmN2Q5N2Y2OWVhNTNmNDQ3MjUxMDI3NGRjYWU3MjJlYmI0YjAyOTU5MyIsImV4cCI6MTgwMDIwMjY0MH0.uC3hCpCcf2uuxBs3bY5u5d6KHNaGtngHufen-0HZnbw'; 

// Открыть модальное окно
document.getElementById('mint-btn').onclick = () => {
    document.getElementById('mint-modal').style.display = 'block';
};

function closeModal() {
    document.getElementById('mint-modal').style.display = 'none';
}

// Функция загрузки в IPFS
async function uploadToIPFS(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${PINATA_JWT}`
        },
        body: formData
    });
    const json = await res.json();
    return json.IpfsHash; // Возвращает уникальный адрес картинки
}

async function startMinting() {
    const name = document.getElementById('nft-name').value;
    const fileInput = document.getElementById('nft-file');
    const price = document.getElementById('nft-price').value;

    if(!name || !fileInput.files[0] || !price) {
        WebApp.showAlert("Заполни все поля, брат!");
        return;
    }

    const btn = document.getElementById('confirm-mint-btn');
    const originalText = btn.innerText;
    btn.innerText = "Загрузка в IPFS (подожди)...";
    btn.disabled = true;

    try {
        // 1. Загружаем картинку
        const ipfsHash = await uploadToIPFS(fileInput.files[0]);
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        
        console.log("Картинка в IPFS:", imageUrl);

        // 2. Имитируем создание метаданных и минтинг
        WebApp.showConfirm(`Картинка загружена! Создать NFT "${name}" за ${price} TON?`, (confirmed) => {
            if(confirmed) {
                WebApp.showAlert("Успешно! NFT создана. Теперь она появится в витрине.");
                // Тут в будущем будет вызов смарт-контракта
                closeModal();
            }
            btn.innerText = originalText;
            btn.disabled = false;
        });

    } catch (error) {
        console.error(error);
        WebApp.showAlert("Ошибка при загрузке. Проверь токен Pinata.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
