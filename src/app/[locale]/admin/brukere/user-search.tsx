"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

export function UserSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function apply(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="relative" aria-busy={pending}>
      <label htmlFor="user-search" className="sr-only">
        Søk etter bruker
      </label>
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#2F7938]"
      />
      <Input
        id="user-search"
        type="search"
        defaultValue={searchParams.get("q") ?? ""}
        placeholder="Søk på navn eller e-post"
        className="min-h-11 rounded-xl border-[#CFC9BD] bg-white pl-10 shadow-none focus-visible:border-[#2F7938] focus-visible:ring-[#2F7938]/20"
        onChange={(event) => {
          const value = event.target.value.trim();
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => apply(value), 300);
        }}
      />
    </div>
  );
}
