/**
 * UUID v4 con fallback. NO se usa `crypto.randomUUID()` a secas: esa API requiere
 * contexto seguro (HTTPS/localhost) y NO existe sobre HTTP en una IP de LAN ni en
 * webviews viejos — entornos reales de dev/quiosco, donde tiraría
 * "crypto.randomUUID is not a function". `crypto.getRandomValues` sí está
 * disponible en contextos inseguros, así que se arma el v4 a mano si hace falta.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
