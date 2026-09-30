# NIDU

Gestão financeira com login. Cada usuário tem sua própria conta e seu próprio dashboard.

- Os dados ficam **somente** no Google Sheets (via Apps Script). Nada é gravado em localStorage, sessionStorage ou cache do navegador.
- A sessão fica só na memória da aba: ao recarregar a página, é preciso entrar de novo.
- Cada linha da planilha tem a coluna `usuario`; o servidor só lê e grava as linhas do dono do token de sessão.
- Senhas são guardadas com salt + SHA-256 (1000 iterações), nunca em texto puro.

## Como publicar

1. Na planilha, apague as abas antigas (Lançamentos, Estimativas, Orçamentos, Configurações, Usuários) para o `setup` recriá-las com as colunas novas.
2. Cole o novo `google-apps-script.gs` no editor do Apps Script.
3. Execute a função `setup` uma vez (autorize o acesso).
4. Implantar > Gerenciar implantações > editar > Nova versão. Acesso: "Qualquer pessoa".
5. Confirme que a URL no topo do `app.js` (`APPS_SCRIPT_URL`) é a do seu Web App.
6. Abra o `index.html`, clique em "Criar uma conta" e entre.

Para restringir quem pode se cadastrar, preencha `SIGNUP_CODE` no script; o código passa a ser exigido no cadastro.
