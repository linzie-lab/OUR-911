export default function BrandMark({ compact = false }) {
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      <img
        alt=""
        className={compact ? "h-9 w-9 object-contain" : "h-11 w-11 object-contain"}
        height="44"
        src="/images/our911-logo.png"
        width="44"
      />
      <span className="font-bold tracking-tight text-slate-950">OUR 911</span>
    </span>
  );
}
