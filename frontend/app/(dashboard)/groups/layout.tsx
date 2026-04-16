import type { ReactNode } from "react";

import { GroupsSplitLayout } from "@/components/GroupsSplitLayout";

export default function GroupsLayout({ children }: { children: ReactNode }) {
  return <GroupsSplitLayout>{children}</GroupsSplitLayout>;
}
