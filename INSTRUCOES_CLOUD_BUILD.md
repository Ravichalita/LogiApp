# Como Resolver o Erro "Permission Denied" no Cloud Build (Manualmente via Console)

Você está recebendo um erro de permissão porque a conta de serviço usada pelo **Firebase App Hosting** não tem permissão para criar "builds" no Google Cloud Build.

Siga estes passos para corrigir o problema usando o **Google Cloud Console** (Interface Web), sem precisar usar comandos de texto.

## Passo 1: Acessar o Google Cloud IAM

1. Acesse o [Console do Google Cloud](https://console.cloud.google.com/).
2. Certifique-se de que o projeto **`caambacontrol3`** está selecionado na barra superior (ao lado do logo do Google Cloud).
3. No menu de navegação (três linhas no canto superior esquerdo), vá em **IAM e admin** > **IAM**.

## Passo 2: Adicionar Permissões à Conta de Serviço

Precisamos dar a permissão "Agente de serviço do Cloud Build" para a conta de serviço específica mencionada no erro.

1. Na página do IAM, clique no botão **CONCEDER ACESSO** (ou "GRANT ACCESS") que fica próximo ao topo da tabela de permissões.
2. Vai abrir um painel lateral direito "Adicionar principais".
3. No campo **Novos principais**, copie e cole exatamente o e-mail da conta de serviço que apareceu no seu erro:

   ```text
   service-11233123437@gcp-sa-firebaseapphosting.iam.gserviceaccount.com
   ```

4. No campo **Selecionar um papel** (Role), digite e procure por:

   **Agente de serviço do Cloud Build**
   *(Em inglês: Cloud Build Service Agent)*

5. Selecione essa opção na lista.
6. Clique em **SALVAR**.

## Passo 3: Verificar API do Cloud Build (Opcional, mas recomendado)

Se o erro persistir dizendo que o "Cloud Build Service Agent" não existe, certifique-se de que a API está ativada:

1. No menu de navegação, vá em **APIs e serviços** > **Biblioteca**.
2. Na barra de busca, digite **Cloud Build API**.
3. Clique no resultado "Cloud Build API".
4. Se houver um botão azul escrito **ATIVAR** (ENABLE), clique nele. Se já estiver escrito "GERENCIAR", então já está ativo.

---

### Resumo
Você acabou de autorizar manualmente o "robô" do Firebase App Hosting (`service-11233...`) a criar e gerenciar builds no seu projeto, adicionando o papel de `Cloud Build Service Agent` através do painel do IAM. Tente fazer o deploy novamente após alguns instantes.
