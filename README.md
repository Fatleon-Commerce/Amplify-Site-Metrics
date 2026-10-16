# Site metrics

Add one script to a page, then view visitors and their paths in the admin at `/admin`. The script and the admin belong to this app, separate from the kit storefront.

## Local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `/admin`. The password is `ADMIN_PASSWORD` in `.env.local`. After you create a site, paste the script into the website. Use “Open test page” on the same machine to try it.

Run `npm run check` before committing. It typechecks the frontend and Amplify code, then runs the unit tests.

Local data is stored in `.data/metrics.json`.

## Sandbox

Run these commands from this repository. The identifier is fixed as `site-metrics`. The storefront project uses `fatleon` and `amplify-shop`, and its package name is `amplify-nextjs-ecommerce-kit`, so the CloudFormation stacks stay separate.

```bash
npm run sandbox:secret
npm run sandbox
```

The first command prompts for `ADMIN_PASSWORD`. Set the same secret on the new Amplify app before the first deploy. After the sandbox is up, remove `STORE=file` from `.env.local` so `npm run dev` uses the cloud DynamoDB table.

## Deploy on Amplify

Create a new Amplify app in the console. Do not select the existing storefront app. Choose the Web Compute (SSR) platform and connect this repository. Add `ADMIN_PASSWORD` to that new app’s Secrets. Do not set `STORE=file`.

After deploy, use that app’s own URL:

- Admin: `https://main.<app-id>.amplifyapp.com/admin`
- Script: `https://main.<app-id>.amplifyapp.com/<siteKey>.js`

The `amplifyapp.com` URL can stay in use. If you later move the script to your own domain, update every site that already embeds it.
