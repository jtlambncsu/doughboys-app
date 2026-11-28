import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { applyBranding, type BrandingRequest } from './branding.js';

/** CDK custom resource: brands the login page on create and update; nothing on delete. */
export async function handler(event: CloudFormationCustomResourceEvent) {
  const physicalResourceId = 'managed-login-branding';
  if (event.RequestType === 'Delete') return { PhysicalResourceId: physicalResourceId };
  const props = event.ResourceProperties as unknown as BrandingRequest & { assets: string };
  const { unknown } = await applyBranding({
    userPoolId: props.userPoolId,
    clientId: props.clientId,
    settings: props.settings,
    assets: JSON.parse(props.assets),
  });
  console.log(JSON.stringify({ message: 'Branding applied', unknown }));
  return {
    PhysicalResourceId: physicalResourceId,
    // Shown in the deploy log as a stack output, so wrong setting names are visible.
    Data: { UnknownSettings: unknown.length ? unknown.join(', ') : 'none' },
  };
}
