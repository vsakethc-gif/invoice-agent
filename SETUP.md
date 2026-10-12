# InvoiceNudge Setup Guide

Follow these steps to configure your environment and get InvoiceNudge running locally.

## 1. Supabase (Database & Auth)

1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Under **Project Settings > API**, find your `Project URL` and `anon public` key.
3. Copy `.env.example` to `.env.local` and paste these values into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. In your Supabase dashboard, go to the **SQL Editor** and run the contents of the `supabase/migrations/20231001000000_init.sql` file. This will create your `businesses`, `invoices`, `messages`, and `audit_logs` tables with appropriate Row-Level Security (RLS) policies.
5. In Supabase **Authentication > Providers**, make sure **Email** is enabled. (You can turn off email confirmation for easier local testing).

## 2. Gemini (AI Module)

1. Go to [Google AI Studio](https://aistudio.google.com/) and get an API key.
2. Add it to `.env.local` as `GEMINI_API_KEY`.

## 3. Resend (Email Sending & Webhooks)

1. Go to [Resend](https://resend.com/) and create an API key.
2. Add it to `.env.local` as `RESEND_API_KEY`.
3. To test inbound emails (replies from customers), you will need to configure a domain in Resend and point an MX record to it, then set up an Inbound Webhook pointing to your deployed app or a local ngrok tunnel (`https://your-ngrok-url/api/webhooks/resend`).

## 4. Running Locally

Once `.env.local` is populated:

```bash
npm run dev
```

Visit `http://localhost:3000/login` to sign up and view the dashboard shell.
