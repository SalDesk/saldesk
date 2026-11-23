/* Rotulo curto de um mes pelo indice (0-11), na lingua do painel: as chaves staff.months tem em pt
   o mesmo texto de sempre (Jan, Fev, Mar...). Partilhado pelo pessoal, pelas financas e pela previsao. */
export const MES_CHAVE = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export const rotuloMes = (indice, t) => t(`staff.months.${MES_CHAVE[indice]}`);
