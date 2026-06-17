# LabLumen — EC2 + Docker Compose Testing Guide

Single-instance testing setup. All AWS resources have been provisioned.
nginx (port 80) serves the frontend and proxies `/api/v1/` to the backend — no CORS issues.

---

## Provisioned AWS Resources (already live)

| Resource | Value |
|---|---|
| **Cognito User Pool ID** | `us-east-1_3hMVOZPch` |
| **Cognito App Client ID** | `7eb2d3esnbfs3te482jgsfqp6t` |
| **S3 Bucket** | `lablumen-reports-130290476321` |
| **SQS Queue URL** | `https://sqs.us-east-1.amazonaws.com/130290476321/lablumen-notifications` |
| **SES Sender Email** | `rukesully@gmail.com` (verified) |
| **EC2 IAM Role** | `lablumen-ec2-role` |
| **EC2 Instance Profile** | `lablumen-ec2-profile` |
| **EC2 Security Group** | `sg-0cd62be1c32705ec0` (`lablumen-sg`) |
| **Bedrock Models** | `amazon.titan-embed-text-v1` (embed) + `amazon.nova-lite-v1:0` (text). Nova 2 Lite needs a cross-region inference profile that the org SCP blocks — see docs/CURRENT_STATUS.md. |
| **Test User** | `patient@example.com` / `Test12345!` |

All values are already baked into `docker-compose.yml` — no manual editing required after clone.

---

## Step 1 — Push the Updated Code

Several files changed locally (CORS fix, nginx proxy, frontend Dockerfile, docker-compose.yml).
Push them to GitHub before launching EC2 so the bootstrap script pulls the latest version.

```bash
git add backend/appointment-service/app/config.py \
        backend/appointment-service/app/main.py \
        backend/report-service/app/config.py \
        backend/report-service/app/main.py \
        frontend/Dockerfile \
        frontend/nginx.conf \
        docker-compose.yml

git commit -m "fix: nginx reverse proxy, CORS env var, frontend Dockerfile for EC2 deploy"
git push origin main
```

---

## Step 2 — Launch the EC2 Instance (Console)

The IAM user `rn1d` cannot launch EC2 via CLI (org SCP restriction). Use the AWS Console.

1. Go to **EC2 → Launch instance**
2. Use these exact settings:

   | Setting | Value |
   |---|---|
   | Name | `lablumen-test` |
   | AMI | Ubuntu 24.04 LTS — `ami-0f8a61b66d1accaee` (us-east-1) |
   | Instance type | `t3.large` |
   | Key pair | `rnld2` |
   | Security group | Select existing: `lablumen-sg` (`sg-0cd62be1c32705ec0`) |
   | Storage | 30 GB gp3 |
   | IAM instance profile | `lablumen-ec2-profile` |

3. Expand **Advanced details → User data** and paste the entire script below:

```bash
#!/bin/bash
set -e
exec > /var/log/lablumen-setup.log 2>&1

echo "=== LabLumen bootstrap start $(date) ==="

apt-get update -y
apt-get install -y ca-certificates curl gnupg git

# Install Docker CE via official repo
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

cd /home/ubuntu
git clone https://github.com/rnld101/lablumen.git lablumen
chown -R ubuntu:ubuntu /home/ubuntu/lablumen

cd /home/ubuntu/lablumen
sudo -u ubuntu docker compose up --build -d

echo "=== LabLumen bootstrap done $(date) ==="
echo "App ready at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
```

4. Click **Launch instance**

> If the repo is **private**, replace the `git clone` line with:
> `git clone https://<YOUR_GITHUB_PAT>@github.com/rnld101/lablumen.git lablumen`

---

## Step 3 — Wait for Bootstrap to Complete

The user-data script runs in the background. It takes **10–15 minutes** (image builds dominate).

SSH in and tail the log to watch progress:

```bash
ssh -i /path/to/rnld2.pem ubuntu@<EC2-PUBLIC-IP>
tail -f /var/log/lablumen-setup.log
```

Bootstrap is complete when you see:
```
=== LabLumen bootstrap done ...
App ready at: http://54.x.x.x
```

---

## Step 4 — Verify the Stack

