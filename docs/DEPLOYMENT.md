# Deployment

The **API runs on AWS** (deployed by GitHub Actions) and the **web app runs on Vercel**.
Nothing is deployed yet. These are the one-time steps, mirroring Puzzle Log's.

> **No laptop?** Steps 1 to 3 work in **AWS CloudShell** in a phone browser ("Request
> desktop site" on, region `us-east-1`).

### 1. Get the code and find two IDs

```bash
git clone https://github.com/jtlambncsu/doughboys-app
cd doughboys-app && npm ci
# The repo's numeric ID (GitHub uses it in the deploy token):
curl -s https://api.github.com/repos/jtlambncsu/doughboys-app | grep -m1 '"id"'
# The GitHub OIDC provider Puzzle Log already created in this account:
aws iam list-open-id-connect-providers
```

### 2. Create the GitHub deploy role

CDK is already bootstrapped in this account from Puzzle Log. Replace the two values:

```bash
cd infra
npx cdk deploy DoughboysGithubDeploy \
  -c githubRepoId=REPO_ID \
  -c existingOidcProviderArn=arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com
```

It prints `DeployRoleArn`.

### 3. Tell GitHub about it

In the repo on GitHub: **Settings → Secrets and variables → Actions → Variables**, add:

| Variable              | Value                                               |
| --------------------- | --------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | The `DeployRoleArn` from step 2                     |
| `ALLOWED_ORIGINS`     | Optional. The Vercel URL, once you have it (step 5) |

The next push to `main` deploys `DoughboysApi`. Its outputs include `ApiUrl` and
`ImportFunctionName`.

### 4. Load the data once

The weekly import runs on Sundays. To fill the table right away:

```bash
aws lambda invoke --function-name IMPORT_FUNCTION_NAME /dev/stdout
```

It prints how many episodes it imported (about 1,100).

### 5. Set up Vercel

1. Import the repo at vercel.com/new. **Root Directory:** `apps/web`.
2. Add the environment variable `VITE_API_URL` = the `ApiUrl` output.
3. Deploy, then put the production URL in the `ALLOWED_ORIGINS` GitHub variable and push
   (or re-run the deploy) so the API only answers that site.

### 6. Check the live API

```bash
API=https://xxxx.execute-api.us-east-1.amazonaws.com
curl -s $API/api/health                      # {"status":"ok"}
curl -s $API/api/chains | head -c 300        # the leaderboard
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS $API/api/chains \
  -H 'Origin: https://YOUR-SITE.vercel.app' -H 'Access-Control-Request-Method: GET'  # 204
```
