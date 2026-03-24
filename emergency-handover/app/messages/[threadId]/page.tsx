"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import StatePanel from "../../../components/ui/StatePanel";
import {
  DIRECT_MESSAGES_CHANGED_EVENT,
  getDirectMessageOtherParticipant,
  getDirectMessageThreadById,
  getThreadMessages,
  markThreadAsRead,
  sendDirectMessage,
  type DirectMessage,
  type DirectMessageThread,
} from "../../../lib/direct-messages";
import { AUTH_CHANGED_EVENT, getCurrentSession } from "../../../lib/local-auth";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = typeof params?.threadId === "string" ? params.threadId : "";
  const [userId, setUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [thread, setThread] = useState<DirectMessageThread | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [body, setBody] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function syncThread() {
      try {
        setError("");
        const session = getCurrentSession();
        const nextUserId = session?.userId ?? "";
        setUserId(nextUserId);
        setNickname(session?.nickname ?? "");

        if (!nextUserId) {
          setThread(null);
          setMessages([]);
          setReady(true);
          return;
        }

        const nextThread = getDirectMessageThreadById(threadId);
        if (!nextThread || !nextThread.participantIds.includes(nextUserId)) {
          setThread(null);
          setMessages([]);
          setReady(true);
          return;
        }

        setThread(nextThread);
        setMessages(getThreadMessages(threadId));
        setReady(true);
      } catch {
        setError("대화 내용을 불러오는 중 문제가 발생했습니다.");
        setReady(true);
      }
    }

    syncThread();
    window.addEventListener(AUTH_CHANGED_EVENT, syncThread);
    window.addEventListener(DIRECT_MESSAGES_CHANGED_EVENT, syncThread);
    window.addEventListener("storage", syncThread);
    window.addEventListener("focus", syncThread);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncThread);
      window.removeEventListener(DIRECT_MESSAGES_CHANGED_EVENT, syncThread);
      window.removeEventListener("storage", syncThread);
      window.removeEventListener("focus", syncThread);
    };
  }, [threadId]);

  useEffect(() => {
    if (!thread || !userId) return;
    if (markThreadAsRead(thread.id, userId)) {
      setMessages(getThreadMessages(thread.id));
    }
  }, [thread, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const otherUserId = useMemo(() => (thread && userId ? getDirectMessageOtherParticipant(thread, userId) : null), [thread, userId]);
  const otherNickname = otherUserId && thread ? thread.participantNicknames[otherUserId] || "Member" : "";

  function handleSendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!thread || !userId || !otherUserId) return;

    const trimmed = body.trim();
    if (!trimmed) return;

    const sent = sendDirectMessage({
      threadId: thread.id,
      currentUserId: userId,
      currentUserNickname: nickname || "Member",
      otherUserId,
      otherUserNickname: otherNickname || "Member",
      body: trimmed,
      teamCode: thread.teamCode,
      teamName: thread.teamName,
    });

    if (!sent) {
      setError("메시지 전송에 실패했습니다.");
      return;
    }

    setBody("");
    setThread(sent.thread);
    setMessages(getThreadMessages(sent.thread.id));
  }

  return (
    <main className="page-shell">
      <div className="page-stack">
        <div>
          <Link href="/messages" className="subtle-link">{"쪽지함으로 돌아가기"}</Link>
        </div>

        {!ready ? (
          <StatePanel kind="loading" title="대화 내용을 불러오는 중입니다" description="잠시만 기다려 주세요." />
        ) : !userId ? (
          <section className="section-card" style={{ display: "grid", gap: "12px" }}>
            <h2 className="section-title">Login이 필요합니다</h2>
            <p className="muted" style={{ margin: 0 }}>{"대화는 Login 후 확인할 수 있습니다."}</p>
            <div>
              <Link href={`/auth?mode=login&redirect=/messages/${threadId}`} className="btn btn-secondary">Login</Link>
            </div>
          </section>
        ) : error ? (
          <StatePanel kind="error" title={error} description="다시 시도해 주세요." />
        ) : !thread || !otherUserId ? (
          <StatePanel kind="empty" title="대화를 찾을 수 없습니다" description="쪽지함에서 다시 확인해 주세요." />
        ) : (
          <>
            <section className="section-card" style={{ display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "end", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: "4px" }}>
                  <h1 className="section-title" style={{ margin: 0 }}>{otherNickname}</h1>
                  {thread.teamName ? <p className="muted" style={{ margin: 0 }}>{thread.teamName}</p> : null}
                </div>
                <div className="hero-meta" style={{ marginTop: 0 }}>
                  <span>{`메시지 ${messages.length}개`}</span>
                </div>
              </div>
            </section>

            <section className="section-card" style={{ display: "grid", gap: "14px" }}>
              {messages.length === 0 ? (
                <StatePanel kind="empty" compact title="아직 주고받은 메시지가 없습니다" description="첫 메시지를 보내 대화를 시작해 보세요." />
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {messages.map((message) => {
                    const mine = message.senderId === userId;
                    return (
                      <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                        <div style={{ width: "min(100%, 560px)", borderRadius: "16px", border: mine ? "1px solid #bfdbfe" : "1px solid #e5e7eb", background: mine ? "#eff6ff" : "#ffffff", padding: "12px 14px", display: "grid", gap: "6px" }}>
                          {message.title ? <div style={{ fontWeight: 800, color: "#111827", fontSize: "14px" }}>{message.title}</div> : null}
                          <div style={{ color: "#111827", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{message.body}</div>
                          <div style={{ fontSize: "12px", color: "#6b7280", textAlign: mine ? "right" : "left" }}>{formatDate(message.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
              )}

              <form onSubmit={handleSendMessage} style={{ display: "grid", gap: "10px" }}>
                <textarea className="textarea" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={"메시지를 입력하세요"} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary" disabled={!body.trim()}>{"전송"}</button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
