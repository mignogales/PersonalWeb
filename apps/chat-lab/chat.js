const form = document.querySelector('#form');
const prompt = document.querySelector('#prompt');
const password = document.querySelector('#password');
const messages = document.querySelector('#messages');
const status = document.querySelector('#status');
const send = document.querySelector('#send');
const clear = document.querySelector('#clear');
let history = [];
let busy = false;
function add(role, text) {
  const article = document.createElement('article');
  article.className = role;
  const label = document.createElement('small');
  label.textContent = role === 'user' ? 'TÚ' : 'ASISTENTE';
  const content = document.createElement('p');
  content.textContent = text;
  article.append(label, content);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}
clear.addEventListener('click', () => {
  history = [];
  messages.replaceChildren();
  add('model', 'Nueva conversación. ¿Qué te gustaría probar?');
  status.textContent = '';
  prompt.focus();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const text = prompt.value.trim();
  if (busy || !text) return;
  if (!password.value) { status.textContent = 'Introduce la contraseña de prueba.'; password.focus(); return; }
  busy = true;
  send.disabled = clear.disabled = true;
  status.textContent = 'Gemini está escribiendo…';
  const bubble = add('user', text);
  const pending = [...history.slice(-14), { role: 'user', text }];
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Chat-Password': password.value },
      body: JSON.stringify({ messages: pending }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo enviar el mensaje.');
    if (!data.text) throw new Error('La respuesta está vacía.');
    history = [...pending, { role: 'model', text: data.text.slice(0, 2000) }];
    add('model', data.text);
    if (prompt.value.trim() === text) prompt.value = '';
    status.textContent = data.model;
  } catch (error) {
    bubble.remove();
    status.textContent = error.name === 'TimeoutError' ? 'La petición ha tardado demasiado. Vuelve a intentarlo.' : error.message;
  } finally {
    busy = false;
    send.disabled = clear.disabled = false;
    prompt.focus();
  }
});
