import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';
import { createDoughboysApi } from '@/api/client';
import { createQueryClient } from '@/api/queries';
import { getAccessToken } from '@/auth/config';
import { FanAuthProvider } from '@/auth/FanAuthProvider';
import { Toaster } from '@/components/ui/sonner';
import { createAppRouter } from '@/router';
import './index.css';

const queryClient = createQueryClient();
const router = createAppRouter({ queryClient, api: createDoughboysApi(getAccessToken) });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FanAuthProvider
        // Back from Cognito's sign-in page: show the page they started on.
        onSignIn={(returnTo) => void router.navigate({ to: returnTo, replace: true })}
        // Don't leave someone's personal data cached on a shared device.
        onSignOut={() => queryClient.removeQueries({ queryKey: ['me'] })}
      >
        <RouterProvider router={router} />
      </FanAuthProvider>
      <Toaster position="top-center" />
      {/* Only included in development builds. */}
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  </StrictMode>,
);
