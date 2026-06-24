import React from 'react';
import wobbleFullLogo from '../assets/wobble-full-logo.png';
import wobbleWLogo from '../assets/wobble-w-logo.png';

export function BrandIcon({ className }) {
  return (
    <div className={className}>
      <img src={wobbleWLogo} alt="Wobble icon" className="w-full h-full object-contain" />
    </div>
  );
}



export default function BrandLogo({ className }) {

  return (
    <div className={className}>
      <img src={wobbleFullLogo} alt="Wobble logo" className="w-full h-full object-contain" />
    </div>
  );
}

