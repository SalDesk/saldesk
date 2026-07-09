import logoImg from '../../assets/logo.png';
const HEIGHTS = { sm: 28, md: 36, lg: 48, xl: 76 };
export default function Logo({ size = 'md', white = false, dark = false }) {
  const h = HEIGHTS[size] || 36;
  const filter = white ? 'brightness(0) invert(1)' : dark ? 'brightness(0)' : 'none';
  return (
    <img
      src={logoImg}
      alt="SalDesk"
      height={h}
      style={{ height: h, width: 'auto', display: 'block', filter }}
    />
  );
}
