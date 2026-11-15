// The single icon set (lucide, 2px stroke everywhere). Decorative by default:
// an icon given an aria-label stays announced.
import { createElement, forwardRef } from "react";
import * as L from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";

export type { LucideIcon };
export const ICON_STROKE = 2;

function wrap(Icon: LucideIcon): LucideIcon {
  const W = forwardRef<SVGSVGElement, LucideProps>((props, ref) =>
    createElement(Icon, {
      "aria-hidden": props["aria-label"] ? undefined : true,
      strokeWidth: ICON_STROKE,
      ...props,
      ref,
    })
  );
  W.displayName = Icon.displayName;
  return W as LucideIcon;
}

export const Accessibility = wrap(L.Accessibility);
export const AlertTriangle = wrap(L.AlertTriangle);
export const Armchair = wrap(L.Armchair);
export const ArrowDown = wrap(L.ArrowDown);
export const ArrowDownLeft = wrap(L.ArrowDownLeft);
export const ArrowLeft = wrap(L.ArrowLeft);
export const ArrowLeftRight = wrap(L.ArrowLeftRight);
export const ArrowRight = wrap(L.ArrowRight);
export const ArrowUpRight = wrap(L.ArrowUpRight);
export const Baby = wrap(L.Baby);
export const Banknote = wrap(L.Banknote);
export const Bell = wrap(L.Bell);
export const BellOff = wrap(L.BellOff);
export const BellRing = wrap(L.BellRing);
export const Briefcase = wrap(L.Briefcase);
export const Calendar = wrap(L.Calendar);
export const CalendarDays = wrap(L.CalendarDays);
export const Camera = wrap(L.Camera);
export const Car = wrap(L.Car);
export const Check = wrap(L.Check);
export const ChevronDown = wrap(L.ChevronDown);
export const ChevronLeft = wrap(L.ChevronLeft);
export const ChevronRight = wrap(L.ChevronRight);
export const CircleDot = wrap(L.CircleDot);
export const Clock = wrap(L.Clock);
export const CreditCard = wrap(L.CreditCard);
export const FileText = wrap(L.FileText);
export const FlaskConical = wrap(L.FlaskConical);
export const Gift = wrap(L.Gift);
export const Globe = wrap(L.Globe);
export const HandCoins = wrap(L.HandCoins);
export const HelpCircle = wrap(L.HelpCircle);
export const History = wrap(L.History);
export const Home = wrap(L.Home);
export const Hourglass = wrap(L.Hourglass);
export const IdCard = wrap(L.IdCard);
export const Inbox = wrap(L.Inbox);
export const Info = wrap(L.Info);
export const KeyRound = wrap(L.KeyRound);
export const LifeBuoy = wrap(L.LifeBuoy);
export const ListChecks = wrap(L.ListChecks);
export const LogOut = wrap(L.LogOut);
export const Luggage = wrap(L.Luggage);
export const MapPin = wrap(L.MapPin);
export const Megaphone = wrap(L.Megaphone);
export const MessageCircle = wrap(L.MessageCircle);
export const MessageSquareText = wrap(L.MessageSquareText);
export const Moon = wrap(L.Moon);
export const Navigation = wrap(L.Navigation);
export const Package = wrap(L.Package);
export const PawPrint = wrap(L.PawPrint);
export const Pencil = wrap(L.Pencil);
export const Percent = wrap(L.Percent);
export const Phone = wrap(L.Phone);
export const Plus = wrap(L.Plus);
export const Power = wrap(L.Power);
export const Receipt = wrap(L.Receipt);
export const RefreshCw = wrap(L.RefreshCw);
export const RotateCcw = wrap(L.RotateCcw);
export const Route = wrap(L.Route);
export const Ruler = wrap(L.Ruler);
export const Search = wrap(L.Search);
export const SearchX = wrap(L.SearchX);
export const Send = wrap(L.Send);
export const ShieldCheck = wrap(L.ShieldCheck);
export const SlidersHorizontal = wrap(L.SlidersHorizontal);
export const Star = wrap(L.Star);
export const Sun = wrap(L.Sun);
export const Timer = wrap(L.Timer);
export const Trash2 = wrap(L.Trash2);
export const Trophy = wrap(L.Trophy);
export const Truck = wrap(L.Truck);
export const Upload = wrap(L.Upload);
export const User = wrap(L.User);
export const UserPlus = wrap(L.UserPlus);
export const UserRound = wrap(L.UserRound);
export const UserX = wrap(L.UserX);
export const Users = wrap(L.Users);
export const Wallet = wrap(L.Wallet);
export const WifiOff = wrap(L.WifiOff);
export const X = wrap(L.X);
export const Zap = wrap(L.Zap);
