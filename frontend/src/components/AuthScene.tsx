/**
 * Full-screen flowing-aurora background for the loading splash
 * (the "正在确认登录状态" screen). Pure decoration (aria-hidden);
 * position: fixed (see auth-scene.css), sits behind .auth-splash-content.
 */
export function AuthScene() {
  return <div className="auth-scene" aria-hidden="true" />;
}
