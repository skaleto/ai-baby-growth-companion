/**
 * Full-screen lively background for the consent / auth screens.
 * Pure decoration (aria-hidden). Rendered as a sibling BEFORE the glass panel
 * so the panel's backdrop-filter can blur it. Position: fixed (see auth-scene.css).
 * The brand mascot lives in the crisp foreground lockup (see AuthBrand), not here.
 */
export function AuthScene() {
  return (
    <div className="auth-scene" aria-hidden="true">
      <span className="auth-scene-blob blob-a" />
      <span className="auth-scene-blob blob-b" />
      <span className="auth-scene-blob blob-c" />
      <span className="auth-scene-star star-a" />
      <span className="auth-scene-star star-b" />
      <span className="auth-scene-star star-c" />
    </div>
  );
}
