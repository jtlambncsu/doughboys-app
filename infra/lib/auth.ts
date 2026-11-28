import { CfnOutput, Duration, Fn, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  AccountRecovery,
  CfnManagedLoginBranding,
  FeaturePlan,
  ManagedLoginVersion,
  OAuthScope,
  PasskeyUserVerification,
  UserPool,
  type UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthProps {
  /** URLs of the web app. Sign-in redirects back to these (plus localhost for development). */
  webUrls: string[];
}

/**
 * Accounts for fans who rate chains. AWS's managed login page handles sign-up, sign-in,
 * email verification and password resets, so the app never sees a password. Passwords
 * and passkeys (Face ID / Touch ID) are both allowed. See docs/decisions/0009.
 */
export class Auth extends Construct {
  readonly userPool: UserPool;
  readonly client: UserPoolClient;
  /** The app client's managed login style; LoginBranding (ADR 0015) styles it. */
  readonly loginStyle: CfnManagedLoginBranding;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);
    const region = Stack.of(this).region;

    // Domain prefixes are global per region, so derive a stable suffix from the stack's
    // unique ID rather than the account ID.
    const stackGuid = Fn.select(2, Fn.split('/', Stack.of(this).stackId));
    const domainPrefix = Fn.join('-', ['doughboys-app', Fn.select(0, Fn.split('-', stackGuid))]);

    this.userPool = new UserPool(this, 'UserPool', {
      // Anyone can sign up, but must verify their email before signing in.
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      // Long passwords beat character rules (NIST SP 800-63B); passkeys skip them entirely.
      passwordPolicy: {
        minLength: 12,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      featurePlan: FeaturePlan.ESSENTIALS, // needed for passkeys with managed login
      signInPolicy: { allowedFirstAuthFactors: { password: true, passkey: true } },
      // No passkeyRelyingPartyId: with only a Cognito prefix domain, passkeys use that domain
      // by default, and naming it here fails (the domain doesn't exist yet). See lessons.
      passkeyUserVerification: PasskeyUserVerification.REQUIRED,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const redirectUrls = [...new Set([...props.webUrls, 'http://localhost:5173'])].map((url) =>
      url.replace(/\/$/, ''),
    );

    this.client = this.userPool.addClient('WebClient', {
      generateSecret: false, // a browser can't keep a secret; the code flow uses PKCE instead
      authFlows: { user: true }, // choice-based sign-in: password or passkey
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: redirectUrls,
        logoutUrls: redirectUrls,
      },
      // Don't reveal whether an email address has an account.
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      enableTokenRevocation: true,
    });

    const domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix },
      managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    // The newer managed login needs a style; use Cognito's default look.
    const branding = (this.loginStyle = new CfnManagedLoginBranding(this, 'LoginBranding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.client.userPoolClientId,
      useCognitoProvidedValues: true,
    }));
    branding.node.addDependency(domain);

    const stack = Stack.of(this);
    new CfnOutput(stack, 'CognitoAuthority', {
      value: `https://cognito-idp.${region}.amazonaws.com/${this.userPool.userPoolId}`,
      description: 'Set as VITE_COGNITO_AUTHORITY in Vercel',
    });
    new CfnOutput(stack, 'CognitoClientId', {
      value: this.client.userPoolClientId,
      description: 'Set as VITE_COGNITO_CLIENT_ID in Vercel',
    });
    new CfnOutput(stack, 'CognitoDomain', {
      value: domain.baseUrl(),
      description: 'Set as VITE_COGNITO_DOMAIN in Vercel',
    });
  }
}
