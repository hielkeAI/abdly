import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return <section className="auth-shell"><div className="auth-aside"><p className="eyebrow">Make something happen</p><h1>Good ideas<br /><span className="accent">start somewhere.</span></h1><p>Create your AbdlyAI account, connect with your community, and find your momentum.</p><Link className="subtle-link" href="/pricing">Explore membership options <span>↗</span></Link></div><div className="auth-card"><h2>Create your account</h2><p>It only takes a moment to get started.</p><AuthForm mode="register" /></div></section>;
}
