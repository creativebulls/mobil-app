import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * Web stub for the call system. `react-native-webrtc` has no browser build, so
 * on web we provide a no-op CallProvider that keeps the same context shape. Voice
 * calls are simply unavailable in the browser for now.
 */

export type CallParticipant = {
  userId: string;
  name: string;
  avatarUri: string | null;
};

type StartCallInput = {
  userId: string;
  name: string;
  avatarUri?: string | null;
  conversationId?: string | null;
};

type CallContextValue = {
  status: 'idle';
  startCall: (input: StartCallInput) => Promise<void>;
};

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const value = useMemo<CallContextValue>(
    () => ({
      status: 'idle',
      startCall: async () => {
        if (typeof window !== 'undefined') {
          window.alert('Voice calls are not available on the web version yet.');
        }
      },
    }),
    [],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
