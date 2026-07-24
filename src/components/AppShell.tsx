import Nav from "./Nav";
import SyncStatus from "./SyncStatus";

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <SyncStatus />
      <h1>{title}</h1>
      {children}
      <Nav />
    </div>
  );
}
