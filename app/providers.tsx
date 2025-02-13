'use client';

import { createConfig, WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';

const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <WagmiProvider config={config}>{children}</WagmiProvider>;
}

