export function isFounder(user) {
  return user?.user_metadata?.role === 'FUNDADOR';
}

export function isVendedor(user) {
  return user?.user_metadata?.role === 'VENDEDOR' ||
         user?.user_metadata?.staff_role === 'Vendedor de Praia';
}

export function isStaff(user) {
  return user?.user_metadata?.role === 'STAFF';
}

export function isTraveler(user) {
  return user?.user_metadata?.role === 'TRAVELER';
}
