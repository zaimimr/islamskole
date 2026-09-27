"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PortalTab = "barn" | "klasse";

function rememberTab(value: unknown) {
  const url = new URL(window.location.href);
  if (value === "klasse") url.searchParams.set("fane", "klasse");
  else url.searchParams.delete("fane");
  window.history.replaceState(null, "", url);
}

export function PortalTabs({
  defaultTab,
  parentLabel,
  teacherLabel,
  parent,
  teacher,
}: {
  defaultTab: PortalTab;
  parentLabel: string;
  teacherLabel: string;
  parent: React.ReactNode;
  teacher: React.ReactNode;
}) {
  return (
    <Tabs defaultValue={defaultTab} onValueChange={rememberTab} className="gap-6">
      <TabsList className="grid h-auto w-full grid-cols-2 rounded-full p-1 ring-1 ring-foreground/8 group-data-horizontal/tabs:h-auto sm:w-fit">
        <TabsTrigger
          value="barn"
          className="min-h-11 rounded-full px-5 text-base font-semibold data-active:bg-card data-active:text-brand-green-dark"
        >
          {parentLabel}
        </TabsTrigger>
        <TabsTrigger
          value="klasse"
          className="min-h-11 rounded-full px-5 text-base font-semibold data-active:bg-card data-active:text-brand-green-dark"
        >
          {teacherLabel}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="barn" className="text-base">
        {parent}
      </TabsContent>
      <TabsContent value="klasse" className="text-base">
        {teacher}
      </TabsContent>
    </Tabs>
  );
}
