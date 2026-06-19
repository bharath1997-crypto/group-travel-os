"use client";

type ExplorerDestinationCardProps = {
  name: string;
  count: string;
  image: string;
  onClick?: () => void;
};

export function ExplorerDestinationCard({
  name,
  count,
  image,
  onClick,
}: ExplorerDestinationCardProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-[180px] h-[220px] rounded-2xl overflow-hidden shrink-0 group shadow-md text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h4 className="font-bold text-white text-base leading-tight">{name}</h4>
        <p className="text-xs text-slate-300 mt-0.5 font-medium">{count}</p>
      </div>
    </button>
  );
}
