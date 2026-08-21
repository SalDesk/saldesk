import api from './api';

export async function getFounderConversation() {
  const { data } = await api.get('/founder-chat');
  return data.data;
}

export async function sendFounderMessage(content) {
  const { data } = await api.post('/founder-chat', { content });
  return data.data;
}
