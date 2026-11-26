import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';
import { createDoughboysApi } from '@/api/client';
import { createQueryClient } from '@/api/queries';
import { createAppRouter } from '@/router';
import './index.css';

const queryClient = createQueryClient();
const router = createAppRouter({ queryClient, api: createDoughboysApi() });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {/* Only included in development builds. */}
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  </StrictMode>,
);
