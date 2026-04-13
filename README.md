# Collato.io

Frontend workspace app for Collato.io, focused on project knowledge, team updates, tasks, and grounded AI assistance.

## Stack

- Next.js (App Router)
- JavaScript
- Tailwind CSS
- DaisyUI
- Auth.js / NextAuth
- Resend

## What the POC shows

- Project-first dashboard
- Chat-style update capture
- Monthly report builder preview
- Review queue and export/send affordances
- SaaS-friendly product framing

## Run locally

1. Add env vars to `.env.local`
2. `cmd /c npm install`
3. `cmd /c npm run dev`

Then open `http://localhost:3000`.

## Required env vars

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MONGODB_URI`
- `OPENAI_API_KEY`
- `AUTH_SECRET`

To enable email sign-in and outbound email scaffolding:

- `RESEND_API_KEY`
- `AUTH_RESEND_FROM`
- `RESEND_REPLY_TO`
- `AUTH_URL` or `NEXTAUTH_URL`

Optional for contact form notifications:

- `CONTACT_NOTIFICATION_EMAIL` (defaults to `divyanthj@gmail.com`)

## Wired basics

- Google sign-in with Auth.js
- Email magic-link sign-in with Auth.js + Resend
- MongoDB-backed seeded projects and saved updates
- OpenAI-powered update structuring via `/api/ai/structure-update`
- Protected save flow via `/api/updates`

## Resend setup

1. Verify `resend.collato.io` as a sending domain in Resend.
2. Add the DNS records Resend provides for SPF/DKIM/domain verification.
3. Set `AUTH_RESEND_FROM` to a verified sender, for example `Collato.io <hello@resend.collato.io>`.
4. Add your Resend API key to `RESEND_API_KEY`.

Reusable email helpers now live in `C:\projects\GSC raw file samples\collato\lib\resend.js`.
The Auth.js magic-link email is also sent through that helper, so the same verified domain can be reused for future transactional mail.


