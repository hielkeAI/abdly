"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const links = [
  ["Product", "/#product"],
  ["Pricing", "/pricing"],
  ["Applications", "/applications"],
  ["Reviews", "/reviews"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="AbdlyAI home"><Image className="brand-logo" src="/logo.png" width={42} height={42} alt="" priority /> <span>AbdlyAI</span></Link>
      <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>{open ? "×" : "☰"}</button>
      <nav className={open ? "nav-links nav-open" : "nav-links"}>
        {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
      </nav>
      <div className="header-actions"><Link href="/login" className="login-link">Log in</Link><Link href="/register" className="button button-small">Get started <span>↗</span></Link></div>
    </header>
  );
}
