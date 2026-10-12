# Deploy (preparado, não executado)

> **Nada neste documento foi rodado.** O MVP roda 100% local (`npm run dev`, sem
> nenhuma credencial) — isto aqui é a preparação pro card B14: o que seria
> necessário para implantar de verdade, documentado para quando alguém (com
> acesso ao projeto GCP/Firebase) quiser rodar.

## Equivalente na Renault

Este repositório usa GitHub Actions (`ci.yml` + `deploy.yml`) porque é o que o
Insper/GitHub oferecem de graça para um projeto de estudante. **Na Renault, o
pipeline homologado é o GitLab CI** — a mesma lógica (checks → merge → deploy
manual) se traduziria para um `.gitlab-ci.yml` com estágios `test`, `build` e
`deploy` (o último com `when: manual`), usando GitLab CI/CD Variables no lugar
dos GitHub Secrets. A arquitetura (Cloud Run + Firebase Hosting + Cloud SQL) não
muda — só o orquestrador do pipeline.

## Peças

- **API** (`apps/api`): container Node 20, rodando no **Cloud Run**
  (`southamerica-east1`), com Postgres no **Cloud SQL**.
- **Front** (`apps/web`): build estático no **Firebase Hosting**.
- **Segredos**: **Secret Manager** (GCP) — nunca em variável de ambiente simples
  no workflow.
- **Storage**: **Cloud Storage** (`STORAGE_PROVIDER=gcs`), em vez do disco local.
- **IA**: Gemini real (`LLM_PROVIDER=gemini`), em vez do mock.
- **Auth**: Firebase Auth "live" (`AUTH_MODE=live`), em vez do emulador.

## Pré-requisitos (não feitos aqui)

1. Projeto no Google Cloud com faturamento ativado.
2. `gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com`.
3. Instância do Cloud SQL (Postgres 16):
   ```bash
   gcloud sql instances create gavve-db \
     --database-version=POSTGRES_16 \
     --region=southamerica-east1 \
     --tier=db-f1-micro
   gcloud sql databases create gavve --instance=gavve-db
   ```
4. Repositório no Artifact Registry:
   ```bash
   gcloud artifacts repositories create gavve \
     --repository-format=docker \
     --location=southamerica-east1
   ```
5. Segredos no Secret Manager (nomes usados pelo `deploy.yml`):
   ```bash
   echo -n "postgresql://usuario:senha@/gavve?host=/cloudsql/PROJETO:southamerica-east1:gavve-db" \
     | gcloud secrets create gavve-database-url --data-file=-
   echo -n "SUA_CHAVE_GEMINI" | gcloud secrets create gavve-gemini-api-key --data-file=-
   ```
6. Workload Identity Federation (sem chave JSON) ligando o repositório do GitHub
   a uma service account do GCP com permissão de deploy no Cloud Run e no
   Artifact Registry — ver
   https://github.com/google-github-actions/auth#setting-up-workload-identity-federation.
7. Projeto Firebase (pode ser o mesmo do GCP) com Hosting habilitado
   (`firebase init hosting`, reaproveitando o `firebase.json` já versionado).

## Secrets do GitHub Actions usados pelo `deploy.yml`

Nenhum destes existe neste repositório ainda — o workflow falha na autenticação
até alguém com acesso ao projeto GCP configurá-los em *Settings → Secrets and
variables → Actions*:

| Secret | Para quê |
|---|---|
| `GCP_PROJECT_ID` | projeto do GCP/Firebase |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF (auth sem chave JSON) |
| `GCP_SERVICE_ACCOUNT` | service account usada pelo WIF |
| `VITE_API_URL` | URL pública da API no Cloud Run, pro build do front |
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_PROJECT_ID` | config do Firebase "live" (não o emulador) |

## Comandos (pra rodar manualmente, fora do workflow, se precisar)

```bash
# build + push da imagem da API
docker build -f apps/api/Dockerfile -t southamerica-east1-docker.pkg.dev/PROJETO/gavve/gavve-api:latest .
docker push southamerica-east1-docker.pkg.dev/PROJETO/gavve/gavve-api:latest

# deploy da API no Cloud Run
gcloud run deploy gavve-api \
  --image southamerica-east1-docker.pkg.dev/PROJETO/gavve/gavve-api:latest \
  --region southamerica-east1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,AUTH_MODE=live,STORAGE_PROVIDER=gcs,LLM_PROVIDER=gemini" \
  --set-secrets "DATABASE_URL=gavve-database-url:latest,GEMINI_API_KEY=gavve-gemini-api-key:latest"

# rodar as migrations contra o Cloud SQL (via Cloud SQL Auth Proxy, à parte do deploy)
DATABASE_URL="postgresql://usuario:senha@127.0.0.1:5432/gavve" npm run db:deploy -w @gavve/api

# build do front + deploy no Firebase Hosting
npm run build -w @gavve/shared -w @gavve/web
firebase deploy --only hosting --project PROJETO
```

## Como disparar o workflow

`.github/workflows/deploy.yml` só roda via `workflow_dispatch` (aba *Actions* no
GitHub, botão "Run workflow") — nunca em push ou PR, e não interfere no `ci.yml`.
