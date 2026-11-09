import { useEffect, useState } from "react";
import { Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/api/client";
import type { AdminUser } from "@/api/types";

export function SettingsScreen() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    api.getCurrentAdmin().then(setAdmin).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-2 gap-6">
      <Card className="space-y-4">
        <p className="text-sm font-semibold text-ink">Profil</p>
        {admin ? (
          <div className="flex items-center gap-3">
            <Avatar seed={admin.avatarSeed} name={admin.name} size={48} />
            <div>
              <p className="font-semibold text-ink">{admin.name}</p>
              <p className="text-xs text-ink/50">{admin.email}</p>
              <Badge tone="accent" className="mt-1">
                {admin.role}
              </Badge>
            </div>
          </div>
        ) : (
          <Skeleton className="h-12 w-full" />
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-ink">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold">Xavfsizlik</p>
        </div>
        <p className="text-sm text-ink/60">
          Kirish ikki bosqichli tasdiqlash (2FA) bilan himoyalangan. Tarif o'zgarishlari ikkinchi admin tasdiqlashini talab qiladi.
        </p>
      </Card>

      <Card className="col-span-2 space-y-3">
        <div className="flex items-center gap-2 text-ink">
          <SettingsIcon className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold">Demo rejimi</p>
        </div>
        <p className="text-sm text-ink/60">
          Bu ilova to'liq demo rejimida ishlaydi — barcha ma'lumotlar brauzeringizda (localStorage) saqlanadi, haqiqiy backendga ulanish
          yo'q. O'ng pastdagi demo paneli orqali bazani tiklashingiz va turli stsenariylarni (sekin internet, xatoliklar va h.k.) sinab
          ko'rishingiz mumkin.
        </p>
      </Card>
    </div>
  );
}
