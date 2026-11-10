import Link from "next/link";

export function DashboardNav({ role }: { role: "customer" | "owner" | "supervisor" }) {
  const links = role === "owner"
    ? [["Overview", "/owner"], ["Customers", "/owner#customers"], ["Applications", "/owner#applications"], ["Reviews", "/owner#reviews"], ["Plans", "/owner#plans"], ["Supervisors", "/owner#supervisors"], ["Discord roles", "/owner#roles"]]
    : role === "supervisor"
      ? [["Overview", "/supervisor"], ["Customers", "/supervisor#customers"], ["Applications", "/supervisor#applications"], ["Reviews", "/supervisor#reviews"]]
      : [["Overview", "/dashboard"], ["Plans", "/pricing"], ["Applications", "/applications"], ["Reviews", "/reviews"]];
  return <aside className="sidebar">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}<Link href="/dashboard#accounts">Connected accounts</Link></aside>;
}
