'use client';

import { useState } from 'react';
import { ACCOUNT_DESCRIPTIONS } from '@/lib/logic/account_suggester';

interface AccountHelpChipProps {
  accountName: string;
}

export default function AccountHelpChip({ accountName }: AccountHelpChipProps) {
  const [show, setShow] = useState(false);
  const description = ACCOUNT_DESCRIPTIONS[accountName];

  if (!description) return null;

  return (
    <div className="relative inline-block ml-1 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors focus:outline-none"
        aria-label={`${accountName}の説明を表示`}
      >
        <span className="text-[10px] font-bold">i</span>
      </button>

      {show && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200">
          <p className="font-bold border-b border-gray-600 pb-1 mb-1">{accountName}</p>
          <p className="leading-relaxed">{description}</p>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}
