import { useQuery } from '@tanstack/react-query';
// import { getBalancesOptions } from '../api/client'; // Assuming this exists in OpenAPI

export function useWorkspaceBalances(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace-balances', workspaceId],
    // queryFn: () => fetch balances using OpenAPI client
    queryFn: async () => {
      // Mocking the network request for now
      return new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              total: 45.5,
              owedToYou: 120.0,
              youOwe: 74.5,
            }),
          500,
        );
      });
    },
    // initialData just for instant UI preview
    initialData: {
      total: 45.5,
      owedToYou: 120.0,
      youOwe: 74.5,
    },
  });
}
