// Generated: every lucide icon the app uses, re-exported with aria-hidden by
// default. lucide-react 0.462 renders bare <svg>s, so decorative icons were
// exposed to assistive tech; an icon given an aria-label stays announced.
import { createElement, forwardRef } from "react";
import * as L from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";

export type { LucideIcon, LucideProps };

function decorative(Icon: LucideIcon): LucideIcon {
  const Wrapped = forwardRef<SVGSVGElement, LucideProps>((props, ref) =>
    createElement(Icon, { "aria-hidden": props["aria-label"] ? undefined : true, ...props, ref })
  );
  Wrapped.displayName = Icon.displayName;
  return Wrapped as LucideIcon;
}

export const AlertTriangle = decorative(L.AlertTriangle);
export const Armchair = decorative(L.Armchair);
export const ArrowDownLeft = decorative(L.ArrowDownLeft);
export const ArrowLeft = decorative(L.ArrowLeft);
export const ArrowUpDown = decorative(L.ArrowUpDown);
export const ArrowUpRight = decorative(L.ArrowUpRight);
export const Baby = decorative(L.Baby);
export const Banknote = decorative(L.Banknote);
export const Bell = decorative(L.Bell);
export const Boxes = decorative(L.Boxes);
export const Car = decorative(L.Car);
export const Check = decorative(L.Check);
export const ChevronDown = decorative(L.ChevronDown);
export const ChevronLeft = decorative(L.ChevronLeft);
export const ChevronRight = decorative(L.ChevronRight);
export const Clock = decorative(L.Clock);
export const Clock3 = decorative(L.Clock3);
export const CreditCard = decorative(L.CreditCard);
export const FlaskConical = decorative(L.FlaskConical);
export const Gift = decorative(L.Gift);
export const Globe = decorative(L.Globe);
export const GripVertical = decorative(L.GripVertical);
export const Heart = decorative(L.Heart);
export const HelpCircle = decorative(L.HelpCircle);
export const History = decorative(L.History);
export const Home = decorative(L.Home);
export const Info = decorative(L.Info);
export const LifeBuoy = decorative(L.LifeBuoy);
export const Lightbulb = decorative(L.Lightbulb);
export const Loader2 = decorative(L.Loader2);
export const LocateFixed = decorative(L.LocateFixed);
export const Lock = decorative(L.Lock);
export const LogOut = decorative(L.LogOut);
export const Luggage = decorative(L.Luggage);
export const Mail = decorative(L.Mail);
export const Map = decorative(L.Map);
export const MapPin = decorative(L.MapPin);
export const Megaphone = decorative(L.Megaphone);
export const Menu = decorative(L.Menu);
export const MessageCircle = decorative(L.MessageCircle);
export const Minus = decorative(L.Minus);
export const Moon = decorative(L.Moon);
export const Navigation = decorative(L.Navigation);
export const Package = decorative(L.Package);
export const PackageOpen = decorative(L.PackageOpen);
export const PartyPopper = decorative(L.PartyPopper);
export const Pencil = decorative(L.Pencil);
export const Phone = decorative(L.Phone);
export const Plus = decorative(L.Plus);
export const RotateCcw = decorative(L.RotateCcw);
export const RotateCw = decorative(L.RotateCw);
export const Search = decorative(L.Search);
export const SearchX = decorative(L.SearchX);
export const Send = decorative(L.Send);
export const Settings = decorative(L.Settings);
export const ShieldCheck = decorative(L.ShieldCheck);
export const Star = decorative(L.Star);
export const Sun = decorative(L.Sun);
export const Tag = decorative(L.Tag);
export const Trash2 = decorative(L.Trash2);
export const User = decorative(L.User);
export const UserPlus = decorative(L.UserPlus);
export const Wallet = decorative(L.Wallet);
export const WifiOff = decorative(L.WifiOff);
export const X = decorative(L.X);
