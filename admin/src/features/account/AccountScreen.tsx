import { Settings as SettingsIcon, ShieldCheck, UserRound } from "lucide-react";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Skeleton } from "@/components/Skeleton";
import { ROLE_LABEL } from "@/components/Topbar";
import { usePermissions } from "@/hooks/usePermissions";

export function AccountScreen() {
  const { me } = usePermissions();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-ink">
          <UserRound className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="text-sm font-semibold">Profil</h2>
        </div>
        {me ? (
          <div className="flex items-center gap-3">
            <Avatar seed={me.avatarSeed} name={me.name} size={48} />
            <div>
              <p className="font-semibold text-ink">{me.name}</p>
              {me.email && <p className="text-sm text-ink/60">{me.email}</p>}
              <p className="tabular text-sm text-ink/60">{me.phone}</p>
              <Badge tone="accent" className="mt-2">
                {ROLE_LABEL[me.role]}
              </Badge>
            </div>
          </div>
        ) : (
          <Skeleton className="h-16 w-full" />
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-ink">
          <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="text-sm font-semibold">Xavfsizlik</h2>
        </div>
        <p className="text-sm text-ink/60">
          Kirish ikki bosqichli tasdiqlash bilan himoyalangan (email va telefon kodlari; operatorlar uchun faqat telefon kodi). Tarif
          va hamyon tuzatishlari ikkinchi admin tasdiqlashini talab qiladi. Harakatsizlikdan 15 daqiqadan so'ng tizimdan avtomatik
          chiqiladi.
        </p>
      </Card>

      <Card className="space-y-3 lg:col-span-2">
        <div className="flex items-center gap-2 text-ink">
          <SettingsIcon className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="text-sm font-semibold">Demo rejimi</h2>
        </div>
        <p className="text-sm text-ink/60">
          Bu ilova to'liq demo rejimida ishlaydi — barcha ma'lumotlar brauzeringizda saqlanadi, haqiqiy backendga ulanish yo'q. Chap
          pastdagi demo paneli orqali bazani tiklashingiz, turli stsenariylarni sinab ko'rishingiz va boshqa rol sifatida kirishingiz
          mumkin.
        </p>
      </Card>
    </div>
  );
}
