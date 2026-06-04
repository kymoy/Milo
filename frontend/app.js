const BACKEND = "http://localhost:8000";

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const statusDot = document.getElementById("statusDot");

async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND}/`);
    if (res.ok) {
      statusDot.classList.remove("offline");
    } else {
      statusDot.classList.add("offline");
    }
  } catch {
    statusDot.classList.add("offline");
  }
}

function addMessage(text, role) {
  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  msg.appendChild(bubble);
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage(text, "user");
  inputEl.value = "";
  sendBtn.disabled = true;

  try {
    const res = await fetch(`${BACKEND}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    addMessage(data.reply, "bot");
  } catch {
    addMessage("Could not reach the backend. Make sure it is running.", "bot");
  }

  sendBtn.disabled = false;
  inputEl.focus();
}

sendBtn.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

checkBackend();
setInterval(checkBackend, 5000);
