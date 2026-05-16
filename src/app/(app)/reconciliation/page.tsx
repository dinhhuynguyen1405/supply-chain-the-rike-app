import { redirect } from "next/navigation";

// Trang So khớp tồn kho đã được gộp vào /inventory (tab "So khớp Kho Bros")
export default function ReconciliationRedirect() {
  redirect("/inventory");
}
