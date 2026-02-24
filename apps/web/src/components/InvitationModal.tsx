'use client';

import React from 'react';
import { useCollaborationStore } from '@/store/collaborationStore';
import type { GraphInvitation } from '@/store/collaborationStore';

export function InvitationModal() {
  const { invitations, acceptInvitation, rejectInvitation } = useCollaborationStore();

  if (!invitations || invitations.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-sm">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="bg-slate-900 border border-purple-500/50 rounded-lg p-4 shadow-lg animate-slide-up"
        >
          <div className="mb-3">
            <p className="text-sm text-slate-200">
              <span className="font-semibold text-purple-400">{invitation.fromUser.name}</span>
              {invitation.fromUser.accountCode && (
                <span className="ml-2 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] font-mono text-slate-300 align-middle">{invitation.fromUser.accountCode}</span>
              )}
              {' '}invited you to
            </p>
            <p className="text-base font-semibold text-white">{invitation.graphName}</p>
            <p className="text-xs text-slate-400 mt-1">
              {new Date(invitation.createdAt).toLocaleTimeString()}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => acceptInvitation(invitation.id, invitation.graphId)}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => rejectInvitation(invitation.id)}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
