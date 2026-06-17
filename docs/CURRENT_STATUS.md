# LabLumen — Current Status

> Living document. Update this whenever the deployment, resources, or feature state change.
> Last updated: 2026-06-18.

## TL;DR

Full product runs end-to-end on a single EC2 instance via docker-compose (nginx :80 →
3 FastAPI services + Postgres/pgvector + Redis). Auth wall (Cognito), patient booking, staff
operations + report upload, AI ingestion (Textract → Nova summary → Titan embeddings), and
document-scoped RAG chat are all implemented and wired. The S3-triggered Lambda in
`serverless/` is intentionally parked for the future EKS migration (it can't reach the
docker-compose DB); ingestion runs inside report-service for this single-instance setup.

## Deployment

- **Model**: single EC2 (Ubuntu 24.04) running `docker compose`. nginx serves the SPA on :80 and
  reverse-proxies `/api/v1/*` to the services (same-origin → no CORS).
- **Instance**: `i-062daf1d4c5193613` — public IP **54.198.249.16** (region us-east-1).
- **App URL**: http://54.198.249.16
- **Deploy / redeploy** (on the instance):
  ```bash
  cd ~/lablumen && git pull origin main && docker compose up --build -d
  ```
- Repo: https://github.com/rnld101/lablumen (branch `main`).

## Provisioned AWS resources

| Resource | Value |
|---|---|
| Cognito User Pool | `us-east-1_3hMVOZPch` |
| Cognito App Client | `7eb2d3esnbfs3te482jgsfqp6t` (public client; USER_PASSWORD_AUTH + SRP) |
| Cognito groups | `PATIENT`, `LAB_STAFF`, `LAB_ADMIN` |
| S3 bucket | `lablumen-reports-130290476321` |
| SQS queue | `https://sqs.us-east-1.amazonaws.com/130290476321/lablumen-notifications` |
| SES sender (verified) | `rukesully@gmail.com` |
| Bedrock models | `amazon.titan-embed-text-v1` (embed), `amazon.nova-2-lite-v1:0` (text) |
| EC2 IAM role | `lablumen-ec2-role` (Bedrock, S3, SQS, SES, CognitoReadOnly, **Textract**, SSM) |
| EC2 instance profile | `lablumen-ec2-profile` |
| Security group | `sg-0cd62be1c32705ec0` (`lablumen-sg`; ports 22, 80, 8001–8003) |

## Test users (password for all: `Test12345!`)

| Email | Group | Notes |
|---|---|---|
| `rukesully@gmail.com` | PATIENT | **Use this patient** — email is SES-verified, so booking confirmation emails actually deliver (SES sandbox). |
| `patient@example.com` | PATIENT | Works, but SES sandbox won't deliver email to it. |
| `staff@example.com` | LAB_STAFF | Staff portal + report upload. |

## Feature status

| Area | Status | Notes |
|---|---|---|
| Auth wall + Cognito login | ✅ | Embedded login form (`amazon-cognito-identity-js`), ID token stored, route guards, staff-gated `/staff`. |
| Lazy user provisioning | ✅ | `users` row upserted from JWT on first authenticated request (appointment-service). |
| Lab catalog | ✅ | 9 seeded tests; live fetch. |
| Patient profiles | ✅ | Create/list; booking is per-profile. |
| Booking | ✅ | Redis slot-lock, multi-test cost total, slot picker, price snapshot, `appointment.booked` → SQS → SES email. |
| Appointments list | ✅ | Own (patient) / all (staff). |
| Staff ops queue | ✅ | Join grid: patient/test/when/status + report state; status toggle (PATCH). |
| Report upload | ✅ | Staff multipart upload → S3 → `lab_reports` row → background ingestion. |
| AI ingestion | ✅ | In report-service: Textract OCR → Nova summary → chunk → Titan embeddings → pgvector. |
| Report view | ✅ | Presigned S3 GET URL (120s TTL), ownership-scoped. |
| RAG chat | ✅ | Document-scoped cosine (`<=>`) over the report's chunks + Nova answer + disclaimer. |
| Notifications | ✅ | SQS consumer + SES email (sandbox: only verified recipients receive). |
| S3→Lambda ingestion | ⏸ Parked | Complete code in `serverless/ai-processing-pipeline/`; can't reach the compose DB. For EKS phase. |

## End-to-end demo script

1. Open http://54.198.249.16 → redirected to `/login`.
2. Sign in as **`rukesully@gmail.com` / `Test12345!`** (patient).
3. **Book a Lab Test**: add a patient profile (if none) → select 2 tests (cost total updates) →
   pick date + slot → **Book appointment**. Confirmation email lands at rukesully@gmail.com.
4. Sign out → sign in as **`staff@example.com`** → **Staff** tab → Operations Queue shows the new
   order(s). Toggle status; click **Upload PDF** on a row and pick a lab-report PDF/image.
5. Row flips to "Report uploaded"; ingestion runs in the background (Textract → Nova → Titan).
6. Sign back in as the patient → **My Reports** shows the report as **Ready** with an AI summary →
   **Preview** opens the presigned PDF → **Chat** answers questions grounded in that report only.

## Known limitations / notes

- **SES sandbox**: only verified addresses receive email. Demo as `rukesully@gmail.com`. To email
  arbitrary patients, request SES production access.
- **Textract**: uses synchronous `detect_document_text` — best for single-page PDFs/images.
- **Ingestion** runs as a FastAPI BackgroundTask (no queue/retry). Fine for the demo; the EKS path
  uses the S3-triggered Lambda instead.
- **Secrets**: IDs live in `docker-compose.yml` for this test setup; production uses Secrets
  Manager (see terraform/k8s).
- `EC2 reboot` changes the public IP unless an Elastic IP is attached.

## How to pick up from here

- Code layout: `backend/{appointment,report,notification}-service/app`, `frontend/src`,
  `serverless/ai-processing-pipeline` (EKS-bound), `terraform/`, `k8s/`.
- Implementation runbook: `docs/IMPLEMENTATION.md`. Original blueprint context in git history.
- Next milestones (not done yet): SES production access; move ingestion to the Lambda for EKS;
  Secrets Store CSI; the Terraform/EKS deploy (`docs/IMPLEMENTATION.md` Phases 3–5 from the
  original plan); finish any remaining polish on appointment cancellation flows.
