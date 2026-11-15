/* Mensagens do operador: as que ele escreveu (sender_type 'manager') e as que o sistema enviou em nome
   dele, como a resposta automatica do chat do site (sender_type 'system'). Nao sao mensagens recebidas:
   nao tocam som, nao notificam, nao contam como nao lidas e aparecem do lado do operador. */
export function ehDoOperador(msg) {
  return msg?.sender_type === 'manager' || msg?.sender_type === 'system';
}
