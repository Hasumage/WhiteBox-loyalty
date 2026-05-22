"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminListCompanyUsers, type AdminCompanyUser } from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";

export default function AdminCompaniesPage() {
  const { t } = useI18n("ru");
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<AdminCompanyUser[]>([]);

  async function load() {
    setCompanies(await adminListCompanyUsers(query));
  }

  useEffect(() => {
    let ignore = false;
    void (async () => {
      const rows = await adminListCompanyUsers();
      if (!ignore) setCompanies(rows);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("admin.companies.title")}</h1>
      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-base">{t("admin.companies.directoryTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder={t("admin.companies.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="secondary" onClick={() => void load()} className="sm:min-w-28">
              {t("admin.companies.search")}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2">{t("admin.companies.account")}</th>
                  <th>{t("admin.companies.email")}</th>
                  <th>{t("admin.companies.uuid")}</th>
                  <th>{t("admin.companies.status")}</th>
                  <th>{t("admin.companies.workMode")}</th>
                  <th>{t("admin.companies.companyProfile")}</th>
                  <th className="text-right">{t("admin.companies.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.uuid} className="border-t border-white/10">
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="whitespace-nowrap">{c.email}</td>
                    <td className="font-mono text-xs">{c.uuid}</td>
                    <td>{c.accountStatus}</td>
                    <td>
                      {c.managedCompany?.operatesOnline ? (
                        <Badge variant="outline" className="gap-1">
                          <Globe2 className="h-3 w-3" />
                          {t("admin.companies.online")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <MapPin className="h-3 w-3" />
                          {t("admin.companies.locations")}
                        </Badge>
                      )}
                    </td>
                    <td>{c.managedCompany ? c.managedCompany.name : t("admin.companies.notConfigured")}</td>
                    <td className="text-right">
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/admin/companies/${c.uuid}`}>{t("admin.companies.manage")}</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {companies.length === 0 && (
            <p className="pt-4 text-sm text-muted-foreground">{t("admin.companies.empty")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
