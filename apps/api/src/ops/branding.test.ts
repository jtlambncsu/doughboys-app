import {
  CognitoIdentityProviderClient,
  DescribeManagedLoginBrandingByClientCommand,
  UpdateManagedLoginBrandingCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, expect, it } from 'vitest';
import { applyBranding, mergeSettings } from './branding.js';

describe('mergeSettings', () => {
  it('changes only keys Cognito knows, deeply, and reports the rest', () => {
    const base = {
      components: {
        primaryButton: {
          lightMode: { defaults: { backgroundColor: '0972d3ff', textColor: 'ffffffff' } },
        },
      },
      categories: { global: { colorSchemeMode: 'LIGHT' } },
    };
    const { merged, unknown } = mergeSettings(base, {
      components: {
        primaryButton: { lightMode: { defaults: { backgroundColor: 'bf4306ff' } } },
        madeUp: { x: 1 },
      },
      categories: { global: { colorSchemeMode: 'DYNAMIC', typo: true } },
    });
    expect(merged).toEqual({
      components: {
        primaryButton: {
          lightMode: { defaults: { backgroundColor: 'bf4306ff', textColor: 'ffffffff' } },
        },
      },
      categories: { global: { colorSchemeMode: 'DYNAMIC' } },
    });
    expect(unknown).toEqual(['components.madeUp', 'categories.global.typo']);
  });
});

describe('applyBranding', () => {
  it('reads the merged style, applies our settings and assets, keeps other assets', async () => {
    const cognito = mockClient(CognitoIdentityProviderClient);
    cognito.on(DescribeManagedLoginBrandingByClientCommand).resolves({
      ManagedLoginBranding: {
        ManagedLoginBrandingId: 'style-1',
        Settings: { components: { pageBackground: { lightMode: { color: 'ffffffff' } } } } as never,
        Assets: [
          {
            Category: 'FORM_LOGO',
            ColorMode: 'LIGHT',
            Extension: 'PNG',
            Bytes: new Uint8Array([1]),
          },
          {
            Category: 'PAGE_BACKGROUND',
            ColorMode: 'DARK',
            Extension: 'PNG',
            Bytes: new Uint8Array([2]),
          },
        ],
      },
    });
    cognito.on(UpdateManagedLoginBrandingCommand).resolves({});

    const result = await applyBranding(
      {
        userPoolId: 'pool',
        clientId: 'client',
        settings: JSON.stringify({
          components: { pageBackground: { lightMode: { color: 'fbf9f5ff' } } },
        }),
        assets: [
          { category: 'FORM_LOGO', colorMode: 'LIGHT', extension: 'SVG', base64: 'PHN2Zy8+' },
        ],
      },
      new CognitoIdentityProviderClient({}),
    );

    expect(result.unknown).toEqual([]);
    const input = cognito.commandCalls(UpdateManagedLoginBrandingCommand)[0]!.args[0].input;
    expect(input).toMatchObject({
      UserPoolId: 'pool',
      ManagedLoginBrandingId: 'style-1',
      UseCognitoProvidedValues: false,
      Settings: { components: { pageBackground: { lightMode: { color: 'fbf9f5ff' } } } },
    });
    expect(input.Assets!.map((a) => `${a.Category}/${a.ColorMode}/${a.Extension}`)).toEqual([
      'PAGE_BACKGROUND/DARK/PNG',
      'FORM_LOGO/LIGHT/SVG',
    ]);
    expect(Buffer.from(input.Assets![1]!.Bytes!).toString()).toBe('<svg/>');
  });
});
