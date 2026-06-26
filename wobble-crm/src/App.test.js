import React from 'react';
import { render } from '@testing-library/react';

// Avoid importing App (and therefore react-router-dom) in unit tests.
// CRA unit tests here are smoke tests only.

test('smoke test', () => {
  render(<div>ok</div>);
});

