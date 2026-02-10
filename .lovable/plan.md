

# Store Google Workspace Secrets and Activate Google Groups Automation

## Overview
Store the 3 required secrets in Supabase to fully activate the automated Google Groups member management system.

## Secrets to Store

| Secret Name | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full JSON contents from the uploaded service account key file |
| `GOOGLE_ADMIN_EMAIL` | `desk@unknowniitians.com` |
| `GOOGLE_GROUPS_DOMAIN` | `unknowniitians.com` |

## Steps

1. Add all 3 secrets to the Supabase project using the secrets tool
2. Test the `manage-google-group` edge function by invoking it with a sample request to confirm authentication works
3. Verify the existing database trigger (`auto_add_to_google_group`) on the `user_enrollments` table is active, so new enrollments automatically trigger group creation and member addition

## What This Enables

Once secrets are stored, the full automation pipeline activates:
- Student enrolls --> trigger fires --> edge function creates Google Group if needed --> student added to both Batch group and Subject group automatically
- Announcements, recordings, and schedule changes trigger emails via Google Groups relay

No code changes required -- the edge function and triggers are already in place.

