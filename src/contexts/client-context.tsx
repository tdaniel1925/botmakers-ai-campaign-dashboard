"use client";

import { createContext, useContext } from "react";

export interface ClientContextType {
  clientId: string | null;
  clientName: string;
  companyName: string;
  userEmail: string;
  userRole: string;
  isLoading: boolean;
  isImpersonating: boolean;
  refetch: () => Promise<void>;
}

export const ClientContext = createContext<ClientContextType>({
  clientId: null,
  clientName: "User",
  companyName: "",
  userEmail: "",
  userRole: "owner",
  isLoading: true,
  isImpersonating: false,
  refetch: async () => {},
});

export function useClient() {
  return useContext(ClientContext);
}
