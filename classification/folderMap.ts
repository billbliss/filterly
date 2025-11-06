// classification/folderMap.ts
const folderMap: Record<string, string> = {
  PoliticalSolicitation: "Political",
  PhishingSuspect: "Suspicious",
  FinanceBilling: "Money & Orders",
  OrdersShipping: "Money & Orders",
  Receipts: "Money & Orders",
  Travel: "Travel & Calendar",
  CalendarItinerary: "Travel & Calendar",
  Promotions: "Updates & Marketing",
  Newsletters: "Updates & Marketing",
  Updates: "Updates & Marketing",
  PremiumNewsletters: "Premium Newsletters",
  ActionRequired: "Action",
  ApprovePay: "Action",
  ReplyRequested: "Action",
};

export const mapToFolder = (label: string) =>
  folderMap[label] ?? "Updates & Marketing";
