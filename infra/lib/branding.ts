import { readFileSync } from 'node:fs';
import { CfnOutput, CustomResource, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { CfnManagedLoginBranding, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface LoginBrandingProps {
  userPool: UserPool;
  client: UserPoolClient;
  loginStyle: CfnManagedLoginBranding;
  functionDefaults: Partial<NodejsFunctionProps>;
  entry: (file: string) => string;
}

const brandingFile = (name: string) =>
  readFileSync(new URL(`../branding/${name}`, import.meta.url));

/**
 * Brands Cognito's sign-in page as the Doughboys App (ADR 0015): our colors from
 * `infra/branding/settings.json`, plus our logo and favicon. A deploy-time step reads
 * Cognito's full style, merges ours in and saves it; setting names Cognito doesn't know
 * are listed in the `LoginBrandingUnknownSettings` output.
 */
export class LoginBranding extends Construct {
  constructor(scope: Construct, id: string, props: LoginBrandingProps) {
    super(scope, id);

    const fn = new NodejsFunction(this, 'Function', {
      ...props.functionDefaults,
      entry: props.entry('apps/api/src/ops/brandingLambda.ts'),
      timeout: Duration.seconds(30),
      logGroup: new LogGroup(this, 'Logs', {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'cognito-idp:DescribeManagedLoginBrandingByClient',
          'cognito-idp:UpdateManagedLoginBranding',
        ],
        resources: [props.userPool.userPoolArn],
      }),
    );

    const svg = (name: string, category: string, colorMode: string) => ({
      category,
      colorMode,
      extension: 'SVG',
      base64: brandingFile(name).toString('base64'),
    });

    const resource = new CustomResource(this, 'Resource', {
      serviceToken: new Provider(this, 'Provider', { onEventHandler: fn }).serviceToken,
      // Any change to these files re-runs the branding step on the next deploy.
      properties: {
        userPoolId: props.userPool.userPoolId,
        clientId: props.client.userPoolClientId,
        settings: JSON.stringify(JSON.parse(brandingFile('settings.json').toString())),
        assets: JSON.stringify([
          svg('logo-light.svg', 'FORM_LOGO', 'LIGHT'),
          svg('logo-dark.svg', 'FORM_LOGO', 'DARK'),
          svg('favicon.svg', 'FAVICON_SVG', 'DYNAMIC'),
        ]),
      },
    });
    resource.node.addDependency(props.loginStyle);

    new CfnOutput(Stack.of(this), 'LoginBrandingUnknownSettings', {
      value: resource.getAttString('UnknownSettings'),
      description: 'Branding settings Cognito did not recognize ("none" is good)',
    });
  }
}
