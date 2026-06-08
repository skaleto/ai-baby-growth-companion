import splashMark from "../assets/splash/splash-mark-cutout.png";

/**
 * Foreground brand lockup for the consent / auth screens: the watercolor
 * splash illustration + the 小宝记 wordmark + a slogan. Sits above the glass
 * card (crisp, not blurred) to give a clear brand memory point.
 */
export function AuthBrand() {
  return (
    <div className="auth-brand">
      <img className="auth-brand-mark" src={splashMark} alt="" />
      <strong className="auth-brand-name">小宝记</strong>
      <span className="auth-brand-slogan">陪你记录宝宝的成长</span>
    </div>
  );
}
