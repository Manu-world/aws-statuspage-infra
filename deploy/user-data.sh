#!/bin/bash
# EC2 user-data for StatusPage (Amazon Linux 2023)
# Templated by Terraform: ARTIFACT_BUCKET, ARTIFACT_KEY, SECRET_ARN, AWS_REGION, APP_PORT
set -euo pipefail

ARTIFACT_BUCKET="${artifact_bucket}"
ARTIFACT_KEY="${artifact_key}"
SECRET_ARN="${secret_arn}"
AWS_REGION="${aws_region}"
APP_PORT="${app_port}"
APP_DIR=/opt/statuspage
ENV_FILE=/etc/statuspage/env
APP_USER=statuspage

exec > >(tee /var/log/statuspage-userdata.log | logger -t user-data -s 2>/dev/console) 2>&1

echo "Starting StatusPage user-data"

dnf update -y
dnf install -y unzip jq awscli

# Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

id -u "$APP_USER" &>/dev/null || useradd --system --home "$APP_DIR" --shell /sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" /etc/statuspage
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Fetch secrets from Secrets Manager and write env file for systemd
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)

DATABASE_URL=$(echo "$SECRET_JSON" | jq -r .DATABASE_URL)
JWT_SECRET=$(echo "$SECRET_JSON" | jq -r .JWT_SECRET)

cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=$APP_PORT
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET
EOF
chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE"

# Pull versioned release artifact from S3
# Convention: s3://$ARTIFACT_BUCKET/releases/<sha>.zip — CD also writes releases/latest.zip
TMP_ZIP=/tmp/statuspage-release.zip
aws s3 cp "s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY" "$TMP_ZIP" --region "$AWS_REGION"
rm -rf "$APP_DIR"/*
unzip -o "$TMP_ZIP" -d "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

cd "$APP_DIR"
# Production deps + Prisma client (artifact includes prisma/ and dist/)
sudo -u "$APP_USER" npm ci --omit=dev
sudo -u "$APP_USER" npx prisma generate

# Apply migrations before serving traffic
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
sudo -u "$APP_USER" env DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

# Install and start systemd unit (shipped inside the artifact under deploy/)
if [ -f "$APP_DIR/deploy/statuspage.service" ]; then
  cp "$APP_DIR/deploy/statuspage.service" /etc/systemd/system/statuspage.service
else
  cat > /etc/systemd/system/statuspage.service <<'UNIT'
[Unit]
Description=StatusPage Node.js application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=statuspage
Group=statuspage
WorkingDirectory=/opt/statuspage
EnvironmentFile=/etc/statuspage/env
ExecStart=/usr/bin/node /opt/statuspage/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=statuspage

[Install]
WantedBy=multi-user.target
UNIT
fi

systemctl daemon-reload
systemctl enable statuspage
systemctl restart statuspage

echo "StatusPage user-data complete"
