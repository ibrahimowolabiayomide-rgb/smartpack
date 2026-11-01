/**
 * A permanent, truthful statement until authentication exists (Phase 3): this area is open to
 * anyone who can reach the address, and it holds no company data. Remove it when sign-in is real.
 */
export function PreviewBanner() {
  return (
    <p className="border-b border-warn-text/30 bg-warn-bg px-4 py-2 text-meta text-warn-text sm:px-6 lg:px-10">
      <strong className="font-semibold">Development preview.</strong> Sign-in is not enabled, so
      this area is open and contains no company data.
    </p>
  );
}
