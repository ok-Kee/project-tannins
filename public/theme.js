export function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; } else {
    const d = max-min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch (max) {
      case r: h = ((g-b)/d+(g<b?6:0))/6; break;
      case g: h = ((b-r)/d+2)/6; break;
      case b: h = ((r-g)/d+4)/6; break;
    }
  }
  return [h*360, s*100, l*100];
}

export function hslToHex(h, s, l) {
  h/=360; s/=100; l/=100;
  let r, g, b;
  if (s===0) { r=g=b=l; } else {
    const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    const f = (t) => { if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<0.5)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
    r=f(h+1/3); g=f(h); b=f(h-1/3);
  }
  return '#'+[r,g,b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

export function applyTheme(accent, bg) {
  if (!accent || !bg) return;
  const [ah,as,al] = hexToHsl(accent), [bh,bs,bl] = hexToHsl(bg);
  const c = (v) => Math.min(100, Math.max(0, v));
  const el = document.documentElement;
  const isLight = bl > 55;
  const d = isLight ? -1 : 1;
  el.style.setProperty('--accent', accent);
  el.style.setProperty('--accent-hover', hslToHex(ah, as, c(al+12)));
  el.style.setProperty('--bg', bg);
  el.style.setProperty('--surface', hslToHex(bh, bs, c(bl + d*5)));
  el.style.setProperty('--surface2', hslToHex(bh, bs, c(bl + d*10)));
  el.style.setProperty('--border', hslToHex(bh, bs, c(bl + d*18)));
  el.style.setProperty('--text', hslToHex(bh, bs*0.15, c(isLight ? 10 : 92)));
  el.style.setProperty('--text-muted', hslToHex(ah, as*0.4, isLight ? 38 : 58));
}
