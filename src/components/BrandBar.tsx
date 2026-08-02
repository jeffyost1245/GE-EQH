// General Excavating masthead: the red GE mark over the light-to-dark
// gray sweep, closed by the hatched red rule the site uses under its
// hero. Kept slim — this is a field tool, and vertical space on a phone
// belongs to the numbers.

export default function BrandBar() {
  return (
    <>
      <div className="brand-bar">
        <span className="brand-mark">GE</span>
        <span className="brand-name">General Excavating</span>
      </div>
      <div className="brand-rule" />
    </>
  );
}
