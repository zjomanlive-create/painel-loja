# Painel da Loja (versão com banco de dados compartilhado)

Tudo o que você cadastra fica salvo no Supabase. Celular e PC mostram os mesmos dados, atualizados na hora.
A pasta `www` é o painel. O APK e o .exe são embalagens em volta dela.

## Programas necessários (gratuitos)
- Node.js, versão LTS (nodejs.org)
- Android Studio, só para gerar o APK (developer.android.com/studio)

## 1. Preparar (uma vez só)
Abra o terminal DENTRO desta pasta e rode:

    npm install @supabase/supabase-js
    npm install --save-dev @capacitor/core @capacitor/cli @capacitor/android electron electron-builder

Isso copia a biblioteca do Supabase para `www/supabase.js`.
Se o arquivo não aparecer, baixe em https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js e salve com o nome `supabase.js` dentro da pasta `www`.

## 2. Testar no navegador
    npm run web

Abra o endereço que aparecer (normalmente http://localhost:3000).

## 3. Primeiro acesso
1. Entre com o e-mail e a senha criados no Supabase.
2. No primeiro acesso aparece um QR code. Escaneie com o Google Authenticator (ou Aegis) e digite o código de 6 números.
3. GUARDE a chave em texto que aparece abaixo do QR code, em lugar seguro. Com ela você recria o autenticador se perder o celular.
4. Nos próximos acessos o painel pede e-mail, senha e o código de 30 segundos.

Quando os DOIS tiverem ativado o autenticador, avise o Claude para ligar a trava no banco que exige o código também no servidor.

## 4. APK (Android)
    npx cap add android
    npx cap sync android
    npx cap open android

No Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s).
O arquivo fica em android/app/build/outputs/apk/debug/app-debug.apk
Envie o APK para os celulares e permita "Instalar apps de fontes desconhecidas".
Sempre que mudar algo em `www`, rode `npx cap sync android` e gere o APK de novo.

## 5. .exe (Windows)
Para testar sem instalar:

    npm start

Para gerar o instalador:

    npm run exe

O instalador aparece na pasta `dist`. O Windows pode avisar "editor desconhecido": clique em Mais informações > Executar assim mesmo.

## Observações
- O celular e o PC precisam de internet para usar o painel.
- Se duas pessoas venderem a mesma peça exatamente ao mesmo tempo, o estoque pode ficar com uma unidade a mais ou a menos. Confira se isso acontecer.
- O projeto gratuito do Supabase pausa depois de cerca de uma semana sem uso. Use o painel ao menos uma vez por semana.
- A chave que está em `www/config.js` é a chave PÚBLICA. A chave secreta nunca deve ser colocada nesta pasta.
- Faça backup pela aba Resumo de vez em quando.
