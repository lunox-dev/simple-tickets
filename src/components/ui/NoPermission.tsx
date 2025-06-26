import React from 'react';

interface NoPermissionProps {
  message?: string;
}

export default function NoPermission({ message }: NoPermissionProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-16 h-16 mb-4 text-red-400"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h2 className="text-xl font-semibold mb-2">No Permission</h2>
      <p className="max-w-md">
        {message || 'You do not have permission to view this page or perform this action.'}
      </p>
    </div>
  );
} 