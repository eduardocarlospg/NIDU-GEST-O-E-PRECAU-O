const NIDU_SPREADSHEET_ID = "1nj_zGAg_YUfgsbE79lI3raq7wGob_zR9kmvA_Vgwz1s";
const SIGNUP_CODE = "";      // se preencher, o cadastro exige este código de convite
const SESSION_HOURS = 12;
const KEYS = ["lancamentos", "estimativas", "orcamentos"];
const NAMES = {lancamentos: "Lançamentos", estimativas: "Estimativas", orcamentos: "Orçamentos"};

function sheet_(name, headers) {
  const ss = SpreadsheetApp.openById(NIDU_SPREADSHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}
function dataSheet_(k) { return sheet_(NAMES[k], ["usuario", "id", "json"]); }
function usersSheet_() { return sheet_("Usuários", ["email", "nome", "salt", "hash", "criado"]); }
function sessionsSheet_() { return sheet_("Sessões", ["token", "email", "expira"]); }

// Rode esta função uma vez no editor para criar as abas.
function setup() {
  KEYS.forEach(dataSheet_);
  usersSheet_();
  sessionsSheet_();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(msg) { return json_({ok: false, error: msg}); }
function doGet() { return json_({ok: true, service: "NIDU"}); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const b = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    switch (b.action) {
      case "ping": return json_({ok: true});
      case "register": return register_(b);
      case "login": return login_(b);
      case "logout": return logout_(b.token);
      case "getData": return json_({ok: true, data: load_(user_(b.token))});
      case "saveData": return save_(user_(b.token), b.data);
    }
    return fail_("Ação inválida");
  } catch (err) {
    return fail_(String(err.message || err));
  } finally {
    lock.releaseLock();
  }
}

// ---- senhas e sessões ----
function hash_(salt, pw) {
  let h = salt + pw;
  for (let i = 0; i < 1000; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h));
  }
  return h;
}
function findUser_(email) {
  const rows = usersSheet_().getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (rows[i][0] === email) return rows[i];
  return null;
}
function newSession_(email) {
  const t = Utilities.getUuid() + Utilities.getUuid();
  sessionsSheet_().appendRow([t, email, new Date(Date.now() + SESSION_HOURS * 3600000)]);
  return t;
}
function user_(token) {
  if (!token) throw new Error("Sessão expirada");
  const sh = sessionsSheet_();
  const f = sh.createTextFinder(String(token)).matchEntireCell(true).findNext();
  if (!f) throw new Error("Sessão expirada");
  const r = sh.getRange(f.getRow(), 1, 1, 3).getValues()[0];
  if (new Date(r[2]) < new Date()) { sh.deleteRow(f.getRow()); throw new Error("Sessão expirada"); }
  return r[1];
}
function logout_(token) {
  if (token) {
    const sh = sessionsSheet_();
    const f = sh.createTextFinder(String(token)).matchEntireCell(true).findNext();
    if (f) sh.deleteRow(f.getRow());
  }
  return json_({ok: true});
}

function register_(b) {
  if (SIGNUP_CODE && b.code !== SIGNUP_CODE) return fail_("Código de convite inválido");
  const email = String(b.email || "").trim().toLowerCase();
  const nome = String(b.nome || "").trim().replace(/^[=+\-@]+/, "") || email.split("@")[0];
  const pw = String(b.password || "");
  if (!/^[^\s=+\-@]\S*@\S+\.\S+$/.test(email)) return fail_("E-mail inválido");
  if (pw.length < 8) return fail_("A senha precisa ter ao menos 8 caracteres");
  if (findUser_(email)) return fail_("E-mail já cadastrado");
  const salt = Utilities.getUuid();
  usersSheet_().appendRow([email, nome, salt, hash_(salt, pw), new Date()]);
  return json_({ok: true, token: newSession_(email), nome: nome, data: load_(email)});
}

function login_(b) {
  const email = String(b.email || "").trim().toLowerCase();
  const u = findUser_(email);
  if (!u || hash_(u[2], String(b.password || "")) !== u[3]) return fail_("E-mail ou senha incorretos");
  return json_({ok: true, token: newSession_(email), nome: u[1], data: load_(email)});
}

// ---- dados: cada linha pertence a um usuário; o servidor só lê/grava as do dono do token ----
function load_(email) {
  const d = {};
  KEYS.forEach(function (k) {
    d[k] = dataSheet_(k).getDataRange().getValues().slice(1)
      .filter(function (r) { return r[0] === email; })
      .map(function (r) { return JSON.parse(r[2]); });
  });
  return d;
}

function save_(email, data) {
  data = data || {};
  KEYS.forEach(function (k) {
    const sh = dataSheet_(k);
    const keep = sh.getDataRange().getValues().slice(1).filter(function (r) { return r[0] !== email; });
    const mine = (data[k] || []).map(function (x) { return [email, String(x.id), JSON.stringify(x)]; });
    const rows = keep.concat(mine);
    const n = sh.getMaxRows() - 1;
    if (n > 0) sh.getRange(2, 1, n, 3).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 3).setValues(rows);
  });
  return json_({ok: true});
}
