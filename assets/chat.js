const API = 'http://localhost:5000';
const qs = new URLSearchParams(location.search);
const buyer = localStorage.getItem('userId') || 'guest';
const seller = qs.get('seller');
const product = qs.get('pid');
const chatBox = document.getElementById('chatBox');
const msgInput = document.getElementById('msgInput');

async function loadMessages() {
  const res = await fetch(`${API}/api/chats?buyer=${buyer}&seller=${seller}&product=${product}`);
  const data = await res.json();
  chatBox.innerHTML = data.map(m =>
    `<div class="msg ${m.sender===buyer?'me':'them'}">${m.text}</div>`
  ).join('');
  chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById('sendBtn').onclick = async () => {
  const text = msgInput.value.trim();
  if (!text) return;
  await fetch(`${API}/api/chats`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ buyer, seller, product, sender:buyer, text })
  });
  msgInput.value='';
  loadMessages();
};

setInterval(loadMessages, 3000);
loadMessages();
