import { Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Skeleton } from "@/components/Skeleton";
import { ROLE_LABEL } from "@/components/Topbar";
import { usePermissions } from "@/hooks/usePermissions";

export function AccountScreen() {
  const { me } = usePermissions();

  return (
    <div className="grid grid-cols-2 gap-6">
      <Card className="space-y-4">
        <p className="text-sm font-semibold text-ink">Profil</p>
        {me ? (
          <div className="flex items-center gap-3">
            <Avatar seed={me.avatarSeed} name={me.name} size={48} />
            <div>
              <p className="font-semibold text-ink">{me.name}</p>
              {me.email && <p className="text-xs text-ink/50">{me.email}</p>}
              <p className="text-xs text-ink/50">{me.phone}</p>
              <Badge tone="accent" className="mt-1">
                {ROLE_LABEL[me.role]}
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
          Kirish ikki bosqichli tasdiqlash bilan himoyalangan (email va telefon kodlari; operatorlar uchun faqat telefon kodi). Tarif
          va hamyon tuzatishlari ikkinchi admin tasdiqlashini talab qiladi. Harakatsizlikdan 15 daqiqadan so'ng tizimdan avtomatik
          chiqiladi.
        </p>
      </Card>

      <Card className="col-span-2 space-y-3">
        <div className="flex items-center gap-2 text-ink">
          <SettingsIcon className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold">Demo rejimi</p>
        </div>
        <p className="text-sm text-ink/60">
          Bu ilova to'liq demo rejimida ishlaydi — barcha ma'lumotlar brauzeringizda saqlanadi, haqiqiy backendga ulanish yo'q. O'ng
          pastdagi demo paneli orqali bazani tiklashingiz, turli stsenariylarni sinab ko'rishingiz va boshqa rol sifatida kirishingiz
          mumkin.
        </p>
      </Card>
    </div>
  );
}
