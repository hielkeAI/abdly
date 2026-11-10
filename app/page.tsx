import Link from "next/link";
import Image from "next/image";

const features = [
  { icon: "✳", title: "AI, with intention", body: "A focused set of tools and resources for curious minds and ambitious builders." },
  { icon: "◈", title: "A real community", body: "Meet people who share ideas, learn in public, and make progress together." },
  { icon: "⌁", title: "More room to build", body: "A member experience designed to turn momentum into meaningful work." },
];

export default function HomePage() {
  return <>
    <section className="hero">
      <div>
        <p className="eyebrow">A new kind of AI community</p>
        <h1>Build your edge.<br /><span className="accent">Make it matter.</span></h1>
        <p className="hero-copy">A premium space for people who want to do more with AI. Find your tools, your people, and your next idea—all in one place.</p>
        <div className="hero-actions"><Link href="/pricing" className="button">Explore membership <span>↗</span></Link><Link href="/#product" className="subtle-link">Discover AbdlyAI <span>↓</span></Link></div>
        <div className="hero-note"><div className="avatar-stack"><span>A</span><span>D</span><span>AI</span></div><span>Made for people building what&apos;s next</span></div>
      </div>
      <div className="hero-art" aria-label="AbdlyAI crowned logo with Discord symbol">
        <div className="hero-logo-halo" />
        <Image className="hero-logo" src="/logo.png" width={560} height={560} priority alt="AbdlyAI logo: crowned letter A with a glowing purple orbit and Discord symbol" />
        <div className="glass-card one"><small><span className="pulse" /> YOUR NEXT CHAPTER</small><strong>Starts here.</strong><small>Explore the community →</small></div>
        <div className="glass-card two"><small>ABDLYAI MEMBER SPACE</small><strong>Ideas in motion <span className="accent">✳</span></strong><small>Tools · People · Possibility</small></div>
      </div>
    </section>
    <section className="section" id="product">
      <div className="section-heading"><div><p className="eyebrow">More than a membership</p><h2>Everything you need<br />to move forward.</h2></div><p>Less noise. More signal. AbdlyAI brings the right resources and people together so you can focus on what you want to create.</p></div>
      <div className="feature-grid">{features.map((feature) => <article className="feature-card" key={feature.title}><div className="feature-icon">{feature.icon}</div><h3>{feature.title}</h3><p>{feature.body}</p></article>)}</div>
    </section>
    <section className="feature-band"><div><p className="eyebrow">Your place to grow</p><h2>Start with curiosity.<br /><span className="accent">Stay for what&apos;s possible.</span></h2><p>Explore membership, connect your Discord, and find your people.</p></div><Link className="button" href="/pricing">See membership options <span>↗</span></Link></section>
  </>;
}
