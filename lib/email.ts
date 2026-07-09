import "server-only";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendMail({ to, subject, text }: SendMailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Nagelstudio <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("Mail vorbereitet, aber RESEND_API_KEY fehlt:", { to, subject, text });
    return { sent: false, reason: "missing_provider" as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, subject, text })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    console.error("Mailversand fehlgeschlagen:", message);
    return { sent: false, reason: "provider_error" as const };
  }

  return { sent: true, reason: null };
}

export function feeNoticeText(input: {
  customerName: string;
  serviceName: string;
  date: string;
  startTime: string;
  status: "cancelled" | "no_show";
  feeApplies: boolean;
  cancellationWindow?: "under_24h" | "over_24h" | "studio_cancelled";
}) {
  const statusText = input.status === "no_show" ? "nicht wahrgenommen" : "abgesagt";
  const feeText =
    input.status === "no_show"
      ? "Da der Termin nicht wahrgenommen wurde, faellt gemaess unserer Regelung eine Ausfallpauschale von 20 Euro an."
      : input.feeApplies
        ? "Da die Absage weniger als 24 Stunden vor dem Termin erfolgt ist, faellt gemaess unserer Regelung eine Ausfallpauschale von 20 Euro an."
        : "Da die Absage mehr als 24 Stunden vor dem Termin erfolgt ist, faellt keine Ausfallpauschale an.";

  return [
    `Hallo ${input.customerName},`,
    "",
    `dein Termin fuer ${input.serviceName} am ${formatGermanDate(input.date)} um ${input.startTime} Uhr wurde als ${statusText} markiert.`,
    "",
    feeText,
    "",
    "Liebe Gruesse",
    "Dein Nagelstudio"
  ].join("\n");
}

function formatGermanDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}
