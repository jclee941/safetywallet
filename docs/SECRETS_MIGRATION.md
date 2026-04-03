# Secrets Migration: wrangler.toml [vars] to wrangler secrets

## Overview

This document describes the migration of sensitive values from `wrangler.toml` `[vars]` sections to Cloudflare Workers secrets for production security hardening.

---

## 1. Current State

### Production `[vars]` (apps/api/wrangler.toml, lines 13-23)

| Variable                       | Current Value                                                         | Classification              | Migration Target        |
| ------------------------------ | --------------------------------------------------------------------- | --------------------------- | ----------------------- |
| `ENVIRONMENT`                  | `"production"`                                                        | Non-secret                  | Keep in wrangler.toml   |
| `REQUIRE_ATTENDANCE_FOR_LOGIN` | `"true"`                                                              | Non-secret (feature flag)   | Keep in wrangler.toml   |
| `REQUIRE_ATTENDANCE_FOR_POST`  | `"false"`                                                             | Non-secret (feature flag)   | Keep in wrangler.toml   |
| `ELASTICSEARCH_INDEX_PREFIX`   | `"safetywallet-logs"`                                                 | Non-secret                  | Keep in wrangler.toml   |
| `ALLOWED_ORIGINS`              | `"https://safetywallet.jclee.me,https://admin.safetywallet.jclee.me"` | Non-secret                  | Keep in wrangler.toml   |
| `VAPID_SUBJECT`                | `"mailto:admin@safetywallet.jclee.me"`                                | **Secret**                  | Move to wrangler secret |
| `FAS_DB_NAME`                  | `"mdidev"`                                                            | **Secret** (internal infra) | Move to wrangler secret |
| `FAS_SITE_CD`                  | `"10"`                                                                | **Secret** (internal infra) | Move to wrangler secret |
| `FAS_SITE_NAME`                | `"송도세브란스"`                                                      | **Secret** (internal infra) | Move to wrangler secret |
| `TURNSTILE_SITE_KEY`           | `"0x4AAAAAACx3gVo8D92ukyCJ"`                                          | Non-secret (public key)     | Keep in wrangler.toml   |

### Dev `[env.dev.vars]` (apps/api/wrangler.toml, lines 118-128)

| Variable                       | Current Value                                   | Classification           | Migration Target        |
| ------------------------------ | ----------------------------------------------- | ------------------------ | ----------------------- |
| `ENVIRONMENT`                  | `"development"`                                 | Non-secret               | Keep in wrangler.toml   |
| `REQUIRE_ATTENDANCE_FOR_LOGIN` | `"false"`                                       | Non-secret               | Keep in wrangler.toml   |
| `REQUIRE_ATTENDANCE_FOR_POST`  | `"false"`                                       | Non-secret               | Keep in wrangler.toml   |
| `ELASTICSEARCH_URL`            | `"http://192.168.50.109:9200"`                  | **Secret** (internal IP) | Move to wrangler secret |
| `ELASTICSEARCH_INDEX_PREFIX`   | `"safetywallet-logs"`                           | Non-secret               | Keep in wrangler.toml   |
| `ALLOWED_ORIGINS`              | `"http://localhost:3000,http://localhost:3001"` | Non-secret               | Keep in wrangler.toml   |
| `VAPID_SUBJECT`                | `"mailto:admin@safetywallet.jclee.me"`          | **Secret**               | Move to wrangler secret |
| `FAS_DB_NAME`                  | `"mdidev"`                                      | **Secret**               | Move to wrangler secret |
| `FAS_SITE_CD`                  | `"10"`                                          | **Secret**               | Move to wrangler secret |
| `FAS_SITE_NAME`                | `"송도세브난스"`                                | **Secret**               | Move to wrangler secret |

### Already-Declared Secrets (comments in wrangler.toml)

These are documented as required secrets but may not yet be set via `wrangler secret put`:

| Secret                  | Purpose                          |
| ----------------------- | -------------------------------- |
| `JWT_SECRET`            | JWT signing key                  |
| `HMAC_SECRET`           | HMAC-SHA256 for PII hashing      |
| `ENCRYPTION_KEY`        | AES encryption for phone/DOB     |
| `ALERT_WEBHOOK_URL`     | Webhook for operational alerts   |
| `FAS_SYNC_SECRET`       | Bearer secret for POST /fas-sync |
| `ELASTICSEARCH_URL`     | Elasticsearch endpoint (prod)    |
| `ELASTICSEARCH_API_KEY` | API key for Elasticsearch        |
| `OPENROUTER_API_KEY`    | API key for OpenRouter           |

---

## 2. Migration Steps

### 2.1 Set Production Secrets via CLI

Run these commands from the `apps/api/` directory:

```bash
cd apps/api

# Core secrets
npx wrangler secret put VAPID_SUBJECT --config wrangler.toml
# When prompted, enter: mailto:admin@safetywallet.jclee.me

npx wrangler secret put FAS_DB_NAME --config wrangler.toml
# When prompted, enter: mdidev

npx wrangler secret put FAS_SITE_CD --config wrangler.toml
# When prompted, enter: 10

npx wrangler secret put FAS_SITE_NAME --config wrangler.toml
# When prompted, enter: 송도세브란스

# Elasticsearch (prod URL)
npx wrangler secret put ELASTICSEARCH_URL --config wrangler.toml
# When prompted, enter: https://your-elasticsearch-endpoint:9200

# Verify secrets are set
npx wrangler secret list --config wrangler.toml
```

### 2.2 Set Development Secrets via CLI

