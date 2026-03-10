import hackathons from "../../../data/public_hackathons.json";
import detailData from "../../../data/public_hackathon_detail.json";
import { notFound } from "next/navigation";
import HackathonDetailClient from "./HackathonDetailClient";

export type Hackathon = {
  slug: string;
  title: string;
  status: "ended" | "ongoing" | "upcoming";
  tags: string[];
  thumbnailUrl: string;
  period: {
    timezone: string;
    submissionDeadlineAt: string;
    endAt: string;
  };
  links: {
    detail: string;
    rules: string;
    faq: string;
  };
};

export type DetailHackathon = {
  slug: string;
  title: string;
  sections: {
    overview?: {
      summary?: string;
      teamPolicy?: {
        allowSolo?: boolean;
        maxTeamSize?: number;
      };
    };
    info?: {
      notice?: string[];
      links?: {
        rules?: string;
        faq?: string;
      };
    };
    eval?: {
      metricName?: string;
      description?: string;
      scoreSource?: string;
      scoreDisplay?: {
        label?: string;
        breakdown?: {
          key: string;
          label: string;
          weightPercent: number;
        }[];
      };
      limits?: {
        maxRuntimeSec?: number;
        maxSubmissionsPerDay?: number;
      };
    };
    schedule?: {
      timezone?: string;
      milestones?: {
        name: string;
        at: string;
      }[];
    };
    prize?: {
      items?: {
        place: string;
        amountKRW: number;
      }[];
    };
    teams?: {
      campEnabled?: boolean;
      listUrl?: string;
    };
    submit?: {
      allowedArtifactTypes?: string[];
      submissionUrl?: string;
      guide?: string[];
      submissionItems?: {
        key: string;
        title: string;
        format: string;
      }[];
    };
    leaderboard?: {
      publicLeaderboardUrl?: string;
      note?: string;
    };
  };
};

function findDetailBySlug(slug: string): DetailHackathon | undefined {
  const rootItem = detailData as DetailHackathon & {
    extraDetails?: DetailHackathon[];
  };

  if (rootItem.slug === slug) {
    return rootItem;
  }

  return rootItem.extraDetails?.find((item) => item.slug === slug);
}

export default async function HackathonDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const hackathon = (hackathons as Hackathon[]).find((item) => item.slug === slug);

  if (!hackathon) {
    notFound();
  }

  const details = findDetailBySlug(slug);

  return <HackathonDetailClient hackathon={hackathon} details={details} />;
}