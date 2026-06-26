import React from 'react';

// Minimal wrapper used by tests to avoid pulling in router dependencies.
export default function TestWrapper({ children }) {
  return <>{children}</>;
}

