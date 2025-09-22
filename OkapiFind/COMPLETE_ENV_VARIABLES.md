# Complete Environment Variables Guide for OkapiFind

**Last Updated:** 2025-09-22
**Total Variables:** 50+

## 🔴 Critical Requirements
These environment variables are **MANDATORY** for the app to function properly.

---

## 📱 Core App Configuration

```bash
# App Configuration
NODE_ENV=production                    # Environment (development/staging/production)
EXPO_PUBLIC_APP_NAME=OkapiFind        # App display name
EXPO_PUBLIC_APP_VERSION=1.0.0         # Current app version
EXPO_PUBLIC_BUNDLE_IDENTIFIER=com.okapifind.app
```

---

## 🔥 Firebase Configuration (Required)

```bash
# Firebase Core
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key-here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# Firebase Admin (Server-side)
FIREBASE_ADMIN_SDK_KEY={"type":"service_account"...}
FIREBASE_SERVER_KEY=your-fcm-server-key
```

---

## 🗄️ Supabase Configuration (Required)

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only
```

---

## 🔐 Authentication Providers

```bash
# Google OAuth
EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID=123456.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_OAUTH_IOS_CLIENT_ID=123456.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_OAUTH_ANDROID_CLIENT_ID=123456.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret    # Server-side only

# Apple Sign-In
EXPO_PUBLIC_APPLE_SERVICE_ID=com.okapifind.service
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
```

---

## 🗺️ Maps & Location Services

```bash
# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key
GOOGLE_MAPS_SERVER_KEY=your-server-key           # Server-side

# OpenStreetMap
OSM_API_URL=https://nominatim.openstreetmap.org

# Mapbox (Optional alternative)
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-token
```

---

## 💰 Payment & Subscriptions

```bash
# RevenueCat
EXPO_PUBLIC_REVENUECAT_API_KEY=your-public-api-key
REVENUECAT_SECRET_KEY=your-secret-key            # Server-side
REVENUECAT_WEBHOOK_SECRET=your-webhook-secret

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...                    # Server-side
STRIPE_WEBHOOK_SECRET=whsec_...

# Blockchain (Web3)
BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/v3/your-key
BLOCKCHAIN_WALLET_PRIVATE_KEY=0x...              # Server-side only
BLOCKCHAIN_CONTRACT_ADDRESS=0x...
ETHEREUM_NETWORK=mainnet
```

---

## 📊 Analytics & Monitoring

```bash
# Sentry
EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-org
SENTRY_PROJECT=okapifind
SENTRY_ENVIRONMENT=production

# Google Analytics
EXPO_PUBLIC_GA_TRACKING_ID=UA-XXXXXXXXX-X
GA4_MEASUREMENT_ID=G-XXXXXXXXXX

# Mixpanel
EXPO_PUBLIC_MIXPANEL_TOKEN=your-project-token

# Segment
EXPO_PUBLIC_SEGMENT_WRITE_KEY=your-write-key
```

---

## 🚀 Infrastructure & DevOps

```bash
# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
REDIS_URL=redis://user:pass@host:6379/0

# PostgreSQL
DATABASE_URL=postgresql://user:pass@host:5432/okapifind
DB_PASSWORD=your-db-password

# MongoDB (Alternative)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/okapifind

# Kafka
KAFKA_BROKER=localhost:9092
KAFKA_TOPIC_PREFIX=okapifind
KAFKA_CONSUMER_GROUP=okapifind-consumers

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_API_KEY=your-api-key

# ClickHouse (Analytics DB)
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=okapifind_analytics
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password
```

---

## 🤖 Machine Learning & AI

```bash
# TensorFlow Serving
ML_SERVICE_URL=http://localhost:8501/v1/models
MODEL_PATH=/models

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_ORGANIZATION=org-...

# Hugging Face
HUGGINGFACE_API_KEY=hf_...

# Custom ML Models
ML_PREDICTION_ENDPOINT=https://api.okapifind.com/ml/predict
ML_TRAINING_BUCKET=s3://okapifind-ml-models
```

---

## 📱 Push Notifications

```bash
# Firebase Cloud Messaging
FCM_SERVER_KEY=your-fcm-server-key

# Apple Push Notifications
APNS_KEY_ID=your-key-id
APNS_TEAM_ID=your-team-id
APNS_KEY_PATH=./certificates/apns.p8
APNS_TOPIC=com.okapifind.app

# OneSignal (Alternative)
ONESIGNAL_APP_ID=your-app-id
ONESIGNAL_REST_API_KEY=your-rest-key
```

---

## 🌐 API Gateway & Microservices

```bash
# API Gateway
API_GATEWAY_URL=https://api.okapifind.com
API_VERSION=v1

# Service URLs
SERVICES_AUTH=http://auth-service:3001
SERVICES_USER=http://user-service:3002
SERVICES_PARKING=http://parking-service:3003
SERVICES_NAVIGATION=http://navigation-service:3004
SERVICES_NOTIFICATION=http://notification-service:3005
SERVICES_ANALYTICS=http://analytics-service:3006
SERVICES_PAYMENT=http://payment-service:3007
SERVICES_ML=http://ml-service:3008

# Service Discovery
CONSUL_URL=http://consul:8500
EUREKA_URL=http://eureka:8761/eureka
```

---

## 🔒 Security & Compliance

```bash
# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-256-bit-key
ENCRYPTION_ALGORITHM=aes-256-gcm

