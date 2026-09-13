import { EmailCodeForm } from "@/components/email-code-form";
import { requestCampusCode, verifyCampusCode } from "@/lib/campus";
import { schoolFromEmail } from "@/lib/school";

export function CampusVerify({
  peerId,
  onVerified,
}: {
  peerId: string;
  onVerified: (info: { school: string; email: string; token: string }) => void;
}) {
  return (
    <EmailCodeForm
      label="School email"
      hint="We email a 6-digit code to your school address. Campus only shows people from that school."
      placeholder="you@university.edu"
      verifyLabel="Verify campus"
      validate={(email) =>
        schoolFromEmail(email) ? null : "Use a school .edu address, not Gmail or Yahoo."
      }
      send={(email) => requestCampusCode({ data: { email, peerId } })}
      verify={async (email, code) => {
        const res = await verifyCampusCode({ data: { email, peerId, code } });
        if (res.ok) onVerified({ school: res.school, email: res.email, token: res.token });
        return res;
      }}
    />
  );
}
