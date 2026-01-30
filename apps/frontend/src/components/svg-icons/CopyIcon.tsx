// Reusable copy/clipboard icon component for copy-to-clipboard actions.
type CopyIconProps = {
  size?: number;
  className?: string;
};

export default function CopyIcon({ size = 16, className }: CopyIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5.75 4.75H10.25V2.75C10.25 2.19772 9.80228 1.75 9.25 1.75H2.75C2.19772 1.75 1.75 2.19772 1.75 2.75V9.25C1.75 9.80228 2.19772 10.25 2.75 10.25H5.75V4.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 5.75C5.75 5.19772 6.19772 4.75 6.75 4.75H13.25C13.8023 4.75 14.25 5.19772 14.25 5.75V13.25C14.25 13.8023 13.8023 14.25 13.25 14.25H6.75C6.19772 14.25 5.75 13.8023 5.75 13.25V5.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
