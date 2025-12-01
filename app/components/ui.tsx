export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-slate-800 rounded-ds-lg shadow-ds-card p-ds-md ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-ds-h3 font-semibold mb-3 text-slate-900 dark:text-slate-100">{children}</h2>;
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-ds-md bg-mint-500 text-white hover:bg-mint-600 disabled:opacity-50 transition-colors duration-200 font-medium ${props.className || ""}`}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-slate-200 dark:border-slate-600 rounded-ds-md px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all duration-200 ${props.className || ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border border-slate-200 dark:border-slate-600 rounded-ds-md px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all duration-200 ${props.className || ""}`}
    />
  );
}

export function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "blue" | "amber" | "mint" }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300",
    green: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    blue: "bg-pale-blue text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    amber: "bg-pale-yellow text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    mint: "bg-mint-100 text-mint-700 dark:bg-mint-900 dark:text-mint-300",
  };
  return <span className={`inline-block text-ds-tiny px-2 py-1 rounded-ds-full ${tones[tone]}`}>{children}</span>;
}
