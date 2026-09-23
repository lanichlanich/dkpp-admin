import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PublicUser } from "@/lib/db";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function UserMenu({ user }: { user: PublicUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" aria-label={`Buka menu akun ${user.name}`} className="h-11 gap-3 px-2 sm:pr-3" />}>
        <Avatar className="size-8"><AvatarFallback className="bg-indigo-100 text-xs font-semibold text-indigo-700">{initials(user.name)}</AvatarFallback></Avatar>
        <div className="hidden min-w-0 text-left sm:block"><p className="max-w-36 truncate text-sm font-medium text-zinc-800">{user.name}</p><p className="max-w-36 truncate text-xs text-zinc-500">@{user.username}</p></div>
        <ChevronDown aria-hidden="true" className="hidden size-4 shrink-0 text-zinc-400 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal"><p className="font-medium text-zinc-900">{user.name}</p><p className="mt-0.5 truncate text-xs text-zinc-500">{user.email}</p></DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard/profile" />}><UserRound />Profil saya</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/profile#security" />}><Settings />Keamanan akun</DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}><DropdownMenuItem nativeButton render={<button type="submit" className="w-full text-red-600" />}><LogOut />Keluar</DropdownMenuItem></form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
