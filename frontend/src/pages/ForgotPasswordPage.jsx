import { Link } from "react-router-dom";
import { Notice, PageHeader } from "../components/Ui.jsx";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Account access" title="Password reset" description="Keep account recovery secure and transparent." />
      <Notice kind="warning">
        Email-based password reset is not configured for this application, so no reset email has been sent. Please contact your OUR 911 administrator to restore access.
      </Notice>
      <Link className="mt-5 inline-flex rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-900" to="/login">Return to sign in</Link>
    </main>
  );
}
