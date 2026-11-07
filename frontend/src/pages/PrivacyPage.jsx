import { PageHeader } from "../components/Ui.jsx";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader eyebrow="OUR 911" title="Privacy overview" description="How this application treats account and health report information." />
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 shadow-sm sm:p-7">
        <p>Incident descriptions and optional contact details are available to the reporting user and authorized campus health staff. Aggregate Health Intelligence is restricted to staff and should not identify individual students.</p>
        <p>Guest emergency reports are stored for authorized staff review, but are not attached to an account and cannot be viewed or tracked by public visitors.</p>
        <p>Donor contact details are not public. They are disclosed only to the donor and authorized health personnel for coordination. Donor discovery is preliminary and is not medical compatibility advice.</p>
        <p>Do not include unnecessary sensitive medical or identity information in a report. OUR 911 is not an ambulance dispatch service.</p>
      </section>
    </main>
  );
}
