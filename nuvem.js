/* Ligação com o Supabase: login, código de 30 segundos, sincronização e tempo real */
const sb = window.supabase ? window.supabase.createClient(CFG.url, CFG.key) : null;
const gate = document.getElementById('gate');
let remote = { products: new Map(), sales: new Map(), logs: new Map() };
let saving = Promise.resolve(), bad = false, pendRefresh = false, lt, liveOn = false;

const rP = p => ({ id: p.id, name: p.name, price: p.price || 0, cost: p.cost || 0, cat: p.cat || null, color: p.color || null, brand: p.brand || null, note: p.note || null, photo_path: p.path || null, sizes: p.sizes });
const rS = s => ({ id: s.id, created_at: new Date(s.date).toISOString(), product_id: S.products.some(p => p.id === s.pid) ? s.pid : null, name: s.name, size: s.size, price: s.price || 0, cost: s.cost || 0, pays: s.pays, total: s.total || 0, pend: s.pend || 0, cust: s.cust || null, phone: s.phone || null, due: s.due || null });
const rL = g => ({ id: g.id, created_at: new Date(g.date).toISOString(), action: g.a, detail: g.d, value: g.v });
const rowsOf = () => ({ products: S.products.map(rP), sales: S.sales.map(rS), logs: S.logs.map(rL) });

function setSt(k) {
  const e = document.getElementById('st'); if (!e) return;
  e.textContent = k === 'ok' ? '● Sincronizado' : k === 'err' ? '⚠ Sem sincronizar' : '… Salvando';
  e.style.color = k === 'ok' ? 'var(--ok)' : k === 'err' ? 'var(--bad)' : 'var(--mut)';
}

async function loadAll() {
  const q = t => sb.from(t).select('*').order('created_at', { ascending: true });
  const [p, s, l] = await Promise.all([q('products'), q('sales'), sb.from('logs').select('*').order('created_at', { ascending: false }).limit(2000)]);
  for (const r of [p, s, l]) if (r.error) throw r.error;
  const paths = p.data.map(x => x.photo_path).filter(Boolean), urls = {};
  if (paths.length) {
    const { data } = await sb.storage.from('fotos').createSignedUrls(paths, 21600);
    (data || []).forEach(x => { if (x.signedUrl) urls[x.path] = x.signedUrl; });
  }
  const before = JSON.stringify(rowsOf());
  S.products = p.data.map(x => ({ id: x.id, name: x.name, price: +x.price, cost: +x.cost, cat: x.cat || '', color: x.color || '', brand: x.brand || '', note: x.note || '', sizes: x.sizes || {}, photo: urls[x.photo_path] || '', path: x.photo_path || null, _ok: true }));
  S.sales = s.data.map(x => ({ id: x.id, date: new Date(x.created_at).getTime(), pid: x.product_id, name: x.name, size: x.size, price: +x.price, cost: +x.cost, pays: x.pays || [], total: +x.total, pend: +x.pend, cust: x.cust || '', phone: x.phone || '', due: x.due || '' }));
  S.logs = l.data.map(x => ({ id: x.id, date: new Date(x.created_at).getTime(), a: x.action, d: x.detail, v: x.value == null ? null : +x.value }));
  const cur = rowsOf();
  remote = { products: new Map(cur.products.map(r => [r.id, JSON.stringify(r)])), sales: new Map(cur.sales.map(r => [r.id, JSON.stringify(r)])), logs: new Map(cur.logs.map(r => [r.id, JSON.stringify(r)])) };
  return before !== JSON.stringify(cur);
}

async function sync() {
  for (const p of S.products) {
    if (p.photo && p.photo.startsWith('data:') && !p._ok) {
      const b = await (await fetch(p.photo)).blob();
      const path = p.id + '.jpg';
      const { error } = await sb.storage.from('fotos').upload(path, b, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;
      p.path = path; p._ok = true;
    }
  }
  const cur = rowsOf();
  for (const t of ['products', 'sales', 'logs']) {
    const m = remote[t], up = cur[t].filter(r => m.get(r.id) !== JSON.stringify(r));
    if (up.length) {
      const { error } = await sb.from(t).upsert(up);
      if (error) throw error;
      up.forEach(r => m.set(r.id, JSON.stringify(r)));
    }
  }
  for (const t of ['sales', 'logs', 'products']) {
    const m = remote[t], ids = new Set(cur[t].map(r => r.id)), gone = [...m.keys()].filter(i => !ids.has(i));
    if (gone.length) {
      const { error } = await sb.from(t).delete().in('id', gone);
      if (error) throw error;
      if (t === 'products') {
        const ps = gone.map(i => JSON.parse(m.get(i)).photo_path).filter(Boolean);
        if (ps.length) await sb.storage.from('fotos').remove(ps);
      }
      gone.forEach(i => m.delete(i));
    }
  }
}

function save() {
  setSt('..');
  saving = saving.then(sync).then(() => { bad = false; setSt('ok'); }).catch(e => {
    bad = true; setSt('err');
    if (e && e.code === '42501') { toast('Sem permissão para salvar. Faça login de novo.'); return; }
    toast('Sem sincronizar. Tentando de novo...'); setTimeout(save, 8000);
  });
}

function rerender() {
  const f = document.activeElement && document.activeElement.id === 'qs';
  render();
  if (f) { const i = document.getElementById('qs'); i.focus(); i.setSelectionRange(99, 99); }
}
async function refresh() {
  if (bad) return;
  if (dlg.open) { pendRefresh = true; return; }
  await saving;
  try { if (await loadAll()) rerender(); } catch (e) { /* tenta na próxima */ }
}
dlg.addEventListener('close', () => { if (pendRefresh) { pendRefresh = false; refresh(); } });

function live() {
  if (liveOn) return; liveOn = true;
  sb.channel('painel').on('postgres_changes', { event: '*', schema: 'public' }, () => { clearTimeout(lt); lt = setTimeout(refresh, 600); }).subscribe();
}

function fixIds(d) {
  const ok = x => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(x || ''), m = {};
  (d.products = d.products || []).forEach(p => { if (!ok(p.id)) { m[p.id] = uid(); p.id = m[p.id]; } });
  (d.sales = d.sales || []).forEach(s => { if (!ok(s.id)) s.id = uid(); if (s.pid && m[s.pid]) s.pid = m[s.pid]; if (!ok(s.pid)) s.pid = null; });
  (d.logs = d.logs || []).forEach(g => { if (!ok(g.id)) g.id = uid(); });
}

/* ---------- Login ---------- */
const G = h => { gate.innerHTML = '<div class="gbox">' + h + '</div>'; gate.style.display = 'grid'; };
const gm = t => { document.getElementById('gm').textContent = t; };

function loginUI(msg) {
  G('<h2>Painel da Loja</h2><p class="mut">Entre com a sua conta</p><label>E-mail</label><input id="ge" type="email" autocomplete="username"><label>Senha</label><input id="gs" type="password" autocomplete="current-password"><div class="gm" id="gm">' + (msg || '') + '</div><button class="pri" id="gb" style="width:100%;margin-top:12px">Entrar</button>');
  const go = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: document.getElementById('ge').value.trim(), password: document.getElementById('gs').value });
    if (error) return gm('E-mail ou senha incorretos.');
    gateFlow();
  };
  document.getElementById('gb').onclick = go;
  document.getElementById('gs').onkeydown = e => { if (e.key === 'Enter') go(); };
}

