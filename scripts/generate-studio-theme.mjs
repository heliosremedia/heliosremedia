/** Compatibility bridge for legacy Studio utilities. Re-run after adding UI colors.
 * Only app/admin is scanned. Never transforms artwork, inline template colors or public pages.
 */
import postcss from 'postcss';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
function files(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(`${dir}/${f.name}`):f.name.endsWith('.tsx')?[`${dir}/${f.name}`]:[]); }
const classes=new Set(files('app/admin').flatMap(f=>readFileSync(f,'utf8').match(/(?:[\w-]+:)*(?:text|bg|border|placeholder:text|divide|ring-offset)-(?:white|black|(?:slate|gray|zinc|neutral|stone|emerald|green|red|rose|orange|amber|blue|sky|cyan|violet|purple)-\d+|\[#[\da-fA-F]+\])(?:\/(?:\[[\d.]+\]|\d+))?/g)||[]));
const escape=s=>s.replace(/[^a-zA-Z0-9_-]/g,c=>`\\${c}`);
const rules=[];
for (const full of [...classes].sort()) {
 const pieces=full.split(':'); const cls=pieces.pop();
 if (pieces.some(v=>!['hover','focus','focus-visible','disabled','group-hover','placeholder'].includes(v))) continue;
 const m=cls.match(/^(text|bg|border|divide|ring-offset)-(.+?)(?:\/(\[?[\d.]+\]?))?$/); if(!m)continue;
 const [,kind,color,alpha]=m;
 let val;
 const a=alpha?(alpha.startsWith('[')?+alpha.slice(1,-1):+alpha/100):1;
 const hex=color.startsWith('[#')?color.slice(2,-1):null;
 const dark=hex && /^[\da-f]+$/i.test(hex) && (hex.length===3?[...hex].map(c=>parseInt(c+c,16)):[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16))).every(v=>v<55);
 if(kind==='text' && color==='[#8ab4f8]') val='#175a91';
 else if(kind==='text' && (color==='white'||/^(slate|gray|zinc|neutral|stone)-/.test(color)||(hex&&!dark&& !['d96b2b','ed7a3c','c85f28','8ab4f8'].includes(hex)))) val=a<.8?'var(--studio-muted)':'var(--studio-ink)';
 else if(kind==='text'&&/^(emerald|green)-/.test(color))val='#166534';
 else if(kind==='text'&&/^(red|rose)-/.test(color))val='#b42318';
 else if(kind==='text'&&/^(orange|amber)-/.test(color))val='#9a400d';
 else if(kind==='text'&&/^(blue|sky|cyan)-/.test(color))val='#175a91';
 else if(kind==='text'&&/^(violet|purple)-/.test(color))val='#6b3393';
 else if(kind==='bg'&&dark)val='var(--studio-surface)';
 else if(kind==='bg'&&color==='white'&&a<1)val=`rgb(20 20 22 / ${Math.max(a,.035)})`;
 else if(kind==='bg'&&color==='black'&&a<=.4)val='rgb(20 20 22 / .04)';
 else if((kind==='border'||kind==='divide')&&color==='white')val=`rgb(20 20 22 / ${Math.max(a,.16)})`;
 else if(kind==='ring-offset'&&dark)val='var(--studio-surface)';
 if(!val)continue;
 let selector=`.${escape(full)}:not([data-studio-fixed-colors], [data-studio-fixed-colors] *)`; 
 for(const v of pieces){ if(v==='group-hover')selector=`.group:hover ${selector}`;else if(v==='placeholder')selector+='::placeholder';else selector+=`:${v}`; }
 const prop={text:'color',bg:'background-color',border:'border-color',divide:'border-color','ring-offset':'--tw-ring-offset-color'}[kind];
 rules.push(`${selector} { ${prop}: ${val}; }`);
}
const components=`
& { --foreground: #202124; --helios-muted: #5c6067; --helios-border: #d4d5d7; --studio-surface: #fff; --studio-ink: #202124; --studio-muted: #5c6067; background: #f4f4f3; color: var(--studio-ink); color-scheme: light; }
:where(input,textarea,select) { color-scheme: light; }
:where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]),textarea,select):not([data-studio-fixed-colors], [data-studio-fixed-colors] *) { background-color: #fff; color: var(--studio-ink); }
[class~="text-[var(--helios-orange)]"]:not([data-studio-fixed-colors], [data-studio-fixed-colors] *) { color: #a84310; }
:where(.email-studio-history-helper,.email-studio-history-status,.email-studio-history-meta) { color: var(--studio-muted) !important; }
:where(.email-studio-history-subject,button.email-studio-history-action) { color: var(--studio-ink) !important; }
:where(.input,.referral-form-control) { background: #fff !important; color: var(--studio-ink) !important; border-color: #c7c9cd !important; }
:where(input,textarea)::placeholder { color: var(--studio-muted) !important; }
.admin-btn-primary { background: #202124 !important; color: #fff !important; border-color: #202124 !important; }
.admin-btn-primary:hover { background: #34363a !important; color: #fff !important; border-color: var(--helios-orange) !important; }
.admin-btn-secondary { background: #fff !important; color: var(--studio-ink) !important; border-color: #c7c9cd !important; }
.admin-btn-secondary:hover { background: #ededec !important; color: var(--studio-ink) !important; }
:where(.admin-btn-ghost,.admin-btn-subtle,.admin-btn-icon,.admin-btn-icon-sm,.admin-btn-link) { color: var(--studio-muted); border-color: #d4d5d7; }
:where(.admin-btn-destructive,.admin-btn-danger,.admin-btn-link-destructive) { color: #b42318; }
:where(.admin-btn-ghost,.admin-btn-subtle,.admin-btn-icon,.admin-btn-icon-sm,.admin-btn-link):hover { color: var(--studio-ink); background: #e8e9eb; }
.admin-project-step { background: #fff; color: var(--studio-ink); border-color: #d4d5d7; }
.admin-project-step:hover { background: #f0f1f2; }
:where(.admin-project-step-label,.admin-project-step-detail) { color: var(--studio-muted); }
.admin-project-step-value { color: var(--studio-ink); }
.admin-project-step.is-complete { border-color: #79b18d; background: #f0f8f2; }
:where(.admin-project-step-check,.admin-project-step.is-complete .admin-project-step-value) { color: #166534; }
.admin-project-step:focus-visible { outline-color: #202124; }
.referral-form-checkbox:not(:checked) { background-color: #fff; border-color: #9a9ea5; }
.referral-form-checkbox:checked { background-color: var(--helios-orange); border-color: var(--helios-orange); }
`;
const componentAst=postcss.parse(components);
componentAst.walkRules(rule=>{
 if(rule.selector==='&') return;
 rule.selector=postcss.list.comma(rule.selector).map(selector=>{
  if(selector.includes('data-studio-fixed-colors')) return selector;
  const [base,pseudo]=selector.split('::');
  return `${base}:not([data-studio-fixed-colors], [data-studio-fixed-colors] *)${pseudo?'::'+pseudo:''}`;
 }).join(', ');
});
const body=componentAst.toString()+'\n'+rules.join('\n');
const wrap=selector=>`${selector} {\n${body}\n}\n`;
writeFileSync('app/admin/studio-legacy-theme.css',`/* Generated by scripts/generate-studio-theme.mjs. Do not edit.\n   Neutral UI and semantic status only; media backdrops and template artwork remain fixed. */\n${wrap('.admin-form-scope[data-studio-appearance="day"]')}\n@media (prefers-color-scheme: light) {\n${wrap('.admin-form-scope[data-studio-appearance="system"]')}\n}\n`);
console.log(`Generated ${rules.length} legacy utility mappings.`);
