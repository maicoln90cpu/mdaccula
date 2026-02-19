import { parseLocalDate } from "@/lib/utils";

// Helper function to generate link group name based on event date
export const generateEventGroupName = (eventDate: string): string => {
  const date = parseLocalDate(eventDate);
  const day = date.getDate();
  const month = date.getMonth() + 1; // 0-indexed
  const year = date.getFullYear();

  // Check for REVEILLON 25/26 exception (27/12/2025 to 03/01/2026)
  const isReveillon = 
    (year === 2025 && month === 12 && day >= 27) || 
    (year === 2026 && month === 1 && day <= 3);

  if (isReveillon) {
    return "REVEILLON 25/26";
  }

  // Generate month name in Portuguese
  const monthNames = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];

  const monthName = monthNames[month - 1];
  const yearShort = year.toString().slice(-2);

  return `${monthName}/${yearShort}`;
};
