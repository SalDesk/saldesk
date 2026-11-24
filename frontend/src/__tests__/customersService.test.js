import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { exportCustomersCsv } from '../services/customersService';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

/* O servidor escreve o ficheiro com BOM e o cabecalho em portugues; a importacao le outros nomes
   (first_name, last_name...), por isso trocar o cabecalho da exportacao nao parte nada. */
const BOM = String.fromCharCode(0xFEFF);
const CABECALHO_PT = 'Nome,Email,Telefone,Pais,Idioma,Visitas,Total Gasto,Notas,Criado em';
const LINHAS = '"Ana","ana@x.cv","+238",CV,pt,2,120.00,"gosta, de mar",2026-01-05\n"John","j@x.com","",GB,en,6,650.00,"",2026-02-01';
const CSV_SERVIDOR = `${BOM}${CABECALHO_PT}\n${LINHAS}`;
const CABECALHO_EN = 'Name,Email,Phone,Country,Language,Visits,Total spent,Notes,Created on';

function lerTexto(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsText(blob);
  });
}

/* Os tres primeiros bytes do ficheiro (o BOM do UTF-8 e EF BB BF) */
function primeirosBytes(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve([...new Uint8Array(leitor.result).slice(0, 3)]);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsArrayBuffer(blob);
  });
}

describe('exportCustomersCsv', () => {
  let guardado;
  let nomeFicheiro;

  let original;

  beforeEach(() => {
    guardado = null;
    nomeFicheiro = null;
    original = new Blob([CSV_SERVIDOR], { type: 'text/csv' });
    api.get.mockReset().mockResolvedValue({ data: original });
    URL.createObjectURL = vi.fn((blob) => { guardado = blob; return 'blob:teste'; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clicar() { nomeFicheiro = this.download; });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sem opcoes_descarrega_o_ficheiro_tal_como_o_servidor_o_escreveu_com_o_nome_de_sempre', async () => {
    await exportCustomersCsv();
    expect(api.get).toHaveBeenCalledWith('/customers/export', { responseType: 'blob' });
    /* o mesmo ficheiro, sem o tocar */
    expect(guardado).toBe(original);
    expect(await primeirosBytes(guardado)).toEqual([0xEF, 0xBB, 0xBF]);
    expect(nomeFicheiro).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('com_cabecalho_troca_so_a_primeira_linha_mantem_o_BOM_e_as_linhas_de_dados', async () => {
    await exportCustomersCsv({ cabecalho: CABECALHO_EN, prefixo: 'customers' });
    /* ler o texto descarta o BOM; os bytes mostram que ele la esta */
    expect(await primeirosBytes(guardado)).toEqual([0xEF, 0xBB, 0xBF]);
    const texto = await lerTexto(guardado);
    expect(texto).toBe(`${CABECALHO_EN}\n${LINHAS}`);
    expect(texto.split('\n').slice(1).join('\n')).toBe(LINHAS);
    expect(nomeFicheiro).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('um_ficheiro_so_com_cabecalho_tambem_fica_com_o_cabecalho_novo', async () => {
    api.get.mockResolvedValue({ data: new Blob([CABECALHO_PT], { type: 'text/csv' }) });
    await exportCustomersCsv({ cabecalho: CABECALHO_EN, prefixo: 'customers' });
    expect(await lerTexto(guardado)).toBe(CABECALHO_EN);
  });
});