```bash
cd apps/api

# Dev-specific Elasticsearch URL (internal IP)
npx wrangler secret put ELASTICSEARCH_URL --env dev --config wrangler.toml
# When prompted, enter: http://192.168.50.109:9200

npx wrangler secret put VAPID_SUBJECT --env dev --config wrangler.toml
npx wrangler secret put FAS_DB_NAME --env dev --config wrangler.toml
npx wrangler secret put FAS_SITE_CD --env dev --config wrangler.toml
npx wrangler secret put FAS_SITE_NAME --env dev --config wrangler.toml
```

### 2.3 Set Secrets via Cloudflare Dashboard

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account and navigate to **Workers & Pages**
3. Select **safetywallet** (production)
4. Go to **Settings** > **Environment Variables**
5. For each secret:
   - Click **Edit variables**
   - Set variable name (e.g., `VAPID_SUBJECT`)
   - Select **Secure** checkbox
   - Set value
   - Click **Save and deploy**

For production environment secrets, set them under the **Production** tab.

For dev environment, use the ** env.dev** tab.

---

## 3. Post-Migration: Remove Vars from wrangler.toml

After verifying secrets are set correctly, remove the migrated vars from `wrangler.toml`:

### Production `[vars]` section - remove these lines:

```toml
# REMOVE these lines from [vars]:
VAPID_SUBJECT = "mailto:admin@safetywallet.jclee.me"
FAS_DB_NAME = "mdidev"
FAS_SITE_CD = "10"
FAS_SITE_NAME = "송도세브란스"
```

### Development `[env.dev.vars]` section - remove these lines:

```toml
# REMOVE these lines from [env.dev.vars]:
ELASTICSEARCH_URL = "http://192.168.50.109:9200"
VAPID_SUBJECT = "mailto:admin@safetywallet.jclee.me"
FAS_DB_NAME = "mdidev"
FAS_SITE_CD = "10"
FAS_SITE_NAME = "송도세브란스"
```

### Keep these vars in wrangler.toml:

```toml
[vars]
ENVIRONMENT = "production"
REQUIRE_ATTENDANCE_FOR_LOGIN = "true"
REQUIRE_ATTENDANCE_FOR_POST = "false"
ELASTICSEARCH_INDEX_PREFIX = "safetywallet-logs"
ALLOWED_ORIGINS = "https://safetywallet.jclee.me,https://admin.safetywallet.jclee.me"
TURNSTILE_SITE_KEY = "0x4AAAAAACx3gVo8D92ukyCJ"
```

---

## 4. Rollback Plan

If issues occur after migration:

### 4.1 Emergency Rollback (Restore wrangler.toml vars)

1. Restore the removed vars from git:

   ```bash
   cd apps/api
   git checkout HEAD -- wrangler.toml
   ```

2. Delete the secrets that were created:

   ```bash
   # Production
   npx wrangler secret delete VAPID_SUBJECT --config wrangler.toml
   npx wrangler secret delete FAS_DB_NAME --config wrangler.toml
   npx wrangler secret delete FAS_SITE_CD --config wrangler.toml
   npx wrangler secret delete FAS_SITE_NAME --config wrangler.toml
   npx wrangler secret delete ELASTICSEARCH_URL --config wrangler.toml

   # Development
   npx wrangler secret delete ELASTICSEARCH_URL --env dev --config wrangler.toml
   npx wrangler secret delete VAPID_SUBJECT --env dev --config wrangler.toml
   npx wrangler secret delete FAS_DB_NAME --env dev --config wrangler.toml
   npx wrangler secret delete FAS_SITE_CD --env dev --config wrangler.toml
   npx wrangler secret delete FAS_SITE_NAME --env dev --config wrangler.toml
   ```

3. Redeploy:
   ```bash
   npx wrangler deploy --config wrangler.toml
   ```

### 4.2 Gradual Rollback (If Only Some Secrets Fail)

If only specific secrets are causing issues:

1. Keep the working secrets in place
2. Restore only the problematic var to wrangler.toml
3. Delete only the problematic secret

---

## 5. Verification

### 5.1 Verify Secrets Are Set

```bash
# List all secrets (shows names only, not values)
npx wrangler secret list --config wrangler.toml
npx wrangler secret list --env dev --config wrangler.toml

# Check specific secret is present
npx wrangler secret list --config wrangler.toml | grep VAPID_SUBJECT
```

### 5.2 Verify Deployment

```bash
# Deploy to production
npx wrangler deploy --config wrangler.toml

# Deploy to dev
npx wrangler deploy --env dev --config wrangler.toml

# Check for errors in deployment output
```

### 5.3 Verify Runtime Behavior

1. **VAPID Subject**: Check push notifications still work

   ```bash
   # Test via admin dashboard or trigger a notification
   ```

2. **FAS Variables**: Verify attendance sync still works

   ```bash
   # Check logs for FAS-related operations
   ```

3. **Elasticsearch**: Verify logging still functions
   ```bash
   # Check Elasticsearch indices are being written to
   ```

### 5.4 Test in Development First

Before applying to production:

1. Complete all steps for `[env.dev]` environment
2. Test dev worker thoroughly
3. Verify all FAS-related functionality
4. Only then proceed to production migration

---

## Migration Checklist

- [ ] Set production secrets via CLI or Dashboard
- [ ] Set development secrets via CLI or Dashboard
- [ ] Verify `wrangler secret list` shows all new secrets
- [ ] Remove migrated vars from wrangler.toml `[vars]`
- [ ] Remove migrated vars from wrangler.toml `[env.dev.vars]`
- [ ] Deploy to dev environment
- [ ] Test dev environment thoroughly
- [ ] Deploy to production
- [ ] Verify production behavior
- [ ] Document any issues encountered

---

## Notes

- Secrets are encrypted at rest and never exposed in logs or error messages
- Secrets set via CLI are stored in Cloudflare's secure secret store
- Environment-specific secrets (--env dev) are isolated per environment
- The `wrangler.toml` remains the source of truth for non-secret configuration
