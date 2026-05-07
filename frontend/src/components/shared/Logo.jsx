export default function Logo({ size = 'md', white = false }) {
  const sizes = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl' };
  const color = white ? 'text-white' : 'text-ocean-700';

  return (
    <div className={`flex items-center gap-2 font-display font-bold ${sizes[size]} ${color}`}>
      <svg
        width={size === 'sm' ? 20 : size === 'lg' ? 28 : 24}
        height={size === 'sm' ? 20 : size === 'lg' ? 28 : 24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 17h18M3 12h18M8 7h13M3 7h2" />
        <circle cx="5" cy="17" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>
      SalDesk
    </div>
  );
}
