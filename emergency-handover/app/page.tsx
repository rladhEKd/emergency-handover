import Link from "next/link";
import hackathonsData from "../data/public_hackathons.json";
import teamsData from "../data/public_teams.json";
import leaderboardData from "../data/public_leaderboard.json";
import styles from "./page.module.css";

type Hackathon = {
  slug: string;
  title: string;
  status: "ended" | "ongoing" | "upcoming";
  tags: string[];
  period: {
    startAt?: string;
    submissionDeadlineAt: string;
    endAt: string;
  };
};

type Team = {
  teamCode: string;
  hackathonSlug: string;
  name: string;
  isOpen: boolean;
  lookingFor: string[];
};

type LeaderboardEntry = {
  teamName: string;
  score: number;
};

type Leaderboard = {
  hackathonSlug: string;
  entries: LeaderboardEntry[];
};

type LeaderboardData = Leaderboard & {
  extraLeaderboards?: Leaderboard[];
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });
}

function getStatusText(status: Hackathon["status"]) {
  if (status === "ongoing") return "진행중";
  if (status === "upcoming") return "예정";
  return "종료";
}

function getStatusClass(status: Hackathon["status"]) {
  if (status === "ongoing") return "status-chip status-chip--ongoing";
  if (status === "upcoming") return "status-chip status-chip--upcoming";
  return "status-chip status-chip--ended";
}

function getHackathonTitle(slug: string) {
  switch (slug) {
    case "aimers-8-model-lite":
      return "Aimers 8";
    case "monthly-vibe-coding-2026-02":
      return "Monthly Vibe Coding 2026.02";
    case "daker-handover-2026-03":
      return "Daker Handover 2026.03";
    default:
      return slug;
  }
}

export default function HomePage() {
  const hackathons = hackathonsData as Hackathon[];
  const teams = teamsData as Team[];
  const leaderboard = leaderboardData as LeaderboardData;

  const allLeaderboards: Leaderboard[] = [
    { hackathonSlug: leaderboard.hackathonSlug, entries: leaderboard.entries },
    ...(leaderboard.extraLeaderboards ?? []),
  ];

  const recentHackathons = hackathons.slice(0, 3);
  const openTeams = teams.filter((team) => team.isOpen).slice(0, 3);
  const topBoards = allLeaderboards
    .map((board) => ({
      slug: board.hackathonSlug,
      winner: board.entries[0],
    }))
    .filter((item) => item.winner)
    .slice(0, 3);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroHead}>
          <h1 className={styles.heroTitle}>Hackathon Hub</h1>
          <p className={styles.heroCopy}>해커톤 보기, 팀원 모집, 랭킹 확인을 바로 시작할 수 있습니다.</p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/hackathons" className="btn btn-secondary">
            해커톤 보기
          </Link>
          <Link href="/camp" className="btn btn-secondary">
            팀원 모집
          </Link>
          <Link href="/rankings" className="btn btn-secondary">
            랭킹 보기
          </Link>
        </div>
      </section>

      <div className={styles.homeGrid}>
        {recentHackathons.length > 0 ? (
          <section className={styles.primarySection}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>최근 해커톤</h2>
              <Link href="/hackathons" className={styles.sectionLink}>
                전체 보기
              </Link>
            </div>

            <div className={styles.cardList}>
              {recentHackathons.map((hackathon) => (
                <Link key={hackathon.slug} href={`/hackathons/${hackathon.slug}`} className={`interactive-card ${styles.cardLink}`}>
                  <article className={styles.hackathonCard}>
                    <div className={styles.cardTopRow}>
                      <span className={getStatusClass(hackathon.status)}>{getStatusText(hackathon.status)}</span>
                      <span className={styles.metaText}>마감 {formatDate(hackathon.period.submissionDeadlineAt)}</span>
                    </div>
                    <h3 className={styles.cardTitle}>{hackathon.title}</h3>
                    <div className={styles.tagRow}>
                      {hackathon.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag-chip">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div className={styles.metaRow}>
                      {hackathon.period.startAt ? <span>시작 {formatDate(hackathon.period.startAt)}</span> : null}
                      <span>종료 {formatDate(hackathon.period.endAt)}</span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className={styles.sideStack}>
          {openTeams.length > 0 ? (
            <section className={styles.compactSection}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>모집중인 팀</h2>
                <Link href="/camp" className={styles.sectionLink}>
                  이동
                </Link>
              </div>

              <div className={styles.cardList}>
                {openTeams.map((team) => (
                  <Link
                    key={team.teamCode}
                    href={team.hackathonSlug ? `/camp?hackathon=${team.hackathonSlug}` : "/camp"}
                    className={`interactive-card ${styles.cardLink}`}
                  >
                    <article className={styles.compactCard}>
                      <div className={styles.cardTopRow}>
                        <strong className={styles.compactTitle}>{team.name}</strong>
                        <span className="status-chip status-chip--open">모집중</span>
                      </div>
                      <p className={styles.metaText}>
                        {team.hackathonSlug ? getHackathonTitle(team.hackathonSlug) : "연결된 해커톤 없음"}
                      </p>
                      <div className={styles.tagRow}>
                        {team.lookingFor.slice(0, 3).map((role) => (
                          <span key={role} className="tag-chip">
                            {role}
                          </span>
                        ))}
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {topBoards.length > 0 ? (
            <section className={styles.compactSection}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>리더보드</h2>
                <Link href="/rankings" className={styles.sectionLink}>
                  이동
                </Link>
              </div>

              <div className={styles.cardList}>
                {topBoards.map((item, index) => (
                  <Link key={item.slug} href="/rankings" className={`interactive-card ${styles.cardLink}`}>
                    <article className={styles.compactCard}>
                      <div className={styles.cardTopRow}>
                        <span className="chip">{index + 1}위</span>
                        <span className={styles.metaText}>{getHackathonTitle(item.slug)}</span>
                      </div>
                      <strong className={styles.compactTitle}>{item.winner.teamName}</strong>
                      <p className={styles.metaText}>점수 {item.winner.score}</p>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
