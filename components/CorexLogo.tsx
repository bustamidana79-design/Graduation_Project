import Image from "next/image";

type CorexLogoProps = {
  className?: string;
  imageClassName?: string;
};

export default function CorexLogo({ className = "", imageClassName = "" }: CorexLogoProps) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} aria-label="CoreX">
      <Image
        src="/corex-logo.png"
        alt="CoreX logo"
        width={413}
        height={127}
        className={`h-full w-full object-contain ${imageClassName}`}
      />
    </span>
  );
}
