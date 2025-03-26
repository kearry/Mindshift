'use client'; // This must be a Client Component

import { SessionProvider } from "next-auth/react";
import { ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

// This wrapper is needed because SessionProvider uses React Context
// See: https://next-auth.js.org/getting-started/example#frontend---app-directory
export default function SessionProviderWrapper({ children }: Props) {
    return (
        <SessionProvider>
            {children}
        </SessionProvider>
    );
}