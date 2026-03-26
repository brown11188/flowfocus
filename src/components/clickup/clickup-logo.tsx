export function ClickUpLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <path d="M4.53 21.4L8.2 18.4c1.95 2.3 3.9 3.46 7.8 3.46s5.85-1.16 7.8-3.46l3.67 3c-2.73 3.2-6.4 4.87-11.47 4.87S7.26 24.6 4.53 21.4z" fill="#7B68EE"/>
      <path d="M4 11.2l3.78 2.87C9.9 11.5 12.7 10.1 16 10.1s6.1 1.4 8.22 3.97L28 11.2C25.13 7.7 20.9 5.67 16 5.67S6.87 7.7 4 11.2z" fill="#FF79C6"/>
    </svg>
  );
}
