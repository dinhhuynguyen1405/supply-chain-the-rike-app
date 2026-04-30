import { getAuthUrl } from "@/lib/google";
import { redirect } from "next/navigation";

export async function GET() {
  redirect(getAuthUrl());
}