# GDPR Compliance
GDPR_DATA_RETENTION_DAYS=90
GDPR_EXPORT_ENCRYPTION_KEY=your-export-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://okapifind.com
CORS_CREDENTIALS=true
```

---

## 📦 Storage & CDN

```bash
# AWS S3
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET=okapifind-assets
S3_UPLOAD_BUCKET=okapifind-uploads

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# CDN
CDN_URL=https://cdn.okapifind.com
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_KEY=your-api-key
```

---

## 🔧 Build & Deployment

```bash
# EAS Build
EAS_PROJECT_ID=your-project-id
EXPO_TOKEN=your-expo-token

# App Store
APP_STORE_CONNECT_API_KEY=your-key
APP_STORE_CONNECT_API_KEY_ID=XXXXXXXXXX
APP_STORE_CONNECT_ISSUER_ID=uuid

# Google Play
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account"...}
GOOGLE_PLAY_TRACK=production

# Docker
DOCKER_REGISTRY=docker.io
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-password

# Kubernetes
KUBECONFIG=/path/to/kubeconfig
K8S_NAMESPACE=okapifind
HELM_RELEASE_NAME=okapifind
```

---

## 🔄 CI/CD & Testing

```bash
# GitHub Actions
GITHUB_TOKEN=ghp_...
GITHUB_REPOSITORY=username/okapifind

# Testing
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/test
TEST_REDIS_URL=redis://localhost:6380
E2E_TEST_URL=http://localhost:19000

# Code Quality
SONARQUBE_TOKEN=your-token
SONARQUBE_URL=https://sonarqube.com
CODECOV_TOKEN=your-token
```

---

## 📈 Monitoring & Observability

```bash
# Prometheus
PROMETHEUS_URL=http://localhost:9090
PROMETHEUS_PUSHGATEWAY=http://localhost:9091

# Grafana
GRAFANA_URL=http://localhost:3000
GRAFANA_API_KEY=your-api-key
GRAFANA_DASHBOARD_UID=okapifind-main
GRAFANA_PASSWORD=admin

# Jaeger (Distributed Tracing)
JAEGER_AGENT_HOST=localhost
JAEGER_AGENT_PORT=6831
JAEGER_COLLECTOR_URL=http://localhost:14268/api/traces

# DataDog
DATADOG_API_KEY=your-api-key
DATADOG_APP_KEY=your-app-key
DATADOG_SITE=datadoghq.com

# New Relic
NEW_RELIC_LICENSE_KEY=your-license-key
NEW_RELIC_APP_NAME=OkapiFind
```

---

## 🌍 Multi-Tenant Configuration

```bash
# Tenant Configuration
TENANT_ISOLATION_MODE=database      # database/schema/row
DEFAULT_TENANT_ID=default
TENANT_DATABASE_PREFIX=okapifind_

# Tenant Routing
TENANT_HEADER=X-Tenant-ID
TENANT_SUBDOMAIN_ENABLED=true
TENANT_DOMAIN_PATTERN=*.okapifind.com
```

---

## 🏢 Feature Flags

```bash
# LaunchDarkly
LAUNCHDARKLY_SDK_KEY=sdk-...
LAUNCHDARKLY_MOBILE_KEY=mob-...

# Unleash
UNLEASH_URL=http://unleash:4242
UNLEASH_API_KEY=your-api-key
UNLEASH_APP_NAME=okapifind
```

---

## 🌐 PWA Configuration

```bash
# Progressive Web App
PWA_NAME=OkapiFind
PWA_SHORT_NAME=OkapiFind
PWA_THEME_COLOR=#FFD700
PWA_BACKGROUND_COLOR=#0F1B2A
PWA_DISPLAY=standalone
PWA_ORIENTATION=portrait
SERVICE_WORKER_URL=/sw.js

# Web Push
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:admin@okapifind.com
```

---

## 📝 Development & Local Testing

```bash
# Development overrides
DEV_API_URL=http://localhost:3000
DEV_SKIP_AUTH=false
DEV_MOCK_LOCATION=true
DEV_LOG_LEVEL=debug
DEV_HOT_RELOAD=true

# Expo Development
EXPO_PUBLIC_DEV_TOOLS=true
EXPO_PUBLIC_USE_DEVICE=false
EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
```

---

## 🚨 Emergency & Fallback

```bash
# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=30000
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT=60000

# Fallback Services
FALLBACK_MAP_PROVIDER=openstreetmap
FALLBACK_PAYMENT_PROVIDER=stripe
FALLBACK_CACHE_PROVIDER=memory

# Emergency Contacts
EMERGENCY_ADMIN_EMAIL=admin@okapifind.com
EMERGENCY_PHONE=+1-555-0123
ON_CALL_WEBHOOK=https://hooks.slack.com/services/...
```

---

## 📋 Setup Instructions

### 1. Create `.env` file in project root:
```bash
cp .env.example .env
```

### 2. Add variables based on your environment:
- **Development**: Use `.env.development`
- **Staging**: Use `.env.staging`
- **Production**: Use `.env.production`

### 3. For Expo/React Native:
- Variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the app
- Restart Metro bundler after changing environment variables

### 4. For Docker:
```bash
docker run --env-file .env okapifind/app
```

### 5. For Kubernetes:
```bash
kubectl create secret generic okapifind-env --from-env-file=.env
```

### 6. Validate all required variables:
```bash
npm run validate:env
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` files to version control**
2. **Use different keys for different environments**
3. **Rotate secrets regularly (every 90 days)**
4. **Use secret management tools**:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Secret Manager
5. **Encrypt sensitive values in CI/CD**
6. **Use least privilege principle for API keys**
7. **Monitor for exposed secrets with tools like GitGuardian**

---

## 📞 Support

For help with environment setup:
- Documentation: https://docs.okapifind.com/env
- Support: support@okapifind.com
- Emergency: Use ON_CALL_WEBHOOK

---

*Generated: 2025-09-22*
*Version: 2.0.0*