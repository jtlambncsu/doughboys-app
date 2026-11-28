import {
  CognitoIdentityProviderClient,
  DescribeManagedLoginBrandingByClientCommand,
  UpdateManagedLoginBrandingCommand,
  type AssetType,
} from '@aws-sdk/client-cognito-identity-provider';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObject = (v: unknown): v is Record<string, Json> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Layers `overrides` onto `base` (Cognito's full settings for our style). Values only
 * replace keys that exist in `base`: Cognito ignores unknown keys, so a misspelled path would
 * do nothing silently. Those paths are returned as `unknown` and reported in the deploy log.
 */
export function mergeSettings(
  base: Json,
  overrides: Json,
  path = '',
): { merged: Json; unknown: string[] } {
  if (!isObject(base) || !isObject(overrides)) return { merged: overrides, unknown: [] };
  const merged: Record<string, Json> = { ...base };
  const unknown: string[] = [];
  for (const [key, value] of Object.entries(overrides)) {
    const keyPath = path ? `${path}.${key}` : key;
    if (!(key in base)) {
      unknown.push(keyPath);
      continue;
    }
    const result = mergeSettings(base[key]!, value, keyPath);
    merged[key] = result.merged;
    unknown.push(...result.unknown);
  }
  return { merged, unknown };
}

export interface BrandingRequest {
  userPoolId: string;
  clientId: string;
  /** JSON: our changes to Cognito's settings document. */
  settings: string;
  assets: { category: string; colorMode: string; extension: string; base64: string }[];
}

/**
 * Applies our branding to the app client's managed login style (ADR 0015): read Cognito's
 * full settings, merge ours in, save. Returns setting paths Cognito didn't recognize.
 */
export async function applyBranding(
  { userPoolId, clientId, settings, assets }: BrandingRequest,
  cognito = new CognitoIdentityProviderClient({}),
) {
  const current = await cognito.send(
    new DescribeManagedLoginBrandingByClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      ReturnMergedResources: true,
    }),
  );
  const style = current.ManagedLoginBranding;
  if (!style?.ManagedLoginBrandingId) throw new Error('No managed login style for this client');

  const { merged, unknown } = mergeSettings(
    (style.Settings ?? {}) as Json,
    JSON.parse(settings) as Json,
  );
  // Keep Cognito's other assets; replace only the categories we provide.
  const ours = new Set(assets.map((a) => `${a.category}/${a.colorMode}`));
  const kept = (style.Assets ?? []).filter((a) => !ours.has(`${a.Category}/${a.ColorMode}`));
  const added: AssetType[] = assets.map((a) => ({
    Category: a.category as AssetType['Category'],
    ColorMode: a.colorMode as AssetType['ColorMode'],
    Extension: a.extension as AssetType['Extension'],
    Bytes: Buffer.from(a.base64, 'base64'),
  }));

  await cognito.send(
    new UpdateManagedLoginBrandingCommand({
      UserPoolId: userPoolId,
      ManagedLoginBrandingId: style.ManagedLoginBrandingId,
      UseCognitoProvidedValues: false,
      Settings: merged as never,
      Assets: [...kept, ...added],
    }),
  );
  return { unknown };
}
