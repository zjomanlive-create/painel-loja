const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(__dirname, '..', 'www', 'supabase.js')); console.log('supabase.js copiado para a pasta www'); }
else console.log('supabase.js nao encontrado. Rode: npm install @supabase/supabase-js');
