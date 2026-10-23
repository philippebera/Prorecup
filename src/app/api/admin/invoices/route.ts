import { api, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { issuePendingInvoices } from "@/lib/invoices";

export const POST = api(async () => {
  await requireApiUser("ADMIN");
  return ok(await issuePendingInvoices());
});
