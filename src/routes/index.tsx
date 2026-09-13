import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { JoinForm } from "@/components/join-form";
import { loadProfile } from "@/lib/profile";

export const Route = createFileRoute("/")({ component: Gate });

function Gate() {
  const nav = useNavigate();
  useEffect(() => {
    if (loadProfile()) void nav({ to: "/feed", replace: true });
  }, [nav]);
  return <JoinForm />;
}
