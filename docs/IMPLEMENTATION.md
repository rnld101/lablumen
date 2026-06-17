# LabLumen — EC2 + Docker Compose Testing Guide

Deploy and test the full stack on a single EC2 instance using Docker Compose.
No EKS, no Terraform — just manual AWS resources and one `docker compose up`.

---

## Overview

What you will create manually, in order:

1. IAM role for EC2 (Bedrock, S3, SQS, SES, Cognito)
2. Cognito User Pool + App Client
3. S3 bucket (report uploads)
4. SQS queue (notification events)
5. SES verified sender email
6. Enable Bedrock model access
7. EC2 instance (attach the IAM role)
8. SSH in → install Docker → clone repo → fill in env values → `docker compose up`

Postgres and Redis run inside Docker Compose on the same instance — no RDS needed.

---

## Step 1 — Create the EC2 IAM Role

This role lets the EC2 instance call Bedrock, S3, SQS, SES, and Cognito without hardcoded keys.

1. Open **IAM → Roles → Create role**
2. Trusted entity: **AWS service → EC2**
3. Attach these managed policies:
   - `AmazonBedrockFullAccess`
   - `AmazonS3FullAccess`
   - `AmazonSQSFullAccess`
   - `AmazonSESFullAccess`
   - `AmazonCognitoReadOnly`
4. Name it: `lablumen-ec2-role`
5. Click **Create role**

---

## Step 2 — Create the Cognito User Pool

### 2a. Create the User Pool

