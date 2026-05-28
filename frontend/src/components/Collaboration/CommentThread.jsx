import React, { useMemo, useState } from 'react';
import { Bot } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

const REACTIONS = ['\u{1F44D}', '\u{1F44E}', '\u{2753}', '\u{2705}'];

export default function CommentThread({
  comment,
  onResolve,
  onEdit,
  onDelete,
  onReact,
  onReply,
  currentUserEmail,
  isReply = false,
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content || '');
  const [optimisticReactions, setOptimisticReactions] = useState(null);
  const normalizedContent = String(comment.content || '').trim();
  const isDeleted = normalizedContent.length === 0;

  const isOwn = String(comment.authorEmail || '').toLowerCase() === String(currentUserEmail || '').toLowerCase();
  const isOwner = comment.viewerRole === 'owner' || comment.userRole === 'owner' || comment.canDeleteAll;
  const canDelete = isOwn || isOwner;
  const canEdit = isOwn || isOwner;
  const canResolve = !comment.resolved && (
    comment.canResolve || ['owner', 'approver', 'reviewer'].includes(comment.viewerRole || comment.userRole)
  );

  const initials = useMemo(() => {
    const name = String(comment.authorName || 'U').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0]?.slice(0, 2) || 'U').toUpperCase();
  }, [comment.authorName]);

  const roleBadge = comment.authorRole || comment.role;
  const activeReactions = optimisticReactions || comment.reactions || [];
  const reactionsByEmoji = REACTIONS.reduce((acc, emoji) => {
    acc[emoji] = activeReactions.filter((item) => item.emoji === emoji);
    return acc;
  }, {});

  return (
    <div className={`${isReply ? 'ml-8 mt-3' : ''}`}>
      <div className="relative rounded-xl border border-black/[0.06] bg-[#fbfaf7] px-4 py-3">
        {comment.resolved && (
          <span className="absolute top-3 right-3 badge bg-green-50 text-green-700">Resolved</span>
        )}

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-accent-light text-accent flex items-center justify-center text-[11px] font-semibold shrink-0">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-[13px] text-ink">{comment.authorName || 'Unknown'}</p>
              {roleBadge && <span className="badge bg-blue-50 text-blue-700">{roleBadge}</span>}
              <span className="text-[11px] text-muted">{formatDate(comment.createdAt)}</span>
            </div>

            {editing ? (
              <div className="mb-2">
                <textarea className="input min-h-[70px] resize-y" value={editText} onChange={(event) => setEditText(event.target.value)} />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn-accent"
                    disabled={!editText.trim() || editText.length > 2000}
                    onClick={async () => {
                      const result = await onEdit(comment._id || comment.id, editText.trim());
                      if (result?.success !== false) setEditing(false);
                    }}
                  >
                    Save
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${isDeleted ? 'text-muted italic' : 'text-ink'}`}>
                {isDeleted ? '[deleted]' : comment.content}
              </p>
            )}

            {comment.aiSuggestion && (
              <div className="mt-2 rounded-lg border border-black/[0.06] bg-surface2 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[12px] text-muted mb-1">
                  <Bot size={12} />
                  <span className="font-medium">AI suggestion:</span>
                </div>
                <p className="text-[12px] text-muted italic">{comment.aiSuggestion}</p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {REACTIONS.map((emoji) => {
                const reactions = reactionsByEmoji[emoji];
                const active = reactions.some(
                  (reaction) => String(reaction.userId?.email || reaction.userEmail || reaction.userId || '').toLowerCase() === String(currentUserEmail || '').toLowerCase()
                );
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`px-2 py-1 rounded-full text-[12px] border ${active ? 'bg-accent-light border-accent text-accent' : 'bg-white border-black/10 text-muted'}`}
                    disabled={isDeleted}
                    onClick={async () => {
                      const current = activeReactions;
                      const me = String(currentUserEmail || '').toLowerCase();
                      const myIndex = current.findIndex(
                        (reaction) => String(reaction.userId?.email || reaction.userEmail || reaction.userId || '').toLowerCase() === me
                      );
                      let next = [...current];
                      if (myIndex >= 0 && next[myIndex].emoji === emoji) {
                        next.splice(myIndex, 1);
                      } else if (myIndex >= 0) {
                        next[myIndex] = { ...next[myIndex], emoji };
                      } else {
                        next.push({ userId: me, emoji, userEmail: me });
                      }
                      setOptimisticReactions(next);
                      const result = await onReact(comment._id || comment.id, emoji);
                      if (result?.success === false) {
                        setOptimisticReactions(null);
                        return;
                      }
                      setOptimisticReactions(null);
                    }}
                  >
                    {emoji} {reactions.length}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
              {!isReply && (
                <button type="button" className="text-muted hover:text-ink disabled:opacity-50" disabled={isDeleted} onClick={() => setReplying((value) => !value)}>
                  Reply
                </button>
              )}
              {canEdit && !editing && (
                <button type="button" className="text-muted hover:text-ink disabled:opacity-50" disabled={isDeleted} onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
              {canResolve && (
                <button type="button" className="text-muted hover:text-ink disabled:opacity-50" disabled={isDeleted} onClick={() => onResolve(comment._id || comment.id)}>
                  Resolve
                </button>
              )}
              {canDelete && (
                <button type="button" className="text-red-600 hover:text-red-700 disabled:opacity-50" disabled={isDeleted} onClick={() => onDelete(comment._id || comment.id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {replying && !isReply && (
        <div className="ml-8 mt-2 rounded-xl border border-black/[0.06] bg-white p-3">
          <textarea
            className="input min-h-[70px] resize-y"
            placeholder="Write a reply..."
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn-accent"
              disabled={!replyText.trim() || replyText.length > 2000}
              onClick={async () => {
                const result = await onReply(comment._id || comment.id, replyText.trim());
                if (result?.success !== false) {
                  setReplyText('');
                  setReplying(false);
                }
              }}
            >
              Reply
            </button>
            <button type="button" className="btn-ghost" onClick={() => setReplying(false)}>Cancel</button>
          </div>
        </div>
      )}

      {!isReply && Array.isArray(comment.replies) && comment.replies.map((reply) => (
        <CommentThread
          key={reply._id || reply.id}
          comment={reply}
          onResolve={onResolve}
          onEdit={onEdit}
          onDelete={onDelete}
          onReact={onReact}
          onReply={onReply}
          currentUserEmail={currentUserEmail}
          isReply
        />
      ))}
    </div>
  );
}
