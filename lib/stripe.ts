import Stripe from "stripe";
import { requiredEnv } from "@/lib/config";

let stripe: Stripe | undefined;

export function getStripe() {
  if (!stripe) stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
  return stripe;
}