```bash
# From your local machine
EC2=<EC2-PUBLIC-IP>

# All three health checks
curl http://$EC2/health/appointment    # → {"status":"ok"}
curl http://$EC2/health/report         # → {"status":"ok"}
curl http://$EC2/health/notification   # → {"status":"ok"}

# Lab test catalog (9 seeded records)
curl http://$EC2/api/v1/lab-tests
```

Open the browser at `http://<EC2-PUBLIC-IP>` — you should see the Patient dashboard with:
- The **Test Catalog** bento card populated with 9 tests (CBC, Lipid Profile, etc.)
- The **Latest Reports** card with 2 mock entries
- A working **Preview** button that opens the modal

---

## Step 5 — Get a JWT Token for Auth Testing

```bash
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 7eb2d3esnbfs3te482jgsfqp6t \
  --auth-parameters USERNAME=patient@example.com,PASSWORD='Test12345!' \
  --region us-east-1 \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Test a protected endpoint
curl -H "Authorization: Bearer $TOKEN" http://$EC2/api/v1/reports
```

---

## Architecture on EC2

```
Browser ──HTTP:80──► nginx (frontend container)
                         │
                         ├─ /api/v1/reports/*  ──► report-service:8000
                         ├─ /api/v1/*          ──► appointment-service:8000
                         ├─ /health/*          ──► respective service /healthz
                         └─ /*                 ──► React SPA (built + served by nginx)

All services share one Docker network.
Postgres (pgvector:pg16) and Redis run as containers — no RDS needed.
```

The nginx proxy means the browser always calls the same origin → **zero CORS issues**.

---

## Manual Docker Compose (if user-data fails or for re-deploys)

SSH into the instance and run:

```bash
ssh -i /path/to/rnld2.pem ubuntu@<EC2-PUBLIC-IP>
cd ~/lablumen

# First time
docker compose up --build -d

# Subsequent deploys (after git pull)
git pull origin main
docker compose up --build -d

# Logs
docker compose logs -f

# Tear down + clean volumes
docker compose down -v
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Browser shows blank page | Bootstrap still running. Tail `/var/log/lablumen-setup.log` — wait for "done" |
| `migrate` container keeps restarting | Run `docker compose logs migrate` — usually Postgres not ready yet; run `docker compose restart migrate` |
| Test Catalog empty (browser console shows 502) | `appointment-service` still starting. Wait 30 s and refresh |
| SQS `AccessDenied` in notification-service logs | EC2 IAM role not attached — verify the instance uses `lablumen-ec2-profile` |
| Bedrock `AccessDenied` in report-service logs | Model access not enabled — go to Bedrock → Model access and enable Titan + Nova Lite |
| `docker compose up` says "network lablumen_default already exists" | `docker compose down` first, then `up --build -d` |
| GitHub clone fails (exit 128) | Repo is private — use a PAT in the clone URL (see Step 2 note) |

---

## Teardown

When done testing, terminate the instance to stop charges:

```bash
aws ec2 terminate-instances \
  --instance-ids <INSTANCE-ID> \
  --region us-east-1
```

The provisioned resources (Cognito, S3, SQS) have no ongoing cost until used.
To clean them up:

```bash
aws cognito-idp delete-user-pool --user-pool-id us-east-1_3hMVOZPch --region us-east-1
aws s3 rb s3://lablumen-reports-130290476321 --force
aws sqs delete-queue --queue-url https://sqs.us-east-1.amazonaws.com/130290476321/lablumen-notifications
aws iam remove-role-from-instance-profile --instance-profile-name lablumen-ec2-profile --role-name lablumen-ec2-role
aws iam delete-instance-profile --instance-profile-name lablumen-ec2-profile
aws iam detach-role-policy --role-name lablumen-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
aws iam detach-role-policy --role-name lablumen-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam detach-role-policy --role-name lablumen-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess
aws iam detach-role-policy --role-name lablumen-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonSESFullAccess
aws iam detach-role-policy --role-name lablumen-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonCognitoReadOnly
aws iam delete-role --role-name lablumen-ec2-role
aws ec2 delete-security-group --group-id sg-0cd62be1c32705ec0 --region us-east-1
```
