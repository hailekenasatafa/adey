/**
 * Ambient "breathing" background for the home hero: four large, heavily blurred orbs in the brand
 * green and the Adey Abeba gold that slowly drift and pulse. Pure CSS (transform-only keyframes in
 * globals.css), so it runs on the GPU and costs no JavaScript. Hidden from assistive tech; frozen in
 * place when the visitor prefers reduced motion.
 */
export function BreathingBackground() {
  return (
    <div aria-hidden className="breathing-bg">
      <span className="breathing-orb breathing-orb--green" />
      <span className="breathing-orb breathing-orb--gold" />
      <span className="breathing-orb breathing-orb--deep" />
      <span className="breathing-orb breathing-orb--muted-gold" />
      <span className="breathing-veil" />
    </div>
  );
}
