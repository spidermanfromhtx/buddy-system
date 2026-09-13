import { createFileRoute } from "@tanstack/react-router";
import { JoinForm } from "@/components/join-form";

export const Route = createFileRoute("/join")({ component: JoinForm });