function codeUI(id) {
  G('<h2>Código de segurança</h2><p class="mut">Abra o app autenticador e digite o código de 6 números.</p><input id="gc" inputmode="numeric" maxlength="6" autocomplete="one-time-code" style="font-size:24px;text-align:center;letter-spacing:6px"><div class="gm" id="gm"></div><button class="pri" id="gb" style="width:100%;margin-top:12px">Confirmar</button><button id="gx" style="width:100%;margin-top:8px">Sair</button>');
  const go = async () => {
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: id, code: document.getElementById('gc').value.trim() });
    if (error) return gm('Código incorreto ou vencido.');
    entrar();
  };
  document.getElementById('gb').onclick = go;
  document.getElementById('gc').onkeydown = e => { if (e.key === 'Enter') go(); };
  document.getElementById('gx').onclick = sair;
  document.getElementById('gc').focus();
}

async function enrollUI() {
  const { data: f } = await sb.auth.mfa.listFactors();
  for (const x of (f && f.all) || []) if (x.status === 'unverified') await sb.auth.mfa.unenroll({ factorId: x.id });
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Painel ' + Date.now() });
  if (error) { G('<p>Não foi possível preparar o autenticador: ' + esc(error.message) + '</p><button id="gx" style="width:100%">Sair</button>'); document.getElementById('gx').onclick = sair; return; }
  G('<h2>Ativar o código de 30 segundos</h2><p class="mut">1. Abra o Google Authenticator e escaneie o QR code.<br>2. Digite o código de 6 números que aparecer.</p><img src="' + data.totp.qr_code + '" alt="QR code" style="width:200px;height:200px;background:#fff;padding:8px;border-radius:10px;margin:8px auto;display:block"><p class="mut" style="word-break:break-all">Se não conseguir escanear, digite esta chave no app: <b style="color:var(--tx)">' + esc(data.totp.secret) + '</b><br>Guarde esta chave em lugar seguro.</p><input id="gc" inputmode="numeric" maxlength="6" style="font-size:24px;text-align:center;letter-spacing:6px"><div class="gm" id="gm"></div><button class="pri" id="gb" style="width:100%;margin-top:12px">Ativar</button><button id="gx" style="width:100%;margin-top:8px">Sair</button>');
  const go = async () => {
    const { error: e2 } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: document.getElementById('gc').value.trim() });
    if (e2) return gm('Código incorreto. Confira o app e tente de novo.');
    entrar();
  };
  document.getElementById('gb').onclick = go;
  document.getElementById('gc').onkeydown = e => { if (e.key === 'Enter') go(); };
  document.getElementById('gx').onclick = sair;
}

async function gateFlow() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return loginUI();
  const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (a.currentLevel === 'aal2') return entrar();
  const { data: f } = await sb.auth.mfa.listFactors();
  if (f.totp && f.totp.length) return codeUI(f.totp[0].id);
  return enrollUI();
}

async function entrar() {
  const { data: ok } = await sb.rpc('is_allowed');
  if (!ok) {
    G('<h2>Sem permissão</h2><p class="mut">Esta conta não está na lista de pessoas autorizadas.</p><button id="gx" style="width:100%">Sair</button>');
    document.getElementById('gx').onclick = sair; return;
  }
  gate.style.display = 'none'; setSt('..');
  try { await loadAll(); bad = false; setSt('ok'); render(); live(); }
  catch (e) { setSt('err'); toast('Não foi possível carregar os dados: ' + (e.message || e)); }
}

async function sair() { try { await sb.auth.signOut(); } catch (e) { /* segue */ } location.reload(); }

function boot() {
  S.lastBackup = +localStorage.getItem('lb') || 0;
  if (!sb) { gate.innerHTML = '<div class="gbox"><h2>Falta uma peça</h2><p class="mut">A biblioteca do Supabase não foi encontrada. Rode <b>npm install</b> na pasta do projeto.</p></div>'; return; }
  gateFlow().catch(e => loginUI('Erro: ' + (e.message || e)));
}
boot();
