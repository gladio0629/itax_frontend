import { FlaskConical, ShieldCheck } from "lucide-react";
import { Card, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Skeleton } from "@/components/Skeleton";
import { ROLE_LABEL } from "@/lib/roles";
import { usePermissions } from "@/hooks/usePermissions";
import { DEMO_MODE } from "@/config";
import { PageHeader } from "@/layouts/PageHeader";

/** Simple profile page, opened from the user menu. */
export function AccountScreen() {
  const { me } = usePermissions();

  return (
    <>
      <PageHeader title="Profil" subtitle="Hisobingiz va kirish sozlamalari" />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardTitle>Profil</CardTitle>
          {me ? (
            <div className="flex items-center gap-4">
              <Avatar seed={me.avatarSeed} name={me.name} size={56} />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-base font-extrabold text-ink">{me.name}</p>
                {me.email && <p className="truncate text-sm font-semibold text-muted">{me.email}</p>}
                {me.phone && <p className="tabular text-sm font-semibold text-muted">{me.phone}</p>}
                <Badge tone="neutral" dot={false} className="mt-1 self-start">
                  {ROLE_LABEL[me.role]}
                </Badge>
              </div>
            </div>
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-[18px] w-[18px] text-green-text" aria-hidden /> Xavfsizlik
            </span>
          </CardTitle>
          <p className="text-sm font-medium leading-[21px] text-muted">
            Kirish ikki bosqichli tasdiqlash bilan himoyalangan (email va telefon kodlari; operatorlar uchun faqat telefon kodi). Tarif o'zgarishi va
            tuzatish yozuvi ikki bosqichda saqlanadi: "Saqlash", keyin "Tasdiqlash". Harakatsizlikdan 15 daqiqadan so'ng tizimdan avtomatik chiqiladi.
          </p>
        </Card>

        {DEMO_MODE && (
          <Card className="flex flex-col gap-3 lg:col-span-2">
            <CardTitle>
              <span className="flex items-center gap-2">
                <FlaskConical className="h-[18px] w-[18px] text-green-text" aria-hidden /> Sinov rejimi
              </span>
            </CardTitle>
            <p className="text-sm font-medium leading-[21px] text-muted">
              Ilova namunaviy ma'lumotlar bilan ishlayapti — barcha ma'lumotlar brauzeringizda saqlanadi, serverga ulanish yo'q. Chap pastdagi sinov
              paneli orqali bazani tiklashingiz, turli stsenariylarni sinab ko'rishingiz va boshqa rol sifatida kirishingiz mumkin.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
