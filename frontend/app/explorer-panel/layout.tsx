/**
 * Minimal layout for explorer tool pages (safety, currency).
 * These pages are loaded inside an iframe by ExplorerNewsReaderModal.
 * They intentionally bypass the dashboard layout (no sidebar).
 */
export default function ExplorerPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
