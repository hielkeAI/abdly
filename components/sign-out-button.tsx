"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const [error, setError] = useState("");
  const router = useRouter();
  async function signOut() {
    const { error: authError } = await createClient().auth.signOut();
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }
  return <div><button className="button button-quiet" onClick={signOut}>Sign out</button>{error && <p className="form-message">{error}</p>}</div>;
}
