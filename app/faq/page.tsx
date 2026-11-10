const questions = [
  ["What is AbdlyAI?", "AbdlyAI is a membership platform for people who want to explore AI, connect with a focused community, and build new skills."],
  ["How do I join the community?", "Create an account, choose an available membership, and link your Discord account. Verified paid memberships receive the configured community role."],
  ["How are payments handled?", "Payments and recurring subscriptions are processed by Stripe. Membership access is granted from verified Stripe webhooks, not from a browser redirect."],
  ["Can I cancel a subscription?", "You can manage or cancel an active subscription through the Stripe billing portal from your member dashboard."],
  ["How do I apply for a position?", "Sign in and open Applications to see available positions and submit your answers. You can track each application from the same page."],
  ["How can I get help?", "Join the official Discord community and contact the AbdlyAI team there."],
];

export default function FAQPage() {
  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Questions, answered</p><h1>Good to <span className="accent">know.</span></h1><p>Quick answers to help you get started.</p></div><div className="faq-list">{questions.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>;
}
