export type ShippingMethod = 'air' | 'sea';
export type ShippingMarkImage = { dataUrl: string; blob: Blob; filename: string };
type Options = { customerCode: string; method: ShippingMethod; inspection: boolean; qr: HTMLCanvasElement };

function roundedBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
}

// The same simple line icons as the interface, drawn without Path2D for older browsers.
function methodIcon(ctx: CanvasRenderingContext2D, method: ShippingMethod, x: number, y: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(2, 2); ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  if (method === 'air') {
    ctx.moveTo(12, 1); ctx.quadraticCurveTo(14, 1, 14, 4); ctx.lineTo(14, 9);
    ctx.lineTo(22, 14); ctx.lineTo(22, 17); ctx.lineTo(14, 14); ctx.lineTo(14, 20);
    ctx.lineTo(17, 22); ctx.lineTo(17, 23); ctx.lineTo(12, 22); ctx.lineTo(7, 23);
    ctx.lineTo(7, 22); ctx.lineTo(10, 20); ctx.lineTo(10, 14); ctx.lineTo(2, 17);
    ctx.lineTo(2, 14); ctx.lineTo(10, 9); ctx.lineTo(10, 4); ctx.quadraticCurveTo(10, 1, 12, 1); ctx.closePath();
  } else {
    ctx.moveTo(8, 8); ctx.lineTo(8, 3); ctx.lineTo(16, 3); ctx.lineTo(16, 8);
    ctx.moveTo(12, 1); ctx.lineTo(12, 3); ctx.moveTo(12, 7); ctx.lineTo(3, 11); ctx.lineTo(5.5, 18);
    ctx.moveTo(12, 7); ctx.lineTo(21, 11); ctx.lineTo(18.5, 18); ctx.moveTo(12, 7); ctx.lineTo(12, 17);
    ctx.moveTo(2, 21); ctx.quadraticCurveTo(5, 18, 8, 21); ctx.quadraticCurveTo(12, 24, 16, 21); ctx.quadraticCurveTo(19, 18, 22, 21);
  }
  ctx.stroke(); ctx.restore();
}

const loadLogo = () => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  const timeout = setTimeout(() => reject(new Error('Logo loading timed out')), 15_000);
  image.onload = () => { clearTimeout(timeout); resolve(image); };
  image.onerror = () => { clearTimeout(timeout); reject(new Error('Could not load the Exios logo')); };
  image.src = '/images/exios-logo.png';
});

// Direct, bounded canvas drawing avoids DOM screenshots and SVG foreignObject on mobile Safari.
export async function createShippingMarkImage({ customerCode, method, inspection, qr }: Options): Promise<ShippingMarkImage> {
  if (!customerCode?.trim() || !qr?.width || !qr?.height) throw new Error('Missing shipping mark data');
  const logo = await loadLogo();
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 1100;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  const accent = method === 'sea' ? '#087b73' : '#32782b';
  const tint = method === 'sea' ? '#e9f8f6' : '#eff8e8';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#17443e'; ctx.lineWidth = 2;
  roundedBox(ctx, 26, 26, 848, 1048, 22); ctx.stroke();
  const ratio = Math.min(260 / logo.width, 100 / logo.height);
  ctx.drawImage(logo, 66, 54, logo.width * ratio, logo.height * ratio);
  ctx.textAlign = 'right'; ctx.fillStyle = '#17443e'; ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText('SHIPPING MARK', 832, 90);
  ctx.fillStyle = tint; roundedBox(ctx, 712, 112, 120, 42, 7); ctx.fill();
  ctx.fillStyle = accent; ctx.font = 'bold 22px Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(method === 'sea' ? 'SEA' : 'AIR', 772, 141);
  const brand = ctx.createLinearGradient(66, 0, 834, 0);
  brand.addColorStop(0, '#78be32'); brand.addColorStop(1, '#00ae9b');
  ctx.fillStyle = brand; roundedBox(ctx, 66, 182, 768, 5, 2); ctx.fill();
  ctx.strokeStyle = '#d4dce0'; ctx.lineWidth = 1;
  ctx.fillStyle = '#52636e'; ctx.textAlign = 'center'; ctx.font = '24px Arial, sans-serif';
  ctx.fillText('CUSTOMER ID', 450, 248);
  let codeSize = 132;
  do { ctx.font = `bold ${codeSize}px Arial, sans-serif`; codeSize -= 2; } while (ctx.measureText(customerCode).width > 750 && codeSize > 16);
  ctx.fillStyle = '#111b22'; ctx.fillText(customerCode, 450, 372);
  ctx.beginPath(); ctx.moveTo(66, 420); ctx.lineTo(834, 420); ctx.stroke();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, 260, 449, 380, 380);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = tint; roundedBox(ctx, 66, 872, 768, 116, 12); ctx.fill();
  ctx.strokeStyle = accent; methodIcon(ctx, method, 100, 903);
  ctx.textAlign = 'left'; ctx.fillStyle = accent; ctx.font = 'bold 66px Arial, sans-serif';
  ctx.fillText(method === 'sea' ? 'BY SEA' : 'BY AIR', 178, 954);
  if (inspection) {
    ctx.strokeStyle = '#1c2c35'; ctx.lineWidth = 1.5; roundedBox(ctx, 206, 1008, 488, 44, 6); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#111b22'; ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('INSPECTION REQUIRED', 450, 1038);
  }
  const dataUrl = canvas.toDataURL('image/png');
  const binary = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/png' });
  const safeCode = customerCode.replace(/[^a-z0-9_-]/gi, '_');
  return { dataUrl, blob, filename: `Exios-${safeCode}-${method}${inspection ? '-inspection' : ''}.png` };
}

export function shareableMarkFile(image: ShippingMarkImage): File | null {
  try {
    if (typeof File !== 'function' || !navigator.share || !navigator.canShare) return null;
    const file = new File([image.blob], image.filename, { type: 'image/png' });
    return navigator.canShare({ files: [file] }) ? file : null;
  } catch { return null; }
}
