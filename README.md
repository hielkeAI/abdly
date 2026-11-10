# AbdlyAI

AbdlyAI is a Next.js subscription and Discord community management platform. It uses Supabase Auth/Postgres, Stripe Checkout and webhooks, and a Discord bot for verified role changes.

## Local setup

1. Install Node.js 20.9 or later and run `npm install`.
2. Create a Supabase project and run [`supabase/migrations/0001_platform.sql`](./supabase/migrations/0001_platform.sql) in its SQL editor.
3. Configure email/password, Discord, GitHub, and Google providers in Supabase Auth. Set their callback URLs to `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Create Discord OAuth credentials in Supabase and a separate bot. Add the bot to the guild with **Manage Roles** permission, and move its highest role above every product role it must manage.
5. Create a Hugging Face OAuth app with callback URL `<APP_URL>/api/oauth/huggingface/callback`.
6. Copy `.env.example` to `.env.local` and fill in the service credentials. Never expose the Supabase service-role key, Stripe secret, webhook secret, bot token, or Hugging Face client secret to the browser or source control.
7. Set `OWNER_EMAILS` to one or more trusted owner email addresses. The matching authenticated account is provisioned as an owner on its next request.
8. Run `npm run dev`. Configure the Stripe webhook endpoint as `<APP_URL>/api/webhooks/stripe` and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.paid`.

The owner must add active plans with Stripe Price IDs and (for Discord benefits) a Discord role ID before customers can check out. Monthly prices use recurring Stripe Prices; lifetime prices use one-time Stripe Prices. The webhook verifies the signature before recording payments or changing roles. The success page itself does not grant access.

## Implemented areas

- Public landing, pricing, FAQ, contact, and account registration/login screens.
- Supabase email/password auth, Discord and GitHub OAuth, and authenticated Hugging Face account linking.
- Google OAuth sign-in and password recovery verified through the Discord account already linked to an email/password account.
- Customer dashboard, owner and supervisor consoles, application submission/review, and customer reviews.
- Owner-controlled plans, supervisor access, role management, Stripe subscription cancellation, and activity records.
- Stripe Checkout, customer billing portal, verified webhook processing, Discord role assignment/removal, and an audit log.

## Deployment configuration

Configure all `.env.example` entries as server environment variables. In Supabase, verify Row Level Security is enabled for every application table and use the migration as the source of truth. Configure Stripe webhook retries and alerts. For role assignment, the Discord bot must have access to the configured guild, the member must be in that guild, and managed roles must be below the bot's top role. OAuth provider credentials and redirect URLs must match the deployed origin exactly.

Do not use the success redirect or client-side state as proof of payment. Payments and subscription role changes are processed only from signed Stripe events.

Password recovery deliberately does not send an email reset link. The user must authenticate through the Discord identity already linked to their existing email/password account before a new password can be saved. If Discord was never linked to that account, an owner must help resolve the account-linking issue.
