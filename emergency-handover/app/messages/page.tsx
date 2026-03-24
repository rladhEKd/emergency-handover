"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StatePanel from "../../components/ui/StatePanel";
import {
  DIRECT_MESSAGES_CHANGED_EVENT,
  listDirectMessageThreadSummaries,
  type DirectMessageThreadSummary,
} from "../../lib/direct-messages";
import { AUTH_CHANGED_EVENT, getCurrentSession } from "../../lib/local-auth";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function decodeEscapedUnicode(value: string | null | undefined) {
  if (!value) return "";
  return String(value).replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
function getPreview(summary: DirectMessageThreadSummary) {
  if (!summary.lastMessage) return "아직 주고받은 쪽지가 없습니다.";

  const preview = summary.lastMessage.body.replace(/\s+/g, " ").trim();
  if (preview.length <= 56) return preview;
  return `${preview.slice(0, 56)}...`;
}

export default function MessagesPage() {
  const [userId, setUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [threads, setThreads] = useState<DirectMessageThreadSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function syncThreads() {
      try {
        setError("");
        const session = getCurrentSession();
        const nextUserId = session?.userId ?? "";
        setUserId(nextUserId);
        setNickname(decodeEscapedUnicode(session?.nickname ?? ""));

        if (!nextUserId) {
          setThreads([]);
          setReady(true);
          return;
        }

        setThreads(listDirectMessageThreadSummaries(nextUserId));
        setReady(true);
      } catch {
        setError("쪽지함을 불러오는 중 문제가 발생했습니다.");
        setReady(true);
      }
    }

    syncThreads();
    window.addEventListener(AUTH_CHANGED_EVENT, syncThreads);
    window.addEventListener(DIRECT_MESSAGES_CHANGED_EVENT, syncThreads);
    window.addEventListener("storage", syncThreads);
    window.addEventListener("focus", syncThreads);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncThreads);
      window.removeEventListener(DIRECT_MESSAGES_CHANGED_EVENT, syncThreads);
      window.removeEventListener("storage", syncThreads);
      window.removeEventListener("focus", syncThreads);
    };
  }, []);

  const unreadCount = useMemo(() => threads.reduce((sum, thread) => sum + thread.unreadCount, 0), [threads]);

  return (
    <main className="page-shell">
      <div className="page-stack">
        <section className="page-hero page-hero--dark" style={{ display: "grid", gap: "10px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <div className="eyebrow">쪽지함</div>
            <h1 className="hero-title" style={{ margin: 0 }}>메시지</h1>
            {userId ? (
              <p className="hero-description" style={{ margin: 0 }}>
                {`${nickname}님, 지금 확인할 수 있는 대화가 있습니다.`}
              </p>
            ) : null}
          </div>
          {userId ? (
            <div className="hero-meta" style={{ marginTop: 0 }}>
              <span>{`전체 대화 ${threads.length}건`}</span>
              <span>{`읽지 않은 ${unreadCount}건`}</span>
            </div>
          ) : null}
        </section>

        {!ready ? (
          <StatePanel kind="loading" title="쪽지함을 불러오는 중입니다" description="잠시만 기다려 주세요." />
        ) : !userId ? (
          <section className="section-card" style={{ display: "grid", gap: "12px" }}>
            <h2 className="section-title">Login이 필요합니다.</h2>
            <p className="muted" style={{ margin: 0 }}>쪽지함은 Login 후 확인할 수 있습니다.</p>
            <div>
              <Link href="/auth?mode=login&redirect=/messages" className="btn btn-secondary">
                Login
              </Link>
            </div>
          </section>
        ) : error ? (
          <StatePanel kind="error" title={error} description="다시 시도해 주세요." />
        ) : threads.length === 0 ? (
          <StatePanel
            kind="empty"
            title="아직 주고받은 쪽지가 없습니다"
            description="팀 모집글에서 관심 있는 팀에게 먼저 쪽지를 보내보세요."
          />
        ) : (
          <section className="section-card" style={{ display: "grid", gap: "10px", padding: "12px" }}>
            {threads.map((summary) => (
              <Link key={summary.thread.id} href={`/messages/${summary.thread.id}`} className="interactive-card" style={{ textDecoration: "none", color: "inherit" }}>
                <article style={{ padding: "14px 16px", display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start" }}>
                    <div style={{ minWidth: 0, display: "grid", gap: "4px" }}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>{summary.otherNickname}</div>
                      {summary.thread.teamName ? <div className="muted" style={{ fontSize: "13px" }}>{summary.thread.teamName}</div> : null}
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {summary.unreadCount > 0 ? <span className="status-chip status-chip--pending">읽지 않음 {summary.unreadCount}</span> : null}
                      <span className="muted" style={{ fontSize: "12px" }}>
                        {summary.lastMessage ? formatDate(summary.lastMessage.createdAt) : formatDate(summary.thread.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <div style={{ color: "#374151", fontSize: "14px", lineHeight: 1.6, overflow: "hidden", textOverflow: "ellipsis" }}>{getPreview(summary)}</div>
                </article>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
