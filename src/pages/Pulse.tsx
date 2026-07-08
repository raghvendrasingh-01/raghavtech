/**
 * Portfolio route for Pulse. Pulse is a standalone Next.js app, so this page
 * embeds it full-screen — giving it the same internal-navigation feel as the
 * other project pages.
 *
 * Update PULSE_URL to the deployed URL (e.g. https://pulse.vercel.app) once
 * deployed; it defaults to the local dev server.
 */
const PULSE_URL = import.meta.env.VITE_PULSE_URL || "http://localhost:3000";

const Pulse = () => {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <iframe
        src={PULSE_URL}
        title="Pulse — AI Chief of Staff"
        className="h-full w-full border-0"
        allow="clipboard-write"
      />
    </div>
  );
};

export default Pulse;
