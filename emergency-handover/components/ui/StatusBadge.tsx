type Status = "ongoing" | "ended" | "upcoming";

function getLabel(status: Status) {
  switch (status) {
    case "ongoing":
      return "진행중";
    case "ended":
      return "종료";
    case "upcoming":
      return "예정";
  }
}

function getColors(status: Status) {
  switch (status) {
    case "ongoing":
      return {
        backgroundColor: "#e8f7ea",
        color: "#1f7a35",
      };
    case "ended":
      return {
        backgroundColor: "#f3f4f6",
        color: "#4b5563",
      };
    case "upcoming":
      return {
        backgroundColor: "#eaf2ff",
        color: "#2457c5",
      };
  }
}

export default function StatusBadge({ status }: { status: Status }) {
  const colors = getColors(status);

  return (
    <span
      style={{
        display: "inline-block",
        padding: "8px 12px",
        borderRadius: "999px",
        fontSize: "13px",
        fontWeight: 800,
        ...colors,
      }}
    >
      {getLabel(status)}
    </span>
  );
}