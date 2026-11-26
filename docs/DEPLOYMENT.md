# Deployment

The **API runs on AWS** (deployed by GitHub Actions) and the **web app runs on Vercel**.
Live at **https://doughboysapp.com**. These are the one-time steps used to set it up.

> **No laptop?** Everything works from **AWS CloudShell** in a phone browser ("Request
> desktop site" on, region `us-east-1`). CloudShell's home folder only holds 1 GB, which
> `npm ci` for this repo overflows (`ENOSPC`), so clone into `/tmp` instead, as below.

> **Same AWS account as Puzzle Log.** CDK is already bootstrapped there, and AWS allows only
> one GitHub OIDC provider per account, which Puzzle Log created. This app reuses both;
> nothing in Puzzle Log changes.

### 1. The repo ID

The repo's numeric ID is `1472501624` (from `https://api.github.com/repos/jtlambncsu/doughboys-app`).

### 2. Create the GitHub deploy role

```bash
cd /tmp && rm -rf doughboys-app
git clone https://github.com/jtlambncsu/doughboys-app
cd doughboys-app && npm ci --cache /tmp/npm-cache
OIDC=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn,'token.actions.githubusercontent.com')].Arn" --output text)
cd infra && npx cdk deploy DoughboysGithubDeploy \
  -c githubRepoId=1472501624 \
  -c existingOidcProviderArn="$OIDC"
```

It prints `DeployRoleArn`.

### 3. Tell GitHub about it

In the repo on GitHub: **Settings → Secrets and variables → Actions → Variables**, add:

| Variable              | Value                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| `AWS_DEPLOY_ROLE_ARN` | The `DeployRoleArn` from step 2                                                |
| `ALLOWED_ORIGINS`     | `https://doughboysapp.com,https://www.doughboysapp.com` (set last, see step 5) |

The next push to `main` deploys `DoughboysApi`. Its outputs include `ApiUrl` and
`ImportFunctionName`.

### 4. Load the data once

The weekly import runs on Sundays. To fill the table right away:

```bash
aws lambda invoke --function-name IMPORT_FUNCTION_NAME /dev/stdout
```

It prints how many episodes it imported (about 1,100).

### 5. Set up Vercel and the domain

1. Import the repo at vercel.com/new. **Root Directory:** `apps/web`.
2. Add the environment variable `VITE_API_URL` = the `ApiUrl` output.
3. Deploy. Then **Settings → Domains**: add `doughboysapp.com` (and `www`, redirecting to
   it), and create the DNS records Vercel shows at the domain's registrar.
4. Once the domain loads, set the `ALLOWED_ORIGINS` GitHub variable (above) and re-run the
   deploy, so the API only answers that site. After this, `*.vercel.app` URLs can't load
   data.

### 6. Check the live API

```bash
API=https://xxxx.execute-api.us-east-1.amazonaws.com
curl -s $API/api/health                      # {"status":"ok"}
curl -s $API/api/chains | head -c 300        # the leaderboard
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS $API/api/chains \
  -H 'Origin: https://doughboysapp.com' -H 'Access-Control-Request-Method: GET'  # 204
```
