export function isVendedor(user) {
  return user?.user_metadata?.role === 'VENDEDOR' ||
         user?.user_metadata?.staff_role === 'Vendedor de Praia';
}

export function isStaff(user) {
  return user?.user_metadata?.role === 'STAFF';
}
