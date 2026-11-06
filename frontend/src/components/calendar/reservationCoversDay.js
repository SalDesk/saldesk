/* Diz se uma reserva ocupa o dia indicado (datas AAAA-MM-DD, comparaveis como texto).
   - varios dias: ocupa de check_in ate ao dia antes de check_out (a saida nao ocupa);
   - um so dia (check_in === check_out, comum em tours): ocupa apenas esse dia. */
export default function reservationCoversDay(reservation, dateStr) {
  const checkIn = reservation?.check_in;
  const checkOut = reservation?.check_out;
  if (!checkIn || !checkOut) return false;
  if (checkIn === checkOut) return checkIn === dateStr;
  return checkIn <= dateStr && checkOut > dateStr;
}
