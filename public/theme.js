export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) return [0, 0, lightness * 100];

  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);

  let hue;
  switch (max) {
    case r: hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6; break;
    case g: hue = ((b - r) / delta + 2) / 6; break;
    case b: hue = ((r - g) / delta + 4) / 6; break;
  }

  return [hue * 360, saturation * 100, lightness * 100];
}

export function hslToHex(h, s, l) {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  if (sNorm === 0) {
    const grey = Math.round(lNorm * 255).toString(16).padStart(2, '0');
    return `#${grey}${grey}${grey}`;
  }

  const maxChannel = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const minChannel = 2 * lNorm - maxChannel;

  function hueToChannel(channelAngle) {
    if (channelAngle < 0) channelAngle += 1;
    if (channelAngle > 1) channelAngle -= 1;
    if (channelAngle < 1 / 6) return minChannel + (maxChannel - minChannel) * 6 * channelAngle;
    if (channelAngle < 1 / 2) return maxChannel;
    if (channelAngle < 2 / 3) return minChannel + (maxChannel - minChannel) * (2 / 3 - channelAngle) * 6;
    return minChannel;
  }

  const r = hueToChannel(hNorm + 1 / 3);
  const g = hueToChannel(hNorm);
  const b = hueToChannel(hNorm - 1 / 3);

  return '#' + [r, g, b]
    .map(x => Math.round(x * 255).toString(16).padStart(2, '0'))
    .join('');
}

export function applyTheme(accent, bg) {
  if (!accent || !bg) return;

  const [accentH, accentS, accentL] = hexToHsl(accent);
  const [bgH, bgS, bgL] = hexToHsl(bg);

  const clamp = (v) => Math.min(100, Math.max(0, v));
  const shift = (lightness, amount) => clamp(lightness + amount);

  const isLight = bgL > 55;
  const lightnessDir = isLight ? -1 : 1;

  const root = document.documentElement;
  root.style.setProperty('--accent',       accent);
  root.style.setProperty('--accent-hover', hslToHex(accentH, accentS, shift(accentL, 12)));
  root.style.setProperty('--bg',           bg);
  root.style.setProperty('--surface',      hslToHex(bgH, bgS, shift(bgL, lightnessDir * 5)));
  root.style.setProperty('--surface2',     hslToHex(bgH, bgS, shift(bgL, lightnessDir * 10)));
  root.style.setProperty('--border',       hslToHex(bgH, bgS, shift(bgL, lightnessDir * 18)));
  root.style.setProperty('--text',         hslToHex(bgH, bgS * 0.15, isLight ? 10 : 92));
  root.style.setProperty('--text-muted',   hslToHex(accentH, accentS * 0.4, isLight ? 38 : 58));
}