1. Open **Cognito → User Pools → Create user pool**
2. Authentication providers: **Username and password** (Cognito user pool)
3. Sign-in options: check **Email**
4. Password policy: keep defaults or relax minimum length to 8
5. Multi-factor: **No MFA** (for testing)
6. Self-registration: **Enable** or disable — doesn't matter for CLI testing
7. Attribute verification: **Send email message** (uses Cognito's built-in sandbox)
8. Required attributes: add **email** as required
9. Email provider: **Send email with Cognito** (free tier, no SES setup required here)
10. User pool name: `lablumen-users`
11. Skip "Hosted UI" for now
12. Click **Create user pool**

**Copy the User Pool ID** (looks like `us-east-1_AbCdEfGhI`) — you will need it.

### 2b. Create the App Client

1. Inside your new user pool → **App clients → Create app client**
2. App type: **Public client**
3. App client name: `lablumen-app`
4. Client secret: **Don't generate** (public client)
5. Authentication flows: check **ALLOW_USER_PASSWORD_AUTH** and **ALLOW_REFRESH_TOKEN_AUTH**
6. Click **Create app client**

**Copy the App Client ID** (long alphanumeric string) — you will need it.

---

## Step 3 — Create the S3 Bucket

1. Open **S3 → Create bucket**
2. Bucket name: `lablumen-reports-<your-account-id>` (must be globally unique)
   - Example: `lablumen-reports-130290476321`
3. Region: **us-east-1**
4. Block all public access: **leave ON** (services use presigned URLs, not public access)
5. Versioning: off
6. Click **Create bucket**

**Copy the bucket name** — you will need it.

---

## Step 4 — Create the SQS Queue

1. Open **SQS → Create queue**
2. Type: **Standard**
3. Name: `lablumen-notifications`
4. Keep all defaults
5. Click **Create queue**

**Copy the Queue URL** — it looks like:
`https://sqs.us-east-1.amazonaws.com/130290476321/lablumen-notifications`

---

## Step 5 — Verify the SES Sender Email

SES starts in sandbox mode. You must verify the sender address.

1. Open **SES → Verified identities → Create identity**
2. Identity type: **Email address**
3. Email address: the address you want to send FROM (e.g. `no-reply@yourdomain.com`, or any personal email you own)
4. Click **Create identity**
5. Check that inbox and click the verification link AWS sends you

**Copy the verified email address** — you will need it.

> If you do not care about actual email delivery during testing, you can leave the placeholder
> value in docker-compose.yml. The notification service will log SES errors but stay running.

---

## Step 6 — Enable Bedrock Model Access

1. Open **Bedrock → Model access** (left sidebar, bottom section)
2. Click **Modify model access**
3. Enable both:
   - **Titan Text Embeddings v1** (`amazon.titan-embed-text-v1`)
   - **Amazon Nova Lite** (`amazon.nova-2-lite-v1:0`)
4. Click **Save changes**

Access is granted within a few minutes. Status will change from "Available" to "Access granted."

> This is required for the report-service RAG/chat features. Health checks and the lab test catalog work without Bedrock.

---

## Step 7 — Launch the EC2 Instance

1. Open **EC2 → Launch instance**
2. Name: `lablumen-test`
3. AMI: **Amazon Linux 2023** (x86_64)
4. Instance type: **t3.large** (Docker builds need RAM; t3.medium works but is slower)
5. Key pair: create or select an existing key pair — **save the `.pem` file**
6. Network settings:
   - VPC: default VPC is fine
   - Auto-assign public IP: **Enable**
   - Security group — create new, add these inbound rules:

     | Type | Port | Source |
     |---|---|---|
     | SSH | 22 | My IP |
     | Custom TCP | 8001 | My IP |
     | Custom TCP | 8002 | My IP |
     | Custom TCP | 8003 | My IP |
     | Custom TCP | 5173 | My IP |

7. Storage: **30 GB gp3** (default 8 GB is too small for Docker images)
8. Advanced details → IAM instance profile: select `lablumen-ec2-role`
9. Click **Launch instance**

Wait for instance state to show **Running** and status checks to pass (~2 min).

**Copy the public IP address** of the instance.

---

## Step 8 — Connect to the Instance and Install Docker

```bash
# From your local machine
ssh -i /path/to/your-key.pem ec2-user@<EC2-PUBLIC-IP>
```

Once connected:

```bash
# Install Docker
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user

# Install Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Re-login so the docker group takes effect
exit
```

SSH back in:

```bash
ssh -i /path/to/your-key.pem ec2-user@<EC2-PUBLIC-IP>

# Verify
docker --version
docker compose version
```

---

## Step 9 — Clone the Repo

```bash
git clone https://github.com/<your-github-username>/lablumen.git
cd lablumen
```

---

## Step 10 — Fill in the Placeholder Values

Edit `docker-compose.yml` and replace the placeholder values with the real ones you collected:

```bash
nano docker-compose.yml
```

Find the `x-service-env` block near the top and update:

```yaml
x-service-env: &service-env
  DATABASE_URL: postgresql+asyncpg://lablumen:lablumen@postgres:5432/lablumen
  REDIS_URL: redis://redis:6379/0
  AWS_REGION: us-east-1
  COGNITO_USER_POOL_ID: us-east-1_AbCdEfGhI          # ← your User Pool ID
  COGNITO_APP_CLIENT_ID: 3abc123def456ghi789          # ← your App Client ID
  BEDROCK_EMBED_MODEL_ID: amazon.titan-embed-text-v1
  BEDROCK_TEXT_MODEL_ID: amazon.nova-2-lite-v1:0
```

Find the `report-service` block and update:

```yaml
  report-service:
    ...
    environment:
      <<: *service-env
      REPORTS_S3_BUCKET: lablumen-reports-130290476321  # ← your bucket name
      PRESIGNED_URL_TTL_SECONDS: "120"
```

Find the `notification-service` block and update:

```yaml
  notification-service:
    ...
    environment:
      <<: *service-env
      NOTIFICATIONS_QUEUE_URL: https://sqs.us-east-1.amazonaws.com/130290476321/lablumen-notifications  # ← your queue URL
      SES_SENDER_EMAIL: no-reply@yourdomain.com         # ← your verified SES email
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

---

## Step 11 — Configure the Frontend (optional, for UI testing)

```bash
cp frontend/.env.example frontend/.env
nano frontend/.env
```

Replace the values:

```env
VITE_APPOINTMENT_API=http://<EC2-PUBLIC-IP>:8001
VITE_REPORT_API=http://<EC2-PUBLIC-IP>:8002

VITE_COGNITO_USER_POOL_ID=us-east-1_AbCdEfGhI
VITE_COGNITO_APP_CLIENT_ID=3abc123def456ghi789
VITE_COGNITO_DOMAIN=https://lablumen-users.auth.us-east-1.amazoncognito.com
```

> The Cognito domain follows the pattern `https://<user-pool-name>.auth.<region>.amazoncognito.com`.
> Check it under Cognito → your user pool → App integration → Domain.

---

## Step 12 — Start the Stack

```bash
cd ~/lablumen
docker compose up --build
```

First run takes 5–10 minutes (builds images, installs pip deps). Watch for:

- `migrate` container exits with code `0` — means DB schema + seed applied
- Each service logs: `Uvicorn running on http://0.0.0.0:8000`

To run in background after first build:

```bash
docker compose up -d
docker compose logs -f   # tail logs
```

---

## Step 13 — Smoke Test

From your **local machine** (not the EC2 terminal), run:

```bash
# Replace with your EC2 public IP
EC2=<EC2-PUBLIC-IP>

curl http://$EC2:8001/healthz          # → {"status":"ok"}
curl http://$EC2:8002/healthz          # → {"status":"ok"}
curl http://$EC2:8003/healthz          # → {"status":"ok"}
curl http://$EC2:8001/api/v1/lab-tests # → JSON array of 9 lab tests
```

---

## Step 14 — Create a Test Cognito User

Run this from your **local machine** (needs AWS CLI configured):

```bash
POOL_ID=us-east-1_AbCdEfGhI          # your User Pool ID
CLIENT_ID=3abc123def456ghi789         # your App Client ID

# Create user
aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username patient@example.com \
  --region us-east-1

# Set a permanent password (skips the forced-reset flow)
aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username patient@example.com \
  --password 'Test12345!' \
  --permanent \
  --region us-east-1

# Get a JWT token
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters USERNAME=patient@example.com,PASSWORD='Test12345!' \
  --region us-east-1 \
  --query 'AuthenticationResult.IdToken' \
  --output text)

echo $TOKEN   # long JWT string
```

Test an authenticated endpoint:

```bash
curl -H "Authorization: Bearer $TOKEN" http://$EC2:8002/api/v1/reports
```

---

## Step 15 — Test the Frontend (optional)

From the EC2 instance, build and serve the frontend:

```bash
cd ~/lablumen/frontend
npm install
npm run build
npm run preview -- --host 0.0.0.0 --port 5173
```

Then open `http://<EC2-PUBLIC-IP>:5173` in your browser.

---

## Summary of Values to Collect

| Value | Where to find it | Used in |
|---|---|---|
| Cognito User Pool ID | Cognito → User pools → your pool → Overview | docker-compose.yml, frontend/.env |
| Cognito App Client ID | Cognito → your pool → App clients | docker-compose.yml, frontend/.env |
| Cognito Domain | Cognito → your pool → App integration → Domain | frontend/.env |
| S3 Bucket Name | S3 → your bucket name | docker-compose.yml (report-service) |
| SQS Queue URL | SQS → your queue → URL | docker-compose.yml (notification-service) |
| SES Sender Email | SES → Verified identities | docker-compose.yml (notification-service) |
| EC2 Public IP | EC2 → your instance → Public IPv4 | frontend/.env, curl test commands |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `migrate` exits non-zero | Postgres not ready yet. Run `docker compose restart migrate` |
| Service crashes with `COGNITO_USER_POOL_ID` error | You have the old placeholder value — check docker-compose.yml |
| `curl` to port 8001 times out | EC2 security group is missing the inbound rule for that port |
| Bedrock `AccessDenied` | Model access not enabled (Step 6) or EC2 role missing `AmazonBedrockFullAccess` |
| SES `MessageRejected` | Sender email not verified, or recipient is not verified (sandbox mode) |
| SQS `AccessDenied` | EC2 role missing `AmazonSQSFullAccess` |
| Frontend can't reach API | `VITE_APPOINTMENT_API` uses `localhost` — must be the EC2 public IP |
| `notification-service` logs SQS errors but stays up | Expected if queue URL is still placeholder; doesn't block other features |
| Docker build fails out of disk | Instance storage too small — stop and increase EBS volume to 30 GB |
