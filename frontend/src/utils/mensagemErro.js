import { linguaActual } from './formatoLingua';

/* Mensagem de um erro do servidor na lingua do painel.
   - pt: sempre o texto do proprio servidor (com o detalhe que ele trouxer);
   - en/de/nl: errors.code.<CODE> quando existe, senao o texto do servidor;
   - sem resposta do servidor (rede): errors.network;
   - nada aproveitavel: o fallback do chamador, senao errors.generic.
   err: erro do axios, objeto { error, code } ou Error lancado no codigo.
   t: o de useT() ou o de getT(lang) fora de componentes. */
export function mensagemErro(err, t, fallback, lang = linguaActual()) {
  const semNada = () => fallback || t('errors.generic');
  if (!err) return semNada();

  const temResposta = err.response !== undefined && err.response !== null;
  if (!temResposta && (err.isAxiosError || err.request)) return t('errors.network');

  /* Error lancado no codigo (sem resposta): a mensagem e tecnica, nunca se mostra */
  const dados = temResposta ? err.response.data : (err instanceof Error ? null : err);
  const texto = dados && typeof dados.error === 'string' && dados.error.trim() ? dados.error : '';
  const codigo = dados && typeof dados.code === 'string' ? dados.code : '';

  if (lang !== 'pt' && codigo) {
    const chave = `errors.code.${codigo}`;
    const traducao = t(chave);
    if (typeof traducao === 'string' && traducao.trim() && traducao !== chave) return traducao;
  }
  return texto || semNada();
}
