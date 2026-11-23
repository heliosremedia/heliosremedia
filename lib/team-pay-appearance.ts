import { createHash } from 'node:crypto';

const choices = ['day', 'night', 'system'] as const;
const label = {day:'Day',night:'Night',system:'System'};
const shapes = {
  day:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  night:'<path d="M20.2 15.3A8.7 8.7 0 0 1 8.7 3.8 8.7 8.7 0 1 0 20.2 15.3Z"/>',
  system:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/>',
};
const icon = (mode: typeof choices[number]) => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+shapes[mode]+'</svg>';
export const appearanceControl = '<div class="pay-appearance" data-pay-appearance-control hidden><button type="button" class="pay-appearance-trigger" aria-label="Appearance: System" title="Appearance: System" aria-haspopup="menu" aria-expanded="false" aria-controls="pay-appearance-options">'+choices.map(mode=>'<span data-pay-glyph="'+mode+'"'+(mode==='system'?'':' hidden')+'>'+icon(mode)+'</span>').join('')+'</button><div id="pay-appearance-options" class="pay-appearance-options" role="menu" aria-label="Appearance" hidden><p aria-hidden="true">Appearance</p>'+choices.map(mode=>'<button type="button" role="menuitemradio" aria-checked="'+String(mode==='system')+'" tabindex="-1" data-pay-choice="'+mode+'">'+icon(mode)+'<span>'+label[mode]+'</span><span class="pay-check" aria-hidden="true">✓</span></button>').join('')+'</div></div>';

// Fixed script only: server content (including account ID) never enters script source.
export const appearanceScript = `(function(){
 const html=document.documentElement, id=html.dataset.themeAccount;
 const key=html.dataset.appearanceSurface==='studio'?'helios-studio-appearance':id?'portal:'+id+':helios.production.appearance':null;
 const media=window.matchMedia('(prefers-color-scheme: dark)');
 const read=()=>{try{const value=key?localStorage.getItem(key):null;return value==='day'||value==='night'?value:'system';}catch{return 'system';}};
 let preference=read();
 const labels={day:'Day',night:'Night',system:'System'};
 let control,trigger,menu,options,glyphs;
 function apply(){
  const mode=preference==='system'?(media.matches?'night':'day'):preference;
  html.dataset.payTheme=mode;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=mode==='night'?'#0f0f10':'#f5f1ea';
  if(!trigger)return;
  const name='Appearance: '+labels[preference];
  trigger.setAttribute('aria-label',name);trigger.title=name;
  options.forEach(e=>e.setAttribute('aria-checked',String(e.dataset.payChoice===preference)));
  glyphs.forEach(e=>e.hidden=e.dataset.payGlyph!==preference);
 }
 apply();
 media.addEventListener('change',apply);
 window.addEventListener('storage',e=>{if(key&&(e.key===key||e.key===null)){preference=read();apply();}});
 document.addEventListener('DOMContentLoaded',()=>{
  control=document.querySelector('[data-pay-appearance-control]');if(!control)return;
  trigger=control.querySelector('.pay-appearance-trigger');
  menu=control.querySelector('[role="menu"]');
  options=Array.from(menu.querySelectorAll('[data-pay-choice]'));
  glyphs=Array.from(trigger.querySelectorAll('[data-pay-glyph]'));
  const focus=e=>e?.focus({preventScroll:true});
  function close(returnFocus){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(returnFocus)focus(trigger);}
  function open(){menu.hidden=false;trigger.setAttribute('aria-expanded','true');focus(options.find(e=>e.dataset.payChoice===preference));}
  trigger.addEventListener('click',()=>menu.hidden?open():close(true));
  trigger.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open();}});
  control.addEventListener('focusout',e=>{if(!control.contains(e.relatedTarget))close(false);});
  document.addEventListener('pointerdown',e=>{if(!control.contains(e.target))close(false);});
  menu.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return;}
   const i=options.indexOf(document.activeElement);
   let n;
   if(e.key==='ArrowDown'||e.key==='ArrowRight')n=(i+1)%options.length;
   else if(e.key==='ArrowUp'||e.key==='ArrowLeft')n=(i+options.length-1)%options.length;
   else if(e.key==='Home')n=0;
   else if(e.key==='End')n=options.length-1;
   else return;
   e.preventDefault();focus(options[n]);
  });
  options.forEach(e=>e.addEventListener('click',()=>{
   preference=e.dataset.payChoice;
   try{if(key)localStorage.setItem(key,preference);}catch{}
   apply();close(true);
  }));
  apply();control.hidden=false;
 });
})();`;
export const appearanceCsp = "'sha256-" + createHash('sha256').update(appearanceScript).digest('base64') + "'";
export const appearanceCss = `
.pay-appearance,.pay-appearance button{box-sizing:border-box}
.pay-appearance[hidden],.pay-appearance [hidden]{display:none!important}
.pay-appearance{position:relative;flex:none}
.pay-appearance .pay-appearance-trigger,.pay-icon-link{width:44px;height:44px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;flex:none;border-radius:50%;padding:0;border:1px solid var(--control-border);color:var(--control-ink);background:var(--control-fill);cursor:pointer;text-decoration:none}
.pay-appearance .pay-appearance-trigger:hover,.pay-icon-link:hover{color:var(--ink);border-color:var(--warm);background:var(--control-hover)}
.pay-appearance .pay-appearance-trigger:focus-visible,.pay-icon-link:focus-visible,.pay-appearance-options button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.pay-appearance svg,.pay-icon-link svg{width:18px;height:18px;display:block}
.pay-appearance-options{position:absolute;z-index:8;right:0;top:calc(100% + 8px);width:min(13rem,calc(100vw - 2rem));padding:8px;border:1px solid var(--control-border);border-radius:13px;background:var(--paper);color:var(--ink);box-shadow:0 12px 36px #0003}
.pay-appearance-options p{padding:4px 8px 8px;margin:0;color:var(--muted);font-size:.65rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase}
.pay-appearance-options button{width:100%;display:flex;align-items:center;text-align:left;gap:10px;min-height:44px;padding:7px 10px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--ink);font:inherit;font-size:.875rem;cursor:pointer}
.pay-appearance-options button:hover,.pay-appearance-options button:focus-visible{background:var(--hover)}
.pay-appearance-options button[aria-checked="true"]{color:var(--accent);border-color:var(--control-border)}
.pay-appearance-options .pay-check{margin-left:auto;visibility:hidden}
.pay-appearance-options [aria-checked="true"] .pay-check{visibility:visible}
`;
