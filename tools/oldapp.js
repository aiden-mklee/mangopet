// One-off: put the phone build back in the old test mode (the game loaded from GitHub Pages, as before 2026-11-08), so
// the save that lives in that site's storage inside the app shows up again and can be exported (설정 › 기록 › 내보내기).
//   npm run ios:old   → syncs an iOS build that loads https://aiden-mklee.github.io/mangopet/app.html, then opens Xcode (▶)
//   npm run ios       → back to the normal store build (app/www)
// capacitor.config.json itself is left as it was; only the copy inside the iOS project changes.
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const cfg=path.join(__dirname,'..','capacitor.config.json'),orig=fs.readFileSync(cfg,'utf8');
const c=JSON.parse(orig);c.server=Object.assign({},c.server,{url:'https://aiden-mklee.github.io/mangopet/app.html'});
fs.writeFileSync(cfg,JSON.stringify(c,null,2)+'\n');
try{execSync('npx cap sync ios',{stdio:'inherit'})}finally{fs.writeFileSync(cfg,orig)}
execSync('npx cap open ios',{stdio:'inherit'});
